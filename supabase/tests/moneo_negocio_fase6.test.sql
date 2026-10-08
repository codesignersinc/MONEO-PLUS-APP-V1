-- ============================================================
-- Pruebas de MONEO NEGOCIO, fase 6 (migración 20261021120000).
-- Ejecutar SOLO contra staging, como postgres. Termina en ROLLBACK.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);
CREATE FUNCTION moneo_test.ok(cond boolean, label text, detail text DEFAULT '') RETURNS void
LANGUAGE sql AS $$ INSERT INTO moneo_test.results (ok, label, detail) VALUES (coalesce(cond, false), label, detail) $$;
CREATE FUNCTION moneo_test.as_user(u uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
CREATE FUNCTION moneo_test.plan(u uuid, code text, st text, ends timestamptz) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.user_entitlements (user_id, plan_code, status, current_period_end)
  VALUES (u, code, st, ends)
  ON CONFLICT (user_id) DO UPDATE SET plan_code = excluded.plan_code, status = excluded.status,
    current_period_end = excluded.current_period_end
$$;
-- Creates a business as the user (authenticated role, like the app); true if it was created.
CREATE FUNCTION moneo_test.try_business(u uuid, nm text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM moneo_test.as_user(u);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.businesses (owner_id, name) VALUES (u, nm);
  RESET ROLE;
  RETURN true;
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  RETURN false;
END $$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-0000000006a1';
  biz uuid; acc_b uuid; acc_p uuid; emp uuid;
  pago uuid; pago_m uuid; nxt record; n int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'f6@test.local');
  INSERT INTO public.user_profiles (id, email) VALUES (ua, 'f6@test.local') ON CONFLICT (id) DO NOTHING;

  -- 1. Only paid MONEO PLUS creates a business.
  DELETE FROM public.user_entitlements WHERE user_id = ua;
  PERFORM moneo_test.ok(NOT moneo_test.try_business(ua, 'Sin plan'), 'MONEO FREE no crea negocio');
  PERFORM moneo_test.plan(ua, 'free_trial', 'trialing', now() + interval '5 days');
  PERFORM moneo_test.ok(NOT moneo_test.try_business(ua, 'Prueba'), 'la prueba gratis no crea negocio');
  PERFORM moneo_test.plan(ua, 'plus_monthly', 'active', now() - interval '1 day');
  PERFORM moneo_test.ok(NOT moneo_test.try_business(ua, 'Vencido'), 'un plan vencido no crea negocio');
  PERFORM moneo_test.plan(ua, 'plus_lifetime', 'active', NULL);
  PERFORM moneo_test.ok(moneo_test.try_business(ua, 'De por vida'), 'plan de por vida crea negocio');
  PERFORM moneo_test.plan(ua, 'pass_3m', 'active', now() + interval '80 days');
  PERFORM moneo_test.ok(moneo_test.try_business(ua, 'Pase'), 'pase prepagado crea negocio');
  PERFORM moneo_test.plan(ua, 'plus_monthly', 'active', now() + interval '20 days');
  PERFORM moneo_test.ok(moneo_test.try_business(ua, 'Mensual'), 'plan mensual vigente crea negocio');
  -- Existing businesses stay when the plan ends.
  PERFORM moneo_test.plan(ua, 'free_trial', 'trialing', now() + interval '5 days');
  SELECT count(*) INTO n FROM public.businesses WHERE owner_id = ua;
  PERFORM moneo_test.ok(n = 3, 'los negocios existentes se conservan', n::text);
  PERFORM moneo_test.ok(NOT has_function_privilege('authenticated', 'public.user_has_paid_plus(uuid)', 'EXECUTE'),
                        'user_has_paid_plus no se expone');
  PERFORM moneo_test.ok(public.user_has_plus(ua) AND NOT public.user_has_paid_plus(ua),
                        'la prueba es PLUS pero no PLUS pagado');

  -- 2. Weekly payments.
  PERFORM moneo_test.as_user(ua);
  SELECT id INTO biz FROM public.businesses WHERE owner_id = ua AND name = 'Mensual';
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency, business_id)
    VALUES (ua, 'Caja', 'efectivo', 1000, 'PEN', biz) RETURNING id INTO acc_b;
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency)
    VALUES (ua, 'Personal', 'banco', 1000, 'PEN') RETURNING id INTO acc_p;
  INSERT INTO public.business_parties (business_id, user_id, kind, name, usual_amount, frequency)
    VALUES (biz, ua, 'empleado', 'Luis', 1200, 'semanal') RETURNING id INTO emp;

  BEGIN
    INSERT INTO public.pagos (user_id, name, category, category_icon, amount, payment_date, notes, is_recurring, every_days)
      VALUES (ua, 'Suelto', 'Otros', 'tag', 10, '2026-10-02', '', false, 7);
    PERFORM moneo_test.ok(false, 'every_days exige pago recurrente');
  EXCEPTION WHEN check_violation THEN PERFORM moneo_test.ok(true, 'every_days exige pago recurrente');
  END;
  BEGIN
    INSERT INTO public.pagos (user_id, name, category, category_icon, amount, payment_date, notes, is_recurring, every_days)
      VALUES (ua, 'Raro', 'Otros', 'tag', 10, '2026-10-02', '', true, 10);
    PERFORM moneo_test.ok(false, 'every_days solo 7 o 14');
  EXCEPTION WHEN check_violation THEN PERFORM moneo_test.ok(true, 'every_days solo 7 o 14');
  END;

  INSERT INTO public.pagos (user_id, business_id, party_id, name, category, category_icon, amount, payment_date, notes,
                            is_recurring, payment_day, every_days)
    VALUES (ua, biz, emp, 'Sueldo Luis', 'Planilla', 'users', 300, '2026-10-30', '', true, 30, 7)
    RETURNING id INTO pago;
  PERFORM public.mark_pago_paid(pago, acc_b, NULL);
  SELECT * INTO nxt FROM public.pagos WHERE generated_from = pago;
  PERFORM moneo_test.ok(nxt.payment_date = '2026-11-06', 'semanal: siguiente pago 7 días después', nxt.payment_date);
  PERFORM moneo_test.ok(nxt.every_days = 7 AND nxt.business_id = biz AND nxt.party_id = emp AND nxt.status = 'pendiente',
                        'conserva frecuencia, negocio y empleado');
  PERFORM public.mark_pago_paid(nxt.id, acc_b, NULL);
  SELECT * INTO nxt FROM public.pagos WHERE generated_from = nxt.id;
  PERFORM moneo_test.ok(nxt.payment_date = '2026-11-13', 'y el siguiente, otra semana', nxt.payment_date);
  PERFORM moneo_test.ok((SELECT balance FROM public.accounts WHERE id = acc_b) = 400, 'cada pago mueve la caja una vez');

  -- Every two weeks, personal.
  INSERT INTO public.pagos (user_id, name, category, category_icon, amount, payment_date, notes, is_recurring, payment_day, every_days)
    VALUES (ua, 'Cada 14', 'Otros', 'tag', 50, '2026-12-25', '', true, 25, 14) RETURNING id INTO pago;
  PERFORM public.mark_pago_paid(pago, acc_p, NULL);
  SELECT * INTO nxt FROM public.pagos WHERE generated_from = pago;
  PERFORM moneo_test.ok(nxt.payment_date = '2027-01-08' AND nxt.business_id IS NULL,
                        'cada 14 días cruza el año y sigue personal', nxt.payment_date);

  -- Monthly payments are unchanged.
  INSERT INTO public.pagos (user_id, business_id, name, category, category_icon, amount, payment_date, notes, is_recurring, payment_day)
    VALUES (ua, biz, 'Alquiler', 'Alquiler del local', 'store', 100, '2026-01-31', '', true, 31) RETURNING id INTO pago_m;
  PERFORM public.mark_pago_paid(pago_m, acc_b, NULL);
  SELECT * INTO nxt FROM public.pagos WHERE generated_from = pago_m;
  PERFORM moneo_test.ok(nxt.payment_date = '2026-02-28' AND nxt.every_days IS NULL AND nxt.business_id = biz,
                        'mensual igual que antes (fin de mes)', nxt.payment_date);

  -- Paying twice never creates two next instances.
  PERFORM public.mark_pago_paid(pago_m, acc_b, NULL);
  SELECT count(*) INTO n FROM public.pagos WHERE generated_from = pago_m;
  PERFORM moneo_test.ok(n = 1, 'idempotente', n::text);
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

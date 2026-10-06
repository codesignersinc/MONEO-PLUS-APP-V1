-- ============================================================
-- Pruebas de MONEO PLUS: planes, entitlements y perfil de onboarding
-- (migración 20261008120000).
--
-- Ejecutar SOLO contra staging, como postgres (SQL Editor o psql). Todo ocurre
-- en una transacción que termina en ROLLBACK: no deja usuarios ni datos.
-- El resultado es la tabla final (ok, prueba, detalle); todas deben salir ok = true.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
GRANT USAGE ON SCHEMA moneo_test TO authenticated;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);

-- Ejecuta `sql` como el usuario `uid` (rol authenticated + JWT) y devuelve el
-- primer valor del resultado como texto.
CREATE FUNCTION moneo_test.run(uid uuid, sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE sql INTO v;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN v;
END $$;

CREATE FUNCTION moneo_test.ok(cond boolean, label text, detail text DEFAULT '') RETURNS void
LANGUAGE sql AS $$ INSERT INTO moneo_test.results (ok, label, detail) VALUES (coalesce(cond, false), label, detail) $$;

-- Espera que `sql` falle como `uid` con un mensaje que contenga `pattern`.
CREATE FUNCTION moneo_test.fails(uid uuid, sql text, pattern text, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM moneo_test.run(uid, sql);
  EXCEPTION WHEN OTHERS THEN
    PERFORM moneo_test.ok(SQLERRM ILIKE '%' || pattern || '%', label, SQLERRM);
    RETURN;
  END;
  PERFORM moneo_test.ok(false, label, 'no falló');
END $$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');

  -- Catálogo
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.billing_plans') = '4', 'se ven los 4 planes');
  PERFORM moneo_test.ok(moneo_test.run(ua, $$SELECT price FROM public.billing_plans WHERE code = 'plus_yearly'$$) = '97.50', 'anual S/ 97.50');
  UPDATE public.billing_plans SET active = false WHERE code = 'founder';
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.billing_plans') = '3', 'Fundador apagado deja de mostrarse');
  UPDATE public.billing_plans SET active = true, available_until = now() - interval '1 minute' WHERE code = 'founder';
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.billing_plans') = '3', 'Fundador vencido deja de mostrarse');
  PERFORM moneo_test.fails(ua, $$UPDATE public.billing_plans SET price = 1 WHERE code = 'plus_monthly' RETURNING 1$$, 'permission denied', 'un usuario no puede cambiar precios');

  -- Sin entitlement: FREE
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'false', 'usuario nuevo es FREE');

  -- El cliente no puede darse PLUS
  PERFORM moneo_test.fails(ua, $$INSERT INTO public.user_entitlements (user_id, plan_code, status) VALUES (auth.uid(), 'plus_lifetime', 'active') RETURNING 1$$, 'permission denied', 'el cliente no puede crear su entitlement');
  PERFORM moneo_test.fails(ua, $$INSERT INTO public.billing_checkouts (user_id, plan_code, amount, currency) VALUES (auth.uid(), 'plus_monthly', 9.9, 'PEN') RETURNING 1$$, 'permission denied', 'el cliente no puede crear checkouts');
  PERFORM moneo_test.fails(ua, 'SELECT count(*) FROM public.billing_events', 'permission denied', 'el cliente no lee billing_events');

  -- Prueba gratis (escrita por el servidor)
  INSERT INTO public.user_entitlements (user_id, plan_code, status, current_period_end, trial_ends_at, had_trial)
  VALUES (ua, 'plus_yearly', 'trialing', now() + interval '14 days', now() + interval '14 days', true);
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'true', 'en prueba gratis tiene PLUS');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT public.has_plus()') = 'false', 'otro usuario sigue FREE');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*) FROM public.user_entitlements') = '0', 'B no ve el entitlement de A');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT plan_code FROM public.user_entitlements') = 'plus_yearly', 'A ve su plan');

  -- Cancelado: acceso hasta fin del periodo
  UPDATE public.user_entitlements SET status = 'cancelled', current_period_end = now() + interval '3 days' WHERE user_id = ua;
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'true', 'cancelado conserva acceso hasta fin del periodo');
  UPDATE public.user_entitlements SET current_period_end = now() - interval '1 minute' WHERE user_id = ua;
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'false', 'periodo vencido → FREE');
  UPDATE public.user_entitlements SET status = 'past_due', current_period_end = now() - interval '1 minute' WHERE user_id = ua;
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'false', 'pago fallido y periodo vencido → FREE');

  -- De por vida
  UPDATE public.user_entitlements SET plan_code = 'plus_lifetime', status = 'active', current_period_end = NULL WHERE user_id = ua;
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'true', 'lifetime activo tiene PLUS sin fecha de fin');
  UPDATE public.user_entitlements SET plan_code = 'founder' WHERE user_id = ua;
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'true', 'Fundador tiene PLUS aunque el plan ya no se venda');

  -- Perfil de onboarding
  PERFORM moneo_test.run(ua, $$INSERT INTO public.onboarding_profiles (goals, leak_categories, capture_methods, first_goal) VALUES ('{ahorrar,gastar_menos}', '{comida}', '{voz,scan}', 'emergencia') RETURNING 1$$);
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT first_goal FROM public.onboarding_profiles') = 'emergencia', 'A guarda su perfil');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*) FROM public.onboarding_profiles') = '0', 'B no ve el perfil de A');
  PERFORM moneo_test.fails(ua, $$UPDATE public.onboarding_profiles SET goals = '{a,b,c,d}' RETURNING 1$$, 'check', 'máximo 3 objetivos y solo valores conocidos');
  PERFORM moneo_test.fails(ub, $$INSERT INTO public.onboarding_profiles (user_id) VALUES ('00000000-0000-4000-8000-0000000000a1') RETURNING 1$$, 'row-level security', 'B no puede escribir el perfil de A');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

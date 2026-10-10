-- ============================================================
-- Pruebas de la migración 20261023120000 (Coronas, rachas y logros).
-- Ejecutar SOLO contra staging, como postgres. Termina en ROLLBACK.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);
CREATE FUNCTION moneo_test.ok(cond boolean, label text, detail text DEFAULT '') RETURNS void
LANGUAGE sql AS $$ INSERT INTO moneo_test.results (ok, label, detail) VALUES (coalesce(cond, false), label, detail) $$;
CREATE FUNCTION moneo_test.as_user(u uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
-- Runs coronas_sync() as `who` (authenticated role).
CREATE FUNCTION moneo_test.sync(who uuid) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM moneo_test.as_user(who);
  SET LOCAL ROLE authenticated;
  r := public.coronas_sync();
  RESET ROLE;
  RETURN r;
END $$;
-- Runs `sql` as `who`; returns the first column or the SQLSTATE.
CREATE FUNCTION moneo_test.run(who uuid, sql text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM moneo_test.as_user(who);
  SET LOCAL ROLE authenticated;
  EXECUTE sql INTO r;
  RESET ROLE;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'ERR ' || SQLSTATE;
END $$;
CREATE FUNCTION moneo_test.sum_rule(u uuid, r text) RETURNS integer
LANGUAGE sql AS $$ SELECT coalesce(sum(amount), 0)::int FROM public.coronas_ledger WHERE user_id = u AND rule = r $$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-00000000c001';
  ub uuid := '00000000-0000-4000-8000-00000000c002';
  m1 uuid := '00000000-0000-4000-8000-00000000c011';
  m2 uuid := '00000000-0000-4000-8000-00000000c012';
  m3 uuid := '00000000-0000-4000-8000-00000000c013';
  acc uuid;
  goal uuid;
  j uuid;
  s jsonb;
  today date := (now() AT TIME ZONE 'America/Lima')::date;
  prev date := (date_trunc('month', (now() AT TIME ZONE 'America/Lima')::date) - interval '1 month')::date;
  n int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'ca@t.local'), (ub, 'cb@t.local'),
    (m1, 'cm1@t.local'), (m2, 'cm2@t.local'), (m3, 'cm3@t.local');
  INSERT INTO public.user_profiles (id, email) VALUES (ua, 'ca@t.local'), (ub, 'cb@t.local'),
    (m1, 'cm1@t.local'), (m2, 'cm2@t.local'), (m3, 'cm3@t.local') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency)
    VALUES (ua, 'Cuenta', 'banco', 1000, 'PEN') RETURNING id INTO acc;
  PERFORM moneo_test.as_user(ua);

  -- 1. Sin movimientos no hay Coronas; el perfil nace hoy.
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok((s->>'balance')::int = 0 AND (s->>'streak')::int = 0, 'sin hábitos, 0 Coronas', s::text);
  PERFORM moneo_test.ok((s->>'startedOn')::date = today, 'el programa empieza hoy');

  -- 2. Registro del día: +1 y logro primer registro (+3), una sola vez.
  INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    VALUES (ua, acc, 'Almuerzo', 'Comida', -18, now(), 'gasto');
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'registro_dia') = 1, 'registro del día +1');
  PERFORM moneo_test.ok(EXISTS (SELECT 1 FROM public.coronas_achievements WHERE user_id = ua AND code = 'primer_registro'),
                        'logro primer registro');
  PERFORM moneo_test.ok((s->>'balance')::int = 4 AND (s->>'streak')::int = 1 AND (s->>'registeredToday')::boolean,
                        'saldo 4 y racha 1', s::text);
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok((s->>'balance')::int = 4, 'sincronizar de nuevo no duplica');

  -- 3. Un movimiento con created_at de ayer no da Coronas hacia atrás.
  INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type, created_at)
    VALUES (ua, acc, 'Viejo', 'Comida', -5, now() - interval '1 day', 'gasto', now() - interval '1 day');
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.coronas_ledger WHERE user_id = ua AND earned_on = today - 1),
                        'no se otorgan días pasados');

  -- 4. Racha de 7: se completa con 6 días previos en el ledger.
  INSERT INTO public.coronas_ledger (user_id, rule, award_key, earned_on, amount, expires_at)
    SELECT ua, 'registro_dia', 'registro:' || (today - k), today - k, 1, now() + interval '1 year'
      FROM generate_series(1, 6) k ON CONFLICT DO NOTHING;
  DELETE FROM public.coronas_ledger WHERE user_id = ua AND award_key = 'racha:' || today;
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok((s->>'streak')::int = 7, 'racha de 7 días', s->>'streak');
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'racha_7') = 5, 'racha de 7: +5');
  PERFORM moneo_test.ok(EXISTS (SELECT 1 FROM public.coronas_achievements WHERE user_id = ua AND code = 'racha_7'),
                        'logro racha 7');

  -- 5. Pagos a tiempo: máx. 2 por día; uno creado hoy o vencido no cuenta.
  INSERT INTO public.pagos (user_id, name, category, amount, payment_date, status, created_at)
    VALUES (ua, 'Luz', 'Servicios', 80, to_char(today + 2, 'YYYY-MM-DD'), 'pagado', now() - interval '3 days'),
           (ua, 'Agua', 'Servicios', 40, to_char(today, 'YYYY-MM-DD'), 'pagado', now() - interval '3 days'),
           (ua, 'Gas', 'Servicios', 30, to_char(today + 5, 'YYYY-MM-DD'), 'pagado', now() - interval '3 days'),
           (ua, 'Tarde', 'Servicios', 30, to_char(today - 1, 'YYYY-MM-DD'), 'pagado', now() - interval '3 days'),
           (ua, 'Nuevo', 'Servicios', 30, to_char(today + 3, 'YYYY-MM-DD'), 'pagado', now()),
           (ua, 'Pendiente', 'Servicios', 30, to_char(today + 3, 'YYYY-MM-DD'), 'pendiente', now() - interval '3 days');
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'pago_a_tiempo') = 4, 'pagos a tiempo: 2 por día (+4)',
                        moneo_test.sum_rule(ua, 'pago_a_tiempo')::text);
  PERFORM moneo_test.ok(EXISTS (SELECT 1 FROM public.coronas_achievements WHERE user_id = ua AND code = 'pago_puntual'),
                        'logro pago puntual');

  -- 6. Metas: la primera vez solo se anota la base; luego +2 por semana; logro al cumplirla.
  INSERT INTO public.savings_goals (user_id, name, current_amount, target_amount)
    VALUES (ua, 'Viaje', 100, 300) RETURNING id INTO goal;
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'aporte_meta') = 0, 'meta nueva: sin premio');
  UPDATE public.savings_goals SET current_amount = 150 WHERE id = goal;
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'aporte_meta') = 2, 'aporte a meta +2');
  UPDATE public.savings_goals SET current_amount = 50 WHERE id = goal;
  s := moneo_test.sync(ua);
  UPDATE public.savings_goals SET current_amount = 140 WHERE id = goal;
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok((SELECT high_water FROM public.coronas_goal_marks WHERE goal_id = goal) = 150,
                        'bajar y subir no supera la marca');
  UPDATE public.savings_goals SET current_amount = 300 WHERE id = goal;
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'aporte_meta') = 2, 'solo 1 premio de meta por semana');
  PERFORM moneo_test.ok(EXISTS (SELECT 1 FROM public.coronas_achievements WHERE user_id = ua AND code = 'meta_cumplida'),
                        'logro meta cumplida');

  -- 7. Presupuesto del mes anterior: cumple con 10 días de registro.
  INSERT INTO public.budget_categories (user_id, name, budget) VALUES (ua, 'Comida', 100);
  INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    VALUES (ua, acc, 'Menú', 'Comida', -60, (prev + 3)::timestamp AT TIME ZONE 'America/Lima', 'gasto');
  INSERT INTO public.coronas_ledger (user_id, rule, award_key, earned_on, amount, expires_at)
    SELECT ua, 'registro_dia', 'registro:' || (prev + k), prev + k, 1, now() + interval '1 year'
      FROM generate_series(0, 8) k ON CONFLICT DO NOTHING;
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'presupuesto_mes') = 0, 'con 9 días de registro no hay premio');
  INSERT INTO public.coronas_ledger (user_id, rule, award_key, earned_on, amount, expires_at)
    VALUES (ua, 'registro_dia', 'registro:' || (prev + 9), prev + 9, 1, now() + interval '1 year');
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'presupuesto_mes') = 10, 'presupuesto cumplido +10');
  -- B se pasó del presupuesto.
  PERFORM moneo_test.as_user(ub);
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency) VALUES (ub, 'B', 'banco', 1000, 'PEN');
  INSERT INTO public.budget_categories (user_id, name, budget) VALUES (ub, 'Comida', 100);
  INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    SELECT ub, a.id, 'Menú', 'Comida', -150, (prev + 3)::timestamp AT TIME ZONE 'America/Lima', 'gasto'
      FROM public.accounts a WHERE a.user_id = ub;
  INSERT INTO public.coronas_ledger (user_id, rule, award_key, earned_on, amount, expires_at)
    SELECT ub, 'registro_dia', 'registro:' || (prev + k), prev + k, 1, now() + interval '1 year'
      FROM generate_series(0, 12) k;
  s := moneo_test.sync(ub);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ub, 'presupuesto_mes') = 0, 'presupuesto excedido: sin premio');

  -- 8. Junta finalizada con 3 participantes con cuenta: +10; con 2 no.
  INSERT INTO public.juntas (user_id, name, status) VALUES (ua, 'Junta 2', 'finalizada') RETURNING id INTO j;
  INSERT INTO public.junta_members (junta_id, user_id, display_name, role, status)
    VALUES (j, m1, 'M1', 'member', 'active'), (j, m2, 'M2', 'member', 'active');
  s := moneo_test.sync(ua);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'junta_completa') = 0, 'junta con 2 participantes: sin premio');
  INSERT INTO public.junta_members (junta_id, user_id, display_name, role, status) VALUES (j, m3, 'M3', 'member', 'active');
  s := moneo_test.sync(ua);
  s := moneo_test.sync(m1);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ua, 'junta_completa') = 10 AND moneo_test.sum_rule(m1, 'junta_completa') = 10,
                        'junta completa +10 para organizador y participante');

  -- 9. MONEO AUTO: máx. 2 por día; lo escrito a mano (text) no cuenta.
  INSERT INTO public.auto_suggestions (user_id, source, bank, kind, movement_type, amount, currency, occurred_date, fingerprint, status, resolved_at)
    SELECT ub, 'email', 'bcp', 'consumo', 'gasto', 10, 'PEN', today, repeat(md5('fp' || g), 2), 'registrada', now() FROM generate_series(1, 3) g;
  INSERT INTO public.auto_suggestions (user_id, source, bank, kind, movement_type, amount, currency, occurred_date, fingerprint, status, resolved_at)
    VALUES (ub, 'text', 'bcp', 'consumo', 'gasto', 10, 'PEN', today, repeat(md5('fp9'), 2), 'registrada', now());
  s := moneo_test.sync(ub);
  PERFORM moneo_test.ok(moneo_test.sum_rule(ub, 'auto_confirmada') = 2, 'AUTO confirmado: máx. 2 por día',
                        moneo_test.sum_rule(ub, 'auto_confirmada')::text);

  -- 10. Vencimiento: lo vencido no cuenta en el saldo, sí en el total histórico.
  INSERT INTO public.coronas_ledger (user_id, rule, award_key, earned_on, amount, expires_at)
    VALUES (ub, 'registro_dia', 'registro:2020-01-01', '2020-01-01', 7, now() - interval '1 day');
  s := moneo_test.sync(ub);
  PERFORM moneo_test.ok((s->>'lifetime')::int - (s->>'balance')::int = 7, 'lo vencido sale del saldo', s::text);

  -- 11. Seguridad.
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.coronas_ledger WHERE user_id = %L', ua)) = '0',
                        'B no ve las Coronas de A');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.coronas_ledger') <> '0', 'A ve las suyas');
  PERFORM moneo_test.ok(moneo_test.run(ua, format($q$INSERT INTO public.coronas_ledger (user_id, rule, award_key, earned_on, amount, expires_at)
    VALUES (%L, 'logro', 'x', now()::date, 1000, now() + interval '1 year') RETURNING 1$q$, ua)) LIKE 'ERR%',
                        'el cliente no se da Coronas');
  PERFORM moneo_test.ok(moneo_test.run(ua, format('UPDATE public.coronas_ledger SET amount = 999 WHERE user_id = %L RETURNING 1', ua)) IS DISTINCT FROM '1',
                        'el cliente no cambia su saldo');
  PERFORM moneo_test.ok(moneo_test.run(ua, format($q$SELECT public.coronas_award(%L, 'logro', 'y', now()::date, 100)$q$, ua)) LIKE 'ERR%',
                        'el cliente no llama a coronas_award');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.coronas_goal_marks') LIKE 'ERR%',
                        'las marcas de metas son internas');
  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.coronas_sync()', 'EXECUTE'), 'sin sesión no se sincroniza');

  -- 12. Al borrar la cuenta se borran sus Coronas.
  DELETE FROM auth.users WHERE id = ub;
  SELECT count(*) INTO n FROM public.coronas_ledger WHERE user_id = ub;
  SELECT n + count(*) INTO n FROM public.coronas_profiles WHERE user_id = ub;
  PERFORM moneo_test.ok(n = 0, 'borrar la cuenta borra sus Coronas', n::text);
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

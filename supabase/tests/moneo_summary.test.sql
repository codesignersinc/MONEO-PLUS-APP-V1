-- ============================================================
-- Pruebas de MONEO Core: moneo_summary (migración 20261015120000).
-- Ejecutar SOLO contra staging, como postgres. Termina en ROLLBACK.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);
CREATE FUNCTION moneo_test.ok(cond boolean, label text, detail text DEFAULT '') RETURNS void
LANGUAGE sql AS $$ INSERT INTO moneo_test.results (ok, label, detail) VALUES (coalesce(cond, false), label, detail) $$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  acc uuid := gen_random_uuid();
  d date := '2026-10-10';
  s jsonb; msg text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.user_settings (user_id, base_currency_code) VALUES (ua, 'PEN')
    ON CONFLICT (user_id) DO UPDATE SET base_currency_code = 'PEN';
  INSERT INTO public.accounts (id, user_id, name, account_type, balance, currency) VALUES
    (acc, ua, 'BCP', 'banco', 5000, 'PEN');
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency) VALUES
    (ua, 'Dólares', 'banco', 100, 'USD'),
    (ua, 'Visa', 'credito', -500, 'PEN');
  -- The user's own rate wins over the app default (3.73).
  INSERT INTO public.exchange_rates (user_id, from_currency, to_currency, rate, rate_date, source)
    VALUES (ua, 'USD', 'PEN', 3.80, '2026-10-01', 'manual');
  INSERT INTO public.investments (user_id, name, investment_type, shares, price, cost)
    VALUES (ua, 'Fondo', 'fondo', 1, 1000, 1000);
  INSERT INTO public.debts (user_id, name, balance) VALUES (ua, 'Préstamo', 200);
  INSERT INTO public.savings_goals (user_id, name, current_amount, target_amount, target_date, created_at) VALUES
    (ua, 'Fondo de emergencia', 400, 1000, '2026-12-10', now() - interval '2 days'),
    (ua, 'Laptop', 500, 500, '2026-11-01', now() - interval '3 days');
  INSERT INTO public.pagos (user_id, name, category, amount, payment_date, status) VALUES
    (ua, 'Internet', 'Servicios', 100, '2026-10-15', 'pendiente'),
    (ua, 'Luz', 'Servicios', 80, '2026-10-05', 'pagado'),
    (ua, 'Seguro', 'Seguros', 50, '2026-11-05', 'pendiente');
  INSERT INTO public.subscriptions (user_id, name, category, amount, active, next_payment_date)
    VALUES (ua, 'Netflix', 'Entretenimiento', 49.90, true, '2026-10-12');
  INSERT INTO public.income_entries (user_id, name, amount, category, collection_date, status)
    VALUES (ua, 'Sueldo', 3000, 'Salario', '2026-10-20', 'pendiente');
  -- Movements through the balance engine (it moves the BCP balance).
  INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_type,
      transaction_date, currency_code, original_amount, base_currency_code, base_amount, exchange_rate) VALUES
    (ua, acc, 'Taxi', 'Transporte', -30, 'gasto', '2026-10-10 12:00-05', 'PEN', -30, 'PEN', -30, 1),
    (ua, acc, 'Freelance', 'Freelance', 1000, 'ingreso', '2026-10-02 09:00-05', 'PEN', 1000, 'PEN', 1000, 1),
    (ua, acc, 'Cena', 'Comida', -40, 'gasto', '2026-09-28 20:00-05', 'PEN', -40, 'PEN', -40, 1);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  s := public.moneo_summary(d);

  -- BCP 5000 − 30 + 1000 − 40 = 5930; USD 100 × 3.80 = 380; Visa −500.
  PERFORM moneo_test.ok((s->>'available')::numeric = 6310, 'disponible sin tarjetas de crédito y con la tasa propia', s->>'available');
  PERFORM moneo_test.ok((s->>'netWorth')::numeric = 6610, 'patrimonio = cuentas + inversiones − deudas', s->>'netWorth');
  PERFORM moneo_test.ok((s->>'committed')::numeric = 149.90, 'comprometido del mes: pendientes y suscripciones hasta fin de mes', s->>'committed');
  PERFORM moneo_test.ok((s->>'inGoals')::numeric = 900, 'en metas', s->>'inGoals');
  -- Month: +1000 −30 = 970 over a start of 6610 − 970 = 5640 → 17%.
  PERFORM moneo_test.ok((s->>'netWorthPct')::int = 17, 'variación del mes', s->>'netWorthPct');
  PERFORM moneo_test.ok((s->>'spentToday')::numeric = 30, 'gastado hoy', s->>'spentToday');
  PERFORM moneo_test.ok(s->'safeToSpend'->>'until' = '2026-10-20' AND s->'safeToSpend'->>'untilKind' = 'proximo_ingreso'
                        AND (s->'safeToSpend'->>'days')::int = 11, 'horizonte: el próximo ingreso', (s->'safeToSpend')::text);
  PERFORM moneo_test.ok((s->'safeToSpend'->>'goals')::numeric = 300, 'aporte del mes: 600 que faltan / 2 meses', s->'safeToSpend'->>'goals');
  -- (6310 + 30 − 149.90 − 300) / 11 = 535.46; hoy: 535.46 − 30 = 505.46.
  PERFORM moneo_test.ok((s->'safeToSpend'->>'dailyBudget')::numeric = 535.46, 'presupuesto diario', s->'safeToSpend'->>'dailyBudget');
  PERFORM moneo_test.ok((s->'safeToSpend'->>'today')::numeric = 505.46, 'puedes gastar hoy', s->'safeToSpend'->>'today');
  PERFORM moneo_test.ok(s->'nextPayment'->>'name' = 'Netflix' AND s->'nextPayment'->>'date' = '2026-10-12', 'próximo pago', (s->'nextPayment')::text);
  PERFORM moneo_test.ok(s->'mainGoal'->>'name' = 'Fondo de emergencia' AND (s->'mainGoal'->>'pct')::int = 40, 'meta principal: la primera sin cumplir', (s->'mainGoal')::text);
  PERFORM moneo_test.ok(jsonb_array_length(s->'recent') = 3 AND s->'recent'->0->>'name' = 'Taxi', 'últimos movimientos, el más reciente primero', (s->'recent')::text);

  -- Without a pending income the horizon is the end of the month.
  UPDATE public.income_entries SET status = 'cobrado' WHERE user_id = ua;
  s := public.moneo_summary(d);
  PERFORM moneo_test.ok(s->'safeToSpend'->>'until' = '2026-10-31' AND s->'safeToSpend'->>'untilKind' = 'fin_de_mes'
                        AND (s->'safeToSpend'->>'days')::int = 22, 'sin ingreso pendiente: hasta fin de mes', (s->'safeToSpend')::text);
  -- Never negative.
  INSERT INTO public.pagos (user_id, name, category, amount, payment_date, status)
    VALUES (ua, 'Alquiler', 'Vivienda', 9000, '2026-10-25', 'pendiente');
  s := public.moneo_summary(d);
  PERFORM moneo_test.ok((s->'safeToSpend'->>'today')::numeric = 0, 'nunca negativo', s->'safeToSpend'->>'today');

  -- Another user sees only their own (empty) summary.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  s := public.moneo_summary(d);
  PERFORM moneo_test.ok((s->>'netWorth')::numeric = 0 AND jsonb_array_length(s->'recent') = 0
                        AND s->'nextPayment' = 'null'::jsonb, 'otro usuario no ve nada ajeno', s::text);

  -- Not signed in → error.
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    s := public.moneo_summary(d);
    PERFORM moneo_test.ok(false, 'sin sesión debe fallar');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM moneo_test.ok(true, 'sin sesión: error');
  END;

  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.moneo_summary(date)', 'EXECUTE'), 'anon no puede ejecutarla');
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

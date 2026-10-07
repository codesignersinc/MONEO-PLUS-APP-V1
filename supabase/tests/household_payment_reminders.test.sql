-- ============================================================
-- Pruebas del aviso "Próximo pago del hogar" (migración 20261014120000).
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
  h uuid := gen_random_uuid(); ma uuid := gen_random_uuid(); mb uuid := gen_random_uuid();
  today date := (now() AT TIME ZONE 'America/Lima')::date;
  n int; msg text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.households (id, name, created_by) VALUES (h, 'Casa', ua);
  INSERT INTO public.household_members (id, household_id, user_id, display_name, role) VALUES
    (ma, h, ua, 'Félix', 'owner'), (mb, h, ub, 'Sophia', 'member');
  INSERT INTO public.household_expenses (household_id, created_by, paid_by, name, category, amount,
    currency_code, base_amount, exchange_rate, expense_date, is_recurring, frequency, next_date) VALUES
    -- Due tomorrow (latest of its series) → notified.
    (h, ua, mb, 'Internet', 'Servicios', 70, 'PEN', 70, 1, today - 29, true, 'monthly', today + 1),
    -- An older occurrence of the same series → not counted.
    (h, ua, mb, 'Internet', 'Servicios', 70, 'PEN', 70, 1, today - 59, true, 'monthly', today - 29),
    -- Far away → not yet.
    (h, ua, ma, 'Alquiler', 'Vivienda', 2600, 'PEN', 2600, 1, today - 5, true, 'monthly', today + 25),
    -- Not recurring → never.
    (h, ua, ma, 'Pan', 'Comida', 5, 'PEN', 5, 1, today, false, NULL, NULL),
    -- Overdue 2 days → "vencido".
    (h, ua, ma, 'Seguro', 'Seguros', 300, 'PEN', 300, 1, today - 33, true, 'monthly', today - 2);

  n := public.household_payment_reminders();
  PERFORM moneo_test.ok(n = 4, '2 pagos × 2 miembros = 4 avisos', n::text);
  SELECT message INTO msg FROM public.notifications WHERE user_id = ua AND title = 'Próximo pago del hogar';
  PERFORM moneo_test.ok(msg = format('"Internet" vence el %s. Lo paga Sophia.', to_char(today + 1, 'DD/MM')), 'texto con fecha y quién paga', msg);
  PERFORM moneo_test.ok(msg !~ '70', 'el aviso no lleva el monto', msg);
  PERFORM moneo_test.ok((SELECT count(*) FROM public.notifications WHERE user_id = ub AND title = 'Pago del hogar vencido') = 1, 'pago vencido avisado');
  PERFORM moneo_test.ok(public.household_payment_reminders() = 0, 'no se repite el mismo aviso');
  -- Paid: the series moves to next month → nothing new until it is close again.
  UPDATE public.household_expenses SET next_date = today + 31 WHERE name = 'Internet' AND next_date = today + 1;
  PERFORM moneo_test.ok(public.household_payment_reminders() = 0, 'pagado y reprogramado: sin aviso');
  PERFORM moneo_test.ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'household-payment-reminders' AND schedule = '0 13 * * *'), 'tarea diaria programada (8:00 Lima)');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

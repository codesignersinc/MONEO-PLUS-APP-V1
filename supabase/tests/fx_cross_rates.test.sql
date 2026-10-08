-- ============================================================
-- Pruebas de tasas cruzadas (migración 20261017120000).
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
  r numeric; s jsonb;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);

  PERFORM moneo_test.ok(public.moneo_fx_rate('PEN', 'PEN') = 1, 'misma moneda = 1');
  PERFORM moneo_test.ok(public.moneo_fx_rate('USD', 'PEN') = 3.73, 'tasa directa por defecto');
  r := public.moneo_fx_rate('COP', 'MXN');
  PERFORM moneo_test.ok(abs(r - 0.00093 / 0.22) < 1e-9, 'COP → MXN cruzando por PEN (antes daba 1)', r::text);
  r := public.moneo_fx_rate('CLP', 'BRL');
  PERFORM moneo_test.ok(abs(r - 0.0041 / 0.74) < 1e-9, 'CLP → BRL cruzando por PEN', r::text);
  PERFORM moneo_test.ok(public.moneo_fx_rate('XYZ', 'PEN') = 1, 'moneda desconocida: 1');

  -- The user's own rates win, also when crossing.
  INSERT INTO public.exchange_rates (user_id, from_currency, to_currency, rate, rate_date, source) VALUES
    (ua, 'USD', 'PEN', 3.80, '2026-10-01', 'manual'),
    (ua, 'COP', 'PEN', 0.001, '2026-10-01', 'manual');
  PERFORM moneo_test.ok(public.moneo_fx_rate('USD', 'PEN') = 3.80, 'tasa propia directa');
  r := public.moneo_fx_rate('COP', 'USD');
  PERFORM moneo_test.ok(abs(r - 0.001 / 3.80) < 1e-12, 'cruce con tasas propias', r::text);

  -- moneo_summary adds a COP account correctly in a MXN base.
  INSERT INTO public.user_settings (user_id, base_currency_code) VALUES (ua, 'MXN')
    ON CONFLICT (user_id) DO UPDATE SET base_currency_code = 'MXN';
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency)
    VALUES (ua, 'Nequi', 'digital', 100000, 'COP');
  s := public.moneo_summary('2026-10-10');
  PERFORM moneo_test.ok(abs((s->>'available')::numeric - round(100000 * 0.001 / 0.22, 2)) < 0.01,
                        'resumen: 100.000 COP en base MXN ya no es 100.000', s->>'available');
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

-- ============================================================
-- Pruebas de la prueba gratis sin tarjeta, los pases prepagados y el nuevo precio
-- de por vida (migración 20261010120000).
--
-- Ejecutar SOLO contra staging, como postgres (SQL Editor o psql). Todo ocurre
-- en una transacción que termina en ROLLBACK: no deja usuarios ni datos.
-- El resultado es la tabla final (ok, prueba, detalle); todas deben salir ok = true.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
GRANT USAGE ON SCHEMA moneo_test TO authenticated;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);

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
  ua uuid := '00000000-0000-4000-8000-0000000000a2';
  ub uuid := '00000000-0000-4000-8000-0000000000b2';
  uc uuid := '00000000-0000-4000-8000-0000000000c2';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a2@test.local'), (ub, 'b2@test.local'), (uc, 'c2@test.local');

  -- Catálogo
  PERFORM moneo_test.ok(moneo_test.run(ua, $$SELECT price FROM public.billing_plans WHERE code = 'pass_3m'$$) = '25.90', 'pase 3 meses S/ 25.90');
  PERFORM moneo_test.ok(moneo_test.run(ua, $$SELECT price FROM public.billing_plans WHERE code = 'pass_12m'$$) = '97.50', 'pase 1 año S/ 97.50');
  PERFORM moneo_test.ok(moneo_test.run(ua, $$SELECT price FROM public.billing_plans WHERE code = 'plus_lifetime'$$) = '127.00', 'de por vida S/ 127.00');
  PERFORM moneo_test.ok(moneo_test.run(ua, $$SELECT count(*) FROM public.billing_plans WHERE code = 'free_trial'$$) = '0', 'la prueba gratis no se ofrece como plan');

  -- Prueba gratis sin tarjeta
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.start_free_trial()') = 'true', 'A inicia su prueba gratis');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'true', 'en prueba gratis tiene PLUS');
  PERFORM moneo_test.ok(moneo_test.run(ua, $$SELECT (current_period_end - now()) BETWEEN interval '13 days 23 hours' AND interval '14 days' FROM public.user_entitlements$$) = 'true', 'la prueba dura 14 días');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT provider || status || had_trial FROM public.user_entitlements') = 'moneotrialingtrue', 'queda marcada como prueba de MONEO');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.start_free_trial()') = 'false', 'no se puede iniciar dos veces');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT public.has_plus()') = 'false', 'B sigue FREE');
  PERFORM moneo_test.fails(ua, $$UPDATE public.user_entitlements SET current_period_end = now() + interval '1 year' RETURNING 1$$, 'permission denied', 'el cliente no puede alargar su prueba');

  UPDATE public.user_entitlements SET current_period_end = now() - interval '1 minute' WHERE user_id = ua;
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()') = 'false', 'prueba vencida → FREE');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.start_free_trial()') = 'false', 'prueba vencida no se repite');

  -- Quien ya compró no recibe prueba
  INSERT INTO public.user_entitlements (user_id, plan_code, status, provider) VALUES (uc, 'plus_lifetime', 'active', 'mercadopago');
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT public.start_free_trial()') = 'false', 'con plan pagado no se inicia prueba');
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT plan_code FROM public.user_entitlements') = 'plus_lifetime', 'el plan pagado no cambia');

  -- Pases: PLUS hasta la fecha de fin
  INSERT INTO public.user_entitlements (user_id, plan_code, status, current_period_end, provider) VALUES (ub, 'pass_3m', 'active', now() + interval '3 months', 'mercadopago');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT public.has_plus()') = 'true', 'pase vigente tiene PLUS');
  UPDATE public.user_entitlements SET current_period_end = now() - interval '1 minute' WHERE user_id = ub;
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT public.has_plus()') = 'false', 'pase vencido → FREE');

  -- Restricciones del catálogo
  BEGIN
    UPDATE public.billing_plans SET price = 0 WHERE code = 'pass_3m';
    PERFORM moneo_test.ok(false, 'un pase no puede costar 0', 'no falló');
  EXCEPTION WHEN OTHERS THEN
    PERFORM moneo_test.ok(true, 'un pase no puede costar 0');
  END;
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

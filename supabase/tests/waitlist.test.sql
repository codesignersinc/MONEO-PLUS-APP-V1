-- ============================================================
-- Pruebas de la lista de espera de las landings por país (migración 20261019120000).
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
  r record; n int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.user_profiles (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local')
    ON CONFLICT (id) DO NOTHING;

  PERFORM moneo_test.ok(has_function_privilege('anon', 'public.join_waitlist(text,text,text,text,text,text,text)', 'EXECUTE'),
                        'visitantes sin sesión pueden unirse');
  PERFORM moneo_test.ok(NOT has_table_privilege('anon', 'public.waitlist', 'SELECT')
                        AND NOT has_table_privilege('anon', 'public.waitlist', 'INSERT'),
                        'sin sesión no se lee ni se inserta directo');

  -- A visitor from a Spain campaign joins; the email is normalised.
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM public.join_waitlist('  Ana@Example.COM ', 'ES', 'es-ES', 'low', 'instagram', 'paid', 'lanzamiento-es');
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.waitlist WHERE email = 'ana@example.com';
  PERFORM moneo_test.ok(r.country_code = 'ES' AND r.willing_to_pay = 'low' AND r.utm_source = 'instagram'
                        AND r.utm_campaign = 'lanzamiento-es', 'guarda correo, país, respuesta y campaña',
                        row_to_json(r)::text);

  -- Joining again does not duplicate and keeps the answer when none is given.
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM public.join_waitlist('ana@example.com', 'ES', 'es-ES');
  EXECUTE 'RESET ROLE';
  SELECT count(*), max(willing_to_pay) INTO n, r.willing_to_pay FROM public.waitlist WHERE email = 'ana@example.com';
  PERFORM moneo_test.ok(n = 1 AND r.willing_to_pay = 'low', 'sin duplicados; conserva la respuesta', n::text);

  -- The same person can wait for two countries.
  PERFORM public.join_waitlist('ana@example.com', 'US', 'es-US', 'mid');
  SELECT count(*) INTO n FROM public.waitlist WHERE email = 'ana@example.com';
  PERFORM moneo_test.ok(n = 2, 'un correo puede esperar en dos países', n::text);

  BEGIN
    PERFORM public.join_waitlist('no-es-correo', 'ES', 'es-ES');
    PERFORM moneo_test.ok(false, 'correo inválido');
  EXCEPTION WHEN invalid_parameter_value THEN PERFORM moneo_test.ok(true, 'correo inválido: error');
  END;
  BEGIN
    PERFORM public.join_waitlist('b@example.com', 'PE', 'es-PE');
    PERFORM moneo_test.ok(false, 'Perú ya está activo');
  EXCEPTION WHEN invalid_parameter_value THEN PERFORM moneo_test.ok(true, 'país activo u oculto: error');
  END;
  BEGIN
    PERFORM public.join_waitlist('b@example.com', 'ES', 'es-ES', 'gratis');
    PERFORM moneo_test.ok(false, 'respuesta inválida');
  EXCEPTION WHEN invalid_parameter_value THEN PERFORM moneo_test.ok(true, 'respuesta inválida: error');
  END;

  -- Only admins read the list and its counts.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.waitlist;
  EXECUTE 'RESET ROLE';
  PERFORM moneo_test.ok(n = 0, 'un usuario no ve la lista (RLS)', n::text);
  BEGIN
    PERFORM * FROM public.admin_waitlist_stats();
    PERFORM moneo_test.ok(false, 'estadísticas solo para administradores');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM moneo_test.ok(true, 'estadísticas: solo administradores');
  END;

  INSERT INTO public.app_admins (user_id) VALUES (ub);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  SELECT * INTO r FROM public.admin_waitlist_stats() WHERE code = 'ES';
  PERFORM moneo_test.ok(r.total >= 1 AND r.pay_low >= 1 AND r.last_7_days >= 1, 'el admin ve la lista por país',
                        row_to_json(r)::text);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.waitlist WHERE email = 'ana@example.com';
  EXECUTE 'RESET ROLE';
  PERFORM moneo_test.ok(n = 2, 'el admin puede leer la lista', n::text);
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

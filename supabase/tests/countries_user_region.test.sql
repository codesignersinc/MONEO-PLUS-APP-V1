-- ============================================================
-- Pruebas de países y región del usuario (migración 20261018120000).
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

  PERFORM moneo_test.ok((SELECT status FROM public.countries WHERE code = 'PE') = 'live', 'Perú activo');
  PERFORM moneo_test.ok((SELECT count(*) FROM public.countries WHERE status = 'waitlist') = 5,
                        'España, EE. UU., Australia, Emiratos y Singapur en lista de espera');
  PERFORM moneo_test.ok(has_table_privilege('anon', 'public.countries', 'SELECT'), 'países: lectura pública');

  -- A new user confirms Spain and euros.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM public.set_my_region('ES', 'es-ES', 'Europe/Madrid', 'EUR');
  SELECT * INTO r FROM public.user_settings WHERE user_id = ua;
  PERFORM moneo_test.ok(r.country_code = 'ES' AND r.locale = 'es-ES' AND r.timezone = 'Europe/Madrid'
                        AND r.base_currency_code = 'EUR' AND r.region_confirmed_at IS NOT NULL,
                        'guarda país, idioma, zona horaria y moneda', row_to_json(r)::text);

  -- Changing country without asking keeps the base currency.
  PERFORM public.set_my_region('US', 'es-US', 'America/New_York');
  SELECT * INTO r FROM public.user_settings WHERE user_id = ua;
  PERFORM moneo_test.ok(r.country_code = 'US' AND r.base_currency_code = 'EUR', 'la moneda solo cambia si se pide');

  BEGIN
    PERFORM public.set_my_region('XX', 'es-PE', 'America/Lima');
    PERFORM moneo_test.ok(false, 'país desconocido');
  EXCEPTION WHEN invalid_parameter_value THEN PERFORM moneo_test.ok(true, 'país desconocido: error');
  END;
  BEGIN
    PERFORM public.set_my_region('PE', 'es-PE', 'Marte/Olympus');
    PERFORM moneo_test.ok(false, 'zona horaria inválida');
  EXCEPTION WHEN invalid_parameter_value THEN PERFORM moneo_test.ok(true, 'zona horaria inválida: error');
  END;
  BEGIN
    PERFORM public.set_my_region('PE', 'español', 'America/Lima');
    PERFORM moneo_test.ok(false, 'idioma inválido');
  EXCEPTION WHEN check_violation THEN PERFORM moneo_test.ok(true, 'idioma inválido: error');
  END;

  -- Users cannot change countries; admins see counts.
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.countries SET status = 'live' WHERE code = 'ES';
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  PERFORM moneo_test.ok(n = 0, 'un usuario no puede cambiar países (RLS)', n::text);
  BEGIN
    PERFORM * FROM public.admin_country_stats();
    PERFORM moneo_test.ok(false, 'estadísticas solo para administradores');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM moneo_test.ok(true, 'estadísticas: solo administradores');
  END;
  INSERT INTO public.app_admins (user_id) VALUES (ub);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  SELECT users INTO n FROM public.admin_country_stats() WHERE code = 'US';
  PERFORM moneo_test.ok(n >= 1, 'el admin ve usuarios por país', n::text);

  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.set_my_region(text,text,text,text)', 'EXECUTE'),
                        'sin sesión no se guarda región');
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

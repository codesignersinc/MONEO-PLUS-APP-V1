-- ============================================================
-- Pruebas de la migración 20261022120000 (eliminar usuario desde el panel y correos reales).
-- Ejecutar SOLO contra staging, como postgres. Termina en ROLLBACK.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);
CREATE FUNCTION moneo_test.ok(cond boolean, label text, detail text DEFAULT '') RETURNS void
LANGUAGE sql AS $$ INSERT INTO moneo_test.results (ok, label, detail) VALUES (coalesce(cond, false), label, detail) $$;
CREATE FUNCTION moneo_test.as_user(u uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
-- Runs admin_delete_user as `who` (authenticated role); returns the SQLSTATE or 'ok'.
CREATE FUNCTION moneo_test.del(who uuid, target uuid) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM moneo_test.as_user(who);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_delete_user(target);
  RESET ROLE;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN SQLSTATE;
END $$;
CREATE FUNCTION moneo_test.hook(email text, provider text DEFAULT 'email') RETURNS jsonb
LANGUAGE sql AS $$
  SELECT public.hook_before_user_created(jsonb_build_object('user',
    jsonb_build_object('email', email, 'app_metadata', jsonb_build_object('provider', provider))))
$$;

DO $test$
DECLARE
  adm uuid := '00000000-0000-4000-8000-00000000ad01';
  adm2 uuid := '00000000-0000-4000-8000-00000000ad02';
  u1 uuid := '00000000-0000-4000-8000-00000000ad11';
  u2 uuid := '00000000-0000-4000-8000-00000000ad12';
  n int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (adm, 'adm@t.local'), (adm2, 'adm2@t.local'),
    (u1, 'u1@t.local'), (u2, 'u2@t.local');
  INSERT INTO public.user_profiles (id, email) VALUES (adm, 'adm@t.local'), (adm2, 'adm2@t.local'),
    (u1, 'u1@t.local'), (u2, 'u2@t.local') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.app_admins (user_id) VALUES (adm), (adm2);
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency)
    VALUES (u1, 'Cuenta', 'banco', 10, 'PEN');

  -- 1. Delete from the panel.
  PERFORM moneo_test.ok(moneo_test.del(u2, u1) = '42501', 'un usuario normal no puede eliminar');
  PERFORM moneo_test.ok(moneo_test.del(adm, adm) = '22023', 'el admin no se elimina a sí mismo');
  PERFORM moneo_test.ok(moneo_test.del(adm, adm2) = '42501', 'no se elimina a otro admin');
  PERFORM moneo_test.ok(moneo_test.del(adm, '00000000-0000-4000-8000-00000000adff') = 'P0002',
                        'usuario inexistente');
  PERFORM moneo_test.ok(moneo_test.del(adm, u1) = 'ok', 'el admin elimina al usuario');
  SELECT count(*) INTO n FROM auth.users WHERE id = u1;
  SELECT n + count(*) INTO n FROM public.accounts WHERE user_id = u1;
  PERFORM moneo_test.ok(n = 0, 'se borran el usuario y sus datos', n::text);
  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.admin_delete_user(uuid)', 'EXECUTE'),
                        'sin sesión no se puede');

  -- 2. Real emails.
  PERFORM moneo_test.ok(moneo_test.hook('codesignersperu@gmail.com') = '{}'::jsonb, 'gmail real pasa');
  PERFORM moneo_test.ok(moneo_test.hook('ana@empresa.pe') = '{}'::jsonb, 'dominio propio pasa');
  PERFORM moneo_test.ok(moneo_test.hook('x@gmail.com') #>> '{error,message}' = 'MONEO: Ese correo de Gmail no existe. Revísalo.',
                        'x@gmail.com se rechaza');
  PERFORM moneo_test.ok((moneo_test.hook('x@gmail.com') #>> '{error,http_code}')::int = 400, 'con código 400');
  PERFORM moneo_test.ok(moneo_test.hook('prueba@test.com') ? 'error', 'test.com se rechaza');
  PERFORM moneo_test.ok(moneo_test.hook('test@prueba.com') ? 'error', 'prueba.com se rechaza');
  PERFORM moneo_test.ok(moneo_test.hook('yo@yopmail.com') ? 'error', 'correo temporal se rechaza');
  PERFORM moneo_test.ok(moneo_test.hook('jorge') ? 'error', 'sintaxis inválida se rechaza');
  PERFORM moneo_test.ok(moneo_test.hook('x@gmail.com', 'google') = '{}'::jsonb, 'Google no se revisa');
  DELETE FROM public.app_settings WHERE key = 'allow_test_signups';
  PERFORM moneo_test.ok(moneo_test.hook('e2e-1@test.local') ? 'error', 'test.local se rechaza por defecto');
  INSERT INTO public.app_settings (key, value) VALUES ('allow_test_signups', 'on');
  PERFORM moneo_test.ok(moneo_test.hook('e2e-1@test.local') = '{}'::jsonb, 'test.local solo con la opción de staging');
  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'EXECUTE')
                        AND has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'EXECUTE'),
                        'el hook solo lo ejecuta Supabase Auth');
  PERFORM moneo_test.ok(NOT has_table_privilege('authenticated', 'public.app_settings', 'SELECT'),
                        'app_settings no se lee desde la app');
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

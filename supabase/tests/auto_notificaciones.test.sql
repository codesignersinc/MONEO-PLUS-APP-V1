-- ============================================================
-- Pruebas de la migración 20261024120000 (MONEO AUTO en Android).
-- Ejecutar SOLO contra staging, como postgres. Termina en ROLLBACK.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);
CREATE FUNCTION moneo_test.ok(cond boolean, label text, detail text DEFAULT '') RETURNS void
LANGUAGE sql AS $$ INSERT INTO moneo_test.results (ok, label, detail) VALUES (coalesce(cond, false), label, detail) $$;
CREATE FUNCTION moneo_test.as_user(u uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
-- Runs `sql` as `who`; returns the first column or 'ERR <sqlstate>'.
CREATE FUNCTION moneo_test.run(who uuid, sql text, r text DEFAULT 'authenticated') RETURNS text
LANGUAGE plpgsql AS $$
DECLARE out text;
BEGIN
  PERFORM moneo_test.as_user(who);
  EXECUTE format('SET LOCAL ROLE %I', r);
  EXECUTE sql INTO out;
  RESET ROLE;
  RETURN out;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'ERR ' || SQLSTATE;
END $$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-00000000a701';
  ub uuid := '00000000-0000-4000-8000-00000000a702';
  link jsonb;
  link2 jsonb;
  widget jsonb;
  tok text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'an1@t.local'), (ub, 'an2@t.local');

  link := moneo_test.run(ua, $q$SELECT public.create_companion_auto_device('Android · Pixel 8')$q$)::jsonb;
  tok := link->>'token';
  PERFORM moneo_test.ok(tok ~ '^[0-9a-f]{64}$', 'se crea el token de MONEO AUTO');
  PERFORM moneo_test.ok((SELECT can_auto AND platform = 'android' FROM public.companion_devices WHERE id = (link->>'id')::uuid),
                        'el dispositivo queda con permiso de MONEO AUTO');
  PERFORM moneo_test.ok(public.companion_auto_user(tok) = ua, 'el token identifica a su dueño');
  PERFORM moneo_test.ok(public.companion_auto_user('abc') IS NULL AND public.companion_auto_user(NULL) IS NULL
                        AND public.companion_auto_user(repeat('0', 64)) IS NULL, 'tokens inválidos no sirven');

  -- The widget token cannot send notifications.
  widget := moneo_test.run(ua, $q$SELECT public.create_companion_device('Android · Pixel 8', 'android')$q$)::jsonb;
  PERFORM moneo_test.ok(public.companion_auto_user(widget->>'token') IS NULL, 'el token del widget no sirve para AUTO');

  -- Linking again on the same phone replaces the previous link.
  link2 := moneo_test.run(ua, $q$SELECT public.create_companion_auto_device('Android · Pixel 8')$q$)::jsonb;
  PERFORM moneo_test.ok(public.companion_auto_user(tok) IS NULL AND public.companion_auto_user(link2->>'token') = ua,
                        'volver a vincular reemplaza el enlace anterior');

  -- Revoking from Configuración cuts it off.
  PERFORM moneo_test.run(ua, format($q$SELECT public.revoke_companion_device(%L)$q$, link2->>'id'));
  PERFORM moneo_test.ok(public.companion_auto_user(link2->>'token') IS NULL, 'desvincular corta MONEO AUTO');

  -- Only the service role (auto-notify) can resolve a token.
  PERFORM moneo_test.ok(moneo_test.run(ub, format($q$SELECT public.companion_auto_user(%L)$q$, tok)) LIKE 'ERR%',
                        'un usuario no puede resolver tokens');
  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.companion_auto_user(text)', 'EXECUTE'),
                        'sin sesión no se resuelven tokens');
  PERFORM moneo_test.ok(has_function_privilege('service_role', 'public.companion_auto_user(text)', 'EXECUTE'),
                        'auto-notify sí puede');
  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.create_companion_auto_device(text)', 'EXECUTE'),
                        'sin sesión no se vincula');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.companion_devices WHERE user_id = %L', ua)) = '0',
                        'B no ve los dispositivos de A');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FILTER (WHERE can_auto) FROM public.companion_devices') = '2',
                        'A ve sus enlaces de MONEO AUTO');

  -- Deleting the account removes the links.
  DELETE FROM auth.users WHERE id = ua;
  PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.companion_devices WHERE user_id = ua), 'borrar la cuenta borra los enlaces');
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

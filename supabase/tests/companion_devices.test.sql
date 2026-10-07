-- ============================================================
-- Pruebas de dispositivos de MONEO Companion (migración 20261016120000).
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
  r jsonb; tok text; dev uuid; s jsonb; n int; i int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency)
    VALUES (ua, 'BCP', 'banco', 1234.5, 'PEN');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  r := public.create_companion_device('Samsung A54', 'android');
  tok := r->>'token'; dev := (r->>'id')::uuid;
  PERFORM moneo_test.ok(length(tok) = 64, 'token aleatorio de 64 caracteres', length(tok)::text);
  PERFORM moneo_test.ok((SELECT token_hash FROM public.companion_devices WHERE id = dev)
                        = encode(sha256(convert_to(tok, 'UTF8')), 'hex')
                        AND (SELECT token_hash FROM public.companion_devices WHERE id = dev) <> tok,
                        'se guarda solo el hash');

  -- The widget reads its owner's summary, without movements, and with no session.
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  s := public.companion_widget(tok);
  PERFORM moneo_test.ok((s->>'available')::numeric = 1234.5, 'el widget ve el resumen del dueño', s->>'available');
  PERFORM moneo_test.ok(NOT (s ? 'recent'), 'sin lista de movimientos');
  PERFORM moneo_test.ok(current_setting('request.jwt.claims', true) = '{"role":"anon"}', 'restaura la sesión anterior',
                        current_setting('request.jwt.claims', true));
  PERFORM moneo_test.ok((SELECT last_seen_at IS NOT NULL FROM public.companion_devices WHERE id = dev), 'registra el último uso');
  PERFORM moneo_test.ok(public.companion_widget('x' || tok) IS NULL AND public.companion_widget(NULL) IS NULL,
                        'token desconocido: nada');

  -- Another user cannot revoke it; the owner can.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  PERFORM public.revoke_companion_device(dev);
  PERFORM moneo_test.ok(public.companion_widget(tok) IS NOT NULL, 'otro usuario no puede desvincularlo');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM public.revoke_companion_device(dev);
  PERFORM moneo_test.ok(public.companion_widget(tok) IS NULL, 'desvinculado: deja de funcionar al instante');

  -- At most 10 active devices.
  FOR i IN 1..10 LOOP PERFORM public.create_companion_device('Tel ' || i, 'android'); END LOOP;
  BEGIN
    PERFORM public.create_companion_device('Tel 11', 'android');
    PERFORM moneo_test.ok(false, 'límite de 10');
  EXCEPTION WHEN invalid_parameter_value THEN
    PERFORM moneo_test.ok(true, 'límite de 10 dispositivos activos');
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.create_companion_device('PC', 'linux');
    PERFORM moneo_test.ok(false, 'plataforma inválida');
  EXCEPTION WHEN check_violation THEN
    PERFORM moneo_test.ok(true, 'solo plataformas conocidas');
  END;

  -- Privileges.
  PERFORM moneo_test.ok(NOT has_column_privilege('authenticated', 'public.companion_devices', 'token_hash', 'SELECT'),
                        'el hash no se puede leer desde la app');
  PERFORM moneo_test.ok(NOT has_table_privilege('authenticated', 'public.companion_devices', 'INSERT')
                        AND NOT has_table_privilege('authenticated', 'public.companion_devices', 'UPDATE'),
                        'sin escritura directa');
  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.create_companion_device(text, text)', 'EXECUTE'),
                        'sin sesión no se vincula');
  PERFORM moneo_test.ok(has_function_privilege('anon', 'public.companion_widget(text)', 'EXECUTE'),
                        'el widget entra sin sesión, solo con su token');

  -- Deleting the account removes its devices.
  DELETE FROM auth.users WHERE id = ua;
  SELECT count(*) INTO n FROM public.companion_devices WHERE user_id = ua;
  PERFORM moneo_test.ok(n = 0, 'al borrar la cuenta se borran sus dispositivos', n::text);
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

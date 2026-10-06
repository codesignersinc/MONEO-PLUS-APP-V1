-- ============================================================
-- Pruebas de direcciones de MONEO AUTO (migración 20261006140000).
--
-- Ejecutar SOLO contra staging, como postgres (SQL Editor o psql). Todo ocurre
-- en una transacción que termina en ROLLBACK: no deja usuarios ni datos.
-- El resultado es la tabla final (ok, prueba, detalle); todas deben salir ok = true.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
GRANT USAGE ON SCHEMA moneo_test TO authenticated;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);

-- Ejecuta `sql` como el usuario `uid` (rol authenticated + JWT) y devuelve el
-- primer valor del resultado como texto.
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

-- Espera que `sql` falle como `uid` con un mensaje que contenga `pattern`.
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
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  a1 text; a2 text; a3 text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');

  a1 := moneo_test.run(ua, 'SELECT public.get_or_create_auto_address()');
  PERFORM moneo_test.ok(a1 ~ '^u-[a-z0-9]{12}@auto\.moneo\.plus$', 'crea dirección con token de 12 caracteres', a1);
  a2 := moneo_test.run(ua, 'SELECT public.get_or_create_auto_address()');
  PERFORM moneo_test.ok(a1 = a2, 'la segunda llamada devuelve la misma dirección');
  a3 := moneo_test.run(ua, 'SELECT public.get_or_create_auto_address(true)');
  PERFORM moneo_test.ok(a3 <> a1, 'regenerar cambia la dirección');
  PERFORM moneo_test.ok((SELECT count(*) = 1 FROM public.auto_addresses WHERE user_id = ua), 'una sola fila por usuario');

  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.auto_addresses') = '1', 'A ve su dirección');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*) FROM public.auto_addresses') = '0', 'B no ve la dirección de A');
  PERFORM moneo_test.fails(ub, format('INSERT INTO public.auto_addresses (user_id, token) VALUES (%L, %L)', ub, 'abcdefghijkm'), 'permission denied', 'no se insertan direcciones directamente');
  PERFORM moneo_test.fails(ua, format('UPDATE public.auto_addresses SET token = %L', 'abcdefghijkm'), 'permission denied', 'no se cambia el token directamente');
  PERFORM moneo_test.fails(ua, 'SELECT public.auto_new_token()', 'permission denied', 'auto_new_token no es invocable por usuarios');

  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT public.get_or_create_auto_address()') <> a3, 'B obtiene otra dirección');
  DELETE FROM auth.users WHERE id = ua;
  PERFORM moneo_test.ok((SELECT count(*) = 0 FROM public.auto_addresses WHERE user_id = ua), 'borrar el usuario borra su dirección');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

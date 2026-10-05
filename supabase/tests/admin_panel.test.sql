-- ============================================================
-- Pruebas del panel de administración (migración 20261005120000).
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
  adm uuid := '00000000-0000-4000-8000-0000000000ad';
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  acc uuid := '00000000-0000-4000-8000-00000000a001';
  j uuid;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (adm, 'adm@test.local', '{}'),
    (ua, 'a@test.local', '{"full_name":"Ana Test"}'),
    (ub, 'b@test.local', '{}');
  INSERT INTO public.app_admins (user_id) VALUES (adm);
  INSERT INTO public.accounts (id, user_id, name, account_type, institution, balance, currency, icon, color, bg_color)
    VALUES (acc, ua, 'Soles', 'banco', '', 100, 'PEN', '', '', '');
  INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    VALUES (ua, acc, 'G1', 'Comida', -10, now(), 'gasto'), (ua, acc, 'G2', 'Comida', -5, now(), 'gasto'),
           (ua, acc, 'I1', 'Ingreso', 50, now(), 'ingreso');
  INSERT INTO public.juntas (user_id, name, status) VALUES (ub, 'Junta B', 'activa') RETURNING id INTO j;
  INSERT INTO public.junta_members (junta_id, user_id, display_name, role, status) VALUES (j, ua, 'Ana', 'member', 'active');

  PERFORM moneo_test.ok(moneo_test.run(adm, 'SELECT public.is_app_admin()')::boolean, 'admin: is_app_admin = true');
  PERFORM moneo_test.ok(NOT moneo_test.run(ua, 'SELECT public.is_app_admin()')::boolean, 'usuario: is_app_admin = false');
  PERFORM moneo_test.fails(ua, 'SELECT count(*) FROM public.admin_users_overview()', 'solo para administradores', 'usuario normal no ve el panel');
  PERFORM moneo_test.fails(ua, 'SELECT count(*) FROM public.app_admins', 'permission denied', 'usuario no lee app_admins');
  PERFORM moneo_test.fails(ua, format('INSERT INTO public.app_admins (user_id) VALUES (%L)', ua), 'permission denied', 'usuario no se hace admin');

  PERFORM moneo_test.ok(moneo_test.run(adm, 'SELECT count(*) FROM public.admin_users_overview()')::int >= 3, 'admin lista usuarios');
  PERFORM moneo_test.ok(moneo_test.run(adm, format(
    'SELECT row(email, full_name, cuentas, gastos, ingresos, juntas_organiza, juntas_participa)::text FROM public.admin_users_overview() WHERE user_id = %L', ua))
    = '(a@test.local,"Ana Test",1,2,1,0,1)', 'conteos de Ana',
    moneo_test.run(adm, format('SELECT row(email, full_name, cuentas, gastos, ingresos, juntas_organiza, juntas_participa)::text FROM public.admin_users_overview() WHERE user_id = %L', ua)));
  PERFORM moneo_test.ok(moneo_test.run(adm, format(
    'SELECT juntas_organiza::text FROM public.admin_users_overview() WHERE user_id = %L', ub)) = '1', 'B organiza 1 junta');
  PERFORM moneo_test.ok(
    (SELECT NOT EXISTS (SELECT 1 FROM information_schema.routines r JOIN information_schema.parameters p ON p.specific_name = r.specific_name
       WHERE r.routine_name = 'admin_users_overview' AND p.parameter_mode = 'OUT' AND p.parameter_name ~ 'amount|balance|monto|saldo')),
    'el panel no devuelve montos');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

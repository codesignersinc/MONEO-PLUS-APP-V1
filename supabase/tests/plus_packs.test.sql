-- ============================================================
-- Pruebas de MONEO PLUS Duo / Familiar y la regla PLUS de HOGAR
-- (migración 20261013120000; requiere la de HOGAR 20261012120000).
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
  ua uuid := '00000000-0000-4000-8000-0000000000a1';  -- paga el pack
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  uc uuid := '00000000-0000-4000-8000-0000000000c1';
  ud uuid := '00000000-0000-4000-8000-0000000000d1';
  ue uuid := '00000000-0000-4000-8000-0000000000e1';
  tok text; tok2 text; h uuid; j jsonb;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (ua, 'ana@test.local', '{}'), (ub, 'beto@test.local', '{}'), (uc, 'caro@test.local', '{}'),
    (ud, 'dani@test.local', '{}'), (ue, 'eva@test.local', '{}');

  PERFORM moneo_test.ok((SELECT seats FROM public.billing_plans WHERE code = 'duo_12m') = 2
    AND (SELECT seats FROM public.billing_plans WHERE code = 'family_monthly') = 6
    AND (SELECT seats FROM public.billing_plans WHERE code = 'pass_12m') = 1, 'cupos de los planes');
  PERFORM moneo_test.ok(moneo_test.run(ub, $q$SELECT count(*) FROM public.billing_plans WHERE code LIKE 'duo%' OR code LIKE 'family%'$q$) = '6', 'los 6 planes Duo/Familiar se listan');
  PERFORM moneo_test.fails(ua, $q$SELECT public.create_plus_pack_invite('Ana')$q$, 'Duo o Familiar', 'sin plan Duo no se invita');

  -- A compra Duo 1 año.
  INSERT INTO public.user_entitlements (user_id, plan_code, status, current_period_end, provider)
    VALUES (ua, 'duo_12m', 'active', now() + interval '1 year', 'mercadopago');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT public.has_plus()')::boolean, 'A (paga) tiene PLUS');
  PERFORM moneo_test.ok(NOT moneo_test.run(ub, 'SELECT public.has_plus()')::boolean, 'B aún no tiene PLUS');

  tok := moneo_test.run(ua, $q$SELECT public.create_plus_pack_invite('Ana')$q$);
  PERFORM moneo_test.ok(length(tok) = 64, 'A crea una invitación');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT row(owner_name, plan_name, status)::text FROM public.plus_pack_invite_info(%L)', tok))
    = '(Ana,"MONEO PLUS Duo 1 año (pago único)",valid)', 'B ve quién lo invita',
    moneo_test.run(ub, format('SELECT row(owner_name, plan_name, status)::text FROM public.plus_pack_invite_info(%L)', tok)));
  PERFORM moneo_test.fails(ua, format('SELECT public.accept_plus_pack_invite(%L, %L)', tok, 'Ana'), 'propio pack', 'A no se une a su propio pack');
  PERFORM moneo_test.run(ub, format('SELECT public.accept_plus_pack_invite(%L, %L)::text', tok, 'Beto'));
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT public.has_plus()')::boolean, 'B tiene PLUS por el pack');
  PERFORM moneo_test.fails(uc, format('SELECT public.accept_plus_pack_invite(%L, %L)', tok, 'Caro'), 'ya fue usada', 'la invitación es de un solo uso');
  PERFORM moneo_test.fails(ua, $q$SELECT public.create_plus_pack_invite('Ana')$q$, 'completo', 'Duo lleno: no hay más invitaciones');

  -- Qué ve cada uno.
  j := moneo_test.run(ua, 'SELECT public.my_plus_pack()::text')::jsonb;
  PERFORM moneo_test.ok(j->>'role' = 'owner' AND jsonb_array_length(j->'members') = 1
    AND j->'members'->0->>'name' = 'Beto' AND (j->'members'->0->>'covered')::boolean, 'A ve a Beto en su pack', j::text);
  j := moneo_test.run(ub, 'SELECT public.my_plus_pack()::text')::jsonb;
  PERFORM moneo_test.ok(j->>'role' = 'member' AND j->>'owner_name' = 'Ana' AND NOT j ? 'members'
    AND (j->>'covered')::boolean, 'B ve solo quién paga, no a los demás', j::text);
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT public.my_plus_pack()->>''role''') IS NULL, 'C no tiene pack');
  PERFORM moneo_test.fails(ub, 'SELECT count(*) FROM public.plus_pack_members', 'permission denied', 'nadie lee las tablas del pack directo');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.user_entitlements WHERE user_id = %L', ua)) = '0', 'B no lee el plan de A');
  PERFORM moneo_test.fails(ub, $q$SELECT public.create_plus_pack_invite('Beto')$q$, 'Duo o Familiar', 'un miembro no invita');

  -- Quitar y volver a FREE; el plan de A vence.
  PERFORM moneo_test.fails(uc, format('SELECT public.remove_plus_pack_member(%L)', ub), 'no está en tu pack', 'C no saca a B');
  PERFORM moneo_test.run(ua, format('SELECT public.remove_plus_pack_member(%L)::text', ub));
  PERFORM moneo_test.ok(NOT moneo_test.run(ub, 'SELECT public.has_plus()')::boolean, 'B quitado vuelve a FREE');
  tok := moneo_test.run(ua, $q$SELECT public.create_plus_pack_invite('Ana', 'Caro@Test.local')$q$);
  PERFORM moneo_test.fails(ud, format('SELECT public.accept_plus_pack_invite(%L, %L)', tok, 'Dani'), 'otro correo', 'invitación amarrada a otro correo');
  PERFORM moneo_test.run(uc, format('SELECT public.accept_plus_pack_invite(%L, %L)::text', tok, 'Caro'));
  -- Inside one transaction now() does not move: make C the oldest member explicitly.
  UPDATE public.plus_pack_members SET joined_at = now() - interval '1 day' WHERE member_id = uc;
  UPDATE public.user_entitlements SET current_period_end = now() - interval '1 day' WHERE user_id = ua;
  PERFORM moneo_test.ok(NOT moneo_test.run(uc, 'SELECT public.has_plus()')::boolean, 'si el plan de A vence, C pierde PLUS');
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT (public.my_plus_pack()->>''covered'')') = 'false', 'C ve que su cupo no está activo');

  -- Familiar: 5 personas además de quien paga; bajar a Duo deja solo al más antiguo.
  UPDATE public.user_entitlements SET plan_code = 'family_12m', current_period_end = now() + interval '1 year' WHERE user_id = ua;
  FOREACH tok2 IN ARRAY ARRAY[ub::text, ud::text, ue::text] LOOP
    tok := moneo_test.run(ua, $q$SELECT public.create_plus_pack_invite('Ana')$q$);
    PERFORM moneo_test.run(tok2::uuid, format('SELECT public.accept_plus_pack_invite(%L, %L)::text', tok, 'Miembro'));
  END LOOP;
  PERFORM moneo_test.ok(moneo_test.run(ue, 'SELECT public.has_plus()')::boolean
    AND moneo_test.run(uc, 'SELECT public.has_plus()')::boolean, 'Familiar: 4 miembros con PLUS');
  UPDATE public.user_entitlements SET plan_code = 'duo_12m' WHERE user_id = ua;
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT public.has_plus()')::boolean
    AND NOT moneo_test.run(ub, 'SELECT public.has_plus()')::boolean
    AND NOT moneo_test.run(ue, 'SELECT public.has_plus()')::boolean, 'al bajar a Duo solo el más antiguo conserva PLUS');
  PERFORM moneo_test.fails(ua, $q$SELECT public.create_plus_pack_invite('Ana')$q$, 'completo', 'con más miembros que cupos no se invita');

  -- Un miembro no se une a otro pack; salir.
  INSERT INTO public.user_entitlements (user_id, plan_code, status, current_period_end, provider)
    VALUES (ud, 'family_monthly', 'active', now() + interval '1 month', 'mercadopago')
    ON CONFLICT (user_id) DO UPDATE SET plan_code = EXCLUDED.plan_code, current_period_end = EXCLUDED.current_period_end;
  PERFORM moneo_test.fails(ud, $q$SELECT public.create_plus_pack_invite('Dani')$q$, 'Sal del pack', 'quien está en un pack no arma otro sin salir');
  PERFORM moneo_test.run(ud, 'SELECT public.leave_plus_pack()::text');
  tok := moneo_test.run(ud, $q$SELECT public.create_plus_pack_invite('Dani')$q$);
  PERFORM moneo_test.fails(ub, format('SELECT public.accept_plus_pack_invite(%L, %L)', tok, 'Beto'), 'Ya estás en un pack', 'un miembro no se une a un segundo pack');
  PERFORM moneo_test.ok(moneo_test.run(ud, 'SELECT count(*) FROM public.my_plus_pack_invitations()') = '1', 'quien paga ve sus invitaciones pendientes');
  PERFORM moneo_test.run(ud, format('SELECT public.revoke_plus_pack_invite(id)::text FROM public.my_plus_pack_invitations() LIMIT 1'));
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT status FROM public.plus_pack_invite_info(%L)', tok)) = 'revoked', 'invitación anulada');

  -- HOGAR: si un miembro tiene PLUS, el hogar lo tiene para todos.
  PERFORM moneo_test.run(ub, 'SELECT public.leave_plus_pack()::text');
  h := moneo_test.run(ub, $q$SELECT public.create_household('Casa', 'Beto')$q$)::uuid;
  tok := moneo_test.run(ub, format('SELECT public.create_household_invite(%L)', h));
  PERFORM moneo_test.run(ue, format('SELECT public.accept_household_invite(%L, %L)::text', tok, 'Eva'));
  PERFORM moneo_test.ok(NOT moneo_test.run(ub, format('SELECT public.household_has_plus(%L)', h))::boolean, 'hogar sin PLUS: nadie tiene PLUS');
  -- Eva está en el pack de A sin cupo activo (solo C lo tiene): le damos un pase propio.
  INSERT INTO public.user_entitlements (user_id, plan_code, status, current_period_end, provider)
    VALUES (ue, 'pass_3m', 'active', now() + interval '3 months', 'mercadopago')
    ON CONFLICT (user_id) DO UPDATE SET plan_code = EXCLUDED.plan_code, current_period_end = EXCLUDED.current_period_end;
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT public.household_has_plus(%L)', h))::boolean, 'un miembro con PLUS abre el hogar para todos');
  PERFORM moneo_test.ok(NOT moneo_test.run(ub, 'SELECT public.has_plus()')::boolean, 'pero B sigue sin PLUS personal');
  PERFORM moneo_test.ok(NOT moneo_test.run(ua, format('SELECT public.household_has_plus(%L)', h))::boolean, 'quien no es del hogar no lo consulta');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

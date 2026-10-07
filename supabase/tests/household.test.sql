-- ============================================================
-- Pruebas de MONEO HOGAR (migración 20261012120000).
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
  ua uuid := '00000000-0000-4000-8000-0000000000a1';  -- Félix (owner)
  ub uuid := '00000000-0000-4000-8000-0000000000b1';  -- Sophia
  uc uuid := '00000000-0000-4000-8000-0000000000c1';  -- ajeno
  ud uuid := '00000000-0000-4000-8000-0000000000d1';  -- invitado por correo
  acc_a uuid := '00000000-0000-4000-8000-00000000a001';
  acc_b uuid := '00000000-0000-4000-8000-00000000b001';
  h uuid; h2 uuid; ma uuid; mb uuid; md uuid;
  tok text; tok2 text; tok_mail text; tx_a uuid; tx_b uuid; tx_b2 uuid;
  e1 uuid; e2 uuid; st uuid; g uuid; bal numeric;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (ua, 'felix@test.local', '{}'), (ub, 'sophia@test.local', '{}'),
    (uc, 'otro@test.local', '{}'), (ud, 'dani@test.local', '{}');
  INSERT INTO public.accounts (id, user_id, name, account_type, institution, balance, currency, icon, color, bg_color) VALUES
    (acc_a, ua, 'BCP Félix', 'banco', 'BCP', 5000, 'PEN', '', '', ''),
    (acc_b, ub, 'Interbank Sophia', 'banco', 'Interbank', 3000, 'PEN', '', '', '');

  -- Crear hogar e invitar.
  h := moneo_test.run(ua, $q$SELECT public.create_household('Nuestro hogar', 'Félix', 'Félix + Sophia', 'PEN')$q$)::uuid;
  PERFORM moneo_test.ok(h IS NOT NULL, 'A crea su hogar');
  PERFORM moneo_test.fails(ua, $q$SELECT public.create_household('Otro', 'Félix')$q$, 'Ya perteneces', 'A no crea un segundo hogar');
  PERFORM moneo_test.fails(ub, format('SELECT public.create_household_invite(%L)', h), 'Solo quien administra', 'B (ajena) no invita');
  tok := moneo_test.run(ua, format('SELECT public.create_household_invite(%L)', h));
  PERFORM moneo_test.ok(length(tok) = 64, 'la invitación devuelve un token de 64 caracteres');
  PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.household_invitations WHERE token_hash = tok), 'el token no se guarda en claro');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT row(household_name, inviter_name, status)::text FROM public.household_invite_info(%L)', tok))
    = '("Nuestro hogar",Félix,valid)', 'B ve a qué hogar la invitan',
    moneo_test.run(ub, format('SELECT row(household_name, inviter_name, status)::text FROM public.household_invite_info(%L)', tok)));
  PERFORM moneo_test.ok(moneo_test.run(ub, $q$SELECT status FROM public.household_invite_info('x')$q$) = 'invalid', 'token falso = invalid');
  PERFORM moneo_test.fails(ub, $q$SELECT public.accept_household_invite('no-existe', 'Sophia')$q$, 'no es válida', 'token falso no se acepta');

  -- Antes de aceptar, B no ve nada.
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.households WHERE id = %L', h)) = '0', 'B no ve el hogar antes de aceptar');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*) FROM public.household_members') = '0', 'B no ve miembros antes de aceptar');

  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT public.accept_household_invite(%L, %L)', tok, 'Sophia'))::uuid = h, 'B acepta la invitación');
  PERFORM moneo_test.fails(uc, format('SELECT public.accept_household_invite(%L, %L)', tok, 'Otro'), 'ya fue usada', 'invitación usada no se reutiliza');
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT count(*) FROM public.households WHERE id = %L', h)) = '1', 'A ve el hogar');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.households WHERE id = %L', h)) = '1', 'B ve el hogar');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*) FROM public.household_members') = '2', 'B ve a los 2 miembros');
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT count(*) FROM public.households') = '0', 'un ajeno no ve hogares');
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT count(*) FROM public.household_members') = '0', 'un ajeno no ve miembros');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*) FROM public.household_invitations') = '0', 'un miembro no ve las invitaciones');
  PERFORM moneo_test.fails(ua, 'SELECT token_hash FROM public.household_invitations', 'permission denied', 'nadie lee el hash del token');

  -- Invitación vencida, anulada y amarrada a un correo.
  tok2 := moneo_test.run(ua, format('SELECT public.create_household_invite(%L)', h));
  UPDATE public.household_invitations SET expires_at = now() - interval '1 minute'
    WHERE token_hash = encode(sha256(convert_to(tok2, 'UTF8')), 'hex');
  PERFORM moneo_test.fails(uc, format('SELECT public.accept_household_invite(%L, %L)', tok2, 'Otro'), 'venció', 'invitación vencida no se acepta');
  tok2 := moneo_test.run(ua, format('SELECT public.create_household_invite(%L)', h));
  PERFORM moneo_test.run(ua, format('SELECT public.revoke_household_invite(id)::text FROM public.household_invitations WHERE household_id = %L AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()', h));
  PERFORM moneo_test.fails(uc, format('SELECT public.accept_household_invite(%L, %L)', tok2, 'Otro'), 'anulada', 'invitación anulada no se acepta');
  tok_mail := moneo_test.run(ua, format('SELECT public.create_household_invite(%L, %L)', h, 'Dani@Test.local'));
  PERFORM moneo_test.fails(uc, format('SELECT public.accept_household_invite(%L, %L)', tok_mail, 'Otro'), 'otro correo', 'invitación de otro correo no se acepta');
  PERFORM moneo_test.fails(ub, format('SELECT public.accept_household_invite(%L, %L)', tok_mail, 'Sophia'), 'otro correo', 'ni siquiera por un miembro');

  SELECT id INTO ma FROM public.household_members WHERE household_id = h AND user_id = ua;
  SELECT id INTO mb FROM public.household_members WHERE household_id = h AND user_id = ub;

  -- Privacidad: las cuentas y movimientos siguen privados.
  tx_a := moneo_test.run(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    VALUES (%L, %L, 'Alquiler', 'Vivienda', -2600, now(), 'gasto') RETURNING id$q$, ua, acc_a))::uuid;
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.accounts WHERE user_id = %L', ua)) = '0', 'B NO ve las cuentas de A');
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT count(*) FROM public.accounts WHERE user_id = %L', ub)) = '0', 'A NO ve las cuentas de B');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.transactions WHERE user_id = %L', ua)) = '0', 'B NO ve los movimientos de A');

  -- Gasto compartido 50/50 vinculado al movimiento real de A.
  e1 := moneo_test.run(ua, format($q$SELECT public.save_household_expense(%L, NULL, %L, 'Alquiler', 'Vivienda', 2600, 'PEN', 1, current_date, 'shared',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 50), jsonb_build_object('member_id', %L, 'percentage', 50)),
    true, 'monthly', current_date + 30, NULL, %L)$q$, h, ma, ma, mb, tx_a))::uuid;
  PERFORM moneo_test.ok(e1 IS NOT NULL, 'A crea un gasto compartido');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT string_agg(amount::text, ''/'' ORDER BY amount) FROM public.household_expense_splits WHERE expense_id = %L', e1)) = '1300.00/1300.00', '50/50: S/1,300 cada uno');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT name FROM public.household_expenses WHERE id = %L', e1)) = 'Alquiler', 'B ve el gasto compartido');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.transactions WHERE id = %L', tx_a)) = '0', 'B no lee el movimiento vinculado');
  SELECT balance INTO bal FROM public.accounts WHERE id = acc_b;
  PERFORM moneo_test.ok(bal = 3000, 'el saldo de B no cambia por el gasto compartido', bal::text);
  SELECT balance INTO bal FROM public.accounts WHERE id = acc_a;
  PERFORM moneo_test.ok(bal = 2400, 'solo baja el saldo de quien pagó', bal::text);

  -- B no puede vincular un movimiento ajeno ni reutilizar el de A.
  PERFORM moneo_test.fails(ub, format($q$SELECT public.save_household_expense(%L, NULL, %L, 'X', 'Otros', 10, 'PEN', 1, current_date, 'shared',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 100)), false, NULL, NULL, NULL, %L)$q$, h, mb, mb, tx_a),
    'propios movimientos', 'B no vincula el movimiento de A');

  -- Proporcional (71.4/28.6), redondeo y 70/30.
  e2 := moneo_test.run(ub, format($q$SELECT public.save_household_expense(%L, NULL, %L, 'Internet', 'Servicios', 70, 'PEN', 1, current_date, 'shared',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 71.4), jsonb_build_object('member_id', %L, 'percentage', 28.6)))$q$, h, mb, ma, mb))::uuid;
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT string_agg(amount::text, ''/'' ORDER BY amount DESC) FROM public.household_expense_splits WHERE expense_id = %L', e2)) = '49.98/20.02', 'proporcional: 49.98 / 20.02 (suman 70)',
    moneo_test.run(ua, format('SELECT string_agg(amount::text, ''/'' ORDER BY amount DESC) FROM public.household_expense_splits WHERE expense_id = %L', e2)));
  PERFORM moneo_test.fails(ua, format($q$SELECT public.save_household_expense(%L, NULL, %L, 'X', 'Otros', 10, 'PEN', 1, current_date, 'shared',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 70), jsonb_build_object('member_id', %L, 'percentage', 20)))$q$, h, ma, ma, mb),
    'sumar 100', 'personalizado que no suma 100 se rechaza');
  PERFORM moneo_test.fails(ua, format($q$SELECT public.save_household_expense(%L, NULL, %L, 'X', 'Otros', 10, 'PEN', 1, current_date, 'member',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 50), jsonb_build_object('member_id', %L, 'percentage', 50)))$q$, h, ma, ma, mb),
    'no es válido', 'gasto de una persona con 2 responsables se rechaza');

  -- Multimoneda: USD a PEN con la tasa guardada.
  PERFORM moneo_test.run(ua, format($q$SELECT public.save_household_expense(%L, NULL, %L, 'Netflix', 'Suscripciones', 10.50, 'USD', 3.75, current_date, 'member',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 100)))$q$, h, ma, ma));
  PERFORM moneo_test.ok(moneo_test.run(ub, $q$SELECT row(amount, currency_code, base_amount, exchange_rate)::text FROM public.household_expenses WHERE name = 'Netflix'$q$)
    = '(10.50,USD,39.38,3.75000000)', 'USD guarda monto original y equivalente en PEN',
    moneo_test.run(ub, $q$SELECT row(amount, currency_code, base_amount, exchange_rate)::text FROM public.household_expenses WHERE name = 'Netflix'$q$));
  PERFORM moneo_test.fails(ua, format('UPDATE public.households SET base_currency = ''USD'' WHERE id = %L RETURNING 1', h), 'no se puede cambiar', 'la moneda del hogar no cambia con gastos');

  -- Edición y borrado: B no edita ni borra el gasto de A; el owner sí borra.
  PERFORM moneo_test.fails(ub, format($q$SELECT public.save_household_expense(%L, %L, %L, 'Alquiler', 'Vivienda', 1, 'PEN', 1, current_date, 'shared',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 100)))$q$, h, e1, ma, mb), 'Solo quien lo registró', 'B no edita el gasto de A');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('WITH d AS (DELETE FROM public.household_expenses WHERE id = %L RETURNING 1) SELECT count(*) FROM d', e1)) = '0', 'B no borra el gasto de A');
  PERFORM moneo_test.fails(ub, format('INSERT INTO public.household_expenses (household_id, paid_by, name, category, amount, currency_code, base_amount, exchange_rate, expense_date) VALUES (%L, %L, ''X'', ''Otros'', 1, ''PEN'', 1, 1, current_date) RETURNING 1', h, mb),
    'permission denied', 'no se insertan gastos sin la función');

  -- Un ajeno no puede tocar nada del hogar.
  PERFORM moneo_test.fails(uc, format($q$SELECT public.save_household_expense(%L, NULL, %L, 'X', 'Otros', 10, 'PEN', 1, current_date, 'member',
    jsonb_build_array(jsonb_build_object('member_id', %L, 'percentage', 100)))$q$, h, ma, ma), 'No perteneces', 'un ajeno no crea gastos');
  PERFORM moneo_test.ok(moneo_test.run(uc, 'SELECT count(*) FROM public.household_expenses') = '0', 'un ajeno no ve gastos');
  PERFORM moneo_test.fails(uc, format('INSERT INTO public.household_budgets (household_id, category, monthly_limit) VALUES (%L, ''Vivienda'', 100) RETURNING 1', h), 'row-level security', 'un ajeno no crea presupuestos');
  PERFORM moneo_test.ok(moneo_test.run(uc, format('WITH u AS (UPDATE public.households SET name = ''Hack'' WHERE id = %L RETURNING 1) SELECT count(*) FROM u', h)) = '0', 'un ajeno no edita el hogar');

  -- Configuración: solo el owner; cada uno su ingreso declarado.
  PERFORM moneo_test.ok(moneo_test.run(ub, format('WITH u AS (UPDATE public.households SET split_method = ''income'' WHERE id = %L RETURNING 1) SELECT count(*) FROM u', h)) = '0', 'B (member) no cambia el reparto');
  PERFORM moneo_test.run(ua, format('UPDATE public.households SET split_method = ''income'' WHERE id = %L RETURNING 1', h));
  PERFORM moneo_test.ok((SELECT split_method FROM public.households WHERE id = h) = 'income', 'el owner guarda el método de reparto');
  PERFORM moneo_test.run(ub, format('UPDATE public.household_members SET declared_income = 3151 WHERE id = %L RETURNING 1', mb));
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT declared_income::text FROM public.household_members WHERE id = %L', mb)) = '3151.00', 'B declara su ingreso y A lo ve (decisión 2)');
  PERFORM moneo_test.fails(ua, format('UPDATE public.household_members SET declared_income = 1 WHERE id = %L RETURNING 1', mb), 'propio nombre', 'A no cambia el ingreso de B');
  PERFORM moneo_test.fails(ub, format('UPDATE public.household_members SET custom_pct = 90 WHERE id = %L RETURNING 1', mb), 'Solo quien administra', 'B no cambia los porcentajes');
  PERFORM moneo_test.fails(ub, format('UPDATE public.household_members SET role = ''owner'' WHERE id = %L RETURNING 1', mb), 'permission denied', 'B no se hace owner');

  -- Presupuesto y metas.
  PERFORM moneo_test.run(ub, format('INSERT INTO public.household_budgets (household_id, category, monthly_limit) VALUES (%L, ''Comida'', 2000) RETURNING 1', h));
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT monthly_limit::text FROM public.household_budgets') = '2000.00', 'B crea un presupuesto y A lo ve');
  g := moneo_test.run(ua, format('INSERT INTO public.household_goals (household_id, created_by, name, kind, target_amount) VALUES (%L, %L, ''Fondo de emergencia'', ''emergency'', 66078) RETURNING id', h, ua))::uuid;
  PERFORM moneo_test.run(ub, format('INSERT INTO public.household_goal_contributions (goal_id, household_id, member_id, created_by, amount) VALUES (%L, %L, %L, %L, 500) RETURNING 1', g, h, mb, ub));
  PERFORM moneo_test.fails(ub, format('INSERT INTO public.household_goal_contributions (goal_id, household_id, member_id, created_by, amount) VALUES (%L, %L, %L, %L, 500) RETURNING 1', g, h, ma, ub),
    'row-level security', 'B no registra aportes a nombre de A');
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT sum(amount)::text FROM public.household_goal_contributions WHERE goal_id = %L', g)) = '500.00', 'A ve el aporte de B');

  -- Compensación: dos confirmaciones, cada una con su movimiento real.
  st := moneo_test.run(ua, format('INSERT INTO public.household_settlements (household_id, period, from_member, to_member, amount, created_by) VALUES (%L, date_trunc(''month'', current_date)::date, %L, %L, 1300, %L) RETURNING id', h, mb, ma, ua))::uuid;
  PERFORM moneo_test.fails(ua, format('SELECT public.confirm_household_settlement_paid(%L, NULL)', st), 'Solo quien paga', 'A no confirma el pago de B');
  tx_b := moneo_test.run(ub, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    VALUES (%L, %L, 'Compensación hogar', 'Hogar', -1300, now(), 'gasto') RETURNING id$q$, ub, acc_b))::uuid;
  PERFORM moneo_test.fails(ub, format('SELECT public.confirm_household_settlement_paid(%L, %L)', st, tx_a), 'propios movimientos', 'B no confirma con el movimiento de A');
  PERFORM moneo_test.run(ub, format('SELECT public.confirm_household_settlement_paid(%L, %L)::text', st, tx_b));
  PERFORM moneo_test.ok((SELECT status FROM public.household_settlements WHERE id = st) = 'proposed', 'solo pagada: aún no está saldada');
  PERFORM moneo_test.fails(ub, format('SELECT public.set_household_settlement_status(%L, ''waived'')', st), 'ya tiene un pago', 'no se anula una compensación ya pagada');
  tx_b2 := moneo_test.run(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    VALUES (%L, %L, 'Compensación hogar', 'Ingreso', 1300, now(), 'ingreso') RETURNING id$q$, ua, acc_a))::uuid;
  PERFORM moneo_test.run(ua, format('SELECT public.confirm_household_settlement_received(%L, %L)::text', st, tx_b2));
  PERFORM moneo_test.ok((SELECT status FROM public.household_settlements WHERE id = st) = 'settled', 'pagada y recibida = saldada');
  SELECT balance INTO bal FROM public.accounts WHERE id = acc_b;
  PERFORM moneo_test.ok(bal = 1700, 'la compensación mueve el saldo real de B (3000 - 1300)', bal::text);
  SELECT balance INTO bal FROM public.accounts WHERE id = acc_a;
  PERFORM moneo_test.ok(bal = 3700, 'y el de A (2400 + 1300)', bal::text);
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.transactions WHERE id = %L', tx_b2)) = '0', 'B no ve el ingreso de A');

  -- Dejar para el próximo mes / sin compensación.
  st := moneo_test.run(ub, format('INSERT INTO public.household_settlements (household_id, period, from_member, to_member, amount, created_by) VALUES (%L, date_trunc(''month'', current_date)::date, %L, %L, 50, %L) RETURNING id', h, mb, ma, ub))::uuid;
  PERFORM moneo_test.run(ub, format('SELECT public.set_household_settlement_status(%L, ''deferred'')::text', st));
  PERFORM moneo_test.ok((SELECT status FROM public.household_settlements WHERE id = st) = 'deferred', 'dejar para el próximo mes');
  PERFORM moneo_test.fails(ub, format('UPDATE public.household_settlements SET status = ''settled'' WHERE id = %L RETURNING 1', st), 'permission denied', 'no se marca saldada a mano');

  -- Avisos: solo a los otros miembros.
  PERFORM moneo_test.ok(moneo_test.run(ua, format($q$SELECT public.notify_household(%L, 'household_expense', 'Nuevo gasto compartido', 'Félix agregó Alquiler')$q$, h)) = '1', 'el aviso llega a 1 co-miembro');
  PERFORM moneo_test.ok((SELECT count(*) FROM public.notifications WHERE user_id = ub AND type = 'household_expense') = 1, 'B recibe el aviso');
  PERFORM moneo_test.ok((SELECT count(*) FROM public.notifications WHERE user_id = ua AND type = 'household_expense') = 0, 'A no se avisa a sí mismo');
  PERFORM moneo_test.fails(uc, format($q$SELECT public.notify_household(%L, 'household_expense', 'Spam')$q$, h), 'No perteneces', 'un ajeno no envía avisos');
  PERFORM moneo_test.fails(ua, format($q$SELECT public.notify_household(%L, 'system', 'X')$q$, h), 'no válido', 'solo tipos de hogar');

  -- Simulación: no toca movimientos.
  PERFORM moneo_test.run(ub, format($q$INSERT INTO public.household_simulations (household_id, created_by, name, cuts, monthly_saving) VALUES (%L, %L, 'Menos delivery', jsonb_build_array(jsonb_build_object('expense_id', %L, 'cut', 200)), 200) RETURNING 1$q$, h, ub, e2));
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.household_simulations') = '1', 'A ve la simulación guardada');

  -- Roles: quitar, transferir, salir.
  PERFORM moneo_test.fails(ub, format('SELECT public.remove_household_member(%L)', ma), 'Solo quien administra', 'B no quita a A');
  PERFORM moneo_test.fails(ua, format('SELECT public.leave_household(%L)', h), 'pasa la administración', 'el owner no sale sin transferir');
  PERFORM moneo_test.run(ua, format('SELECT public.transfer_household_ownership(%L)::text', mb));
  PERFORM moneo_test.ok((SELECT role FROM public.household_members WHERE id = mb) = 'owner' AND (SELECT role FROM public.household_members WHERE id = ma) = 'member', 'owner transferido a B');
  PERFORM moneo_test.run(ub, format('SELECT public.remove_household_member(%L)::text', ma));
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT count(*) FROM public.households WHERE id = %L', h)) = '0', 'A quitado ya no ve el hogar');
  PERFORM moneo_test.ok(moneo_test.run(ua, 'SELECT count(*) FROM public.household_expenses') = '0', 'A quitado ya no ve los gastos');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT display_name FROM public.household_members WHERE id = %L', ma)) = 'Félix', 'el historial conserva el nombre de A');
  PERFORM moneo_test.ok((SELECT count(*) FROM public.transactions WHERE id = tx_a) = 1, 'el movimiento privado de A sigue intacto');

  -- A puede crear otro hogar; usuario eliminado; borrar hogar.
  h2 := moneo_test.run(ua, $q$SELECT public.create_household('Casa de playa', 'Félix')$q$)::uuid;
  tok := moneo_test.run(ua, format('SELECT public.create_household_invite(%L)', h2));
  PERFORM moneo_test.run(uc, format('SELECT public.accept_household_invite(%L, %L)::text', tok, 'Carla'));
  DELETE FROM auth.users WHERE id = ua;
  PERFORM moneo_test.ok((SELECT role FROM public.household_members WHERE household_id = h2 AND user_id = uc) = 'owner', 'si el owner borra su cuenta, el otro miembro pasa a owner');
  PERFORM moneo_test.ok((SELECT status FROM public.household_members WHERE household_id = h2 AND user_id IS NULL) = 'left', 'el miembro eliminado queda como "salió"');
  PERFORM moneo_test.run(uc, format('SELECT public.delete_household(%L)::text', h2));
  PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.households WHERE id = h2), 'el owner elimina el hogar');
  PERFORM moneo_test.run(ub, format('SELECT public.leave_household(%L)::text', h));
  PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.households WHERE id = h), 'la última persona que sale elimina el hogar');
  PERFORM moneo_test.ok((SELECT balance FROM public.accounts WHERE id = acc_b) = 1700, 'las cuentas privadas no se tocan al borrar el hogar');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

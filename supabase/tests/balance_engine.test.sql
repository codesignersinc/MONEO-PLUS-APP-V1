-- ============================================================
-- Pruebas del motor de saldo y transferencias (migración 20261004120100).
--
-- Ejecutar SOLO contra staging, como postgres (SQL Editor o psql). Todo ocurre
-- en una transacción que termina en ROLLBACK: no deja usuarios ni datos.
-- El resultado es la tabla final (ok, prueba, detalle); todas deben salir ok = true.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
GRANT USAGE ON SCHEMA moneo_test TO authenticated;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);
CREATE TABLE moneo_test.depth_log (tbl text, depth int);
GRANT INSERT ON moneo_test.depth_log TO authenticated;

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

CREATE FUNCTION moneo_test.bal(acc uuid) RETURNS numeric LANGUAGE sql AS $$
  SELECT balance FROM public.accounts WHERE id = acc $$;

-- Registra pg_trigger_depth() en los triggers BEFORE UPDATE (donde viven las guardas)
-- y AFTER UPDATE de cada tabla, para comprobar qué ven en una acción referencial.
CREATE FUNCTION moneo_test.log_depth() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO moneo_test.depth_log VALUES (TG_TABLE_NAME || ':' || lower(TG_WHEN), pg_trigger_depth());
  RETURN NEW;
END $$;
CREATE TRIGGER zz_test_depth_before BEFORE UPDATE ON public.currency_exchanges FOR EACH ROW EXECUTE FUNCTION moneo_test.log_depth();
CREATE TRIGGER zz_test_depth_before BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION moneo_test.log_depth();
CREATE TRIGGER zz_test_depth_before BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION moneo_test.log_depth();
CREATE TRIGGER zz_test_depth_after AFTER UPDATE ON public.currency_exchanges FOR EACH ROW EXECUTE FUNCTION moneo_test.log_depth();
CREATE TRIGGER zz_test_depth_after AFTER UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION moneo_test.log_depth();
CREATE TRIGGER zz_test_depth_after AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION moneo_test.log_depth();

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  a1 uuid := '00000000-0000-4000-8000-00000000a001'; -- PEN 1000
  a2 uuid := '00000000-0000-4000-8000-00000000a002'; -- PEN 500
  a3 uuid := '00000000-0000-4000-8000-00000000a003'; -- USD 100
  b1 uuid := '00000000-0000-4000-8000-00000000b001'; -- PEN 300 (usuario B)
  tx uuid; legacy uuid; tr uuid; tr2 uuid; ex uuid;
  n int;
BEGIN
  -- ── Datos ──
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.accounts (id, user_id, name, account_type, institution, balance, currency, icon, color, bg_color) VALUES
    (a1, ua, 'A1', 'banco', '', 1000, 'PEN', '', '', ''),
    (a2, ua, 'A2', 'banco', '', 500, 'PEN', '', '', ''),
    (a3, ua, 'A3', 'banco', '', 100, 'USD', '', '', ''),
    (b1, ub, 'B1', 'banco', '', 300, 'PEN', '', '', '');

  -- ── Gasto / ingreso ──
  tx := moneo_test.run(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (%L, %L, 'g', 'c', 'i', 'A1', -50, now(), '10:00', 'gasto') RETURNING id$q$, ua, a1));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 950, 'gasto resta', moneo_test.bal(a1)::text);
  PERFORM moneo_test.run(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (%L, %L, 'i', 'c', 'i', 'A1', 200, now(), '10:00', 'ingreso') RETURNING id$q$, ua, a1));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 1150, 'ingreso suma', moneo_test.bal(a1)::text);

  PERFORM moneo_test.run(ua, format('UPDATE public.transactions SET amount = -80 WHERE id = %L RETURNING id', tx));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 1120, 'editar monto revierte y aplica', moneo_test.bal(a1)::text);
  PERFORM moneo_test.run(ua, format('UPDATE public.transactions SET account_id = %L WHERE id = %L RETURNING id', a2, tx));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 1200 AND moneo_test.bal(a2) = 420, 'cambiar de cuenta mueve el gasto',
    moneo_test.bal(a1)::text || ' / ' || moneo_test.bal(a2)::text);
  PERFORM moneo_test.run(ua, format('UPDATE public.transactions SET balance_applied = false WHERE id = %L RETURNING id', tx));
  PERFORM moneo_test.run(ua, format('DELETE FROM public.transactions WHERE id = %L RETURNING id', tx));
  PERFORM moneo_test.ok(moneo_test.bal(a2) = 500, 'borrar revierte (balance_applied no editable)', moneo_test.bal(a2)::text);

  PERFORM moneo_test.run(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (%L, NULL, 'p', 'c', 'i', 'Pagos', -70, now(), '10:00', 'gasto') RETURNING id$q$, ua));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 1200 AND moneo_test.bal(a2) = 500, 'sin cuenta no afecta saldos');

  -- ── Filas anteriores al motor (balance_applied = false) ──
  ALTER TABLE public.transactions DISABLE TRIGGER trg_transactions_guard;
  ALTER TABLE public.transactions DISABLE TRIGGER trg_transactions_balance;
  INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (ua, a1, 'old', 'c', 'i', 'A1', -30, now(), '10:00', 'gasto') RETURNING id INTO legacy;
  ALTER TABLE public.transactions ENABLE TRIGGER trg_transactions_guard;
  ALTER TABLE public.transactions ENABLE TRIGGER trg_transactions_balance;
  PERFORM moneo_test.run(ua, format('UPDATE public.transactions SET amount = -60 WHERE id = %L RETURNING id', legacy));
  PERFORM moneo_test.run(ua, format('DELETE FROM public.transactions WHERE id = %L RETURNING id', legacy));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 1200, 'fila antigua no mueve saldo al editar/borrar', moneo_test.bal(a1)::text);

  -- ── Seguridad de saldos ──
  PERFORM moneo_test.fails(ua, format('UPDATE public.accounts SET balance = 1 WHERE id = %L RETURNING id', a1), 'permission denied', 'cliente no puede editar balance');
  PERFORM moneo_test.run(ua, format($q$UPDATE public.accounts SET name = 'A1b' WHERE id = %L RETURNING id$q$, a1));
  PERFORM moneo_test.ok((SELECT name FROM public.accounts WHERE id = a1) = 'A1b', 'cliente sí edita el nombre');
  PERFORM moneo_test.ok(NOT has_column_privilege('service_role', 'public.accounts', 'balance', 'UPDATE'), 'service_role sin UPDATE de balance');
  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.create_transfer(uuid, uuid, numeric, numeric, numeric, timestamptz, text, text)', 'EXECUTE'), 'anon sin create_transfer');
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (%L, %L, 'x', 'c', 'i', 'B1', -5, now(), '10:00', 'gasto') RETURNING id$q$, ua, b1), 'no pertenece', 'no se usa la cuenta de otro usuario');
  PERFORM moneo_test.ok(moneo_test.bal(b1) = 300, 'saldo ajeno intacto');

  PERFORM moneo_test.run(ua, format($q$SELECT public.adjust_account_balance(%L, 1234.567, 'conciliación')$q$, a1));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 1234.57, 'ajuste manual de saldo', moneo_test.bal(a1)::text);
  PERFORM moneo_test.ok((SELECT previous_balance = 1200 AND new_balance = 1234.57 AND reason = 'conciliación'
    FROM public.account_balance_adjustments WHERE account_id = a1), 'ajuste auditado');
  PERFORM moneo_test.fails(ub, format('SELECT public.adjust_account_balance(%L, 0)', a1), 'Cuenta inválida', 'B no ajusta cuentas de A');
  PERFORM moneo_test.run(ua, format('SELECT public.adjust_account_balance(%L, 1000)', a1));

  -- ── Transferencias ──
  tr := moneo_test.run(ua, format($q$SELECT public.create_transfer(%L, %L, 100, 27, 100, now(), 'Cambio', 'n')$q$, a1, a3));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 900 AND moneo_test.bal(a3) = 127, 'transferencia: origen − destino +',
    moneo_test.bal(a1)::text || ' / ' || moneo_test.bal(a3)::text);
  PERFORM moneo_test.ok((SELECT count(*) = 2 AND sum(amount) = -73
    AND bool_and((transfer_leg = 'out' AND amount = -100 AND currency_code = 'PEN' AND base_amount = -100)
              OR (transfer_leg = 'in' AND amount = 27 AND currency_code = 'USD' AND base_amount = 100))
    FROM public.transactions WHERE transfer_id = tr), 'dos patas con signo y moneda');
  SELECT id INTO tx FROM public.transactions WHERE transfer_id = tr AND transfer_leg = 'out';
  PERFORM moneo_test.fails(ua, format('UPDATE public.transactions SET amount = -1 WHERE id = %L RETURNING id', tx), 'operación de transferencia', 'no se edita una pata suelta');
  PERFORM moneo_test.fails(ua, format('DELETE FROM public.transactions WHERE id = %L RETURNING id', tx), 'operación de transferencia', 'no se borra una pata suelta');
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (%L, %L, 't', 'c', 'i', 'A1', -5, now(), '10:00', 'transferencia') RETURNING id$q$, ua, a1), 'operación de transferencia', 'no se inserta una transferencia directa');
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.transfers (user_id, from_account_id, to_account_id, from_amount, from_currency, to_amount, to_currency, exchange_rate, base_currency_code, base_amount, transfer_date)
    VALUES (%L, %L, %L, 1, 'PEN', 1, 'PEN', 1, 'PEN', 1, now()) RETURNING id$q$, ua, a1, a2), 'permission denied', 'transfers no admite INSERT directo');
  PERFORM moneo_test.fails(ua, format('SELECT public.create_transfer(%L, %L, 10, 10, 10, now())', a1, b1), 'Cuenta inválida', 'no se transfiere a cuenta ajena');
  PERFORM moneo_test.fails(ua, format('SELECT public.create_transfer(%L, %L, 10, 10, 10, now())', a1, a1), 'Cuentas iguales', 'origen y destino distintos');
  PERFORM moneo_test.fails(ua, format('SELECT public.create_transfer(%L, %L, 0, 10, 10, now())', a1, a2), 'Monto inválido', 'monto positivo');

  PERFORM moneo_test.run(ua, format($q$SELECT public.update_transfer(%L, %L, %L, 50, 13.5, 50, now(), 'Cambio 2', '')$q$, tr, a1, a3));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 950 AND moneo_test.bal(a3) = 113.5, 'editar transferencia',
    moneo_test.bal(a1)::text || ' / ' || moneo_test.bal(a3)::text);
  PERFORM moneo_test.run(ua, format($q$SELECT public.update_transfer(%L, %L, %L, 50, 13.5, 50, now(), 'Cambio 3', '')$q$, tr, a2, a3));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 1000 AND moneo_test.bal(a2) = 450 AND moneo_test.bal(a3) = 113.5, 'cambiar cuenta origen',
    moneo_test.bal(a1)::text || ' / ' || moneo_test.bal(a2)::text || ' / ' || moneo_test.bal(a3)::text);
  PERFORM moneo_test.ok((SELECT name FROM public.transactions WHERE transfer_id = tr AND transfer_leg = 'in') = 'Cambio 3', 'patas sincronizadas');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*)::text FROM public.transfers') = '0', 'B no ve transferencias de A');
  PERFORM moneo_test.fails(ub, format('SELECT public.delete_transfer(%L)', tr), 'no encontrada', 'B no borra transferencias de A');
  PERFORM moneo_test.run(ua, format('SELECT public.delete_transfer(%L)', tr));
  PERFORM moneo_test.ok(moneo_test.bal(a2) = 500 AND moneo_test.bal(a3) = 100
    AND NOT EXISTS (SELECT 1 FROM public.transactions WHERE transfer_id = tr), 'borrar transferencia revierte ambas patas');

  -- ── Conversiones ──
  ex := moneo_test.run(ua, format($q$INSERT INTO public.currency_exchanges (user_id, from_account_id, to_account_id, from_currency, from_amount, to_currency, to_amount, exchange_rate, exchange_date)
    VALUES (%L, %L, %L, 'PEN', 37, 'USD', 10, 0.27, '2026-10-04') RETURNING id$q$, ua, a1, a3));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 963 AND moneo_test.bal(a3) = 110, 'conversión: origen −from destino +to',
    moneo_test.bal(a1)::text || ' / ' || moneo_test.bal(a3)::text);
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.currency_exchanges (user_id, from_account_id, to_account_id, from_currency, from_amount, to_currency, to_amount, exchange_rate, exchange_date)
    VALUES (%L, %L, %L, 'USD', 37, 'USD', 10, 1, '') RETURNING id$q$, ua, a1, a3), 'origen inválida', 'conversión con moneda incorrecta');
  PERFORM moneo_test.fails(ua, format('UPDATE public.currency_exchanges SET from_amount = 1 WHERE id = %L RETURNING id', ex), 'permission denied', 'conversión no editable');
  PERFORM moneo_test.fails(ua, format('DELETE FROM public.currency_exchanges WHERE id = %L RETURNING id', ex), 'permission denied', 'conversión no borrable por el cliente');

  -- ── Eliminar una cuenta con historial (acciones referenciales) ──
  tr2 := moneo_test.run(ua, format($q$SELECT public.create_transfer(%L, %L, 20, 5, 20, now())$q$, a1, a3));
  PERFORM moneo_test.run(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (%L, %L, 'usd', 'c', 'i', 'A3', -1, now(), '10:00', 'gasto') RETURNING id$q$, ua, a3));
  DELETE FROM moneo_test.depth_log;
  PERFORM moneo_test.run(ua, format('DELETE FROM public.accounts WHERE id = %L RETURNING id', a3));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 943, 'borrar cuenta no toca el saldo de las otras', moneo_test.bal(a1)::text);
  PERFORM moneo_test.ok((SELECT from_account_id = a1 AND to_account_id IS NULL FROM public.currency_exchanges WHERE id = ex), 'conversión conservada con destino NULL');
  PERFORM moneo_test.ok((SELECT from_account_id = a1 AND to_account_id IS NULL FROM public.transfers WHERE id = tr2), 'transferencia conservada con destino NULL');
  PERFORM moneo_test.ok((SELECT count(*) = 2 AND count(account_id) = 1 FROM public.transactions WHERE transfer_id = tr2), 'patas conservadas, la del destino sin cuenta');
  PERFORM moneo_test.ok((SELECT count(*) FROM public.transactions WHERE user_id = ua AND name = 'usd' AND account_id IS NULL) = 1, 'movimiento de la cuenta queda sin cuenta');
  -- 4 filas tocadas por SET NULL: conversión, transferencia, pata 'in' y gasto USD.
  -- BEFORE (guardas) ven profundidad > 1; AFTER ven 1 (por eso no la usan).
  SELECT count(*) INTO n FROM moneo_test.depth_log WHERE tbl LIKE '%:before';
  PERFORM moneo_test.ok(n = 4 AND NOT EXISTS (SELECT 1 FROM moneo_test.depth_log WHERE tbl LIKE '%:before' AND depth <= 1),
    'acción referencial: guardas BEFORE con pg_trigger_depth() > 1',
    (SELECT string_agg(tbl || '=' || depth, ', ') FROM moneo_test.depth_log));
  PERFORM moneo_test.ok((SELECT count(*) = 4 AND bool_and(depth = 1) FROM moneo_test.depth_log WHERE tbl LIKE '%:after'),
    'acción referencial: triggers AFTER con pg_trigger_depth() = 1 y sin UPDATE extra',
    (SELECT string_agg(tbl || '=' || depth, ', ') FROM moneo_test.depth_log));
  PERFORM moneo_test.fails(ua, format($q$SELECT public.update_transfer(%L, %L, NULL, 20, 5, 20, now(), 'x', '')$q$, tr2, a1), 'Cuenta inválida', 'transferencia huérfana exige cuentas al editar');
  PERFORM moneo_test.run(ua, format('SELECT public.delete_transfer(%L)', tr2));
  PERFORM moneo_test.ok(moneo_test.bal(a1) = 963, 'borrar transferencia huérfana revierte la pata que queda', moneo_test.bal(a1)::text);

  -- ── Eliminar el usuario (cascada) con transferencias, conversiones y ajustes ──
  PERFORM moneo_test.run(ua, format('SELECT public.create_transfer(%L, %L, 10, 10, 10, now())', a1, a2));
  BEGIN
    DELETE FROM auth.users WHERE id = ua;
    PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = ua)
      AND NOT EXISTS (SELECT 1 FROM public.transactions WHERE user_id = ua)
      AND NOT EXISTS (SELECT 1 FROM public.transfers WHERE user_id = ua)
      AND NOT EXISTS (SELECT 1 FROM public.currency_exchanges WHERE user_id = ua), 'eliminar usuario borra todo en cascada');
  EXCEPTION WHEN OTHERS THEN
    PERFORM moneo_test.ok(false, 'eliminar usuario borra todo en cascada', SQLERRM);
  END;
  PERFORM moneo_test.ok(moneo_test.bal(b1) = 300, 'otro usuario intacto tras la cascada');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

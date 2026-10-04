-- ============================================================
-- Pruebas de pagos de deudas (migración 20261004120300).
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

CREATE FUNCTION moneo_test.bal(acc uuid) RETURNS numeric LANGUAGE sql AS $$
  SELECT balance FROM public.accounts WHERE id = acc $$;

CREATE FUNCTION moneo_test.debt_bal(id uuid) RETURNS numeric LANGUAGE sql AS $$
  SELECT balance FROM public.debts WHERE debts.id = $1 $$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  pen uuid := '00000000-0000-4000-8000-00000000a001'; -- PEN 1000
  usd uuid := '00000000-0000-4000-8000-00000000a003'; -- USD 100
  d1 uuid; tx uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.accounts (id, user_id, name, account_type, institution, balance, currency, icon, color, bg_color) VALUES
    (pen, ua, 'Soles', 'banco', '', 1000, 'PEN', '', '', ''),
    (usd, ua, 'Dólares', 'banco', '', 100, 'USD', '', '', '');

  d1 := moneo_test.run(ua, format($q$INSERT INTO public.debts (user_id, name, institution, balance) VALUES (%L, 'Tarjeta', 'BCP', 600) RETURNING id$q$, ua));
  PERFORM moneo_test.ok((SELECT original_amount = 600 FROM public.debts WHERE id = d1), 'nueva deuda: monto original = saldo');

  PERFORM moneo_test.run(ua, format('SELECT public.pay_debt(%L, %L, 200)', d1, pen));
  PERFORM moneo_test.ok(moneo_test.debt_bal(d1) = 400 AND moneo_test.bal(pen) = 800, 'pago parcial reduce deuda y cuenta',
    moneo_test.debt_bal(d1)::text || ' / ' || moneo_test.bal(pen)::text);
  PERFORM moneo_test.ok((SELECT original_amount = 600 FROM public.debts WHERE id = d1), 'monto original se conserva');
  SELECT transaction_id INTO tx FROM public.debt_payments WHERE debt_id = d1;
  PERFORM moneo_test.ok((SELECT amount = -200 AND transaction_type = 'gasto' AND category = 'Deudas' AND account_id = pen FROM public.transactions WHERE id = tx), 'gasto registrado');

  PERFORM moneo_test.fails(ua, format('SELECT public.pay_debt(%L, %L, 500)', d1, pen), 'supera el saldo', 'no se paga más que el saldo');
  PERFORM moneo_test.fails(ua, format('SELECT public.pay_debt(%L, %L, 0)', d1, pen), 'Monto inválido', 'monto positivo');
  PERFORM moneo_test.fails(ua, format('SELECT public.pay_debt(%L, %L, 50)', d1, usd), 'moneda de la cuenta', 'cuenta USD exige monto en USD');
  PERFORM moneo_test.run(ua, format('SELECT public.pay_debt(%L, %L, 37.5, 10)', d1, usd));
  PERFORM moneo_test.ok(moneo_test.debt_bal(d1) = 362.5 AND moneo_test.bal(usd) = 90, 'pago desde cuenta USD',
    moneo_test.debt_bal(d1)::text || ' / ' || moneo_test.bal(usd)::text);

  PERFORM moneo_test.fails(ub, format('SELECT public.pay_debt(%L, %L, 10)', d1, pen), 'no encontrada', 'B no paga deudas de A');
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.debt_payments (user_id, debt_id, amount) VALUES (%L, %L, 1) RETURNING id$q$, ua, d1), 'permission denied', 'sin INSERT directo en debt_payments');

  -- Borrar el gasto devuelve el monto a la deuda y a la cuenta.
  PERFORM moneo_test.run(ua, format('DELETE FROM public.transactions WHERE id = %L RETURNING id', tx));
  PERFORM moneo_test.ok(moneo_test.debt_bal(d1) = 562.5 AND moneo_test.bal(pen) = 1000
    AND NOT EXISTS (SELECT 1 FROM public.debt_payments WHERE transaction_id = tx), 'borrar el gasto revierte el pago',
    moneo_test.debt_bal(d1)::text || ' / ' || moneo_test.bal(pen)::text);

  -- Pago total.
  PERFORM moneo_test.run(ua, format('SELECT public.pay_debt(%L, %L, 562.5)', d1, pen));
  PERFORM moneo_test.ok(moneo_test.debt_bal(d1) = 0 AND moneo_test.bal(pen) = 437.5, 'pago total deja la deuda en 0');

  -- Editar el saldo por encima del original sube el original.
  PERFORM moneo_test.run(ua, format('UPDATE public.debts SET balance = 900 WHERE id = %L RETURNING id', d1));
  PERFORM moneo_test.ok((SELECT original_amount = 900 FROM public.debts WHERE id = d1), 'original >= saldo al editar');

  BEGIN
    DELETE FROM auth.users WHERE id = ua;
    PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.debts WHERE user_id = ua), 'eliminar usuario borra deudas y pagos');
  EXCEPTION WHEN OTHERS THEN
    PERFORM moneo_test.ok(false, 'eliminar usuario borra deudas y pagos', SQLERRM);
  END;
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

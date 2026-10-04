-- ============================================================
-- Pruebas de Pagos e Ingresos con cuenta (migración 20261004120200).
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

CREATE FUNCTION moneo_test.pago(id uuid) RETURNS public.pagos LANGUAGE sql AS $$
  SELECT * FROM public.pagos WHERE pagos.id = $1 $$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  pen uuid := '00000000-0000-4000-8000-00000000a001'; -- PEN 1000
  usd uuid := '00000000-0000-4000-8000-00000000a003'; -- USD 100
  b1 uuid := '00000000-0000-4000-8000-00000000b001';
  p1 uuid; p2 uuid; inc uuid; tx uuid; tx2 uuid; manual uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.accounts (id, user_id, name, account_type, institution, balance, currency, icon, color, bg_color) VALUES
    (pen, ua, 'Soles', 'banco', '', 1000, 'PEN', '', '', ''),
    (usd, ua, 'Dólares', 'banco', '', 100, 'USD', '', '', ''),
    (b1, ub, 'B', 'banco', '', 300, 'PEN', '', '', '');

  -- ── Permisos ──
  p1 := moneo_test.run(ua, format($q$INSERT INTO public.pagos (user_id, name, category, category_icon, amount, payment_date, notes, is_recurring, payment_day)
    VALUES (%L, 'Luz', 'Servicios', '💡', 100, '2026-01-31', '', true, 31) RETURNING id$q$, ua));
  PERFORM moneo_test.ok((moneo_test.pago(p1)).status = 'pendiente', 'pago nuevo queda pendiente');
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 1000, 'pendiente no mueve saldo');
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.pagos (user_id, name, amount, status) VALUES (%L, 'x', 1, 'pagado') RETURNING id$q$, ua), 'permission denied', 'cliente no inserta status');
  PERFORM moneo_test.fails(ua, format($q$UPDATE public.pagos SET status = 'pagado' WHERE id = %L RETURNING id$q$, p1), 'permission denied', 'cliente no edita status');
  PERFORM moneo_test.fails(ua, format($q$UPDATE public.income_entries SET status = 'cobrado' RETURNING id$q$), 'permission denied', 'cliente no edita status de ingresos');

  -- ── Marcar pagado ──
  tx := moneo_test.run(ua, format('SELECT public.mark_pago_paid(%L, %L)', p1, pen));
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 900, 'pagado resta de la cuenta', moneo_test.bal(pen)::text);
  PERFORM moneo_test.ok((SELECT status = 'pagado' AND transaction_id = tx FROM public.pagos WHERE id = p1), 'pago guarda transaction_id');
  PERFORM moneo_test.ok((SELECT amount = -100 AND transaction_type = 'gasto' AND account_id = pen AND original_amount = -100 AND base_amount = -100
    AND currency_code = 'PEN' AND exchange_rate_date = '2026-01-31' AND name = 'Luz' FROM public.transactions WHERE id = tx), 'movimiento del pago');
  PERFORM moneo_test.ok((SELECT payment_date = '2026-02-28' AND status = 'pendiente' AND is_recurring FROM public.pagos WHERE generated_from = p1),
    'recurrente: siguiente mes (31 → 28 feb)', (SELECT payment_date FROM public.pagos WHERE generated_from = p1));
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT public.mark_pago_paid(%L, %L)', p1, pen)) = tx::text AND moneo_test.bal(pen) = 900,
    'marcar dos veces es idempotente');

  -- ── Editar un pago pagado ──
  PERFORM moneo_test.run(ua, format($q$UPDATE public.pagos SET amount = 120, name = 'Luz enero' WHERE id = %L RETURNING id$q$, p1));
  PERFORM moneo_test.ok((SELECT amount = -120 AND original_amount = -120 AND name = 'Luz enero' FROM public.transactions WHERE id = tx)
    AND moneo_test.bal(pen) = 880, 'editar monto actualiza movimiento y saldo', moneo_test.bal(pen)::text);

  -- ── Volver a pendiente y re-marcar ──
  PERFORM moneo_test.run(ua, format('SELECT public.mark_pago_pending(%L)', p1));
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 1000 AND NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = tx)
    AND (moneo_test.pago(p1)).status = 'pendiente' AND (moneo_test.pago(p1)).transaction_id IS NULL, 'pendiente borra el movimiento por id');
  tx := moneo_test.run(ua, format('SELECT public.mark_pago_paid(%L, %L)', p1, pen));
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 880 AND (SELECT count(*) FROM public.pagos WHERE generated_from = p1) = 1,
    're-marcar no duplica el recurrente');

  -- ── Cuenta en otra moneda ──
  p2 := moneo_test.run(ua, format($q$INSERT INTO public.pagos (user_id, name, amount, payment_date) VALUES (%L, 'Netflix', 37.5, '') RETURNING id$q$, ua));
  PERFORM moneo_test.fails(ua, format('SELECT public.mark_pago_paid(%L, %L)', p2, usd), 'moneda de la cuenta', 'cuenta en USD exige el monto en USD');
  tx2 := moneo_test.run(ua, format('SELECT public.mark_pago_paid(%L, %L, 10)', p2, usd));
  PERFORM moneo_test.ok(moneo_test.bal(usd) = 90 AND (SELECT amount = -10 AND original_amount = -37.5 AND currency_code = 'PEN' FROM public.transactions WHERE id = tx2),
    'pago desde cuenta USD', moneo_test.bal(usd)::text);
  PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.pagos WHERE generated_from = p2), 'no recurrente no genera siguiente');
  PERFORM moneo_test.run(ua, format($q$UPDATE public.pagos SET amount = 75 WHERE id = %L RETURNING id$q$, p2));
  PERFORM moneo_test.ok(moneo_test.bal(usd) = 80, 'editar monto escala el monto en USD', moneo_test.bal(usd)::text);

  -- ── Borrar el movimiento desde Movimientos ──
  PERFORM moneo_test.run(ua, format('DELETE FROM public.transactions WHERE id = %L RETURNING id', tx2));
  PERFORM moneo_test.ok(moneo_test.bal(usd) = 100 AND (moneo_test.pago(p2)).status = 'pendiente' AND (moneo_test.pago(p2)).transaction_id IS NULL,
    'borrar el movimiento devuelve el pago a pendiente');

  -- ── Aislamiento ──
  PERFORM moneo_test.fails(ub, format('SELECT public.mark_pago_paid(%L, %L)', p2, b1), 'no encontrado', 'B no marca pagos de A');
  PERFORM moneo_test.fails(ua, format('SELECT public.mark_pago_paid(%L, %L)', p2, b1), 'Cuenta inválida', 'A no paga con cuenta de B');
  PERFORM moneo_test.fails(ua, format('SELECT public.mark_pago_paid(%L, NULL)', p2), 'Cuenta inválida', 'cuenta obligatoria');
  PERFORM moneo_test.ok(moneo_test.bal(b1) = 300, 'saldo de B intacto');

  -- ── Ingresos (incluye C-08) ──
  inc := moneo_test.run(ua, format($q$INSERT INTO public.income_entries (user_id, name, amount, collection_date) VALUES (%L, 'Sueldo', 200, '2026-10-04') RETURNING id$q$, ua));
  manual := moneo_test.run(ua, format($q$INSERT INTO public.transactions (user_id, account_id, name, category, category_icon, account_name, amount, transaction_date, transaction_time, transaction_type)
    VALUES (%L, %L, 'Sueldo', 'Ingreso', '💰', 'Soles', 200, now(), '10:00', 'ingreso') RETURNING id$q$, ua, pen));
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 1080, 'ingreso manual con mismo nombre y monto', moneo_test.bal(pen)::text);
  tx := moneo_test.run(ua, format('SELECT public.mark_income_collected(%L, %L)', inc, pen));
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 1280 AND (SELECT amount = 200 AND transaction_type = 'ingreso' FROM public.transactions WHERE id = tx), 'cobrado suma a la cuenta');
  PERFORM moneo_test.ok(moneo_test.run(ua, format('SELECT public.mark_income_collected(%L, %L)', inc, pen)) = tx::text AND moneo_test.bal(pen) = 1280, 'cobrar dos veces es idempotente');
  PERFORM moneo_test.run(ua, format($q$UPDATE public.income_entries SET amount = 250 WHERE id = %L RETURNING id$q$, inc));
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 1330, 'editar ingreso cobrado actualiza saldo', moneo_test.bal(pen)::text);
  PERFORM moneo_test.run(ua, format('SELECT public.mark_income_pending(%L)', inc));
  PERFORM moneo_test.ok(moneo_test.bal(pen) = 1080 AND EXISTS (SELECT 1 FROM public.transactions WHERE id = manual)
    AND NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = tx), 'C-08: pendiente borra solo su movimiento');

  -- ── Eliminar el usuario con pagos/ingresos vinculados ──
  PERFORM moneo_test.run(ua, format('SELECT public.mark_income_collected(%L, %L)', inc, pen));
  BEGIN
    DELETE FROM auth.users WHERE id = ua;
    PERFORM moneo_test.ok(NOT EXISTS (SELECT 1 FROM public.pagos WHERE user_id = ua)
      AND NOT EXISTS (SELECT 1 FROM public.income_entries WHERE user_id = ua), 'eliminar usuario borra pagos e ingresos');
  EXCEPTION WHEN OTHERS THEN
    PERFORM moneo_test.ok(false, 'eliminar usuario borra pagos e ingresos', SQLERRM);
  END;
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

-- ============================================================
-- Pruebas de MONEO AUTO fase A (migración 20261006120000).
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
  acc_a uuid := '00000000-0000-4000-8000-00000000a001';
  acc_b uuid := '00000000-0000-4000-8000-00000000b001';
  tx_b uuid;
  s1 uuid;
  fp text := repeat('a', 64);
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.accounts (id, user_id, name, account_type, institution, balance, currency, icon, color, bg_color) VALUES
    (acc_a, ua, 'Interbank', 'banco', 'Interbank', 100, 'PEN', '', '', ''),
    (acc_b, ub, 'BCP', 'banco', 'BCP', 100, 'PEN', '', '', '');
  INSERT INTO public.transactions (user_id, account_id, name, category, amount, transaction_date, transaction_type)
    VALUES (ub, acc_b, 'B', 'Comida', -5, now(), 'gasto') RETURNING id INTO tx_b;

  s1 := moneo_test.run(ua, format($q$INSERT INTO public.auto_suggestions
    (source, bank, kind, movement_type, amount, merchant, occurred_date, card_last4, fingerprint)
    VALUES ('text', 'interbank', 'consumo', 'gasto', 21, 'Yopo', '2026-10-04', '4821', %L) RETURNING id$q$, fp));
  PERFORM moneo_test.ok(s1 IS NOT NULL, 'A crea una sugerencia (user_id por defecto)');
  PERFORM moneo_test.ok((SELECT user_id = ua AND status = 'pendiente' FROM public.auto_suggestions WHERE id = s1), 'dueño y estado pendiente');

  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.auto_suggestions
    (source, bank, kind, movement_type, amount, occurred_date, fingerprint)
    VALUES ('text', 'interbank', 'consumo', 'gasto', 21, '2026-10-04', %L)$q$, fp), 'duplicate key', 'misma huella no se repite');
  PERFORM moneo_test.ok(moneo_test.run(ub, format($q$INSERT INTO public.auto_suggestions
    (source, bank, kind, movement_type, amount, occurred_date, fingerprint)
    VALUES ('text', 'bcp', 'consumo', 'gasto', 21, '2026-10-04', %L) RETURNING 'ok'$q$, fp)) = 'ok', 'otra persona puede tener la misma huella');

  PERFORM moneo_test.ok(moneo_test.run(ub, format('SELECT count(*) FROM public.auto_suggestions WHERE id = %L', s1)) = '0', 'B no ve sugerencias de A');
  PERFORM moneo_test.ok(moneo_test.run(ub, format('WITH u AS (UPDATE public.auto_suggestions SET status = %L WHERE id = %L RETURNING 1) SELECT count(*) FROM u', 'ignorada', s1)) = '0', 'B no modifica sugerencias de A');
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.auto_suggestions (user_id, source, bank, kind, movement_type, amount, occurred_date)
    VALUES (%L, 'text', 'bcp', 'consumo', 'gasto', 1, '2026-10-04')$q$, ub), 'row-level security', 'A no crea sugerencias a nombre de B');

  PERFORM moneo_test.fails(ua, format('UPDATE public.auto_suggestions SET transaction_id = %L WHERE id = %L', tx_b, s1), 'Movimiento no encontrado', 'no se enlaza un movimiento de otro usuario');
  PERFORM moneo_test.fails(ua, $q$INSERT INTO public.auto_suggestions (source, bank, kind, movement_type, amount, occurred_date)
    VALUES ('text', 'bcp', 'consumo', 'gasto', -3, '2026-10-04')$q$, 'check constraint', 'monto positivo');
  PERFORM moneo_test.fails(ua, $q$INSERT INTO public.auto_suggestions (source, bank, kind, movement_type, amount, occurred_date, card_last4)
    VALUES ('text', 'bcp', 'consumo', 'gasto', 3, '2026-10-04', '4111111111111111')$q$, 'check constraint', 'solo últimos 4 dígitos');

  PERFORM moneo_test.ok(moneo_test.run(ua, format($q$INSERT INTO public.auto_rules (rule_type, match_key, account_id) VALUES ('card', '4821', %L) RETURNING 'ok'$q$, acc_a)) = 'ok', 'A guarda regla tarjeta → cuenta');
  PERFORM moneo_test.fails(ua, format($q$INSERT INTO public.auto_rules (rule_type, match_key, account_id) VALUES ('card', '9999', %L)$q$, acc_b), 'Cuenta no encontrada', 'no se usa la cuenta de otro usuario');
  PERFORM moneo_test.ok(moneo_test.run(ub, 'SELECT count(*) FROM public.auto_rules') = '0', 'B no ve reglas de A');

  PERFORM moneo_test.ok(moneo_test.run(ua, format('WITH u AS (UPDATE public.auto_suggestions SET status = %L, resolved_at = now() WHERE id = %L AND status = %L RETURNING 1) SELECT count(*) FROM u', 'registrada', s1, 'pendiente')) = '1', 'A registra su sugerencia');
  PERFORM moneo_test.ok(moneo_test.run(ua, format('WITH u AS (UPDATE public.auto_suggestions SET status = %L WHERE id = %L AND status = %L RETURNING 1) SELECT count(*) FROM u', 'registrada', s1, 'pendiente')) = '0', 'no se registra dos veces');

  DELETE FROM public.accounts WHERE id = acc_a;
  PERFORM moneo_test.ok((SELECT count(*) = 0 FROM public.auto_rules WHERE user_id = ua), 'borrar la cuenta borra sus reglas');
  DELETE FROM auth.users WHERE id = ua;
  PERFORM moneo_test.ok((SELECT count(*) = 0 FROM public.auto_suggestions WHERE user_id = ua), 'borrar el usuario borra sus sugerencias');
END $test$;

SELECT ok, label AS prueba, detail AS detalle FROM moneo_test.results ORDER BY n;

ROLLBACK;

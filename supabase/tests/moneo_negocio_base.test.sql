-- ============================================================
-- Pruebas de MONEO NEGOCIO, fase 1 (migración 20261020120000).
-- Ejecutar SOLO contra staging, como postgres. Termina en ROLLBACK.
-- ============================================================

BEGIN;

CREATE SCHEMA moneo_test;
CREATE TABLE moneo_test.results (n serial, ok boolean, label text, detail text);
CREATE FUNCTION moneo_test.ok(cond boolean, label text, detail text DEFAULT '') RETURNS void
LANGUAGE sql AS $$ INSERT INTO moneo_test.results (ok, label, detail) VALUES (coalesce(cond, false), label, detail) $$;
CREATE FUNCTION moneo_test.as_user(u uuid) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
CREATE FUNCTION moneo_test.tx(u uuid, acc uuid, kind text, amt numeric, day date, cat text DEFAULT 'Ventas',
                              forced_business uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.transactions (user_id, account_id, account_name, name, category, category_icon, amount,
    transaction_date, transaction_time, transaction_type, currency_code, original_amount, base_currency_code,
    base_amount, exchange_rate, exchange_rate_date, business_id)
  VALUES (u, acc, 'Cuenta', kind || ' prueba', cat, 'tag',
    CASE WHEN kind = 'gasto' THEN -amt ELSE amt END,
    (day::text || 'T12:00:00-05:00')::timestamptz, '12:00', kind, 'PEN',
    CASE WHEN kind = 'gasto' THEN -amt ELSE amt END, 'PEN',
    CASE WHEN kind = 'gasto' THEN -amt ELSE amt END, 1, day::text, forced_business)
  RETURNING id
$$;

DO $test$
DECLARE
  ua uuid := '00000000-0000-4000-8000-0000000000a1';
  ub uuid := '00000000-0000-4000-8000-0000000000b1';
  biz uuid; biz_b uuid; acc_p uuid; acc_b uuid; acc_other uuid;
  sup uuid; cli uuid; sup_b uuid;
  pago uuid; pago2 uuid; inc uuid; tx uuid; tr uuid; debt uuid;
  r record; n int; j jsonb; bal numeric; today date := '2026-10-15';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local');
  INSERT INTO public.user_profiles (id, email) VALUES (ua, 'a@test.local'), (ub, 'b@test.local')
    ON CONFLICT (id) DO NOTHING;
  PERFORM moneo_test.as_user(ua);

  -- Businesses: owner only, up to 5.
  INSERT INTO public.businesses (owner_id, name, kind) VALUES (ua, ' Codesigners ', 'Agencia') RETURNING id INTO biz;
  PERFORM moneo_test.ok((SELECT name FROM public.businesses WHERE id = biz) = 'Codesigners', 'crea negocio (nombre limpio)');
  INSERT INTO public.businesses (owner_id, name) SELECT ua, 'N' || g FROM generate_series(2, 5) g;
  BEGIN
    INSERT INTO public.businesses (owner_id, name) VALUES (ua, 'Sexto');
    PERFORM moneo_test.ok(false, 'máximo 5 negocios');
  EXCEPTION WHEN invalid_parameter_value THEN PERFORM moneo_test.ok(true, 'máximo 5 negocios');
  END;

  -- Accounts: one personal, one business.
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency) VALUES (ua, 'BCP personal', 'banco', 0, 'PEN')
    RETURNING id INTO acc_p;
  INSERT INTO public.accounts (user_id, name, account_type, balance, currency, business_id)
    VALUES (ua, 'BCP negocio', 'banco', 0, 'PEN', biz) RETURNING id INTO acc_b;

  -- Contacts.
  INSERT INTO public.business_parties (business_id, user_id, kind, name) VALUES (biz, ua, 'proveedor', 'Makro') RETURNING id INTO sup;
  INSERT INTO public.business_parties (business_id, user_id, kind, name) VALUES (biz, ua, 'cliente', 'Vega') RETURNING id INTO cli;

  -- Movements take the context of their account, whatever the client sends.
  tx := moneo_test.tx(ua, acc_b, 'ingreso', 5000, today, 'Ventas', NULL);
  PERFORM moneo_test.ok((SELECT business_id FROM public.transactions WHERE id = tx) = biz,
                        'movimiento en cuenta del negocio queda en el negocio');
  tx := moneo_test.tx(ua, acc_p, 'gasto', 100, today, 'Comida', biz);
  PERFORM moneo_test.ok((SELECT business_id FROM public.transactions WHERE id = tx) IS NULL,
                        'un movimiento personal no puede declararse del negocio');
  PERFORM moneo_test.tx(ua, acc_b, 'gasto', 1200, today, 'Compras');
  PERFORM moneo_test.tx(ua, acc_b, 'ingreso', 3000, '2026-09-10', 'Ventas');
  PERFORM moneo_test.tx(ua, acc_b, 'gasto', 800, '2026-09-12', 'Compras');
  SELECT balance INTO bal FROM public.accounts WHERE id = acc_b;
  PERFORM moneo_test.ok(bal = 6000, 'el motor de saldos mueve la cuenta del negocio', bal::text);
  SELECT balance INTO bal FROM public.accounts WHERE id = acc_p;
  PERFORM moneo_test.ok(bal = -100, 'y la cuenta personal por separado', bal::text);

  BEGIN
    UPDATE public.accounts SET business_id = NULL WHERE id = acc_b;
    PERFORM moneo_test.ok(false, 'cuenta con movimientos no cambia de contexto');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM moneo_test.ok(true, 'cuenta con movimientos no cambia de contexto');
  END;

  -- A business payment cannot be paid from a personal account; the call rolls back.
  INSERT INTO public.pagos (user_id, name, category, category_icon, amount, payment_date, notes, is_recurring, payment_day,
                            business_id, party_id)
  VALUES (ua, 'Mercadería', 'Compras', 'cart', 850, '2026-10-20', '', true, 20, biz, sup) RETURNING id INTO pago;
  BEGIN
    PERFORM public.mark_pago_paid(pago, acc_p, NULL);
    PERFORM moneo_test.ok(false, 'pago del negocio con cuenta personal');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM moneo_test.ok(true, 'pago del negocio con cuenta personal: rechazado');
  END;
  SELECT status, transaction_id INTO r FROM public.pagos WHERE id = pago;
  SELECT balance INTO bal FROM public.accounts WHERE id = acc_p;
  PERFORM moneo_test.ok(r.status = 'pendiente' AND r.transaction_id IS NULL AND bal = -100,
                        'y no queda nada a medias', r.status || ' ' || bal);

  -- Business payable and receivable before paying (for the summary).
  INSERT INTO public.income_entries (user_id, name, amount, category, category_icon, collection_date, notes, business_id, party_id)
  VALUES (ua, 'Proyecto web', 3500, 'Ventas', 'briefcase', '2026-10-25', '', biz, cli) RETURNING id INTO inc;
  INSERT INTO public.pagos (user_id, name, category, category_icon, amount, payment_date, notes, business_id)
  VALUES (ua, 'Internet oficina', 'Servicios', 'bulb', 150, '2026-11-05', '', biz) RETURNING id INTO pago2;
  INSERT INTO public.subscriptions (user_id, name, category, amount, active, next_payment_date, next_date, business_id)
  VALUES (ua, 'Figma', 'Software', 60, true, '2026-10-28', '2026-10-28', biz);

  -- Business summary (October 2026, today = the 15th).
  j := public.business_summary(biz, NULL, NULL, today);
  PERFORM moneo_test.ok((j ->> 'income')::numeric = 5000 AND (j ->> 'expense')::numeric = 1200
                        AND (j ->> 'result')::numeric = 3800, 'resultado del mes', j::text);
  PERFORM moneo_test.ok((j -> 'previous' ->> 'income')::numeric = 3000 AND (j -> 'previous' ->> 'expense')::numeric = 800,
                        'comparación con el mes anterior', (j -> 'previous')::text);
  PERFORM moneo_test.ok((j ->> 'cash')::numeric = 6000 AND (j ->> 'receivable')::numeric = 3500
                        AND (j ->> 'payable')::numeric = 1000, 'caja, por cobrar y por pagar', j::text);
  -- projected = 6000 + 3500 - 850 (Oct) - 60 (subscription); the November payment is out.
  PERFORM moneo_test.ok((j -> 'projection' ->> 'projected')::numeric = 8590
                        AND (j ->> 'committed')::numeric = 910, 'proyección a fin de mes', (j -> 'projection')::text);
  PERFORM moneo_test.ok(jsonb_array_length(j -> 'series') = 6 AND jsonb_array_length(j -> 'nextPayments') = 2
                        AND (j -> 'nextCollections' -> 0 ->> 'party') = 'Vega', 'serie, próximos pagos y cobros');

  -- Paying it from the business account works, copies the contact, and the next month's
  -- instance stays in the business.
  tx := public.mark_pago_paid(pago, acc_b, NULL);
  SELECT business_id, party_id INTO r FROM public.transactions WHERE id = tx;
  PERFORM moneo_test.ok(r.business_id = biz AND r.party_id = sup, 'pago con cuenta del negocio: movimiento con proveedor');
  SELECT business_id, party_id INTO r FROM public.pagos WHERE generated_from = pago;
  PERFORM moneo_test.ok(r.business_id = biz AND r.party_id = sup, 'el pago recurrente siguiente sigue en el negocio');

  -- Collections follow the same rule.
  BEGIN
    PERFORM public.mark_income_collected(inc, acc_p, NULL);
    PERFORM moneo_test.ok(false, 'cobro del negocio en cuenta personal');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM moneo_test.ok(true, 'cobro del negocio en cuenta personal: rechazado');
  END;
  tx := public.mark_income_collected(inc, acc_b, NULL);
  PERFORM moneo_test.ok((SELECT party_id FROM public.transactions WHERE id = tx) = cli, 'cobro con cliente');

  -- Personal summaries do not see the business (decision 1).
  j := public.moneo_summary(today);
  PERFORM moneo_test.ok((j ->> 'available')::numeric = -100, 'Inicio/Mini/widget: solo cuentas personales', j ->> 'available');
  SELECT count(*) INTO n FROM public.moneo_upcoming(today) u WHERE u.name IN ('Mercadería', 'Internet oficina', 'Figma');
  PERFORM moneo_test.ok(n = 0, 'próximos pagos personales sin los del negocio', n::text);
  SELECT count(*) INTO n FROM jsonb_array_elements(j -> 'recent') x WHERE x ->> 'name' LIKE 'ingreso%';
  PERFORM moneo_test.ok(n = 0, 'movimientos recientes personales sin el negocio', n::text);

  -- Owner withdrawal: a transfer between contexts, neither income nor expense.
  tr := public.create_transfer(acc_b, acc_p, 1000, 1000, 1000, '2026-10-15T15:00:00-05:00', 'Retiro del negocio', '');
  SELECT count(*) FILTER (WHERE business_id = biz AND transfer_leg = 'out') AS biz_out,
         count(*) FILTER (WHERE business_id IS NULL AND transfer_leg = 'in') AS personal_in INTO r
    FROM public.transactions WHERE transfer_id = tr;
  PERFORM moneo_test.ok(r.biz_out = 1 AND r.personal_in = 1, 'retiro: cada pata en su contexto', row_to_json(r)::text);
  j := public.business_summary(biz, NULL, NULL, today);
  PERFORM moneo_test.ok((j ->> 'result')::numeric = 3800 + 3500 - 850 AND (j ->> 'cash')::numeric = 6000 - 850 + 3500 - 1000,
                        'el retiro no es gasto, pero baja la caja', j::text);

  -- Household / debts only accept personal movements.
  INSERT INTO public.debts (user_id, name, balance) VALUES (ua, 'Tarjeta', 500) RETURNING id INTO debt;
  BEGIN
    INSERT INTO public.debt_payments (user_id, debt_id, transaction_id, amount) VALUES (ua, debt, tx, 100);
    PERFORM moneo_test.ok(false, 'deudas solo con movimientos personales');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM moneo_test.ok(true, 'deudas solo con movimientos personales');
  END;

  -- Another person: nothing of A is visible or usable.
  INSERT INTO public.businesses (owner_id, name) VALUES (ub, 'Otro') RETURNING id INTO biz_b;
  INSERT INTO public.business_parties (business_id, user_id, kind, name) VALUES (biz_b, ub, 'proveedor', 'X') RETURNING id INTO sup_b;
  PERFORM moneo_test.as_user(ub);
  BEGIN
    INSERT INTO public.accounts (user_id, name, account_type, balance, currency, business_id)
      VALUES (ub, 'Intruso', 'banco', 0, 'PEN', biz);
    PERFORM moneo_test.ok(false, 'cuenta en negocio ajeno');
  EXCEPTION WHEN foreign_key_violation THEN PERFORM moneo_test.ok(true, 'no se puede usar el negocio de otro');
  END;
  BEGIN
    PERFORM public.business_summary(biz);
    PERFORM moneo_test.ok(false, 'resumen de negocio ajeno');
  EXCEPTION WHEN insufficient_privilege THEN PERFORM moneo_test.ok(true, 'no se ve el resumen de otro negocio');
  END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.businesses WHERE id = biz;
  SELECT n + count(*) INTO n FROM public.business_parties WHERE business_id = biz;
  EXECUTE 'RESET ROLE';
  PERFORM moneo_test.ok(n = 0, 'RLS: negocios y contactos de otro no se ven', n::text);
  PERFORM moneo_test.as_user(ua);
  BEGIN
    UPDATE public.pagos SET party_id = sup_b WHERE id = pago2;
    PERFORM moneo_test.ok(false, 'contacto de otro negocio');
  EXCEPTION WHEN foreign_key_violation THEN PERFORM moneo_test.ok(true, 'un pago no usa contactos de otro negocio');
  END;

  PERFORM moneo_test.ok(NOT has_function_privilege('anon', 'public.business_summary(uuid,date,date,date)', 'EXECUTE'),
                        'sin sesión no hay resumen');

  -- Deleting the person removes everything without errors.
  DELETE FROM auth.users WHERE id = ua;
  SELECT count(*) INTO n FROM public.businesses WHERE owner_id = ua;
  SELECT n + count(*) INTO n FROM public.accounts WHERE user_id = ua;
  PERFORM moneo_test.ok(n = 0, 'eliminar la cuenta borra negocios y cuentas', n::text);
END
$test$;

SELECT ok, label, detail FROM moneo_test.results ORDER BY n;
ROLLBACK;

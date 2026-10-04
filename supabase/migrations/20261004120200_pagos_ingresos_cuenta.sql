-- ============================================================
-- Pagos e Ingresos con cuenta.
--
-- Un pago (obligación) o ingreso por cobrar pendiente no mueve saldo. Al marcarlo
-- como pagado/cobrado se elige la cuenta y la RPC crea el movimiento (que el motor
-- de saldo aplica) y guarda su id en transaction_id. Volver a pendiente borra ese
-- movimiento por id (corrige C-08, que borraba por nombre+monto). Marcar dos veces
-- no duplica nada. Editar monto/nombre/categoría/nota actualiza el movimiento.
--
-- status y transaction_id ya no los escribe el cliente: solo estas RPC.
-- Los montos de pagos e ingresos están en la moneda base del usuario; si la cuenta
-- usa otra moneda, el cliente envía el monto debitado/abonado en esa moneda.
-- ============================================================

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS transaction_id uuid NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_from uuid NULL REFERENCES public.pagos(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pagos_generated_from_uq ON public.pagos(generated_from) WHERE generated_from IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pagos_transaction_id_uq ON public.pagos(transaction_id) WHERE transaction_id IS NOT NULL;

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS transaction_id uuid NULL REFERENCES public.transactions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS income_entries_transaction_id_uq ON public.income_entries(transaction_id) WHERE transaction_id IS NOT NULL;

-- ─── Permisos: el cliente no escribe status ni transaction_id ────────────────

REVOKE INSERT, UPDATE ON public.pagos FROM anon, authenticated;
GRANT INSERT (user_id, name, category, category_icon, amount, payment_date, notes, is_recurring, payment_day)
  ON public.pagos TO authenticated;
GRANT UPDATE (name, category, category_icon, amount, payment_date, notes, is_recurring, payment_day, updated_at)
  ON public.pagos TO authenticated;

REVOKE INSERT, UPDATE ON public.income_entries FROM anon, authenticated;
GRANT INSERT (user_id, name, amount, category, category_icon, collection_date, notes)
  ON public.income_entries TO authenticated;
GRANT UPDATE (name, amount, category, category_icon, collection_date, notes, updated_at)
  ON public.income_entries TO authenticated;

-- ─── Utilidades ───────────────────────────────────────────────────────────────

-- Día YYYY-MM-DD (hora de Lima) → timestamptz al mediodía de ese día en Lima.
CREATE OR REPLACE FUNCTION public.obligation_tx_date(p_day text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_day date;
BEGIN
  BEGIN
    v_day := nullif(p_day, '')::date;
  EXCEPTION WHEN OTHERS THEN
    v_day := NULL;
  END;
  v_day := coalesce(v_day, (now() AT TIME ZONE 'America/Lima')::date);
  RETURN (v_day + time '12:00') AT TIME ZONE 'America/Lima';
END $$;

-- Crea el movimiento de un pago/ingreso en la cuenta elegida. p_amount va en la
-- moneda base (con signo); p_account_amount, en la moneda de la cuenta (positivo).
CREATE OR REPLACE FUNCTION public.obligation_create_tx(
  p_uid uuid, p_account_id uuid, p_account_amount numeric, p_type text, p_amount numeric,
  p_name text, p_category text, p_icon text, p_notes text, p_day text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_acc public.accounts%ROWTYPE;
  v_base text;
  v_sign int := CASE WHEN p_type = 'gasto' THEN -1 ELSE 1 END;
  v_acc_amount numeric;
  v_when timestamptz := public.obligation_tx_date(p_day);
  v_id uuid;
BEGIN
  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account_id AND user_id = p_uid;
  IF v_acc.id IS NULL THEN RAISE EXCEPTION 'Cuenta inválida' USING ERRCODE = '42501'; END IF;
  SELECT us.base_currency_code INTO v_base FROM public.user_settings us WHERE us.user_id = p_uid;
  v_base := coalesce(v_base, 'PEN');
  IF v_acc.currency = v_base THEN
    v_acc_amount := abs(p_amount);
  ELSE
    v_acc_amount := round(coalesce(p_account_amount, 0), 2);
    IF v_acc_amount <= 0 THEN
      RAISE EXCEPTION 'Indica el monto en la moneda de la cuenta' USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO public.transactions (user_id, account_id, account_name, name, category, category_icon, amount,
    transaction_date, transaction_time, transaction_type, notes,
    currency_code, original_amount, base_currency_code, base_amount, exchange_rate, exchange_rate_date)
  VALUES (p_uid, v_acc.id, v_acc.name, p_name, p_category, p_icon, v_sign * v_acc_amount,
    v_when, pg_catalog.to_char(now() AT TIME ZONE 'America/Lima', 'HH24:MI'), p_type, coalesce(p_notes, ''),
    v_base, v_sign * abs(p_amount), v_base, v_sign * abs(p_amount), 1,
    pg_catalog.to_char(v_when AT TIME ZONE 'America/Lima', 'YYYY-MM-DD'))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ─── Pagos ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_pago_paid(p_pago_id uuid, p_account_id uuid, p_account_amount numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.pagos%ROWTYPE;
  v_tx uuid;
  v_day date;
  v_next date;
  v_dom int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_p FROM public.pagos WHERE id = p_pago_id AND user_id = v_uid FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Pago no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_p.status = 'pagado' THEN RETURN v_p.transaction_id; END IF; -- idempotente
  IF v_p.amount <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023'; END IF;

  v_tx := public.obligation_create_tx(v_uid, p_account_id, p_account_amount, 'gasto', v_p.amount,
    v_p.name, v_p.category, v_p.category_icon, v_p.notes, v_p.payment_date);
  UPDATE public.pagos SET status = 'pagado', transaction_id = v_tx, updated_at = now() WHERE id = v_p.id;

  -- Recurrente: crea el del mes siguiente una sola vez (generated_from es único).
  IF v_p.is_recurring AND v_p.payment_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_day := v_p.payment_date::date;
    v_next := (date_trunc('month', v_day) + interval '1 month')::date;
    v_dom := least(coalesce(v_p.payment_day, extract(day FROM v_day)::int),
                   extract(day FROM (v_next + interval '1 month' - interval '1 day'))::int);
    v_next := v_next + (v_dom - 1);
    INSERT INTO public.pagos (user_id, name, category, category_icon, amount, payment_date, notes, status, is_recurring, payment_day, generated_from)
    VALUES (v_uid, v_p.name, v_p.category, v_p.category_icon, v_p.amount, pg_catalog.to_char(v_next, 'YYYY-MM-DD'), v_p.notes, 'pendiente', true, v_p.payment_day, v_p.id)
    ON CONFLICT (generated_from) WHERE generated_from IS NOT NULL DO NOTHING;
  END IF;
  RETURN v_tx;
END $$;

CREATE OR REPLACE FUNCTION public.mark_pago_pending(p_pago_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_p public.pagos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_p FROM public.pagos WHERE id = p_pago_id AND user_id = v_uid FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Pago no encontrado' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.pagos SET status = 'pendiente', transaction_id = NULL, updated_at = now() WHERE id = v_p.id;
  IF v_p.transaction_id IS NOT NULL THEN
    DELETE FROM public.transactions WHERE id = v_p.transaction_id AND user_id = v_uid;
  END IF;
END $$;

-- ─── Ingresos ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_income_collected(p_entry_id uuid, p_account_id uuid, p_account_amount numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_e public.income_entries%ROWTYPE; v_tx uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_e FROM public.income_entries WHERE id = p_entry_id AND user_id = v_uid FOR UPDATE;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Ingreso no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_e.status = 'cobrado' THEN RETURN v_e.transaction_id; END IF; -- idempotente
  IF v_e.amount <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023'; END IF;
  v_tx := public.obligation_create_tx(v_uid, p_account_id, p_account_amount, 'ingreso', v_e.amount,
    v_e.name, v_e.category, v_e.category_icon, v_e.notes, v_e.collection_date);
  UPDATE public.income_entries SET status = 'cobrado', transaction_id = v_tx, updated_at = now() WHERE id = v_e.id;
  RETURN v_tx;
END $$;

CREATE OR REPLACE FUNCTION public.mark_income_pending(p_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_e public.income_entries%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_e FROM public.income_entries WHERE id = p_entry_id AND user_id = v_uid FOR UPDATE;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Ingreso no encontrado' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.income_entries SET status = 'pendiente', transaction_id = NULL, updated_at = now() WHERE id = v_e.id;
  IF v_e.transaction_id IS NOT NULL THEN
    DELETE FROM public.transactions WHERE id = v_e.transaction_id AND user_id = v_uid;
  END IF;
END $$;

-- ─── Editar un pago/ingreso ya pagado/cobrado actualiza su movimiento ─────────

CREATE OR REPLACE FUNCTION public.obligation_sync_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_sign int := CASE WHEN TG_TABLE_NAME = 'pagos' THEN -1 ELSE 1 END;
BEGIN
  IF NEW.transaction_id IS NULL OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    RETURN NULL;
  END IF;
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023'; END IF;
  -- El monto en la moneda de la cuenta se escala en la misma proporción (exacto
  -- cuando la cuenta usa la moneda base).
  UPDATE public.transactions t SET
    name = NEW.name,
    category = NEW.category,
    category_icon = NEW.category_icon,
    notes = coalesce(NEW.notes, ''),
    amount = CASE WHEN NEW.amount = OLD.amount OR OLD.amount = 0 THEN t.amount
                  ELSE round(t.amount * NEW.amount / OLD.amount, 2) END,
    original_amount = v_sign * abs(NEW.amount),
    base_amount = v_sign * abs(NEW.amount),
    updated_at = now()
  WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_pagos_sync_tx AFTER UPDATE OF amount, name, category, category_icon, notes ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.obligation_sync_tx();
CREATE TRIGGER trg_income_entries_sync_tx AFTER UPDATE OF amount, name, category, category_icon, notes ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.obligation_sync_tx();

-- ─── Borrar el movimiento (p. ej. desde Movimientos) devuelve a pendiente ─────
-- La FK ON DELETE SET NULL deja transaction_id en NULL; este BEFORE ajusta el estado.

CREATE OR REPLACE FUNCTION public.obligation_unlink()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.transaction_id IS NOT NULL AND NEW.transaction_id IS NULL THEN
    NEW.status := 'pendiente';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pagos_unlink BEFORE UPDATE OF transaction_id ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.obligation_unlink();
CREATE TRIGGER trg_income_entries_unlink BEFORE UPDATE OF transaction_id ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.obligation_unlink();

-- ─── Dueño y permisos de las funciones ────────────────────────────────────────

ALTER FUNCTION public.obligation_tx_date(text) OWNER TO postgres;
ALTER FUNCTION public.obligation_create_tx(uuid, uuid, numeric, text, numeric, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.mark_pago_paid(uuid, uuid, numeric) OWNER TO postgres;
ALTER FUNCTION public.mark_pago_pending(uuid) OWNER TO postgres;
ALTER FUNCTION public.mark_income_collected(uuid, uuid, numeric) OWNER TO postgres;
ALTER FUNCTION public.mark_income_pending(uuid) OWNER TO postgres;
ALTER FUNCTION public.obligation_sync_tx() OWNER TO postgres;
ALTER FUNCTION public.obligation_unlink() OWNER TO postgres;
REVOKE ALL ON FUNCTION
  public.obligation_tx_date(text),
  public.obligation_create_tx(uuid, uuid, numeric, text, numeric, text, text, text, text, text),
  public.obligation_sync_tx(),
  public.obligation_unlink()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.mark_pago_paid(uuid, uuid, numeric),
  public.mark_pago_pending(uuid),
  public.mark_income_collected(uuid, uuid, numeric),
  public.mark_income_pending(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.mark_pago_paid(uuid, uuid, numeric),
  public.mark_pago_pending(uuid),
  public.mark_income_collected(uuid, uuid, numeric),
  public.mark_income_pending(uuid)
  TO authenticated;

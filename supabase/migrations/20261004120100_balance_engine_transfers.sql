-- ============================================================
-- Motor único de saldo + transferencias.
--
-- accounts.balance deja de ser editable desde el cliente: solo lo cambian
--   * los triggers de transactions (gasto −, ingreso +, transferencia con signo),
--   * los triggers de currency_exchanges (origen −from_amount, destino +to_amount),
--   * adjust_account_balance (ajuste manual auditado).
-- Los saldos actuales no se recalculan: las filas anteriores quedan con
-- balance_applied = false y nunca mueven saldo (ni al editarlas ni al borrarlas).
--
-- Transferencias: entidad propia (transfers) con dos patas en transactions
-- ('out' negativa en la cuenta origen, 'in' positiva en la destino) que se
-- crean, editan y borran solo con create_transfer/update_transfer/delete_transfer.
--
-- Guardas (triggers BEFORE): pg_trigger_depth() = 1 → sentencia directa del
-- cliente; > 1 → la hace el sistema (trigger de transfers o acción referencial
-- ON DELETE SET NULL/CASCADE). Ojo: en los triggers AFTER de una acción
-- referencial pg_trigger_depth() vale 1 (Postgres los encola para el final de la
-- sentencia original), así que los AFTER no deben depender de la profundidad.
-- Verificado en supabase/tests/balance_engine.test.sql.
-- ============================================================

-- ─── Columnas nuevas ──────────────────────────────────────────────────────────

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_id     uuid    NULL,
  ADD COLUMN IF NOT EXISTS transfer_leg    text    NULL,
  ADD COLUMN IF NOT EXISTS balance_applied boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_leg_chk CHECK (transfer_leg IS NULL OR transfer_leg IN ('out','in')),
  ADD CONSTRAINT transactions_transfer_pair_chk CHECK ((transfer_id IS NULL) = (transfer_leg IS NULL));
ALTER TABLE public.currency_exchanges
  ADD COLUMN IF NOT EXISTS balance_applied boolean NOT NULL DEFAULT false;

-- ─── Conversiones: conservar el historial al eliminar una cuenta ─────────────
-- Antes: ON DELETE CASCADE (se borraba la conversión). Ahora: SET NULL.

ALTER TABLE public.currency_exchanges
  ALTER COLUMN from_account_id DROP NOT NULL,
  ALTER COLUMN to_account_id DROP NOT NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.currency_exchanges'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.accounts'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.currency_exchanges DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.currency_exchanges
  ADD CONSTRAINT currency_exchanges_from_account_id_fkey
    FOREIGN KEY (from_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD CONSTRAINT currency_exchanges_to_account_id_fkey
    FOREIGN KEY (to_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

-- ─── Transferencias ───────────────────────────────────────────────────────────

CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  from_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  to_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  from_amount numeric(15,2) NOT NULL CHECK (from_amount > 0),
  from_currency text NOT NULL,
  to_amount numeric(15,2) NOT NULL CHECK (to_amount > 0),
  to_currency text NOT NULL,
  exchange_rate numeric NOT NULL CHECK (exchange_rate > 0),
  base_currency_code text NOT NULL,
  base_amount numeric(15,2) NOT NULL CHECK (base_amount > 0),
  transfer_date timestamptz NOT NULL,
  name text NOT NULL DEFAULT 'Transferencia',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transfers_distinct_accounts_chk CHECK (from_account_id IS NULL OR to_account_id IS NULL OR from_account_id <> to_account_id)
);
CREATE INDEX idx_transfers_user_id ON public.transfers(user_id);
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_fk FOREIGN KEY (transfer_id) REFERENCES public.transfers(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX transactions_transfer_leg_uq ON public.transactions(transfer_id, transfer_leg) WHERE transfer_id IS NOT NULL;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_transfers" ON public.transfers FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.transfers FROM anon, authenticated;
GRANT SELECT ON public.transfers TO authenticated;

-- ─── Auditoría de ajustes manuales de saldo ──────────────────────────────────

CREATE TABLE public.account_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  previous_balance numeric(15,2) NOT NULL,
  new_balance numeric(15,2) NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_balance_adjustments_account ON public.account_balance_adjustments(account_id);
ALTER TABLE public.account_balance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_balance_adjustments" ON public.account_balance_adjustments FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.account_balance_adjustments FROM anon, authenticated;
GRANT SELECT ON public.account_balance_adjustments TO authenticated;

-- ─── Permisos ─────────────────────────────────────────────────────────────────
-- Un REVOKE de columna no sirve si existe UPDATE de tabla (Supabase lo concede):
-- se revoca la tabla y se conceden las columnas editables, sin balance.

REVOKE UPDATE ON public.accounts FROM anon, authenticated, service_role;
GRANT UPDATE (name, account_type, institution, currency, currency_code, icon, color, bg_color, updated_at)
  ON public.accounts TO authenticated, service_role;
REVOKE UPDATE, DELETE ON public.currency_exchanges FROM anon, authenticated;

-- ─── Motor: transactions ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tx_balance_delta(p_type text, p_amount numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_type WHEN 'gasto' THEN -abs(p_amount) WHEN 'ingreso' THEN abs(p_amount) ELSE p_amount END;
$$;

CREATE OR REPLACE FUNCTION public.transactions_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_direct boolean := pg_catalog.pg_trigger_depth() = 1;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.balance_applied := true;
    IF v_direct AND (NEW.transfer_id IS NOT NULL OR NEW.transaction_type = 'transferencia') THEN
      RAISE EXCEPTION 'Las transferencias se crean con la operación de transferencia' USING ERRCODE = '42501';
    END IF;
    IF NEW.transfer_id IS NOT NULL AND NEW.transaction_type <> 'transferencia' THEN
      RAISE EXCEPTION 'Pata de transferencia inválida' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.balance_applied := OLD.balance_applied;
    IF v_direct THEN
      IF OLD.transfer_id IS NOT NULL OR NEW.transfer_id IS DISTINCT FROM OLD.transfer_id OR NEW.transfer_leg IS DISTINCT FROM OLD.transfer_leg THEN
        RAISE EXCEPTION 'Las transferencias se editan con la operación de transferencia' USING ERRCODE = '42501';
      END IF;
      IF NEW.transaction_type = 'transferencia' AND OLD.transaction_type <> 'transferencia' THEN
        RAISE EXCEPTION 'No se puede convertir un movimiento en transferencia' USING ERRCODE = '42501';
      END IF;
      IF OLD.transaction_type = 'transferencia' AND (NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.amount <> OLD.amount OR NEW.transaction_type <> OLD.transaction_type OR NEW.user_id <> OLD.user_id) THEN
        RAISE EXCEPTION 'Transferencia antigua: monto, cuenta y tipo no editables' USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  ELSE
    IF v_direct AND OLD.transfer_id IS NOT NULL THEN
      RAISE EXCEPTION 'Las transferencias se eliminan con la operación de transferencia' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER trg_transactions_guard BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_guard();

CREATE OR REPLACE FUNCTION public.transactions_apply_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.balance_applied AND OLD.account_id IS NOT NULL THEN
    UPDATE public.accounts SET balance = balance - public.tx_balance_delta(OLD.transaction_type, OLD.amount), updated_at = now()
     WHERE id = OLD.account_id AND user_id = OLD.user_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.balance_applied AND NEW.account_id IS NOT NULL THEN
    IF v_uid IS NOT NULL AND NEW.user_id <> v_uid THEN RAISE EXCEPTION 'Usuario inválido' USING ERRCODE = '42501'; END IF;
    UPDATE public.accounts SET balance = balance + public.tx_balance_delta(NEW.transaction_type, NEW.amount), updated_at = now()
     WHERE id = NEW.account_id AND user_id = NEW.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no pertenece al usuario' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_transactions_balance AFTER INSERT OR DELETE OR UPDATE OF account_id, amount, transaction_type, user_id
  ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.transactions_apply_balance();

-- ─── Motor: transfers ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transfers_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_from public.accounts%ROWTYPE; v_to public.accounts%ROWTYPE;
BEGIN
  IF v_uid IS NOT NULL AND NEW.user_id <> v_uid THEN RAISE EXCEPTION 'Usuario inválido' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'No se puede cambiar el dueño' USING ERRCODE = '42501'; END IF;
  IF NEW.from_account_id IS NULL OR NEW.to_account_id IS NULL THEN
    -- Solo la acción referencial (cuenta eliminada) puede dejar una cuenta en NULL.
    IF TG_OP = 'INSERT' OR pg_catalog.pg_trigger_depth() = 1 THEN RAISE EXCEPTION 'Cuenta origen y destino requeridas' USING ERRCODE = '22023'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO v_from FROM public.accounts WHERE id = NEW.from_account_id AND user_id = NEW.user_id;
  SELECT * INTO v_to FROM public.accounts WHERE id = NEW.to_account_id AND user_id = NEW.user_id;
  IF v_from.id IS NULL OR v_to.id IS NULL THEN RAISE EXCEPTION 'Cuenta inválida' USING ERRCODE = '42501'; END IF;
  IF NEW.from_currency <> v_from.currency OR NEW.to_currency <> v_to.currency THEN RAISE EXCEPTION 'La moneda no coincide con la cuenta' USING ERRCODE = '22023'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_transfers_validate BEFORE INSERT OR UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.transfers_validate();

CREATE OR REPLACE FUNCTION public.transfers_sync_legs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_date text := pg_catalog.to_char(NEW.transfer_date AT TIME ZONE 'America/Lima', 'YYYY-MM-DD');
  v_time text := pg_catalog.to_char(NEW.transfer_date AT TIME ZONE 'America/Lima', 'HH24:MI');
  v_n int;
BEGIN
  -- Cuenta eliminada (ON DELETE SET NULL): las patas ya quedan sin cuenta por su
  -- propia FK. Un UPDATE directo nunca deja una cuenta en NULL (transfers_validate).
  IF TG_OP = 'UPDATE' AND (NEW.from_account_id IS NULL OR NEW.to_account_id IS NULL) THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions (user_id, account_id, account_name, name, category, category_icon, amount, transaction_date, transaction_time, transaction_type, notes, transfer_id, transfer_leg, currency_code, original_amount, base_currency_code, base_amount, exchange_rate, exchange_rate_date)
    SELECT NEW.user_id, a.id, a.name, NEW.name, 'Transferencia', '⇄', -NEW.from_amount, NEW.transfer_date, v_time, 'transferencia', NEW.notes, NEW.id, 'out', NEW.from_currency, -NEW.from_amount, NEW.base_currency_code, -NEW.base_amount, NEW.base_amount / NEW.from_amount, v_date
      FROM public.accounts a WHERE a.id = NEW.from_account_id
    UNION ALL
    SELECT NEW.user_id, a.id, a.name, NEW.name, 'Transferencia', '⇄', NEW.to_amount, NEW.transfer_date, v_time, 'transferencia', NEW.notes, NEW.id, 'in', NEW.to_currency, NEW.to_amount, NEW.base_currency_code, NEW.base_amount, NEW.base_amount / NEW.to_amount, v_date
      FROM public.accounts a WHERE a.id = NEW.to_account_id;
  ELSE
    UPDATE public.transactions t SET account_id = a.id, account_name = a.name, name = NEW.name, notes = NEW.notes, amount = -NEW.from_amount, transaction_date = NEW.transfer_date, transaction_time = v_time, currency_code = NEW.from_currency, original_amount = -NEW.from_amount, base_currency_code = NEW.base_currency_code, base_amount = -NEW.base_amount, exchange_rate = NEW.base_amount / NEW.from_amount, exchange_rate_date = v_date, updated_at = now()
      FROM public.accounts a WHERE t.transfer_id = NEW.id AND t.transfer_leg = 'out' AND a.id = NEW.from_account_id;
    UPDATE public.transactions t SET account_id = a.id, account_name = a.name, name = NEW.name, notes = NEW.notes, amount = NEW.to_amount, transaction_date = NEW.transfer_date, transaction_time = v_time, currency_code = NEW.to_currency, original_amount = NEW.to_amount, base_currency_code = NEW.base_currency_code, base_amount = NEW.base_amount, exchange_rate = NEW.base_amount / NEW.to_amount, exchange_rate_date = v_date, updated_at = now()
      FROM public.accounts a WHERE t.transfer_id = NEW.id AND t.transfer_leg = 'in' AND a.id = NEW.to_account_id;
  END IF;
  SELECT count(*) INTO v_n FROM public.transactions WHERE transfer_id = NEW.id;
  IF v_n <> 2 THEN RAISE EXCEPTION 'Transferencia incompleta' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_transfers_sync_legs AFTER INSERT OR UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.transfers_sync_legs();

-- ─── Motor: currency_exchanges ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.currency_exchanges_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.balance_applied := true;
    IF NEW.from_account_id IS NULL OR NEW.to_account_id IS NULL
       OR NEW.from_amount <= 0 OR NEW.to_amount <= 0
       OR NEW.from_account_id = NEW.to_account_id THEN
      RAISE EXCEPTION 'Conversión inválida' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  -- Única edición permitida: ON DELETE SET NULL al eliminar una cuenta (acción
  -- referencial, profundidad > 1). Solo pueden cambiar las cuentas, y solo a NULL.
  IF pg_catalog.pg_trigger_depth() > 1
     AND (NEW.from_account_id IS NULL OR NEW.from_account_id IS NOT DISTINCT FROM OLD.from_account_id)
     AND (NEW.to_account_id IS NULL OR NEW.to_account_id IS NOT DISTINCT FROM OLD.to_account_id)
     AND (pg_catalog.to_jsonb(NEW) - 'from_account_id' - 'to_account_id')
         = (pg_catalog.to_jsonb(OLD) - 'from_account_id' - 'to_account_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Las conversiones no se editan' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER trg_currency_exchanges_guard BEFORE INSERT OR UPDATE ON public.currency_exchanges
  FOR EACH ROW EXECUTE FUNCTION public.currency_exchanges_guard();

CREATE OR REPLACE FUNCTION public.currency_exchanges_apply_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NOT NULL AND NEW.user_id <> v_uid THEN RAISE EXCEPTION 'Usuario inválido' USING ERRCODE = '42501'; END IF;
    UPDATE public.accounts SET balance = balance - NEW.from_amount, updated_at = now()
     WHERE id = NEW.from_account_id AND user_id = NEW.user_id AND currency = NEW.from_currency;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta origen inválida' USING ERRCODE = '42501'; END IF;
    UPDATE public.accounts SET balance = balance + NEW.to_amount, updated_at = now()
     WHERE id = NEW.to_account_id AND user_id = NEW.user_id AND currency = NEW.to_currency;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta destino inválida' USING ERRCODE = '42501'; END IF;
    RETURN NULL;
  END IF;
  -- DELETE (solo service_role/postgres, o en cascada al eliminar el usuario): revierte.
  -- Las cuentas ya eliminadas o en NULL simplemente no se actualizan.
  IF OLD.balance_applied THEN
    UPDATE public.accounts SET balance = balance + OLD.from_amount, updated_at = now() WHERE id = OLD.from_account_id AND user_id = OLD.user_id;
    UPDATE public.accounts SET balance = balance - OLD.to_amount, updated_at = now() WHERE id = OLD.to_account_id AND user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_currency_exchanges_balance AFTER INSERT OR DELETE ON public.currency_exchanges
  FOR EACH ROW EXECUTE FUNCTION public.currency_exchanges_apply_balance();

-- ─── RPC ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_transfer(p_from_account_id uuid, p_to_account_id uuid, p_from_amount numeric, p_to_amount numeric, p_base_amount numeric, p_transfer_date timestamptz, p_name text DEFAULT 'Transferencia', p_notes text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_from public.accounts%ROWTYPE; v_to public.accounts%ROWTYPE; v_base text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Cuentas iguales' USING ERRCODE = '22023'; END IF;
  IF coalesce(p_from_amount,0) <= 0 OR coalesce(p_to_amount,0) <= 0 OR coalesce(p_base_amount,0) <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_from FROM public.accounts WHERE id = p_from_account_id AND user_id = v_uid FOR UPDATE;
  SELECT * INTO v_to FROM public.accounts WHERE id = p_to_account_id AND user_id = v_uid FOR UPDATE;
  IF v_from.id IS NULL OR v_to.id IS NULL THEN RAISE EXCEPTION 'Cuenta inválida' USING ERRCODE = '42501'; END IF;
  SELECT us.base_currency_code INTO v_base FROM public.user_settings us WHERE us.user_id = v_uid;
  v_base := coalesce(v_base, 'PEN');
  INSERT INTO public.transfers (user_id, from_account_id, to_account_id, from_amount, from_currency, to_amount, to_currency, exchange_rate, base_currency_code, base_amount, transfer_date, name, notes)
  VALUES (v_uid, v_from.id, v_to.id, round(p_from_amount,2), v_from.currency, round(p_to_amount,2), v_to.currency, p_to_amount / p_from_amount, v_base, round(p_base_amount,2), coalesce(p_transfer_date, now()), coalesce(nullif(p_name,''),'Transferencia'), coalesce(p_notes,''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_transfer(p_transfer_id uuid, p_from_account_id uuid, p_to_account_id uuid, p_from_amount numeric, p_to_amount numeric, p_base_amount numeric, p_transfer_date timestamptz, p_name text, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_from public.accounts%ROWTYPE; v_to public.accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.transfers WHERE id = p_transfer_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Cuentas iguales' USING ERRCODE = '22023'; END IF;
  IF coalesce(p_from_amount,0) <= 0 OR coalesce(p_to_amount,0) <= 0 OR coalesce(p_base_amount,0) <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_from FROM public.accounts WHERE id = p_from_account_id AND user_id = v_uid FOR UPDATE;
  SELECT * INTO v_to FROM public.accounts WHERE id = p_to_account_id AND user_id = v_uid FOR UPDATE;
  IF v_from.id IS NULL OR v_to.id IS NULL THEN RAISE EXCEPTION 'Cuenta inválida' USING ERRCODE = '42501'; END IF;
  UPDATE public.transfers SET from_account_id = v_from.id, to_account_id = v_to.id, from_amount = round(p_from_amount,2), from_currency = v_from.currency, to_amount = round(p_to_amount,2), to_currency = v_to.currency, exchange_rate = p_to_amount / p_from_amount, base_amount = round(p_base_amount,2), transfer_date = coalesce(p_transfer_date, transfer_date), name = coalesce(nullif(p_name,''), name), notes = coalesce(p_notes, notes)
   WHERE id = p_transfer_id AND user_id = v_uid;
END $$;

CREATE OR REPLACE FUNCTION public.delete_transfer(p_transfer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.transfers WHERE id = p_transfer_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada' USING ERRCODE = 'P0002'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_account_balance(p_account_id uuid, p_new_balance numeric, p_reason text DEFAULT '')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_prev numeric; v_new numeric := round(p_new_balance, 2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  IF v_new IS NULL OR abs(v_new) >= 1e13 THEN RAISE EXCEPTION 'Saldo inválido' USING ERRCODE = '22023'; END IF;
  SELECT balance INTO v_prev FROM public.accounts WHERE id = p_account_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta inválida' USING ERRCODE = '42501'; END IF;
  UPDATE public.accounts SET balance = v_new, updated_at = now() WHERE id = p_account_id;
  INSERT INTO public.account_balance_adjustments (user_id, account_id, previous_balance, new_balance, reason)
  VALUES (v_uid, p_account_id, v_prev, v_new, coalesce(p_reason,''));
  RETURN v_new;
END $$;

-- ─── Dueño y permisos de las funciones ────────────────────────────────────────

ALTER FUNCTION public.tx_balance_delta(text, numeric) OWNER TO postgres;
ALTER FUNCTION public.transactions_guard() OWNER TO postgres;
ALTER FUNCTION public.transactions_apply_balance() OWNER TO postgres;
ALTER FUNCTION public.transfers_validate() OWNER TO postgres;
ALTER FUNCTION public.transfers_sync_legs() OWNER TO postgres;
ALTER FUNCTION public.currency_exchanges_guard() OWNER TO postgres;
ALTER FUNCTION public.currency_exchanges_apply_balance() OWNER TO postgres;
ALTER FUNCTION public.create_transfer(uuid, uuid, numeric, numeric, numeric, timestamptz, text, text) OWNER TO postgres;
ALTER FUNCTION public.update_transfer(uuid, uuid, uuid, numeric, numeric, numeric, timestamptz, text, text) OWNER TO postgres;
ALTER FUNCTION public.delete_transfer(uuid) OWNER TO postgres;
ALTER FUNCTION public.adjust_account_balance(uuid, numeric, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION
  public.tx_balance_delta(text, numeric),
  public.transactions_guard(),
  public.transactions_apply_balance(),
  public.transfers_validate(),
  public.transfers_sync_legs(),
  public.currency_exchanges_guard(),
  public.currency_exchanges_apply_balance()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.create_transfer(uuid, uuid, numeric, numeric, numeric, timestamptz, text, text),
  public.update_transfer(uuid, uuid, uuid, numeric, numeric, numeric, timestamptz, text, text),
  public.delete_transfer(uuid),
  public.adjust_account_balance(uuid, numeric, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
  public.create_transfer(uuid, uuid, numeric, numeric, numeric, timestamptz, text, text),
  public.update_transfer(uuid, uuid, uuid, numeric, numeric, numeric, timestamptz, text, text),
  public.delete_transfer(uuid),
  public.adjust_account_balance(uuid, numeric, text)
  TO authenticated;

-- ============================================================
-- Pagos de deudas (total o parcial) con avance.
--
-- debts.original_amount: monto inicial de la deuda, para la barra de avance
--   (pagado = original_amount - balance). Las deudas existentes toman su saldo
--   actual como monto original.
-- pay_debt: pide la cuenta, registra el gasto (el motor de saldo lo descuenta de
--   la cuenta), reduce debts.balance y guarda el pago en debt_payments.
-- Borrar ese gasto (p. ej. desde Movimientos) borra el pago en cascada y devuelve
--   el monto al saldo de la deuda.
-- Los montos de deudas están en la moneda base del usuario; si la cuenta usa otra
-- moneda, el cliente envía el monto debitado en esa moneda (p_account_amount).
-- ============================================================

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS original_amount numeric(15,2) NOT NULL DEFAULT 0;
UPDATE public.debts SET original_amount = balance WHERE original_amount = 0;

-- El monto original nunca queda por debajo del saldo (alta o edición manual).
CREATE OR REPLACE FUNCTION public.debts_keep_original()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND coalesce(NEW.original_amount, 0) = 0 THEN
    NEW.original_amount := NEW.balance;
  END IF;
  NEW.original_amount := greatest(coalesce(NEW.original_amount, 0), NEW.balance);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_debts_keep_original BEFORE INSERT OR UPDATE OF balance, original_amount ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.debts_keep_original();

CREATE TABLE public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  transaction_id uuid NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_debt_payments_debt ON public.debt_payments(debt_id);
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_debt_payments" ON public.debt_payments FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.debt_payments FROM anon, authenticated;
GRANT SELECT ON public.debt_payments TO authenticated;

-- Al borrar un pago (normalmente porque se borró su gasto), el monto vuelve a la deuda.
CREATE OR REPLACE FUNCTION public.debt_payments_restore_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.debts SET balance = balance + OLD.amount, updated_at = now()
   WHERE id = OLD.debt_id AND user_id = OLD.user_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_debt_payments_restore AFTER DELETE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.debt_payments_restore_balance();

CREATE OR REPLACE FUNCTION public.pay_debt(p_debt_id uuid, p_account_id uuid, p_amount numeric, p_account_amount numeric DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_d public.debts%ROWTYPE;
  v_amount numeric := round(p_amount, 2);
  v_tx uuid;
  v_day text := pg_catalog.to_char(now() AT TIME ZONE 'America/Lima', 'YYYY-MM-DD');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.debts WHERE id = p_debt_id AND user_id = v_uid FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'Deuda no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023'; END IF;
  IF v_amount > v_d.balance THEN RAISE EXCEPTION 'El pago supera el saldo de la deuda' USING ERRCODE = '22023'; END IF;

  v_tx := public.obligation_create_tx(v_uid, p_account_id, p_account_amount, 'gasto', v_amount,
    'Pago ' || v_d.name, 'Deudas', '💳', '', v_day);
  UPDATE public.debts SET balance = balance - v_amount, updated_at = now() WHERE id = v_d.id;
  INSERT INTO public.debt_payments (user_id, debt_id, transaction_id, amount) VALUES (v_uid, v_d.id, v_tx, v_amount);
  RETURN v_d.balance - v_amount;
END $$;

ALTER FUNCTION public.debts_keep_original() OWNER TO postgres;
ALTER FUNCTION public.debt_payments_restore_balance() OWNER TO postgres;
ALTER FUNCTION public.pay_debt(uuid, uuid, numeric, numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.debts_keep_original(), public.debt_payments_restore_balance()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pay_debt(uuid, uuid, numeric, numeric) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.pay_debt(uuid, uuid, numeric, numeric) TO authenticated;

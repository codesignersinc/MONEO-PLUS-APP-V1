-- MONEO NEGOCIO, fase 1 (docs/moneo-negocio.md): base de datos de un segundo contexto
-- financiero, Negocio, separado de Personal. Invisible hasta la fase 2 (bandera en la app).
--
-- * La cuenta define el contexto: accounts.business_id (NULL = Personal). Cada movimiento
--   hereda el de su cuenta por trigger; el cliente nunca lo envía.
-- * Pagos, cobros, suscripciones y presupuestos llevan su business_id; al pagarlos o
--   cobrarlos, la cuenta debe ser del mismo contexto.
-- * Hogar y deudas solo aceptan movimientos personales.
-- * moneo_summary / moneo_upcoming (Inicio, MONEO Mini, widget) cuentan solo lo personal.
-- * business_summary() concentra los números del negocio y la fórmula de proyección.
-- El motor de saldos (transactions_guard / transactions_apply_balance, transferencias,
-- conversiones, mark_*) no cambia: solo se agregan validaciones alrededor.

-- ─── Negocios ────────────────────────────────────────────────────────────────

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  kind text CHECK (kind IS NULL OR char_length(kind) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX businesses_owner_idx ON public.businesses (owner_id);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY businesses_owner ON public.businesses FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
REVOKE ALL ON public.businesses FROM anon, authenticated;
GRANT SELECT, DELETE ON public.businesses TO authenticated;
GRANT INSERT (owner_id, name, kind) ON public.businesses TO authenticated;
GRANT UPDATE (name, kind, updated_at) ON public.businesses TO authenticated;

-- Up to 5 businesses per person (V1, no collaboration yet).
CREATE OR REPLACE FUNCTION public.businesses_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.businesses b WHERE b.owner_id = NEW.owner_id) >= 5 THEN
      RAISE EXCEPTION 'Puedes tener hasta 5 negocios.' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.owner_id <> OLD.owner_id THEN
    RAISE EXCEPTION 'No se puede cambiar el dueño.' USING ERRCODE = '42501';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_businesses_guard BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_guard();

-- ─── Proveedores, clientes y empleados ───────────────────────────────────────

CREATE TABLE public.business_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('proveedor', 'cliente', 'empleado')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  email text CHECK (email IS NULL OR char_length(email) <= 254),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  -- Employees: usual pay and frequency (for cash flow and projection, not payroll).
  usual_amount numeric(14, 2) CHECK (usual_amount IS NULL OR usual_amount >= 0),
  frequency text CHECK (frequency IS NULL OR frequency IN ('semanal', 'quincenal', 'mensual')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_parties_business_idx ON public.business_parties (business_id, kind);

ALTER TABLE public.business_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_parties_owner ON public.business_parties FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.business_parties FROM anon, authenticated;
GRANT SELECT, DELETE ON public.business_parties TO authenticated;
GRANT INSERT (business_id, user_id, kind, name, phone, email, notes, usual_amount, frequency, active)
  ON public.business_parties TO authenticated;
GRANT UPDATE (kind, name, phone, email, notes, usual_amount, frequency, active, updated_at)
  ON public.business_parties TO authenticated;

-- ─── Contexto en las tablas existentes ───────────────────────────────────────

ALTER TABLE public.accounts ADD COLUMN business_id uuid REFERENCES public.businesses (id);
ALTER TABLE public.transactions
  ADD COLUMN business_id uuid REFERENCES public.businesses (id),
  ADD COLUMN party_id uuid REFERENCES public.business_parties (id) ON DELETE SET NULL;
ALTER TABLE public.pagos
  ADD COLUMN business_id uuid REFERENCES public.businesses (id) ON DELETE CASCADE,
  ADD COLUMN party_id uuid REFERENCES public.business_parties (id) ON DELETE SET NULL;
ALTER TABLE public.income_entries
  ADD COLUMN business_id uuid REFERENCES public.businesses (id) ON DELETE CASCADE,
  ADD COLUMN party_id uuid REFERENCES public.business_parties (id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions
  ADD COLUMN business_id uuid REFERENCES public.businesses (id) ON DELETE CASCADE;
ALTER TABLE public.budget_categories
  ADD COLUMN business_id uuid REFERENCES public.businesses (id) ON DELETE CASCADE;

CREATE INDEX accounts_business_idx ON public.accounts (business_id) WHERE business_id IS NOT NULL;
CREATE INDEX transactions_business_idx ON public.transactions (business_id, transaction_date)
  WHERE business_id IS NOT NULL;
CREATE INDEX transactions_party_idx ON public.transactions (party_id) WHERE party_id IS NOT NULL;
CREATE INDEX pagos_business_idx ON public.pagos (business_id) WHERE business_id IS NOT NULL;
CREATE INDEX income_entries_business_idx ON public.income_entries (business_id)
  WHERE business_id IS NOT NULL;
CREATE INDEX subscriptions_business_idx ON public.subscriptions (business_id)
  WHERE business_id IS NOT NULL;

-- pagos / income_entries use column privileges: the new columns need their own.
GRANT UPDATE (business_id) ON public.accounts TO authenticated;
GRANT INSERT (business_id, party_id), UPDATE (party_id) ON public.pagos TO authenticated;
GRANT INSERT (business_id, party_id), UPDATE (party_id) ON public.income_entries TO authenticated;

-- ─── Validaciones ────────────────────────────────────────────────────────────

-- A row may only point to the owner's own business and to a contact of that same business.
CREATE OR REPLACE FUNCTION public.business_context_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_party uuid := (pg_catalog.to_jsonb(NEW) ->> 'party_id')::uuid;
BEGIN
  IF NEW.business_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.id = NEW.business_id AND b.owner_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Negocio no encontrado.' USING ERRCODE = '23503';
  END IF;
  IF v_party IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.business_parties p
     WHERE p.id = v_party AND p.user_id = NEW.user_id AND p.business_id = NEW.business_id
  ) THEN
    RAISE EXCEPTION 'Contacto no encontrado en este negocio.' USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    IF TG_TABLE_NAME = 'accounts' AND EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.account_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Una cuenta con movimientos no cambia de contexto.' USING ERRCODE = '42501';
    END IF;
    IF TG_TABLE_NAME IN ('pagos', 'income_entries')
       AND (pg_catalog.to_jsonb(OLD) ->> 'transaction_id') IS NOT NULL THEN
      RAISE EXCEPTION 'Un pago o cobro ya registrado no cambia de contexto.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_context BEFORE INSERT OR UPDATE OF business_id ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.business_context_guard();
CREATE TRIGGER trg_pagos_context BEFORE INSERT OR UPDATE OF business_id, party_id ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.business_context_guard();
CREATE TRIGGER trg_income_entries_context
  BEFORE INSERT OR UPDATE OF business_id, party_id ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.business_context_guard();
CREATE TRIGGER trg_subscriptions_context BEFORE INSERT OR UPDATE OF business_id ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.business_context_guard();
CREATE TRIGGER trg_budget_categories_context
  BEFORE INSERT OR UPDATE OF business_id ON public.budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.business_context_guard();
CREATE TRIGGER trg_business_parties_context BEFORE INSERT ON public.business_parties
  FOR EACH ROW EXECUTE FUNCTION public.business_context_guard();

-- A movement takes the context of its account (never what the client sends). Runs before
-- trg_transactions_guard (alphabetical order) and does not touch the balance.
CREATE OR REPLACE FUNCTION public.transactions_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    NEW.business_id := (SELECT a.business_id FROM public.accounts a WHERE a.id = NEW.account_id);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.business_id := OLD.business_id; -- account deleted (ON DELETE SET NULL)
  ELSE
    NEW.business_id := NULL;
  END IF;
  IF NEW.party_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.business_parties p
     WHERE p.id = NEW.party_id AND p.user_id = NEW.user_id
       AND p.business_id IS NOT DISTINCT FROM NEW.business_id
  ) THEN
    RAISE EXCEPTION 'Contacto no encontrado en este negocio.' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_transactions_context BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_context();

-- Paying a business payment (or collecting a business income) from a personal account, or
-- the other way round, is refused: mark_pago_paid / mark_income_collected roll back. The
-- payment's contact is copied to its movement.
CREATE OR REPLACE FUNCTION public.obligation_context_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.transaction_id IS NOT NULL
     AND (NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
          OR NEW.party_id IS DISTINCT FROM OLD.party_id) THEN
    IF EXISTS (
      SELECT 1 FROM public.transactions t
       WHERE t.id = NEW.transaction_id AND t.business_id IS DISTINCT FROM NEW.business_id
    ) THEN
      RAISE EXCEPTION 'La cuenta elegida no es de este contexto (Personal o Negocio).'
        USING ERRCODE = '42501';
    END IF;
    UPDATE public.transactions SET party_id = NEW.party_id
     WHERE id = NEW.transaction_id AND party_id IS DISTINCT FROM NEW.party_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pagos_context_tx BEFORE UPDATE OF transaction_id, party_id ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.obligation_context_check();
CREATE TRIGGER trg_income_entries_context_tx
  BEFORE UPDATE OF transaction_id, party_id ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.obligation_context_check();

-- The next instance of a recurring payment (mark_pago_paid inserts it with generated_from)
-- keeps the business and the contact of the one it comes from.
CREATE OR REPLACE FUNCTION public.pagos_inherit_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.generated_from IS NOT NULL AND NEW.business_id IS NULL THEN
    SELECT p.business_id, p.party_id INTO NEW.business_id, NEW.party_id
      FROM public.pagos p WHERE p.id = NEW.generated_from AND p.user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
-- "trg_pagos_a…" runs before trg_pagos_context (triggers fire in name order).
CREATE TRIGGER trg_pagos_a_inherit BEFORE INSERT ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.pagos_inherit_context();

-- Household and debts are personal (decision 4): their movements must be personal.
CREATE OR REPLACE FUNCTION public.personal_tx_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  col text;
  v_tx uuid;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    v_tx := (pg_catalog.to_jsonb(NEW) ->> col)::uuid;
    IF v_tx IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.id = v_tx AND t.business_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Aquí solo se usan cuentas personales.' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_household_expenses_personal BEFORE INSERT OR UPDATE ON public.household_expenses
  FOR EACH ROW EXECUTE FUNCTION public.personal_tx_guard('transaction_id');
CREATE TRIGGER trg_household_goal_contributions_personal
  BEFORE INSERT OR UPDATE ON public.household_goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.personal_tx_guard('transaction_id');
CREATE TRIGGER trg_household_settlements_personal
  BEFORE INSERT OR UPDATE ON public.household_settlements
  FOR EACH ROW EXECUTE FUNCTION public.personal_tx_guard('paid_transaction_id', 'received_transaction_id');
CREATE TRIGGER trg_debt_payments_personal BEFORE INSERT OR UPDATE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.personal_tx_guard('transaction_id');

REVOKE ALL ON FUNCTION public.businesses_guard(), public.business_context_guard(),
  public.transactions_context(), public.obligation_context_check(), public.personal_tx_guard(),
  public.pagos_inherit_context()
  FROM PUBLIC, anon, authenticated;

-- ─── Resúmenes personales: solo lo personal (decisión 1) ─────────────────────

CREATE OR REPLACE FUNCTION public.moneo_upcoming(p_today date)
 RETURNS TABLE(name text, amount numeric, due date, overdue boolean, kind text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT p.name, abs(p.amount), left(p.payment_date, 10)::date,
         p.status = 'vencido' OR left(p.payment_date, 10)::date < p_today, 'pago'
    FROM public.pagos p
   WHERE p.user_id = auth.uid() AND p.business_id IS NULL AND p.status <> 'pagado'
     AND p.payment_date ~ '^\d{4}-\d{2}-\d{2}'
  UNION ALL
  SELECT s.name, abs(s.amount), coalesce(s.next_payment_date, left(s.next_date, 10)::date),
         coalesce(s.payment_status = 'overdue', false), 'suscripcion'
    FROM public.subscriptions s
   WHERE s.user_id = auth.uid() AND s.business_id IS NULL AND s.active
     AND (s.next_payment_date IS NOT NULL OR s.next_date ~ '^\d{4}-\d{2}-\d{2}')
$function$;

CREATE OR REPLACE FUNCTION public.moneo_summary(p_today date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  today date := coalesce(p_today, (now() AT TIME ZONE 'America/Lima')::date);
  month_start date := date_trunc('month', coalesce(p_today, (now() AT TIME ZONE 'America/Lima')::date))::date;
  month_end date := (date_trunc('month', coalesce(p_today, (now() AT TIME ZONE 'America/Lima')::date)) + interval '1 month - 1 day')::date;
  base text;
  accounts_total numeric;
  available numeric;
  investments numeric;
  debts numeric;
  net_worth numeric;
  in_goals numeric;
  month_income numeric;
  month_expense numeric;
  tx_count int;
  start_worth numeric;
  spent_today numeric;
  committed numeric;
  horizon date;
  horizon_kind text;
  days int;
  committed_h numeric;
  goals_month numeric;
  daily numeric;
  next_payment jsonb;
  main_goal jsonb;
  recent jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(s.base_currency_code, 'PEN') INTO base
    FROM public.user_settings s WHERE s.user_id = uid LIMIT 1;
  base := coalesce(base, 'PEN');

  SELECT coalesce(sum(a.balance * public.moneo_fx_rate(coalesce(nullif(a.currency, ''), 'PEN'), base)), 0),
         coalesce(sum(a.balance * public.moneo_fx_rate(coalesce(nullif(a.currency, ''), 'PEN'), base))
                  FILTER (WHERE a.account_type NOT IN ('credito', 'inversion')), 0)
    INTO accounts_total, available
    FROM public.accounts a WHERE a.user_id = uid AND a.business_id IS NULL;
  SELECT coalesce(sum(i.shares * i.price), 0) INTO investments
    FROM public.investments i WHERE i.user_id = uid;
  SELECT coalesce(sum(d.balance), 0) INTO debts FROM public.debts d WHERE d.user_id = uid;
  SELECT coalesce(sum(g.current_amount), 0) INTO in_goals
    FROM public.savings_goals g WHERE g.user_id = uid;
  net_worth := accounts_total + investments - debts;

  -- Movements in the base currency (positive); transfers are neither income nor expense.
  WITH tx AS (
    SELECT t.transaction_type AS kind,
           (t.transaction_date AT TIME ZONE 'America/Lima')::date AS day,
           CASE WHEN t.base_amount IS NOT NULL AND t.base_currency_code = base
                THEN abs(t.base_amount)
                ELSE abs(t.amount) * public.moneo_fx_rate(coalesce(nullif(t.currency_code, ''), 'PEN'), base)
           END AS v
      FROM public.transactions t WHERE t.user_id = uid AND t.business_id IS NULL
  )
  SELECT coalesce(sum(v) FILTER (WHERE kind = 'ingreso' AND day BETWEEN month_start AND month_end), 0),
         coalesce(sum(v) FILTER (WHERE kind = 'gasto' AND day BETWEEN month_start AND month_end), 0),
         coalesce(sum(v) FILTER (WHERE kind = 'gasto' AND day = today), 0),
         count(*)
    INTO month_income, month_expense, spent_today, tx_count
    FROM tx;
  start_worth := net_worth - (month_income - month_expense);

  SELECT coalesce(sum(u.amount), 0) INTO committed FROM public.moneo_upcoming(today) u WHERE u.due <= month_end;
  SELECT jsonb_build_object('name', u.name, 'amount', u.amount, 'date', u.due,
                            'overdue', u.overdue, 'kind', u.kind)
    INTO next_payment FROM public.moneo_upcoming(today) u ORDER BY u.due, u.name LIMIT 1;

  -- Horizon: the next pending income, else the end of the month.
  SELECT min(left(e.collection_date, 10)::date) INTO horizon
    FROM public.income_entries e
   WHERE e.user_id = uid AND e.business_id IS NULL AND e.status <> 'cobrado'
     AND e.collection_date ~ '^\d{4}-\d{2}-\d{2}'
     AND left(e.collection_date, 10)::date >= today;
  horizon_kind := CASE WHEN horizon IS NULL THEN 'fin_de_mes' ELSE 'proximo_ingreso' END;
  horizon := coalesce(horizon, month_end);
  days := greatest(1, horizon - today + 1);
  SELECT coalesce(sum(u.amount), 0) INTO committed_h FROM public.moneo_upcoming(today) u WHERE u.due <= horizon;

  SELECT coalesce(sum(
           (g.target_amount - g.current_amount) /
           greatest(1, (extract(year FROM age(left(g.target_date, 10)::date, today)) * 12
                        + extract(month FROM age(left(g.target_date, 10)::date, today)))::int
                       + CASE WHEN extract(day FROM age(left(g.target_date, 10)::date, today)) > 0 THEN 1 ELSE 0 END)
         ), 0)
    INTO goals_month
    FROM public.savings_goals g
   WHERE g.user_id = uid AND g.target_amount > g.current_amount
     AND g.target_date ~ '^\d{4}-\d{2}-\d{2}'
     AND left(g.target_date, 10)::date >= today;

  daily := (available + spent_today - committed_h - goals_month) / days;

  SELECT jsonb_build_object('name', g.name, 'icon', g.icon, 'current', g.current_amount,
                            'target', g.target_amount,
                            'pct', CASE WHEN g.target_amount > 0
                                        THEN least(100, round(g.current_amount / g.target_amount * 100))
                                        ELSE 0 END)
    INTO main_goal
    FROM public.savings_goals g
   WHERE g.user_id = uid
   ORDER BY (g.target_amount > 0 AND g.current_amount < g.target_amount) DESC, g.created_at
   LIMIT 1;

  SELECT coalesce(jsonb_agg(r ORDER BY r->>'date' DESC), '[]'::jsonb) INTO recent FROM (
    SELECT jsonb_build_object('id', t.id, 'name', t.name, 'icon', t.category_icon,
                              'type', t.transaction_type, 'amount', t.amount,
                              'currency', coalesce(nullif(t.currency_code, ''), 'PEN'),
                              'date', t.transaction_date) AS r
      FROM public.transactions t
     WHERE t.user_id = uid AND t.business_id IS NULL AND NOT (t.transaction_type = 'transferencia' AND t.transfer_leg = 'in')
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT 5
  ) x;

  RETURN jsonb_build_object(
    'currency', base,
    'asOf', today,
    'netWorth', round(net_worth, 2),
    'available', round(available, 2),
    'committed', round(committed, 2),
    'inGoals', round(in_goals, 2),
    'netWorthPct', CASE WHEN tx_count > 0 AND start_worth > 0
                        THEN round((month_income - month_expense) / start_worth * 100)
                        ELSE NULL END,
    'spentToday', round(spent_today, 2),
    'safeToSpend', jsonb_build_object(
      'today', round(greatest(0, daily - spent_today), 2),
      'dailyBudget', round(greatest(0, daily), 2),
      'until', horizon,
      'untilKind', horizon_kind,
      'days', days,
      'committed', round(committed_h, 2),
      'goals', round(goals_month, 2)
    ),
    'nextPayment', next_payment,
    'mainGoal', main_goal,
    'recent', recent
  );
END;
$function$;

-- ─── Números del negocio ─────────────────────────────────────────────────────
-- Cash basis (what was collected and paid). Projection, documented in docs/moneo-negocio.md:
--   projected = cash today + pending income due by month end
--               - pending payments due by month end - business subscriptions due by month end
-- Amounts in the user's main currency (decision 2). Runs with the caller's rights (RLS).
CREATE OR REPLACE FUNCTION public.business_summary(
  p_business uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_today date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  tz text;
  base text;
  today date;
  month_end date;
  d_from date;
  d_to date;
  prev_from date;
  prev_to date;
  income numeric;
  expense numeric;
  prev_income numeric;
  prev_expense numeric;
  cash numeric;
  receivable numeric;
  receivable_month numeric;
  payable numeric;
  payable_month numeric;
  subs_month numeric;
  by_category jsonb;
  series jsonb;
  next_payments jsonb;
  next_collections jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business AND b.owner_id = uid) THEN
    RAISE EXCEPTION 'Negocio no encontrado.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(s.base_currency_code, 'PEN'), coalesce(s.timezone, 'America/Lima')
    INTO base, tz FROM public.user_settings s WHERE s.user_id = uid LIMIT 1;
  base := coalesce(base, 'PEN');
  tz := coalesce(tz, 'America/Lima');
  today := coalesce(p_today, (now() AT TIME ZONE tz)::date);
  month_end := (date_trunc('month', today) + interval '1 month - 1 day')::date;
  d_from := coalesce(p_from, date_trunc('month', today)::date);
  d_to := coalesce(p_to, month_end);
  IF d_to < d_from THEN
    RAISE EXCEPTION 'Periodo inválido.' USING ERRCODE = '22023';
  END IF;
  prev_to := d_from - 1;
  prev_from := d_from - (d_to - d_from + 1);

  -- Movements of the business in the main currency (positive); transfers (owner withdrawals
  -- and contributions) are neither income nor expense.
  WITH tx AS (
    SELECT t.transaction_type AS kind,
           (t.transaction_date AT TIME ZONE tz)::date AS day,
           CASE WHEN t.base_amount IS NOT NULL AND t.base_currency_code = base
                THEN abs(t.base_amount)
                ELSE abs(t.amount) * public.moneo_fx_rate(coalesce(nullif(t.currency_code, ''), 'PEN'), base)
           END AS v
      FROM public.transactions t
     WHERE t.user_id = uid AND t.business_id = p_business
       AND t.transaction_type IN ('ingreso', 'gasto')
  )
  SELECT coalesce(sum(v) FILTER (WHERE kind = 'ingreso' AND day BETWEEN d_from AND d_to), 0),
         coalesce(sum(v) FILTER (WHERE kind = 'gasto' AND day BETWEEN d_from AND d_to), 0),
         coalesce(sum(v) FILTER (WHERE kind = 'ingreso' AND day BETWEEN prev_from AND prev_to), 0),
         coalesce(sum(v) FILTER (WHERE kind = 'gasto' AND day BETWEEN prev_from AND prev_to), 0)
    INTO income, expense, prev_income, prev_expense
    FROM tx;

  SELECT coalesce(sum(a.balance * public.moneo_fx_rate(coalesce(nullif(a.currency, ''), 'PEN'), base)), 0)
    INTO cash
    FROM public.accounts a
   WHERE a.user_id = uid AND a.business_id = p_business
     AND a.account_type NOT IN ('credito', 'inversion');

  SELECT coalesce(sum(abs(e.amount)), 0),
         coalesce(sum(abs(e.amount)) FILTER (WHERE left(e.collection_date, 10)::date <= month_end), 0)
    INTO receivable, receivable_month
    FROM public.income_entries e
   WHERE e.user_id = uid AND e.business_id = p_business AND e.status <> 'cobrado'
     AND e.collection_date ~ '^\d{4}-\d{2}-\d{2}';

  SELECT coalesce(sum(abs(p.amount)), 0),
         coalesce(sum(abs(p.amount)) FILTER (WHERE left(p.payment_date, 10)::date <= month_end), 0)
    INTO payable, payable_month
    FROM public.pagos p
   WHERE p.user_id = uid AND p.business_id = p_business AND p.status <> 'pagado'
     AND p.payment_date ~ '^\d{4}-\d{2}-\d{2}';

  SELECT coalesce(sum(abs(s.amount)), 0) INTO subs_month
    FROM public.subscriptions s
   WHERE s.user_id = uid AND s.business_id = p_business AND s.active
     AND coalesce(s.next_payment_date,
                  CASE WHEN s.next_date ~ '^\d{4}-\d{2}-\d{2}' THEN left(s.next_date, 10)::date END)
         <= month_end;

  SELECT coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'amount', round(c.v, 2))
                            ORDER BY c.v DESC), '[]'::jsonb)
    INTO by_category
    FROM (
      SELECT coalesce(nullif(t.category, ''), 'Otros') AS category,
             sum(CASE WHEN t.base_amount IS NOT NULL AND t.base_currency_code = base
                      THEN abs(t.base_amount)
                      ELSE abs(t.amount) * public.moneo_fx_rate(coalesce(nullif(t.currency_code, ''), 'PEN'), base)
                 END) AS v
        FROM public.transactions t
       WHERE t.user_id = uid AND t.business_id = p_business AND t.transaction_type = 'gasto'
         AND (t.transaction_date AT TIME ZONE tz)::date BETWEEN d_from AND d_to
       GROUP BY 1
       ORDER BY 2 DESC
       LIMIT 8
    ) c;

  -- Six months ending in the month of the period's end.
  SELECT coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.m, 'YYYY-MM'),
                                               'income', round(m.inc, 2), 'expense', round(m.exp, 2))
                            ORDER BY m.m), '[]'::jsonb)
    INTO series
    FROM (
      SELECT g.m,
             coalesce(sum(x.v) FILTER (WHERE x.kind = 'ingreso'), 0) AS inc,
             coalesce(sum(x.v) FILTER (WHERE x.kind = 'gasto'), 0) AS exp
        FROM generate_series(date_trunc('month', d_to) - interval '5 months',
                             date_trunc('month', d_to), interval '1 month') AS g(m)
        LEFT JOIN (
          SELECT t.transaction_type AS kind,
                 date_trunc('month', t.transaction_date AT TIME ZONE tz) AS m,
                 CASE WHEN t.base_amount IS NOT NULL AND t.base_currency_code = base
                      THEN abs(t.base_amount)
                      ELSE abs(t.amount) * public.moneo_fx_rate(coalesce(nullif(t.currency_code, ''), 'PEN'), base)
                 END AS v
            FROM public.transactions t
           WHERE t.user_id = uid AND t.business_id = p_business
             AND t.transaction_type IN ('ingreso', 'gasto')
        ) x ON x.m = g.m
       GROUP BY g.m
    ) m;

  SELECT coalesce(jsonb_agg(r ORDER BY r ->> 'due', r ->> 'name'), '[]'::jsonb) INTO next_payments FROM (
    SELECT jsonb_build_object('id', p.id, 'name', p.name, 'amount', abs(p.amount),
                              'due', left(p.payment_date, 10), 'party', bp.name,
                              'overdue', left(p.payment_date, 10)::date < today) AS r
      FROM public.pagos p
      LEFT JOIN public.business_parties bp ON bp.id = p.party_id
     WHERE p.user_id = uid AND p.business_id = p_business AND p.status <> 'pagado'
       AND p.payment_date ~ '^\d{4}-\d{2}-\d{2}'
     ORDER BY left(p.payment_date, 10), p.name
     LIMIT 5
  ) x;

  SELECT coalesce(jsonb_agg(r ORDER BY r ->> 'due', r ->> 'name'), '[]'::jsonb) INTO next_collections FROM (
    SELECT jsonb_build_object('id', e.id, 'name', e.name, 'amount', abs(e.amount),
                              'due', left(e.collection_date, 10), 'party', bp.name,
                              'overdue', left(e.collection_date, 10)::date < today) AS r
      FROM public.income_entries e
      LEFT JOIN public.business_parties bp ON bp.id = e.party_id
     WHERE e.user_id = uid AND e.business_id = p_business AND e.status <> 'cobrado'
       AND e.collection_date ~ '^\d{4}-\d{2}-\d{2}'
     ORDER BY left(e.collection_date, 10), e.name
     LIMIT 5
  ) x;

  RETURN jsonb_build_object(
    'currency', base,
    'asOf', today,
    'period', jsonb_build_object('from', d_from, 'to', d_to),
    'income', round(income, 2),
    'expense', round(expense, 2),
    'result', round(income - expense, 2),
    'previous', jsonb_build_object(
      'from', prev_from, 'to', prev_to,
      'income', round(prev_income, 2),
      'expense', round(prev_expense, 2),
      'result', round(prev_income - prev_expense, 2)
    ),
    'cash', round(cash, 2),
    'receivable', round(receivable, 2),
    'payable', round(payable, 2),
    'committed', round(payable_month + subs_month, 2),
    'projection', jsonb_build_object(
      'until', month_end,
      'cash', round(cash, 2),
      'receivable', round(receivable_month, 2),
      'payable', round(payable_month, 2),
      'subscriptions', round(subs_month, 2),
      'projected', round(cash + receivable_month - payable_month - subs_month, 2)
    ),
    'byCategory', by_category,
    'series', series,
    'nextPayments', next_payments,
    'nextCollections', next_collections
  );
END;
$$;

REVOKE ALL ON FUNCTION public.business_summary(uuid, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_summary(uuid, date, date, date) TO authenticated;

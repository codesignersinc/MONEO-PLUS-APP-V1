-- ============================================================
-- MONEO HOGAR: shared household finances ("Nuestro dinero").
--
-- Privacy model: nothing here reads or exposes the members' private data (accounts,
-- balances, transactions, incomes). Shared data lives only in household_* tables and is
-- visible to the active members of that household. A shared expense may point to the
-- payer's own transaction (transaction_id), but RLS on transactions keeps it private:
-- the other members only see the copy (name, category, amount, date).
--
-- Balance engine: untouched. Only the member who really paid has a real movement. The
-- split is a responsibility layer. A settlement (compensación) moves no balance by
-- itself: each side confirms with a real movement in their own account (the payer an
-- expense, the receiver an income), created by the client with transactionsService.
--
-- Members are never deleted on their own (they leave or are removed, keeping the
-- history); they only go with their household, so references to them cascade.
--
-- Links to transactions are DEFERRABLE: when a user deletes their account, their movements
-- and their created_by references go away in the same cascade, and an immediate check
-- would see the row half-updated.
--
-- Writes that need validation (create/accept/remove, expenses with their splits,
-- settlement confirmations) go through SECURITY DEFINER functions with an empty
-- search_path. The membership helpers are SECURITY DEFINER too, so policies never
-- recurse through household_members (the problem Juntas had).
-- ============================================================

-- ---------- Tables ----------

CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  subtitle TEXT CHECK (char_length(subtitle) <= 60),
  base_currency TEXT NOT NULL DEFAULT 'PEN' CHECK (base_currency IN ('PEN', 'USD', 'EUR')),
  split_method TEXT NOT NULL DEFAULT 'equal' CHECK (split_method IN ('equal', 'income', 'custom')),
  -- Emergency fund rule (months of monthly spending), editable.
  emergency_months INT NOT NULL DEFAULT 6 CHECK (emergency_months BETWEEN 1 AND 24),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- NULL once the user deletes their account: the history keeps the name.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 40),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
  -- Amount the member chooses to declare for the income-proportional split. It is
  -- visible to the household (never read from their private incomes).
  declared_income NUMERIC(14, 2) CHECK (declared_income >= 0),
  -- Share for the custom split (owner sets it).
  custom_pct NUMERIC(6, 3) CHECK (custom_pct BETWEEN 0 AND 100),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ
);
CREATE INDEX household_members_household_idx ON public.household_members (household_id);
-- V1: one active household per user.
CREATE UNIQUE INDEX household_members_one_active_household
  ON public.household_members (user_id) WHERE status = 'active' AND user_id IS NOT NULL;
-- One active owner per household.
CREATE UNIQUE INDEX household_members_one_owner
  ON public.household_members (household_id) WHERE status = 'active' AND role = 'owner';

CREATE TABLE public.household_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- sha256 of the token; the token itself is only returned once to the owner.
  token_hash TEXT NOT NULL UNIQUE,
  -- Optional: only this email can accept.
  email TEXT CHECK (char_length(email) <= 254),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX household_invitations_household_idx ON public.household_invitations (household_id);

CREATE TABLE public.household_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Who really paid (a member of the household).
  paid_by UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  -- The payer's real movement, when it came from one of their accounts. Unique: a
  -- movement is never shared twice.
  transaction_id UUID UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (char_length(btrim(category)) BETWEEN 1 AND 40),
  -- Amount in the original currency, and its equivalent in the household currency with
  -- the rate used (stored, never recalculated).
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL CHECK (currency_code IN ('PEN', 'USD', 'EUR')),
  base_amount NUMERIC(14, 2) NOT NULL CHECK (base_amount > 0),
  exchange_rate NUMERIC(18, 8) NOT NULL CHECK (exchange_rate > 0),
  expense_date DATE NOT NULL,
  -- shared: split between members; member: a single member's responsibility.
  responsibility TEXT NOT NULL DEFAULT 'shared' CHECK (responsibility IN ('shared', 'member')),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_date DATE,
  notes TEXT CHECK (char_length(notes) <= 200),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'excel', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT is_recurring OR frequency IS NOT NULL)
);
CREATE INDEX household_expenses_household_date_idx
  ON public.household_expenses (household_id, expense_date DESC);

CREATE TABLE public.household_expense_splits (
  expense_id UUID NOT NULL REFERENCES public.household_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  percentage NUMERIC(6, 3) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  -- In the household currency; the shares add up to the expense base_amount.
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (expense_id, member_id)
);
CREATE INDEX household_expense_splits_member_idx ON public.household_expense_splits (member_id);

CREATE TABLE public.household_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (char_length(btrim(category)) BETWEEN 1 AND 40),
  monthly_limit NUMERIC(14, 2) NOT NULL CHECK (monthly_limit > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, category)
);

CREATE TABLE public.household_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('emergency', 'travel', 'home', 'car', 'education', 'other')),
  emoji TEXT CHECK (char_length(emoji) <= 8),
  target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX household_goals_household_idx ON public.household_goals (household_id);

CREATE TABLE public.household_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.household_goals(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  contributed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  -- The contributor's own movement, optional.
  transaction_id UUID UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX household_goal_contributions_goal_idx ON public.household_goal_contributions (goal_id);

CREATE TABLE public.household_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- First day of the month being balanced.
  period DATE NOT NULL CHECK (extract(day FROM period) = 1),
  from_member UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  to_member UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  -- proposed → settled once both sides confirmed; deferred = next month; waived = no
  -- settlement this time.
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'deferred', 'waived', 'settled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Each side's confirmation with their own real movement (private to them).
  paid_at TIMESTAMPTZ,
  paid_transaction_id UUID UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  received_at TIMESTAMPTZ,
  received_transaction_id UUID UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_member <> to_member)
);
CREATE INDEX household_settlements_household_idx
  ON public.household_settlements (household_id, period DESC);

CREATE TABLE public.household_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- [{ "expense_id": uuid, "cut": number }, …] in the household currency. Never touches
  -- real movements.
  cuts JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(cuts) = 'array' AND jsonb_array_length(cuts) <= 100),
  monthly_saving NUMERIC(14, 2) NOT NULL CHECK (monthly_saving >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX household_simulations_household_idx ON public.household_simulations (household_id);

-- ---------- updated_at ----------

CREATE OR REPLACE FUNCTION public.household_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.household_touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER households_touch BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.household_touch_updated_at();
CREATE TRIGGER household_expenses_touch BEFORE UPDATE ON public.household_expenses
  FOR EACH ROW EXECUTE FUNCTION public.household_touch_updated_at();
CREATE TRIGGER household_budgets_touch BEFORE UPDATE ON public.household_budgets
  FOR EACH ROW EXECUTE FUNCTION public.household_touch_updated_at();
CREATE TRIGGER household_goals_touch BEFORE UPDATE ON public.household_goals
  FOR EACH ROW EXECUTE FUNCTION public.household_touch_updated_at();
CREATE TRIGGER household_settlements_touch BEFORE UPDATE ON public.household_settlements
  FOR EACH ROW EXECUTE FUNCTION public.household_touch_updated_at();

-- ---------- Membership helpers (SECURITY DEFINER: no RLS recursion) ----------

CREATE OR REPLACE FUNCTION public.is_household_member(p_household UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household AND user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(p_household UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household AND user_id = auth.uid() AND status = 'active'
      AND role = 'owner'
  );
$$;

-- The caller's member id in a household (NULL when not an active member).
CREATE OR REPLACE FUNCTION public.household_my_member(p_household UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.household_members
  WHERE household_id = p_household AND user_id = auth.uid() AND status = 'active';
$$;

-- TRUE when the member belongs to the household and is active (answers only to the
-- household's own members).
CREATE OR REPLACE FUNCTION public.household_member_active(p_household UUID, p_member UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_household_member(p_household) AND EXISTS (
    SELECT 1 FROM public.household_members
    WHERE id = p_member AND household_id = p_household AND status = 'active'
  );
$$;

-- The movement exists and belongs to the caller (or is NULL).
CREATE OR REPLACE FUNCTION public.household_own_transaction(p_tx UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_tx IS NULL OR EXISTS (
    SELECT 1 FROM public.transactions WHERE id = p_tx AND user_id = auth.uid()
  );
$$;

-- ---------- RLS ----------

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_simulations ENABLE ROW LEVEL SECURITY;

-- Start from nothing; grant only what each table needs.
REVOKE ALL ON public.households, public.household_members, public.household_invitations,
  public.household_expenses, public.household_expense_splits, public.household_budgets,
  public.household_goals, public.household_goal_contributions, public.household_settlements,
  public.household_simulations
  FROM anon, authenticated;

-- households: members read; the owner edits the settings (creation/deletion by RPC).
GRANT SELECT ON public.households TO authenticated;
GRANT UPDATE (name, subtitle, base_currency, split_method, emergency_months)
  ON public.households TO authenticated;
CREATE POLICY households_select ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id));
CREATE POLICY households_update ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_owner(id)) WITH CHECK (public.is_household_owner(id));

-- members: co-members read (history names included); each one edits their own name and
-- declared income, the owner the custom shares (guarded by trigger below).
GRANT SELECT ON public.household_members TO authenticated;
GRANT UPDATE (display_name, declared_income, custom_pct) ON public.household_members TO authenticated;
CREATE POLICY household_members_select ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY household_members_update ON public.household_members FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id) AND status = 'active')
  WITH CHECK (public.is_household_member(household_id));

-- invitations: only the owner sees them (no token: only its hash, never readable by
-- members). Created/accepted/revoked by RPC.
GRANT SELECT (id, household_id, email, created_at, expires_at, accepted_at, revoked_at)
  ON public.household_invitations TO authenticated;
CREATE POLICY household_invitations_select ON public.household_invitations FOR SELECT
  TO authenticated USING (public.is_household_owner(household_id));

-- expenses and splits: members read; created/edited by RPC; deleted by its creator or
-- the owner.
GRANT SELECT, DELETE ON public.household_expenses TO authenticated;
CREATE POLICY household_expenses_select ON public.household_expenses FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY household_expenses_delete ON public.household_expenses FOR DELETE TO authenticated
  USING (public.is_household_member(household_id)
    AND (created_by = auth.uid() OR public.is_household_owner(household_id)));

GRANT SELECT ON public.household_expense_splits TO authenticated;
CREATE POLICY household_expense_splits_select ON public.household_expense_splits FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.household_expenses e
    WHERE e.id = expense_id AND public.is_household_member(e.household_id)
  ));

-- budgets: any member manages them.
GRANT SELECT, INSERT, DELETE ON public.household_budgets TO authenticated;
GRANT UPDATE (category, monthly_limit) ON public.household_budgets TO authenticated;
CREATE POLICY household_budgets_all ON public.household_budgets FOR ALL TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

-- goals: any member creates and edits; its creator or the owner deletes.
GRANT SELECT, INSERT, DELETE ON public.household_goals TO authenticated;
GRANT UPDATE (name, kind, emoji, target_amount, target_date) ON public.household_goals TO authenticated;
CREATE POLICY household_goals_select ON public.household_goals FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY household_goals_insert ON public.household_goals FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());
CREATE POLICY household_goals_update ON public.household_goals FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));
CREATE POLICY household_goals_delete ON public.household_goals FOR DELETE TO authenticated
  USING (public.is_household_member(household_id)
    AND (created_by = auth.uid() OR public.is_household_owner(household_id)));

-- contributions: each member records their own (with their own movement, optional).
GRANT SELECT, INSERT, DELETE ON public.household_goal_contributions TO authenticated;
CREATE POLICY household_goal_contributions_select ON public.household_goal_contributions
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));
CREATE POLICY household_goal_contributions_insert ON public.household_goal_contributions
  FOR INSERT TO authenticated WITH CHECK (
    public.is_household_member(household_id)
    AND member_id = public.household_my_member(household_id)
    AND created_by = auth.uid()
    AND public.household_own_transaction(transaction_id)
    AND EXISTS (SELECT 1 FROM public.household_goals g
      WHERE g.id = goal_id AND g.household_id = household_goal_contributions.household_id)
  );
CREATE POLICY household_goal_contributions_delete ON public.household_goal_contributions
  FOR DELETE TO authenticated USING (public.is_household_member(household_id)
    AND (created_by = auth.uid() OR public.is_household_owner(household_id)));

-- settlements: members read and propose; confirmations and status changes by RPC; a
-- proposal nobody confirmed yet can be deleted by its creator or the owner.
GRANT SELECT, INSERT, DELETE ON public.household_settlements TO authenticated;
CREATE POLICY household_settlements_select ON public.household_settlements FOR SELECT
  TO authenticated USING (public.is_household_member(household_id));
CREATE POLICY household_settlements_insert ON public.household_settlements FOR INSERT
  TO authenticated WITH CHECK (
    public.is_household_member(household_id)
    AND created_by = auth.uid()
    AND status = 'proposed'
    AND paid_at IS NULL AND received_at IS NULL
    AND paid_transaction_id IS NULL AND received_transaction_id IS NULL
    AND public.household_member_active(household_id, from_member)
    AND public.household_member_active(household_id, to_member)
  );
CREATE POLICY household_settlements_delete ON public.household_settlements FOR DELETE
  TO authenticated USING (public.is_household_member(household_id)
    AND paid_at IS NULL AND received_at IS NULL
    AND (created_by = auth.uid() OR public.is_household_owner(household_id)));

-- simulations: members save and read; creator or owner deletes.
GRANT SELECT, INSERT, DELETE ON public.household_simulations TO authenticated;
CREATE POLICY household_simulations_select ON public.household_simulations FOR SELECT
  TO authenticated USING (public.is_household_member(household_id));
CREATE POLICY household_simulations_insert ON public.household_simulations FOR INSERT
  TO authenticated WITH CHECK (public.is_household_member(household_id) AND created_by = auth.uid());
CREATE POLICY household_simulations_delete ON public.household_simulations FOR DELETE
  TO authenticated USING (public.is_household_member(household_id)
    AND (created_by = auth.uid() OR public.is_household_owner(household_id)));

-- ---------- Guards ----------

-- Members: each one edits only their own name and declared income; only the owner sets
-- the custom shares. Direct statements only (pg_trigger_depth() = 1): the RPCs below
-- and the account-deletion cleanup run as the system.
CREATE OR REPLACE FUNCTION public.household_members_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (NEW.display_name IS DISTINCT FROM OLD.display_name
      OR NEW.declared_income IS DISTINCT FROM OLD.declared_income)
     AND OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo puedes cambiar tu propio nombre e ingreso declarado.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.custom_pct IS DISTINCT FROM OLD.custom_pct
     AND NOT public.is_household_owner(OLD.household_id) THEN
    RAISE EXCEPTION 'Solo quien administra el hogar cambia el reparto.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.household_members_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER household_members_guard BEFORE UPDATE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.household_members_guard();

-- The household currency cannot change once there are expenses (their equivalents were
-- computed with it).
CREATE OR REPLACE FUNCTION public.households_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.base_currency IS DISTINCT FROM OLD.base_currency
     AND EXISTS (SELECT 1 FROM public.household_expenses WHERE household_id = OLD.id) THEN
    RAISE EXCEPTION 'La moneda del hogar no se puede cambiar cuando ya hay gastos.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.households_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER households_guard BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.households_guard();

-- When a user deletes their account, their membership stays (history) but leaves. If it
-- was the owner, the oldest active member takes over; a household with nobody left is
-- deleted.
CREATE OR REPLACE FUNCTION public.household_members_account_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  heir UUID;
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL AND OLD.status = 'active' THEN
    UPDATE public.household_members
      SET status = 'left', left_at = now(), role = 'member'
      WHERE id = NEW.id;
    IF OLD.role = 'owner' THEN
      SELECT id INTO heir FROM public.household_members
        WHERE household_id = OLD.household_id AND status = 'active' AND id <> OLD.id
        ORDER BY joined_at LIMIT 1;
      IF heir IS NULL THEN
        DELETE FROM public.households WHERE id = OLD.household_id;
      ELSE
        UPDATE public.household_members SET role = 'owner' WHERE id = heir;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.household_members_account_deleted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER household_members_account_deleted AFTER UPDATE OF user_id ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.household_members_account_deleted();

-- ---------- RPC: household lifecycle ----------

-- Creates a household with the caller as owner. Returns its id.
CREATE OR REPLACE FUNCTION public.create_household(
  p_name TEXT,
  p_display_name TEXT,
  p_subtitle TEXT DEFAULT NULL,
  p_base_currency TEXT DEFAULT 'PEN'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  hid UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = uid AND status = 'active') THEN
    RAISE EXCEPTION 'Ya perteneces a un hogar.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.households (name, subtitle, base_currency, created_by)
    VALUES (btrim(p_name), nullif(btrim(coalesce(p_subtitle, '')), ''),
      coalesce(p_base_currency, 'PEN'), uid)
    RETURNING id INTO hid;
  INSERT INTO public.household_members (household_id, user_id, display_name, role)
    VALUES (hid, uid, btrim(p_display_name), 'owner');
  RETURN hid;
END;
$$;

-- Issues an invitation (owner only). Returns the token once; only its hash is stored.
CREATE OR REPLACE FUNCTION public.create_household_invite(p_household UUID, p_email TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  tok TEXT;
BEGIN
  IF NOT public.is_household_owner(p_household) THEN
    RAISE EXCEPTION 'Solo quien administra el hogar puede invitar.' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.household_members
      WHERE household_id = p_household AND status = 'active') >= 8 THEN
    RAISE EXCEPTION 'El hogar ya tiene el máximo de 8 personas.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.household_invitations
      WHERE household_id = p_household AND accepted_at IS NULL AND revoked_at IS NULL
        AND expires_at > now()) >= 10 THEN
    RAISE EXCEPTION 'Hay demasiadas invitaciones pendientes. Revoca alguna.' USING ERRCODE = '22023';
  END IF;
  -- 2 random UUIDs = 244 random bits.
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.household_invitations (household_id, token_hash, email, invited_by)
    VALUES (p_household, encode(sha256(convert_to(tok, 'UTF8')), 'hex'),
      nullif(lower(btrim(coalesce(p_email, ''))), ''), uid);
  RETURN tok;
END;
$$;

-- What the join page shows before accepting. Reveals only the household name and the
-- inviter's name in the household, and only for a valid token.
CREATE OR REPLACE FUNCTION public.household_invite_info(p_token TEXT)
RETURNS TABLE (household_name TEXT, inviter_name TEXT, status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv public.household_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.household_invitations
    WHERE token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  IF inv.id IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'invalid'::TEXT;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT h.name,
      (SELECT m.display_name FROM public.household_members m
        WHERE m.household_id = h.id AND m.user_id = inv.invited_by LIMIT 1),
      CASE
        WHEN inv.revoked_at IS NOT NULL THEN 'revoked'
        WHEN inv.accepted_at IS NOT NULL THEN 'used'
        WHEN inv.expires_at <= now() THEN 'expired'
        ELSE 'valid'
      END
    FROM public.households h WHERE h.id = inv.household_id;
END;
$$;

-- Accepts an invitation. Single use, not expired nor revoked, bound to the email when
-- it has one, and only if the caller is not in a household already. Returns its id.
CREATE OR REPLACE FUNCTION public.accept_household_invite(p_token TEXT, p_display_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  inv public.household_invitations;
  my_email TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.household_invitations
    WHERE token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    FOR UPDATE;
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'La invitación no es válida.' USING ERRCODE = '22023';
  END IF;
  IF inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta invitación fue anulada.' USING ERRCODE = '22023';
  END IF;
  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta invitación ya fue usada.' USING ERRCODE = '22023';
  END IF;
  IF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Esta invitación venció. Pide una nueva.' USING ERRCODE = '22023';
  END IF;
  IF inv.email IS NOT NULL THEN
    SELECT lower(email) INTO my_email FROM auth.users WHERE id = uid;
    IF my_email IS DISTINCT FROM inv.email THEN
      RAISE EXCEPTION 'Esta invitación es para otro correo.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = uid AND status = 'active') THEN
    RAISE EXCEPTION 'Ya perteneces a un hogar.' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.household_members
      WHERE household_id = inv.household_id AND status = 'active') >= 8 THEN
    RAISE EXCEPTION 'El hogar ya tiene el máximo de 8 personas.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.household_members (household_id, user_id, display_name, role)
    VALUES (inv.household_id, uid, btrim(p_display_name), 'member');
  UPDATE public.household_invitations SET accepted_at = now(), accepted_by = uid
    WHERE id = inv.id;
  RETURN inv.household_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_household_invite(p_invitation UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  hid UUID;
BEGIN
  SELECT household_id INTO hid FROM public.household_invitations WHERE id = p_invitation;
  IF hid IS NULL OR NOT public.is_household_owner(hid) THEN
    RAISE EXCEPTION 'Solo quien administra el hogar puede anular invitaciones.'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.household_invitations SET revoked_at = now()
    WHERE id = p_invitation AND accepted_at IS NULL AND revoked_at IS NULL;
END;
$$;

-- The owner removes another member (the history keeps their name).
CREATE OR REPLACE FUNCTION public.remove_household_member(p_member UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m public.household_members;
BEGIN
  SELECT * INTO m FROM public.household_members WHERE id = p_member AND status = 'active';
  IF m.id IS NULL OR NOT public.is_household_owner(m.household_id) THEN
    RAISE EXCEPTION 'Solo quien administra el hogar puede quitar personas.' USING ERRCODE = '42501';
  END IF;
  IF m.user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes quitarte a ti mismo: usa "Salir del hogar".' USING ERRCODE = '22023';
  END IF;
  UPDATE public.household_members SET status = 'removed', left_at = now() WHERE id = p_member;
END;
$$;

-- Hands the owner role to another active member.
CREATE OR REPLACE FUNCTION public.transfer_household_ownership(p_member UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m public.household_members;
BEGIN
  SELECT * INTO m FROM public.household_members WHERE id = p_member AND status = 'active';
  IF m.id IS NULL OR NOT public.is_household_owner(m.household_id) THEN
    RAISE EXCEPTION 'Solo quien administra el hogar puede transferirlo.' USING ERRCODE = '42501';
  END IF;
  IF m.user_id = auth.uid() THEN
    RETURN;
  END IF;
  UPDATE public.household_members SET role = 'member'
    WHERE household_id = m.household_id AND user_id = auth.uid() AND status = 'active';
  UPDATE public.household_members SET role = 'owner' WHERE id = p_member;
END;
$$;

-- The caller leaves. The owner must hand over the household first while others remain;
-- the last member leaving deletes it.
CREATE OR REPLACE FUNCTION public.leave_household(p_household UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me public.household_members;
  others INT;
BEGIN
  SELECT * INTO me FROM public.household_members
    WHERE household_id = p_household AND user_id = auth.uid() AND status = 'active';
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este hogar.' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO others FROM public.household_members
    WHERE household_id = p_household AND status = 'active' AND id <> me.id;
  IF others = 0 THEN
    DELETE FROM public.households WHERE id = p_household;
    RETURN;
  END IF;
  IF me.role = 'owner' THEN
    RAISE EXCEPTION 'Antes de salir, pasa la administración del hogar a otra persona.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.household_members SET status = 'left', left_at = now() WHERE id = me.id;
END;
$$;

-- The owner deletes the household and all its shared data. Private data is untouched.
CREATE OR REPLACE FUNCTION public.delete_household(p_household UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_household_owner(p_household) THEN
    RAISE EXCEPTION 'Solo quien administra el hogar puede eliminarlo.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.households WHERE id = p_household;
END;
$$;

-- ---------- RPC: shared expenses ----------

-- Creates (p_expense NULL) or edits an expense with its split.
--   p_splits: [{ "member_id": uuid, "percentage": number }, …] adding up to 100, for a
--   shared expense; for responsibility = 'member' a single member with 100.
-- The shares in the household currency are computed here (the last one takes the
-- rounding cents). Editing: its creator or the owner. Linking a movement: only one of
-- the caller's own.
CREATE OR REPLACE FUNCTION public.save_household_expense(
  p_household UUID,
  p_expense UUID,
  p_paid_by UUID,
  p_name TEXT,
  p_category TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_exchange_rate NUMERIC,
  p_expense_date DATE,
  p_responsibility TEXT,
  p_splits JSONB,
  p_is_recurring BOOLEAN DEFAULT FALSE,
  p_frequency TEXT DEFAULT NULL,
  p_next_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_transaction UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  h public.households;
  cur public.household_expenses;
  eid UUID;
  base NUMERIC(14, 2);
  rate NUMERIC(18, 8);
  total_pct NUMERIC := 0;
  n INT;
  i INT := 0;
  s JSONB;
  share NUMERIC(14, 2);
  assigned NUMERIC(14, 2) := 0;
BEGIN
  IF uid IS NULL OR NOT public.is_household_member(p_household) THEN
    RAISE EXCEPTION 'No perteneces a este hogar.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO h FROM public.households WHERE id = p_household;
  IF p_expense IS NOT NULL THEN
    SELECT * INTO cur FROM public.household_expenses
      WHERE id = p_expense AND household_id = p_household FOR UPDATE;
    IF cur.id IS NULL THEN
      RAISE EXCEPTION 'El gasto no existe.' USING ERRCODE = '22023';
    END IF;
    IF cur.created_by IS DISTINCT FROM uid AND NOT public.is_household_owner(p_household) THEN
      RAISE EXCEPTION 'Solo quien lo registró o quien administra el hogar puede editarlo.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NOT public.household_member_active(p_household, p_paid_by) THEN
    RAISE EXCEPTION 'Quien pagó debe ser parte del hogar.' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero.' USING ERRCODE = '22023';
  END IF;
  -- Same currency: rate 1. Another currency: the rate the user saw (never recalculated).
  rate := CASE WHEN p_currency = h.base_currency THEN 1 ELSE p_exchange_rate END;
  IF rate IS NULL OR rate <= 0 THEN
    RAISE EXCEPTION 'Falta el tipo de cambio.' USING ERRCODE = '22023';
  END IF;
  base := round(p_amount * rate, 2);
  IF base <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero.' USING ERRCODE = '22023';
  END IF;
  -- Linking a movement: it must be the caller's own (and it stays private).
  IF p_transaction IS NOT NULL
     AND p_transaction IS DISTINCT FROM cur.transaction_id
     AND NOT public.household_own_transaction(p_transaction) THEN
    RAISE EXCEPTION 'Solo puedes vincular tus propios movimientos.' USING ERRCODE = '42501';
  END IF;
  -- Splits.
  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' THEN
    RAISE EXCEPTION 'Falta el reparto.' USING ERRCODE = '22023';
  END IF;
  n := jsonb_array_length(p_splits);
  IF n = 0 OR n > 8 OR (p_responsibility = 'member' AND n <> 1) THEN
    RAISE EXCEPTION 'El reparto no es válido.' USING ERRCODE = '22023';
  END IF;
  FOR s IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    IF NOT public.household_member_active(p_household, (s->>'member_id')::UUID)
       OR coalesce((s->>'percentage')::NUMERIC, 0) <= 0 THEN
      RAISE EXCEPTION 'El reparto no es válido.' USING ERRCODE = '22023';
    END IF;
    total_pct := total_pct + (s->>'percentage')::NUMERIC;
  END LOOP;
  IF abs(total_pct - 100) > 0.01 THEN
    RAISE EXCEPTION 'Los porcentajes deben sumar 100%%.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT x->>'member_id') FROM jsonb_array_elements(p_splits) x) <> n THEN
    RAISE EXCEPTION 'El reparto no es válido.' USING ERRCODE = '22023';
  END IF;

  IF p_expense IS NULL THEN
    INSERT INTO public.household_expenses (household_id, created_by, paid_by, transaction_id,
      name, category, amount, currency_code, base_amount, exchange_rate, expense_date,
      responsibility, is_recurring, frequency, next_date, notes, source)
    VALUES (p_household, uid, p_paid_by, p_transaction, btrim(p_name), btrim(p_category),
      p_amount, p_currency, base, rate, p_expense_date, p_responsibility,
      coalesce(p_is_recurring, FALSE), CASE WHEN p_is_recurring THEN p_frequency END,
      CASE WHEN p_is_recurring THEN p_next_date END, nullif(btrim(coalesce(p_notes, '')), ''),
      coalesce(p_source, 'manual'))
    RETURNING id INTO eid;
  ELSE
    eid := p_expense;
    UPDATE public.household_expenses SET
      paid_by = p_paid_by, transaction_id = p_transaction, name = btrim(p_name),
      category = btrim(p_category), amount = p_amount, currency_code = p_currency,
      base_amount = base, exchange_rate = rate, expense_date = p_expense_date,
      responsibility = p_responsibility, is_recurring = coalesce(p_is_recurring, FALSE),
      frequency = CASE WHEN p_is_recurring THEN p_frequency END,
      next_date = CASE WHEN p_is_recurring THEN p_next_date END,
      notes = nullif(btrim(coalesce(p_notes, '')), '')
    WHERE id = eid;
    DELETE FROM public.household_expense_splits WHERE expense_id = eid;
  END IF;

  FOR s IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    i := i + 1;
    share := CASE WHEN i = n THEN base - assigned
      ELSE round(base * (s->>'percentage')::NUMERIC / 100, 2) END;
    assigned := assigned + share;
    INSERT INTO public.household_expense_splits (expense_id, member_id, percentage, amount)
      VALUES (eid, (s->>'member_id')::UUID, (s->>'percentage')::NUMERIC, share);
  END LOOP;
  RETURN eid;
END;
$$;

-- ---------- RPC: settlements (two confirmations, each with its own movement) ----------

-- The member who owes confirms they paid, with the expense they recorded in their own
-- account (optional: they may have paid in cash outside MONEO).
CREATE OR REPLACE FUNCTION public.confirm_household_settlement_paid(p_settlement UUID, p_transaction UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  st public.household_settlements;
BEGIN
  SELECT * INTO st FROM public.household_settlements WHERE id = p_settlement FOR UPDATE;
  IF st.id IS NULL OR st.from_member IS DISTINCT FROM public.household_my_member(st.household_id) THEN
    RAISE EXCEPTION 'Solo quien paga la compensación puede confirmarla.' USING ERRCODE = '42501';
  END IF;
  IF st.status NOT IN ('proposed', 'deferred') OR st.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta compensación ya no está pendiente de pago.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.household_own_transaction(p_transaction) THEN
    RAISE EXCEPTION 'Solo puedes vincular tus propios movimientos.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.household_settlements SET paid_at = now(), paid_transaction_id = p_transaction,
    status = CASE WHEN received_at IS NOT NULL THEN 'settled' ELSE 'proposed' END
    WHERE id = st.id;
END;
$$;

-- The member who receives confirms it arrived, with the income in their own account.
CREATE OR REPLACE FUNCTION public.confirm_household_settlement_received(p_settlement UUID, p_transaction UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  st public.household_settlements;
BEGIN
  SELECT * INTO st FROM public.household_settlements WHERE id = p_settlement FOR UPDATE;
  IF st.id IS NULL OR st.to_member IS DISTINCT FROM public.household_my_member(st.household_id) THEN
    RAISE EXCEPTION 'Solo quien recibe la compensación puede confirmarla.' USING ERRCODE = '42501';
  END IF;
  IF st.status NOT IN ('proposed', 'deferred') OR st.received_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta compensación ya no está pendiente.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.household_own_transaction(p_transaction) THEN
    RAISE EXCEPTION 'Solo puedes vincular tus propios movimientos.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.household_settlements SET received_at = now(),
    received_transaction_id = p_transaction,
    status = CASE WHEN paid_at IS NOT NULL THEN 'settled' ELSE 'proposed' END
    WHERE id = st.id;
END;
$$;

-- "Dejar para el próximo mes" / "Sin compensación" (either side of the settlement, or
-- the owner), only while nobody confirmed a movement.
CREATE OR REPLACE FUNCTION public.set_household_settlement_status(p_settlement UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  st public.household_settlements;
  me UUID;
BEGIN
  IF p_status NOT IN ('proposed', 'deferred', 'waived') THEN
    RAISE EXCEPTION 'Estado no válido.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO st FROM public.household_settlements WHERE id = p_settlement FOR UPDATE;
  me := public.household_my_member(st.household_id);
  IF st.id IS NULL OR me IS NULL
     OR (me NOT IN (st.from_member, st.to_member) AND NOT public.is_household_owner(st.household_id)) THEN
    RAISE EXCEPTION 'No puedes cambiar esta compensación.' USING ERRCODE = '42501';
  END IF;
  IF st.paid_at IS NOT NULL OR st.received_at IS NOT NULL OR st.status = 'settled' THEN
    RAISE EXCEPTION 'Esta compensación ya tiene un pago confirmado.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.household_settlements SET status = p_status WHERE id = st.id;
END;
$$;

-- ---------- RPC: notify the other members (same notifications table) ----------

-- Sends a notification to the other active members. The text must not carry amounts
-- (the app builds it); rate-limited so it cannot be used for spam.
CREATE OR REPLACE FUNCTION public.notify_household(
  p_household UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT '/finanzas/hogar'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  sent INT;
BEGIN
  IF uid IS NULL OR NOT public.is_household_member(p_household) THEN
    RAISE EXCEPTION 'No perteneces a este hogar.' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('household_expense', 'household_payment', 'household_budget',
      'household_goal', 'household_settlement', 'household_member') THEN
    RAISE EXCEPTION 'Tipo de aviso no válido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(p_title, '')) NOT BETWEEN 1 AND 80
     OR char_length(coalesce(p_message, '')) > 200
     OR (p_action_url IS NOT NULL AND p_action_url !~ '^/finanzas/hogar') THEN
    RAISE EXCEPTION 'Aviso no válido.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.notifications
      WHERE metadata->>'household_sender' = uid::text
        AND created_at > now() - interval '1 hour') >= 60 THEN
    RAISE EXCEPTION 'Demasiados avisos seguidos. Intenta más tarde.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, message, icon, color, action_url,
    entity_type, entity_id, metadata)
  SELECT m.user_id, p_type, p_title, p_message, '🏠', '#FFD83D', p_action_url, 'household',
    p_household, jsonb_build_object('household_sender', uid)
  FROM public.household_members m
  WHERE m.household_id = p_household AND m.status = 'active' AND m.user_id IS NOT NULL
    AND m.user_id <> uid;
  GET DIAGNOSTICS sent = ROW_COUNT;
  RETURN sent;
END;
$$;

-- ---------- Grants on functions ----------

REVOKE ALL ON FUNCTION
  public.is_household_member(UUID),
  public.is_household_owner(UUID),
  public.household_my_member(UUID),
  public.household_member_active(UUID, UUID),
  public.household_own_transaction(UUID),
  public.create_household(TEXT, TEXT, TEXT, TEXT),
  public.create_household_invite(UUID, TEXT),
  public.household_invite_info(TEXT),
  public.accept_household_invite(TEXT, TEXT),
  public.revoke_household_invite(UUID),
  public.remove_household_member(UUID),
  public.transfer_household_ownership(UUID),
  public.leave_household(UUID),
  public.delete_household(UUID),
  public.save_household_expense(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, DATE, TEXT,
    JSONB, BOOLEAN, TEXT, DATE, TEXT, UUID, TEXT),
  public.confirm_household_settlement_paid(UUID, UUID),
  public.confirm_household_settlement_received(UUID, UUID),
  public.set_household_settlement_status(UUID, TEXT),
  public.notify_household(UUID, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.is_household_member(UUID),
  public.is_household_owner(UUID),
  public.household_my_member(UUID),
  public.household_member_active(UUID, UUID),
  public.household_own_transaction(UUID),
  public.create_household(TEXT, TEXT, TEXT, TEXT),
  public.create_household_invite(UUID, TEXT),
  public.household_invite_info(TEXT),
  public.accept_household_invite(TEXT, TEXT),
  public.revoke_household_invite(UUID),
  public.remove_household_member(UUID),
  public.transfer_household_ownership(UUID),
  public.leave_household(UUID),
  public.delete_household(UUID),
  public.save_household_expense(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, DATE, TEXT,
    JSONB, BOOLEAN, TEXT, DATE, TEXT, UUID, TEXT),
  public.confirm_household_settlement_paid(UUID, UUID),
  public.confirm_household_settlement_received(UUID, UUID),
  public.set_household_settlement_status(UUID, TEXT),
  public.notify_household(UUID, TEXT, TEXT, TEXT, TEXT)
TO authenticated;

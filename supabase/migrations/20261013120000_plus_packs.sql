-- ============================================================
-- MONEO PLUS Duo (2 personas) y Familiar (hasta 6), y la regla PLUS de MONEO HOGAR.
--
-- * billing_plans.seats: people covered by a plan (1 = individual). New plans: Duo and
--   Familiar, monthly subscription (card) or prepaid 3 months / 1 year (card, Yape,
--   PagoEfectivo). They are bought and charged exactly like the individual plans: the
--   payer's user_entitlements row holds the plan; nothing else changes in billing.
-- * plus_packs / plus_pack_members / plus_pack_invitations: the payer (owner) invites
--   people with a single-use link (7 days). A member gets PLUS while the owner's plan is
--   active and has a free seat for them (oldest members first). Each person keeps their
--   own private account: a pack shares the payment, never any data.
-- * has_plus(): own plan OR an active pack seat. Gmail stays tied to the person's own
--   paid plan (the mail-oauth function reads user_entitlements), as Google limits the
--   number of users while the app is not verified.
-- * household_has_plus(): MONEO HOGAR's PLUS features open for the whole household when
--   at least one active member has PLUS.
-- ============================================================

-- ---------- Plans ----------

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS seats INT NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 6);

ALTER TABLE public.billing_plans DROP CONSTRAINT IF EXISTS billing_plans_code_check;
ALTER TABLE public.billing_plans ADD CONSTRAINT billing_plans_code_check CHECK (
  code IN ('plus_monthly', 'plus_yearly', 'plus_lifetime', 'founder', 'pass_3m', 'pass_12m',
    'free_trial', 'duo_monthly', 'duo_3m', 'duo_12m', 'family_monthly', 'family_3m',
    'family_12m')
);

INSERT INTO public.billing_plans
  (code, name, kind, price, interval_months, trial_days, active, sort_order, seats)
VALUES
  ('duo_monthly', 'MONEO PLUS Duo mensual', 'subscription', 13.90, 1, 0, TRUE, 20, 2),
  ('duo_3m', 'MONEO PLUS Duo 3 meses', 'pass', 36.90, 3, 0, TRUE, 21, 2),
  ('duo_12m', 'MONEO PLUS Duo 1 año (pago único)', 'pass', 135.00, 12, 0, TRUE, 22, 2),
  ('family_monthly', 'MONEO PLUS Familiar mensual', 'subscription', 17.90, 1, 0, TRUE, 30, 6),
  ('family_3m', 'MONEO PLUS Familiar 3 meses', 'pass', 47.90, 3, 0, TRUE, 31, 6),
  ('family_12m', 'MONEO PLUS Familiar 1 año (pago único)', 'pass', 175.00, 12, 0, TRUE, 32, 6)
ON CONFLICT (code) DO NOTHING;

-- ---------- Packs ----------

CREATE TABLE public.plus_packs (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- How the owner wants to appear to the people they invite.
  owner_name TEXT NOT NULL CHECK (char_length(btrim(owner_name)) BETWEEN 1 AND 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plus_pack_members (
  -- A person is in one pack at most.
  member_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.plus_packs(owner_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 40),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (member_id <> owner_id)
);
CREATE INDEX plus_pack_members_owner_idx ON public.plus_pack_members (owner_id, joined_at);

CREATE TABLE public.plus_pack_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.plus_packs(owner_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT CHECK (char_length(email) <= 254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX plus_pack_invitations_owner_idx ON public.plus_pack_invitations (owner_id);

ALTER TABLE public.plus_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plus_pack_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plus_pack_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_packs, public.plus_pack_members, public.plus_pack_invitations
  FROM anon, authenticated;
-- Everything is read and written through the functions below.

-- ---------- PLUS for a user ----------

-- Seats of the user's own plan while it gives PLUS (0 when it does not). Same rule as
-- has_plus() always had: one_time while active, every other kind until its period end.
CREATE OR REPLACE FUNCTION public.plus_own_seats(p_user UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN (p.kind = 'one_time' AND e.status = 'active')
        OR (p.kind <> 'one_time' AND e.current_period_end IS NOT NULL
          AND e.current_period_end > now())
      THEN p.seats ELSE 0 END
    FROM public.user_entitlements e
    JOIN public.billing_plans p ON p.code = e.plan_code
    WHERE e.user_id = p_user
  ), 0);
$$;

-- TRUE when the user has a seat in an active pack (the owner's plan covers them).
CREATE OR REPLACE FUNCTION public.plus_pack_seat(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plus_pack_members m
    WHERE m.member_id = p_user
      AND (SELECT count(*) FROM public.plus_pack_members o
        WHERE o.owner_id = m.owner_id
          AND (o.joined_at, o.member_id) < (m.joined_at, m.member_id))
        < public.plus_own_seats(m.owner_id) - 1
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_plus(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.plus_own_seats(p_user) > 0 OR public.plus_pack_seat(p_user);
$$;

CREATE OR REPLACE FUNCTION public.has_plus()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND public.user_has_plus(auth.uid());
$$;

-- MONEO HOGAR: PLUS features open for every member when one active member has PLUS.
CREATE OR REPLACE FUNCTION public.household_has_plus(p_household UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_household_member(p_household) AND EXISTS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = p_household AND m.status = 'active' AND m.user_id IS NOT NULL
      AND public.user_has_plus(m.user_id)
  );
$$;

-- ---------- The caller's pack ----------

-- The pack the caller owns or belongs to. role: 'owner' | 'member' | NULL (no pack).
-- Owners also see their members (name in the pack, date, whether they have a seat).
-- Members see only the owner's name and the plan: never the other members.
CREATE OR REPLACE FUNCTION public.my_plus_pack()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  seats INT;
  m public.plus_pack_members;
  plan public.billing_plans;
  ent public.user_entitlements;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  seats := public.plus_own_seats(uid);
  IF seats > 1 THEN
    SELECT p.* INTO plan FROM public.user_entitlements e
      JOIN public.billing_plans p ON p.code = e.plan_code WHERE e.user_id = uid;
    RETURN jsonb_build_object(
      'role', 'owner',
      'plan_code', plan.code,
      'plan_name', plan.name,
      'seats', seats,
      'owner_name', (SELECT owner_name FROM public.plus_packs WHERE owner_id = uid),
      'members', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', x.member_id, 'name', x.display_name, 'joined_at', x.joined_at,
          'covered', x.rn <= seats - 1) ORDER BY x.joined_at)
        FROM (SELECT pm.*, row_number() OVER (ORDER BY pm.joined_at, pm.member_id) AS rn
          FROM public.plus_pack_members pm WHERE pm.owner_id = uid) x
      ), '[]'::jsonb)
    );
  END IF;
  SELECT * INTO m FROM public.plus_pack_members WHERE member_id = uid;
  IF m.member_id IS NULL THEN
    RETURN jsonb_build_object('role', NULL);
  END IF;
  SELECT * INTO ent FROM public.user_entitlements WHERE user_id = m.owner_id;
  SELECT * INTO plan FROM public.billing_plans WHERE code = ent.plan_code;
  RETURN jsonb_build_object(
    'role', 'member',
    'plan_code', plan.code,
    'plan_name', plan.name,
    'seats', plan.seats,
    'owner_name', (SELECT owner_name FROM public.plus_packs WHERE owner_id = m.owner_id),
    'covered', public.plus_pack_seat(uid),
    'period_end', CASE WHEN public.plus_pack_seat(uid) THEN ent.current_period_end END
  );
END;
$$;

-- The owner issues a single-use invitation (7 days). Returns the token once.
CREATE OR REPLACE FUNCTION public.create_plus_pack_invite(p_owner_name TEXT, p_email TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  seats INT;
  tok TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  seats := public.plus_own_seats(uid);
  IF seats < 2 THEN
    RAISE EXCEPTION 'Necesitas un plan Duo o Familiar activo para invitar.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.plus_pack_members WHERE member_id = uid) THEN
    RAISE EXCEPTION 'Sal del pack en el que estás antes de invitar a otros.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.plus_pack_members WHERE owner_id = uid) >= seats - 1 THEN
    RAISE EXCEPTION 'Tu pack ya está completo.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.plus_packs (owner_id, owner_name) VALUES (uid, btrim(p_owner_name))
    ON CONFLICT (owner_id) DO UPDATE SET owner_name = EXCLUDED.owner_name;
  IF (SELECT count(*) FROM public.plus_pack_invitations
      WHERE owner_id = uid AND accepted_at IS NULL AND revoked_at IS NULL
        AND expires_at > now()) >= 10 THEN
    RAISE EXCEPTION 'Hay demasiadas invitaciones pendientes. Anula alguna.' USING ERRCODE = '22023';
  END IF;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.plus_pack_invitations (owner_id, token_hash, email)
    VALUES (uid, encode(sha256(convert_to(tok, 'UTF8')), 'hex'),
      nullif(lower(btrim(coalesce(p_email, ''))), ''));
  RETURN tok;
END;
$$;

-- Pending invitations of the caller's pack (no token).
CREATE OR REPLACE FUNCTION public.my_plus_pack_invitations()
RETURNS TABLE (id UUID, email TEXT, expires_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.id, i.email, i.expires_at FROM public.plus_pack_invitations i
  WHERE i.owner_id = auth.uid() AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.revoke_plus_pack_invite(p_invitation UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.plus_pack_invitations SET revoked_at = now()
  WHERE id = p_invitation AND owner_id = auth.uid() AND accepted_at IS NULL
    AND revoked_at IS NULL;
$$;

-- What the join page shows before accepting.
CREATE OR REPLACE FUNCTION public.plus_pack_invite_info(p_token TEXT)
RETURNS TABLE (owner_name TEXT, plan_name TEXT, status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv public.plus_pack_invitations;
  seats INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.plus_pack_invitations
    WHERE token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  IF inv.id IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'invalid'::TEXT;
    RETURN;
  END IF;
  seats := public.plus_own_seats(inv.owner_id);
  RETURN QUERY SELECT
    (SELECT pk.owner_name FROM public.plus_packs pk WHERE pk.owner_id = inv.owner_id),
    (SELECT p.name FROM public.user_entitlements e JOIN public.billing_plans p ON p.code = e.plan_code
      WHERE e.user_id = inv.owner_id),
    CASE
      WHEN inv.revoked_at IS NOT NULL THEN 'revoked'
      WHEN inv.accepted_at IS NOT NULL THEN 'used'
      WHEN inv.expires_at <= now() THEN 'expired'
      WHEN seats < 2 THEN 'inactive'
      WHEN (SELECT count(*) FROM public.plus_pack_members WHERE owner_id = inv.owner_id) >= seats - 1
        THEN 'full'
      ELSE 'valid'
    END;
END;
$$;

-- Joins a pack: valid single-use invitation, bound to its email when it has one, a free
-- seat, and the caller is neither in another pack nor the owner of one.
CREATE OR REPLACE FUNCTION public.accept_plus_pack_invite(p_token TEXT, p_display_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  inv public.plus_pack_invitations;
  seats INT;
  my_email TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.plus_pack_invitations
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
  IF inv.owner_id = uid THEN
    RAISE EXCEPTION 'No puedes unirte a tu propio pack.' USING ERRCODE = '22023';
  END IF;
  IF inv.email IS NOT NULL THEN
    SELECT lower(email) INTO my_email FROM auth.users WHERE id = uid;
    IF my_email IS DISTINCT FROM inv.email THEN
      RAISE EXCEPTION 'Esta invitación es para otro correo.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.plus_pack_members WHERE member_id = uid) THEN
    RAISE EXCEPTION 'Ya estás en un pack. Sal de ese pack primero.' USING ERRCODE = '23505';
  END IF;
  IF public.plus_own_seats(uid) > 1 THEN
    RAISE EXCEPTION 'Ya tienes tu propio plan Duo o Familiar.' USING ERRCODE = '23505';
  END IF;
  seats := public.plus_own_seats(inv.owner_id);
  IF seats < 2 THEN
    RAISE EXCEPTION 'El plan de quien te invitó ya no está activo.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.plus_pack_members WHERE owner_id = inv.owner_id) >= seats - 1 THEN
    RAISE EXCEPTION 'El pack ya está completo.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.plus_pack_members (member_id, owner_id, display_name)
    VALUES (uid, inv.owner_id, btrim(p_display_name));
  UPDATE public.plus_pack_invitations SET accepted_at = now(), accepted_by = uid WHERE id = inv.id;
END;
$$;

-- The owner removes someone (they go back to their own plan, or FREE). Data untouched.
CREATE OR REPLACE FUNCTION public.remove_plus_pack_member(p_member UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.plus_pack_members WHERE member_id = p_member AND owner_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa persona no está en tu pack.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_plus_pack()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.plus_pack_members WHERE member_id = auth.uid();
$$;

-- ---------- Grants ----------

REVOKE ALL ON FUNCTION
  public.plus_own_seats(UUID),
  public.plus_pack_seat(UUID),
  public.user_has_plus(UUID)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.has_plus(),
  public.household_has_plus(UUID),
  public.my_plus_pack(),
  public.create_plus_pack_invite(TEXT, TEXT),
  public.my_plus_pack_invitations(),
  public.revoke_plus_pack_invite(UUID),
  public.plus_pack_invite_info(TEXT),
  public.accept_plus_pack_invite(TEXT, TEXT),
  public.remove_plus_pack_member(UUID),
  public.leave_plus_pack()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.has_plus(),
  public.household_has_plus(UUID),
  public.my_plus_pack(),
  public.create_plus_pack_invite(TEXT, TEXT),
  public.my_plus_pack_invitations(),
  public.revoke_plus_pack_invite(UUID),
  public.plus_pack_invite_info(TEXT),
  public.accept_plus_pack_invite(TEXT, TEXT),
  public.remove_plus_pack_member(UUID),
  public.leave_plus_pack()
TO authenticated;

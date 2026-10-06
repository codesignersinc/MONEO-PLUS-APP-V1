-- MONEO PLUS: plans, checkouts (Mercado Pago), entitlements and the onboarding profile.
--
-- * billing_plans: catalogue with prices; `active` / `available_until` switch a plan off
--   (e.g. the Founder price) without code changes. Readable by everyone.
-- * billing_checkouts: one row per checkout started by a user. Its id is the
--   external_reference sent to Mercado Pago, so a payment is always resolved to a user
--   and a plan from our own data, never from the provider's payload.
-- * user_entitlements: the source of truth for MONEO PLUS. Written only by the `billing`
--   Edge Function (service role) after verifying the payment with Mercado Pago. Users can
--   read their own row; nothing on the client can grant PLUS.
-- * billing_events: notifications received from Mercado Pago (topic, resource id,
--   outcome) for auditing and idempotency. Never card data.
-- * onboarding_profiles: answers of the onboarding (goals, spending leaks, how the user
--   wants to register, first goal) and notification preferences. No amounts.

CREATE TABLE IF NOT EXISTS public.billing_plans (
  code TEXT PRIMARY KEY CHECK (code IN ('plus_monthly', 'plus_yearly', 'plus_lifetime', 'founder')),
  name TEXT NOT NULL CHECK (char_length(name) <= 60),
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'one_time')),
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL DEFAULT 'PEN' CHECK (currency ~ '^[A-Z]{3}$'),
  interval_months INT CHECK (interval_months IN (1, 12)),
  trial_days INT NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 31),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  available_until TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  CHECK ((kind = 'subscription') = (interval_months IS NOT NULL))
);

INSERT INTO public.billing_plans (code, name, kind, price, interval_months, trial_days, sort_order)
VALUES
  ('plus_yearly', 'MONEO PLUS Anual', 'subscription', 97.50, 12, 14, 1),
  ('plus_monthly', 'MONEO PLUS Mensual', 'subscription', 9.90, 1, 14, 2),
  ('plus_lifetime', 'MONEO PLUS de por vida', 'one_time', 127.90, NULL, 0, 3),
  ('founder', 'MONEO PLUS Fundador', 'one_time', 107.90, NULL, 0, 4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.billing_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.billing_plans (code),
  provider TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  -- Mercado Pago preapproval id (subscriptions) or preference id (one-time payments).
  provider_id TEXT CHECK (char_length(provider_id) <= 80),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  with_trial BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_checkouts_user_idx
  ON public.billing_checkouts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.billing_plans (code),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  -- Subscriptions: access runs until this moment (next charge date). NULL for lifetime.
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  -- Set once a trial was granted: one free trial per user.
  had_trial BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  provider_subscription_id TEXT CHECK (char_length(provider_subscription_id) <= 80),
  provider_payment_id TEXT CHECK (char_length(provider_payment_id) <= 80),
  checkout_id UUID REFERENCES public.billing_checkouts (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago')),
  event_key TEXT NOT NULL CHECK (char_length(event_key) <= 200),
  topic TEXT NOT NULL CHECK (char_length(topic) <= 60),
  resource_id TEXT NOT NULL CHECK (char_length(resource_id) <= 80),
  outcome TEXT CHECK (char_length(outcome) <= 60),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_key)
);

CREATE TABLE IF NOT EXISTS public.onboarding_profiles (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  goals TEXT[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(goals) <= 3
    AND goals <@ ARRAY['entender', 'gastar_menos', 'ahorrar', 'deudas', 'crecer', 'menos_estres']
  ),
  leak_categories TEXT[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(leak_categories) <= 3
    AND leak_categories <@ ARRAY['comida', 'cafes', 'compras', 'suscripciones', 'salidas',
      'transporte', 'casa', 'deudas', 'online']
  ),
  capture_methods TEXT[] NOT NULL DEFAULT '{}' CHECK (
    capture_methods <@ ARRAY['voz', 'auto', 'texto', 'scan']
  ),
  first_goal TEXT CHECK (first_goal IN ('ahorrar_1000', 'viajar', 'casa', 'auto',
    'emergencia', 'deuda', 'invertir', 'otra')),
  notify_prefs JSONB NOT NULL DEFAULT '{}' CHECK (
    jsonb_typeof(notify_prefs) = 'object' AND pg_column_size(notify_prefs) <= 1024
  ),
  step TEXT CHECK (char_length(step) <= 30),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at
CREATE OR REPLACE FUNCTION public.billing_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_checkouts_touch ON public.billing_checkouts;
CREATE TRIGGER billing_checkouts_touch BEFORE UPDATE ON public.billing_checkouts
  FOR EACH ROW EXECUTE FUNCTION public.billing_touch_updated_at();
DROP TRIGGER IF EXISTS user_entitlements_touch ON public.user_entitlements;
CREATE TRIGGER user_entitlements_touch BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.billing_touch_updated_at();
DROP TRIGGER IF EXISTS onboarding_profiles_touch ON public.onboarding_profiles;
CREATE TRIGGER onboarding_profiles_touch BEFORE UPDATE ON public.onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.billing_touch_updated_at();

-- RLS
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_plans_read ON public.billing_plans
  FOR SELECT TO anon, authenticated
  USING (active AND (available_until IS NULL OR available_until > now()));

CREATE POLICY billing_checkouts_own ON public.billing_checkouts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY user_entitlements_own ON public.user_entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY onboarding_profiles_own ON public.onboarding_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.billing_plans, public.billing_checkouts, public.user_entitlements,
  public.billing_events, public.onboarding_profiles FROM anon, authenticated;
GRANT SELECT ON public.billing_plans TO anon, authenticated;
GRANT SELECT ON public.billing_checkouts, public.user_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.onboarding_profiles TO authenticated;
-- billing_events: service role only.

-- Does the caller have MONEO PLUS right now? Lifetime / Founder: while active.
-- Subscriptions: trial or paid period not over yet (a cancelled or failed subscription
-- keeps access until the end of the period already paid).
CREATE OR REPLACE FUNCTION public.has_plus()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p.kind = 'one_time' THEN e.status = 'active'
      ELSE e.current_period_end IS NOT NULL AND e.current_period_end > now()
    END
    FROM public.user_entitlements e
    JOIN public.billing_plans p ON p.code = e.plan_code
    WHERE e.user_id = auth.uid()
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.has_plus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_plus() TO authenticated;
REVOKE ALL ON FUNCTION public.billing_touch_updated_at() FROM PUBLIC, anon, authenticated;

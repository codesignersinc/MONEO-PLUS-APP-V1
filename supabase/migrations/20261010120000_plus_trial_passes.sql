-- MONEO PLUS: free trial without card, prepaid passes and the new Lifetime price.
--
-- * Plan kinds: 'subscription' (card, renews), 'one_time' (Lifetime / Founder, forever),
--   'pass' (prepaid N months, paid once: card, Yape or PagoEfectivo) and 'trial' (the
--   free trial granted by MONEO, no payment).
-- * New plans: pass_3m (S/ 25.90, 3 months), pass_12m (S/ 97.50, 12 months) and
--   free_trial (14 days, not listed: it is never sold). Lifetime goes to S/ 127.00.
-- * start_free_trial(): grants the 14-day trial once per user, only to users who never
--   had an entitlement. The client can call it but cannot choose its length or plan.
-- * has_plus() already treats every non one_time plan by its current_period_end, so
--   passes and the trial expire on their own.
-- * Entitlements and checkouts may come from 'moneo' (the trial) besides Mercado Pago;
--   checkouts record the payment method used ('card', 'yape', 'pagoefectivo', 'redirect').

ALTER TABLE public.billing_plans DROP CONSTRAINT IF EXISTS billing_plans_code_check;
ALTER TABLE public.billing_plans ADD CONSTRAINT billing_plans_code_check CHECK (
  code IN ('plus_monthly', 'plus_yearly', 'plus_lifetime', 'founder', 'pass_3m', 'pass_12m',
    'free_trial')
);
ALTER TABLE public.billing_plans DROP CONSTRAINT IF EXISTS billing_plans_kind_check;
ALTER TABLE public.billing_plans ADD CONSTRAINT billing_plans_kind_check CHECK (
  kind IN ('subscription', 'one_time', 'pass', 'trial')
);
ALTER TABLE public.billing_plans DROP CONSTRAINT IF EXISTS billing_plans_interval_months_check;
ALTER TABLE public.billing_plans ADD CONSTRAINT billing_plans_interval_months_check CHECK (
  interval_months IN (1, 3, 12)
);
ALTER TABLE public.billing_plans DROP CONSTRAINT IF EXISTS billing_plans_check;
ALTER TABLE public.billing_plans ADD CONSTRAINT billing_plans_check CHECK (
  (kind IN ('subscription', 'pass')) = (interval_months IS NOT NULL)
);
ALTER TABLE public.billing_plans DROP CONSTRAINT IF EXISTS billing_plans_price_check;
ALTER TABLE public.billing_plans ADD CONSTRAINT billing_plans_price_check CHECK (
  CASE WHEN kind = 'trial' THEN price = 0 ELSE price > 0 END
);

INSERT INTO public.billing_plans
  (code, name, kind, price, interval_months, trial_days, active, sort_order)
VALUES
  ('pass_3m', 'MONEO PLUS 3 meses', 'pass', 25.90, 3, 0, TRUE, 5),
  ('pass_12m', 'MONEO PLUS 1 año (pago único)', 'pass', 97.50, 12, 0, TRUE, 6),
  -- Not sold: inactive so it is never listed nor offered in a checkout.
  ('free_trial', 'Prueba gratis de MONEO PLUS', 'trial', 0, NULL, 14, FALSE, 99)
ON CONFLICT (code) DO NOTHING;

UPDATE public.billing_plans SET price = 127.00 WHERE code = 'plus_lifetime';

ALTER TABLE public.user_entitlements DROP CONSTRAINT IF EXISTS user_entitlements_provider_check;
ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_provider_check CHECK (
  provider IN ('mercadopago', 'moneo')
);

ALTER TABLE public.billing_checkouts
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'redirect'
  CHECK (method IN ('redirect', 'card', 'yape', 'pagoefectivo'));
-- PagoEfectivo: the payment code and its voucher, shown until it is paid.
ALTER TABLE public.billing_checkouts
  ADD COLUMN IF NOT EXISTS pending_url TEXT CHECK (char_length(pending_url) <= 500);
ALTER TABLE public.billing_checkouts
  ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ;

-- 14 days of MONEO PLUS, once per user, for users without any entitlement yet.
-- Returns TRUE when the trial was started now.
CREATE OR REPLACE FUNCTION public.start_free_trial()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  days INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  SELECT trial_days INTO days FROM public.billing_plans WHERE code = 'free_trial';
  IF days IS NULL OR days <= 0 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_entitlements
    (user_id, plan_code, status, current_period_end, trial_ends_at, had_trial, provider)
  VALUES
    (uid, 'free_trial', 'trialing', now() + make_interval(days => days),
      now() + make_interval(days => days), TRUE, 'moneo')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.start_free_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_free_trial() TO authenticated;

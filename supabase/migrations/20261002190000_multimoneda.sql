-- ============================================================
-- MULTIMONEDA MIGRATION
-- Adds multi-currency support to MONEO+
-- ============================================================

-- 1. Add currency fields to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'PEN',
ADD COLUMN IF NOT EXISTS original_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_currency_code TEXT NOT NULL DEFAULT 'PEN',
ADD COLUMN IF NOT EXISTS base_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS exchange_rate_date TEXT NOT NULL DEFAULT '';

-- Backfill existing transactions: set currency fields from amount
UPDATE public.transactions
SET
  currency_code = 'PEN',
  original_amount = amount,
  base_currency_code = 'PEN',
  base_amount = amount,
  exchange_rate = 1,
  exchange_rate_date = to_char(transaction_date, 'YYYY-MM-DD')
WHERE currency_code = 'PEN' AND original_amount = 0;

-- 2. Ensure accounts table has currency column (already exists as 'currency', rename to currency_code for clarity)
-- The accounts table already has a 'currency' column. We add currency_code as alias.
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'PEN';

-- Backfill currency_code from currency
UPDATE public.accounts
SET currency_code = COALESCE(currency, 'PEN')
WHERE currency_code = 'PEN';

-- 3. Create user_settings table for currency preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  base_currency_code TEXT NOT NULL DEFAULT 'PEN',
  exchange_rate_mode TEXT NOT NULL DEFAULT 'manual',
  show_equivalents BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- 4. Create exchange_rates table for manual/reference rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 1,
  rate_date TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_user_pair_idx
  ON public.exchange_rates (user_id, from_currency, to_currency);

-- 5. Create currency_exchanges table for currency conversion transactions
CREATE TABLE IF NOT EXISTS public.currency_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL,
  from_amount NUMERIC NOT NULL DEFAULT 0,
  to_currency TEXT NOT NULL,
  to_amount NUMERIC NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  exchange_date TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_user_id ON public.exchange_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_exchanges_user_id ON public.currency_exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_exchanges_from_account ON public.currency_exchanges(from_account_id);
CREATE INDEX IF NOT EXISTS idx_currency_exchanges_to_account ON public.currency_exchanges(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_currency_code ON public.transactions(currency_code);

-- 7. Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_exchanges ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

DROP POLICY IF EXISTS "users_manage_own_user_settings" ON public.user_settings;
CREATE POLICY "users_manage_own_user_settings"
ON public.user_settings FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_exchange_rates" ON public.exchange_rates;
CREATE POLICY "users_manage_own_exchange_rates"
ON public.exchange_rates FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_currency_exchanges" ON public.currency_exchanges;
CREATE POLICY "users_manage_own_currency_exchanges"
ON public.currency_exchanges FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

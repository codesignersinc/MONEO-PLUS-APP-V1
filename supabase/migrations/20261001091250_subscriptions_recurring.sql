-- ─── Subscriptions: Add recurring payment fields ─────────────────────────────
-- Adds payment_day (day of month), payment_status, and converts next_date to DATE

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_day INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

-- Migrate existing next_date TEXT to a proper DATE column
-- We add next_payment_date as DATE alongside the old next_date TEXT
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS next_payment_date DATE;

-- For existing rows that have a text next_date, we leave next_payment_date NULL
-- (they will be updated by the app on first load)

CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_date ON public.subscriptions(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_status ON public.subscriptions(payment_status);

-- MONEO AUTO, phase A: suggestion inbox and learned rules.
--
-- * auto_suggestions: movements detected from bank emails / notifications / pasted
--   text. Only the interpreted fields are stored: never the original text, names of the
--   user, phone numbers, security codes or full card/account numbers.
--   The user registers (creating a normal transaction/transfer through the existing
--   services, so the balance engine applies it) or ignores each suggestion.
-- * auto_rules: what MONEO learns from the user's choices (card ****4821 → account X,
--   merchant "ocoris" → category Comida).
-- Both tables are private to their owner (RLS).

CREATE TABLE IF NOT EXISTS public.auto_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('email', 'notification', 'sms', 'text')),
  bank TEXT NOT NULL CHECK (bank IN ('bcp', 'bbva', 'interbank', 'yape', 'plin')),
  kind TEXT NOT NULL CHECK (kind IN ('consumo', 'pago_recurrente', 'pago_servicio',
    'yape_enviado', 'yape_recibido', 'plin_recibido', 'transferencia')),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('gasto', 'ingreso', 'transferencia')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PEN' CHECK (currency ~ '^[A-Z]{3}$'),
  merchant TEXT NOT NULL DEFAULT '' CHECK (char_length(merchant) <= 120),
  occurred_date DATE NOT NULL,
  occurred_time TIME,
  card_last4 TEXT CHECK (card_last4 ~ '^[0-9]{4}$'),
  card_type TEXT CHECK (card_type IN ('debito', 'credito')),
  destination_last4 TEXT CHECK (destination_last4 ~ '^[0-9]{4}$'),
  destination_bank TEXT CHECK (char_length(destination_bank) <= 40),
  own_account BOOLEAN,
  suggested_category TEXT CHECK (char_length(suggested_category) <= 40),
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  -- SHA-256 of the bank operation number (never the number itself), for duplicates.
  fingerprint TEXT CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'registrada', 'ignorada')),
  transaction_id UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
  transfer_id UUID REFERENCES public.transfers (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS auto_suggestions_fingerprint_uq
  ON public.auto_suggestions (user_id, fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS auto_suggestions_user_status_idx
  ON public.auto_suggestions (user_id, status, occurred_date DESC);

CREATE TABLE IF NOT EXISTS public.auto_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('card', 'merchant')),
  -- card: last 4 digits; merchant: compact lowercase merchant key.
  match_key TEXT NOT NULL CHECK (char_length(match_key) BETWEEN 1 AND 80),
  account_id UUID REFERENCES public.accounts (id) ON DELETE CASCADE,
  category TEXT CHECK (char_length(category) <= 40),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_type, match_key),
  CHECK (rule_type <> 'card' OR match_key ~ '^[0-9]{4}$')
);

-- Linked rows must belong to the same user (FK checks alone would accept another
-- user's id).
CREATE OR REPLACE FUNCTION public.auto_check_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'auto_suggestions' THEN
    IF NEW.transaction_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Movimiento no encontrado.' USING ERRCODE = '23503';
    END IF;
    IF NEW.transfer_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.transfers t WHERE t.id = NEW.transfer_id AND t.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Transferencia no encontrada.' USING ERRCODE = '23503';
    END IF;
  ELSIF NEW.account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Cuenta no encontrada.' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_suggestions_check_ownership ON public.auto_suggestions;
CREATE TRIGGER auto_suggestions_check_ownership
  BEFORE INSERT OR UPDATE ON public.auto_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.auto_check_ownership();

DROP TRIGGER IF EXISTS auto_rules_check_ownership ON public.auto_rules;
CREATE TRIGGER auto_rules_check_ownership
  BEFORE INSERT OR UPDATE ON public.auto_rules
  FOR EACH ROW EXECUTE FUNCTION public.auto_check_ownership();

ALTER TABLE public.auto_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_suggestions_own ON public.auto_suggestions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY auto_rules_own ON public.auto_rules
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.auto_suggestions, public.auto_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_suggestions, public.auto_rules TO authenticated;

-- MONEO AUTO: quick typed entries ("gasté 25 en taxi", "almuerzo 18 bcp").
-- A typed entry may not name a bank (bank = 'otro') and has its own kind ('texto').
-- Only the check constraints change; no data is modified.

ALTER TABLE public.auto_suggestions DROP CONSTRAINT IF EXISTS auto_suggestions_bank_check;
ALTER TABLE public.auto_suggestions ADD CONSTRAINT auto_suggestions_bank_check
  CHECK (bank IN ('bcp', 'bbva', 'interbank', 'yape', 'plin', 'scotiabank', 'otro'));

ALTER TABLE public.auto_suggestions DROP CONSTRAINT IF EXISTS auto_suggestions_kind_check;
ALTER TABLE public.auto_suggestions ADD CONSTRAINT auto_suggestions_kind_check
  CHECK (kind IN ('consumo', 'pago_recurrente', 'pago_servicio', 'yape_enviado',
    'yape_recibido', 'plin_recibido', 'transferencia', 'texto'));

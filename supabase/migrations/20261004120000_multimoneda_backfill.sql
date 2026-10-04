-- ============================================================
-- Multimoneda: corrige movimientos guardados sin campos de moneda.
--
-- Hasta este cambio transactionsService.create no enviaba currency_code,
-- original_amount, base_currency_code, base_amount, exchange_rate ni
-- exchange_rate_date, así que la BD dejaba sus valores por defecto (PEN / 0).
--
-- La corrección solo es inequívoca cuando el movimiento está en la moneda base
-- del usuario y su cuenta (si tiene) usa esa misma moneda: entonces
-- original_amount = base_amount = amount y la tasa es 1. Si aparece algún
-- movimiento afectado en otra moneda, la migración aborta para revisarlo a mano
-- (no se recalcula con tasas actuales).
-- ============================================================

DO $$
DECLARE
  v_ambiguous int;
BEGIN
  SELECT count(*) INTO v_ambiguous
  FROM public.transactions t
  LEFT JOIN public.accounts a ON a.id = t.account_id
  WHERE t.original_amount = 0
    AND t.base_amount = 0
    AND t.amount <> 0
    AND NOT (
      t.currency_code = coalesce(
        (SELECT us.base_currency_code FROM public.user_settings us WHERE us.user_id = t.user_id),
        'PEN')
      AND t.base_currency_code = t.currency_code
      AND (a.id IS NULL OR a.currency = t.currency_code)
    );

  IF v_ambiguous > 0 THEN
    RAISE EXCEPTION 'Hay % movimiento(s) sin campos de moneda fuera de la moneda base: requieren revisión manual', v_ambiguous;
  END IF;

  UPDATE public.transactions t
  SET original_amount = t.amount,
      base_amount = t.amount,
      exchange_rate = 1,
      exchange_rate_date = coalesce(
        nullif(t.exchange_rate_date, ''),
        to_char(t.transaction_date AT TIME ZONE 'America/Lima', 'YYYY-MM-DD'))
  WHERE t.original_amount = 0
    AND t.base_amount = 0
    AND t.amount <> 0;
END $$;

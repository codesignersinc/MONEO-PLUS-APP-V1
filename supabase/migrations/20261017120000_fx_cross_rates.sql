-- Cross rates: when a pair has no direct rate (user's own or app default), cross through PEN
-- or USD instead of silently using 1 (e.g. COP → MXN = COP→PEN × PEN→MXN). Same rules as
-- findRate() in src/lib/currency.ts. 1 remains only for a currency the app does not know.

-- Direct or reverse rate for a pair (the user's own first, then the app default); NULL if none.
CREATE OR REPLACE FUNCTION public.moneo_fx_pair(p_from text, p_to text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH d(k, r) AS (
    VALUES ('USD_PEN', 3.73), ('EUR_PEN', 4.05), ('GBP_PEN', 4.72), ('BRL_PEN', 0.74),
           ('CLP_PEN', 0.0041), ('COP_PEN', 0.00093), ('MXN_PEN', 0.22), ('ARS_PEN', 0.0041),
           ('PEN_USD', 0.268), ('PEN_EUR', 0.247), ('PEN_GBP', 0.212), ('EUR_USD', 1.085),
           ('GBP_USD', 1.265)
  )
  SELECT CASE WHEN p_from = p_to THEN 1::numeric ELSE coalesce(
    (SELECT e.rate FROM public.exchange_rates e
      WHERE e.user_id = auth.uid() AND e.from_currency = p_from AND e.to_currency = p_to
        AND e.rate > 0 LIMIT 1),
    (SELECT 1 / e.rate FROM public.exchange_rates e
      WHERE e.user_id = auth.uid() AND e.from_currency = p_to AND e.to_currency = p_from
        AND e.rate > 0 LIMIT 1),
    (SELECT d.r FROM d WHERE d.k = p_from || '_' || p_to),
    (SELECT 1 / d.r FROM d WHERE d.k = p_to || '_' || p_from)
  ) END
$$;

CREATE OR REPLACE FUNCTION public.moneo_fx_rate(p_from text, p_to text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(
    public.moneo_fx_pair(coalesce(p_from, 'PEN'), coalesce(p_to, 'PEN')),
    CASE WHEN coalesce(p_from, 'PEN') <> 'PEN' AND coalesce(p_to, 'PEN') <> 'PEN' THEN
      public.moneo_fx_pair(coalesce(p_from, 'PEN'), 'PEN') * public.moneo_fx_pair('PEN', coalesce(p_to, 'PEN'))
    END,
    CASE WHEN coalesce(p_from, 'PEN') <> 'USD' AND coalesce(p_to, 'PEN') <> 'USD' THEN
      public.moneo_fx_pair(coalesce(p_from, 'PEN'), 'USD') * public.moneo_fx_pair('USD', coalesce(p_to, 'PEN'))
    END,
    1::numeric
  )
$$;

REVOKE ALL ON FUNCTION public.moneo_fx_pair(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.moneo_fx_pair(text, text) TO authenticated;

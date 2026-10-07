-- MONEO Core: one summary for every surface (web Inicio, MONEO Mini, future widgets), so the
-- numbers are computed once with the same rules as the dashboard (src/app/finanzas/page.tsx).
--
-- public.moneo_summary(p_today) returns, for the signed-in user (SECURITY INVOKER: RLS applies):
--   netWorth     accounts (in base currency) + investments − debts
--   available    accounts except credit and investment accounts (in base currency)
--   committed    pending payments and active subscriptions due up to the end of this month
--   inGoals      money saved in goals
--   netWorthPct  this month's net cash flow vs. the net worth at the start of the month
--   spentToday   today's expenses (base currency)
--   safeToSpend  "Puedes gastar hoy" (estimate), see below
--   nextPayment, mainGoal, recent (last 5 movements)
--
-- Puedes gastar hoy: until the next expected income (the next pending income entry, else the
-- end of the month), spread what is left after what is already committed:
--   dailyBudget = (available + spentToday − pending payments up to then − this month's goal
--                  contributions) / days until then (today included)
--   today       = max(0, dailyBudget − spentToday)
-- A goal's monthly contribution = what is missing / months left until its target date.

-- Exchange rate between two currencies for the current user: their own rate (direct or
-- reverse), else the app defaults (src/lib/currency.ts DEFAULT_EXCHANGE_RATES), else 1.
CREATE OR REPLACE FUNCTION public.moneo_fx_rate(p_from text, p_to text)
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
  SELECT CASE
    WHEN coalesce(p_from, 'PEN') = coalesce(p_to, 'PEN') THEN 1::numeric
    ELSE coalesce(
      (SELECT e.rate FROM public.exchange_rates e
        WHERE e.user_id = auth.uid() AND e.from_currency = p_from AND e.to_currency = p_to
          AND e.rate > 0 LIMIT 1),
      (SELECT 1 / e.rate FROM public.exchange_rates e
        WHERE e.user_id = auth.uid() AND e.from_currency = p_to AND e.to_currency = p_from
          AND e.rate > 0 LIMIT 1),
      (SELECT d.r FROM d WHERE d.k = p_from || '_' || p_to),
      (SELECT 1 / d.r FROM d WHERE d.k = p_to || '_' || p_from),
      1::numeric
    )
  END
$$;

-- Pending payments and active subscriptions of the current user (overdue included), as the
-- dashboard's upcomingPayments() in src/lib/dashboard.ts.
CREATE OR REPLACE FUNCTION public.moneo_upcoming(p_today date)
RETURNS TABLE (name text, amount numeric, due date, overdue boolean, kind text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.name, abs(p.amount), left(p.payment_date, 10)::date,
         p.status = 'vencido' OR left(p.payment_date, 10)::date < p_today, 'pago'
    FROM public.pagos p
   WHERE p.user_id = auth.uid() AND p.status <> 'pagado'
     AND p.payment_date ~ '^\d{4}-\d{2}-\d{2}'
  UNION ALL
  SELECT s.name, abs(s.amount), coalesce(s.next_payment_date, left(s.next_date, 10)::date),
         coalesce(s.payment_status = 'overdue', false), 'suscripcion'
    FROM public.subscriptions s
   WHERE s.user_id = auth.uid() AND s.active
     AND (s.next_payment_date IS NOT NULL OR s.next_date ~ '^\d{4}-\d{2}-\d{2}')
$$;

CREATE OR REPLACE FUNCTION public.moneo_summary(p_today date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := coalesce(p_today, (now() AT TIME ZONE 'America/Lima')::date);
  month_start date := date_trunc('month', coalesce(p_today, (now() AT TIME ZONE 'America/Lima')::date))::date;
  month_end date := (date_trunc('month', coalesce(p_today, (now() AT TIME ZONE 'America/Lima')::date)) + interval '1 month - 1 day')::date;
  base text;
  accounts_total numeric;
  available numeric;
  investments numeric;
  debts numeric;
  net_worth numeric;
  in_goals numeric;
  month_income numeric;
  month_expense numeric;
  tx_count int;
  start_worth numeric;
  spent_today numeric;
  committed numeric;
  horizon date;
  horizon_kind text;
  days int;
  committed_h numeric;
  goals_month numeric;
  daily numeric;
  next_payment jsonb;
  main_goal jsonb;
  recent jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(s.base_currency_code, 'PEN') INTO base
    FROM public.user_settings s WHERE s.user_id = uid LIMIT 1;
  base := coalesce(base, 'PEN');

  SELECT coalesce(sum(a.balance * public.moneo_fx_rate(coalesce(nullif(a.currency, ''), 'PEN'), base)), 0),
         coalesce(sum(a.balance * public.moneo_fx_rate(coalesce(nullif(a.currency, ''), 'PEN'), base))
                  FILTER (WHERE a.account_type NOT IN ('credito', 'inversion')), 0)
    INTO accounts_total, available
    FROM public.accounts a WHERE a.user_id = uid;
  SELECT coalesce(sum(i.shares * i.price), 0) INTO investments
    FROM public.investments i WHERE i.user_id = uid;
  SELECT coalesce(sum(d.balance), 0) INTO debts FROM public.debts d WHERE d.user_id = uid;
  SELECT coalesce(sum(g.current_amount), 0) INTO in_goals
    FROM public.savings_goals g WHERE g.user_id = uid;
  net_worth := accounts_total + investments - debts;

  -- Movements in the base currency (positive); transfers are neither income nor expense.
  WITH tx AS (
    SELECT t.transaction_type AS kind,
           (t.transaction_date AT TIME ZONE 'America/Lima')::date AS day,
           CASE WHEN t.base_amount IS NOT NULL AND t.base_currency_code = base
                THEN abs(t.base_amount)
                ELSE abs(t.amount) * public.moneo_fx_rate(coalesce(nullif(t.currency_code, ''), 'PEN'), base)
           END AS v
      FROM public.transactions t WHERE t.user_id = uid
  )
  SELECT coalesce(sum(v) FILTER (WHERE kind = 'ingreso' AND day BETWEEN month_start AND month_end), 0),
         coalesce(sum(v) FILTER (WHERE kind = 'gasto' AND day BETWEEN month_start AND month_end), 0),
         coalesce(sum(v) FILTER (WHERE kind = 'gasto' AND day = today), 0),
         count(*)
    INTO month_income, month_expense, spent_today, tx_count
    FROM tx;
  start_worth := net_worth - (month_income - month_expense);

  SELECT coalesce(sum(u.amount), 0) INTO committed FROM public.moneo_upcoming(today) u WHERE u.due <= month_end;
  SELECT jsonb_build_object('name', u.name, 'amount', u.amount, 'date', u.due,
                            'overdue', u.overdue, 'kind', u.kind)
    INTO next_payment FROM public.moneo_upcoming(today) u ORDER BY u.due, u.name LIMIT 1;

  -- Horizon: the next pending income, else the end of the month.
  SELECT min(left(e.collection_date, 10)::date) INTO horizon
    FROM public.income_entries e
   WHERE e.user_id = uid AND e.status <> 'cobrado'
     AND e.collection_date ~ '^\d{4}-\d{2}-\d{2}'
     AND left(e.collection_date, 10)::date >= today;
  horizon_kind := CASE WHEN horizon IS NULL THEN 'fin_de_mes' ELSE 'proximo_ingreso' END;
  horizon := coalesce(horizon, month_end);
  days := greatest(1, horizon - today + 1);
  SELECT coalesce(sum(u.amount), 0) INTO committed_h FROM public.moneo_upcoming(today) u WHERE u.due <= horizon;

  SELECT coalesce(sum(
           (g.target_amount - g.current_amount) /
           greatest(1, (extract(year FROM age(left(g.target_date, 10)::date, today)) * 12
                        + extract(month FROM age(left(g.target_date, 10)::date, today)))::int
                       + CASE WHEN extract(day FROM age(left(g.target_date, 10)::date, today)) > 0 THEN 1 ELSE 0 END)
         ), 0)
    INTO goals_month
    FROM public.savings_goals g
   WHERE g.user_id = uid AND g.target_amount > g.current_amount
     AND g.target_date ~ '^\d{4}-\d{2}-\d{2}'
     AND left(g.target_date, 10)::date >= today;

  daily := (available + spent_today - committed_h - goals_month) / days;

  SELECT jsonb_build_object('name', g.name, 'icon', g.icon, 'current', g.current_amount,
                            'target', g.target_amount,
                            'pct', CASE WHEN g.target_amount > 0
                                        THEN least(100, round(g.current_amount / g.target_amount * 100))
                                        ELSE 0 END)
    INTO main_goal
    FROM public.savings_goals g
   WHERE g.user_id = uid
   ORDER BY (g.target_amount > 0 AND g.current_amount < g.target_amount) DESC, g.created_at
   LIMIT 1;

  SELECT coalesce(jsonb_agg(r ORDER BY r->>'date' DESC), '[]'::jsonb) INTO recent FROM (
    SELECT jsonb_build_object('id', t.id, 'name', t.name, 'icon', t.category_icon,
                              'type', t.transaction_type, 'amount', t.amount,
                              'currency', coalesce(nullif(t.currency_code, ''), 'PEN'),
                              'date', t.transaction_date) AS r
      FROM public.transactions t
     WHERE t.user_id = uid AND NOT (t.transaction_type = 'transferencia' AND t.transfer_leg = 'in')
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT 5
  ) x;

  RETURN jsonb_build_object(
    'currency', base,
    'asOf', today,
    'netWorth', round(net_worth, 2),
    'available', round(available, 2),
    'committed', round(committed, 2),
    'inGoals', round(in_goals, 2),
    'netWorthPct', CASE WHEN tx_count > 0 AND start_worth > 0
                        THEN round((month_income - month_expense) / start_worth * 100)
                        ELSE NULL END,
    'spentToday', round(spent_today, 2),
    'safeToSpend', jsonb_build_object(
      'today', round(greatest(0, daily - spent_today), 2),
      'dailyBudget', round(greatest(0, daily), 2),
      'until', horizon,
      'untilKind', horizon_kind,
      'days', days,
      'committed', round(committed_h, 2),
      'goals', round(goals_month, 2)
    ),
    'nextPayment', next_payment,
    'mainGoal', main_goal,
    'recent', recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moneo_summary(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.moneo_summary(date) TO authenticated;
REVOKE ALL ON FUNCTION public.moneo_upcoming(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.moneo_upcoming(date) TO authenticated;
REVOKE ALL ON FUNCTION public.moneo_fx_rate(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.moneo_fx_rate(text, text) TO authenticated;

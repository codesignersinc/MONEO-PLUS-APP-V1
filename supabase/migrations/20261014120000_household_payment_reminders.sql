-- ============================================================
-- MONEO HOGAR: "Próximo pago del hogar".
--
-- Every morning (8:00 Lima) the active members of a household get one notification for
-- each recurring household expense due in the next 2 days (or overdue up to 3 days),
-- using the existing notifications table. Only the latest occurrence of each series
-- (same name and category) counts. The text names the expense, the date and who pays it,
-- never the amount. Each due date is notified once per member.
-- ============================================================

CREATE OR REPLACE FUNCTION public.household_payment_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'America/Lima')::date;
  sent INT;
BEGIN
  WITH latest AS (
    -- The latest occurrence of each recurring series of each household.
    SELECT DISTINCT ON (e.household_id, lower(btrim(e.name)), e.category)
      e.id, e.household_id, e.name, e.next_date, e.paid_by
    FROM public.household_expenses e
    WHERE e.is_recurring AND e.next_date IS NOT NULL
    ORDER BY e.household_id, lower(btrim(e.name)), e.category, e.expense_date DESC, e.created_at DESC
  ),
  due AS (
    SELECT l.* FROM latest l
    WHERE l.next_date BETWEEN today - 3 AND today + 2
  ),
  targets AS (
    SELECT d.id AS expense_id, d.household_id, d.name, d.next_date, m.user_id,
      (SELECT p.display_name FROM public.household_members p WHERE p.id = d.paid_by) AS payer
    FROM due d
    JOIN public.household_members m
      ON m.household_id = d.household_id AND m.status = 'active' AND m.user_id IS NOT NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = m.user_id AND n.type = 'household_payment'
        AND n.entity_id = d.id AND n.metadata->>'due' = d.next_date::text
    )
  )
  INSERT INTO public.notifications (user_id, type, title, message, icon, color, action_url,
    entity_type, entity_id, metadata)
  SELECT t.user_id, 'household_payment',
    CASE WHEN t.next_date < today THEN 'Pago del hogar vencido' ELSE 'Próximo pago del hogar' END,
    left(format('"%s" %s el %s. %s', t.name,
      CASE WHEN t.next_date < today THEN 'venció' ELSE 'vence' END,
      to_char(t.next_date, 'DD/MM'),
      CASE WHEN t.payer IS NULL THEN '' ELSE 'Lo paga ' || t.payer || '.' END), 200),
    '🏠', '#FFD83D', '/finanzas/hogar', 'household_expense', t.expense_id,
    jsonb_build_object('due', t.next_date::text)
  FROM targets t;
  GET DIAGNOSTICS sent = ROW_COUNT;
  RETURN sent;
END;
$$;

REVOKE ALL ON FUNCTION public.household_payment_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'household-payment-reminders';
SELECT cron.schedule('household-payment-reminders', '0 13 * * *',
  'SELECT public.household_payment_reminders()');

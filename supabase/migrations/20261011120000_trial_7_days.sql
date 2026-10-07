-- MONEO PLUS free trial goes from 14 to 7 days: the trial without card (free_trial) and the
-- trial of the card subscriptions. start_free_trial() and the billing function read
-- billing_plans.trial_days, so only new trials change; trials already running keep their date.
UPDATE public.billing_plans
SET trial_days = 7
WHERE code IN ('free_trial', 'plus_monthly', 'plus_yearly');

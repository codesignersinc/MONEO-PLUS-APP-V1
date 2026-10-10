-- ============================================================
-- Gamificación, fase 1: Coronas, rachas y logros (docs/gamificacion.md).
--
-- Las Coronas se ganan SOLO con hábitos y SOLO las otorga la base de datos: coronas_sync()
-- revisa los datos de la persona y anota en coronas_ledger lo que corresponde, una vez por
-- hábito (award_key único). El cliente solo lee; no hay INSERT/UPDATE para nadie.
--
-- Contra trampas: el cliente puede escribir transactions.created_at, juntas.created_at y
-- auto_suggestions, así que no se confía en esas fechas. Lo que cuenta es lo que el servidor
-- ve el día en que corre coronas_sync() («hoy» en la zona horaria de la persona):
-- * registro_dia (+1): hay un movimiento creado hoy. Solo se otorga para hoy, nunca hacia
--   atrás. La racha sale de estas filas del ledger, no de los movimientos.
-- * racha_7 (+5): la racha llega a 7, 14, 21… días.
-- * pago_a_tiempo (+2, máx. 2 por día): un pago marcado pagado (solo mark_pago_paid cambia el
--   estado) con vencimiento hoy o después y creado antes de hoy (pagos.created_at no lo
--   escribe el cliente).
-- * aporte_meta (+2, 1 por semana): el monto de una meta supera su máximo visto (marca de
--   agua en coronas_goal_marks; la primera vez solo se anota la base).
-- * presupuesto_mes (+10): el mes anterior ningún presupuesto se pasó y hubo al menos 10 días
--   con registro_dia en ese mes.
-- * junta_completa (+10, 1 cada 30 días): una junta finalizada con al menos 3 participantes
--   con cuenta, aparte del organizador.
-- * auto_confirmada (+1, máx. 2 por día): una sugerencia de MONEO AUTO registrada hoy.
-- * logro: bono único por cada logro (coronas_achievements).
-- Las Coronas no son dinero, no se cambian por efectivo y vencen a los 12 meses (expires_at).
-- Las filas guardan solo la regla, la clave y la cantidad: ni montos, ni comercios, ni textos.
-- ============================================================

CREATE TABLE public.coronas_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  started_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE TABLE public.coronas_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rule text NOT NULL CHECK (rule IN ('registro_dia', 'racha_7', 'pago_a_tiempo', 'aporte_meta',
    'presupuesto_mes', 'junta_completa', 'auto_confirmada', 'logro')),
  award_key text NOT NULL,
  earned_on date NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, award_key)
);
CREATE INDEX coronas_ledger_user_idx ON public.coronas_ledger (user_id, earned_on DESC);

CREATE TABLE public.coronas_achievements (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);

-- Internal: highest amount seen per goal (no grants, no policies).
CREATE TABLE public.coronas_goal_marks (
  goal_id uuid PRIMARY KEY REFERENCES public.savings_goals (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  high_water numeric NOT NULL
);

ALTER TABLE public.coronas_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coronas_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coronas_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coronas_goal_marks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.coronas_profiles, public.coronas_ledger, public.coronas_achievements,
  public.coronas_goal_marks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.coronas_profiles, public.coronas_ledger, public.coronas_achievements
  TO authenticated;

CREATE POLICY coronas_profiles_own ON public.coronas_profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY coronas_ledger_own ON public.coronas_ledger FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY coronas_achievements_own ON public.coronas_achievements FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Internal: one award, once per key. Returns the coronas granted (0 if it already existed).
CREATE OR REPLACE FUNCTION public.coronas_award(p_user uuid, p_rule text, p_key text,
  p_day date, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.coronas_ledger (user_id, rule, award_key, earned_on, amount, expires_at)
  VALUES (p_user, p_rule, p_key, p_day, p_amount, now() + interval '12 months')
  ON CONFLICT (user_id, award_key) DO NOTHING;
  RETURN CASE WHEN FOUND THEN p_amount ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public.coronas_award(uuid, text, text, date, integer)
  FROM PUBLIC, anon, authenticated;

-- Internal: a one-time achievement and its bonus.
CREATE OR REPLACE FUNCTION public.coronas_achieve(p_user uuid, p_code text, p_day date,
  p_bonus integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.coronas_achievements (user_id, code) VALUES (p_user, p_code)
  ON CONFLICT DO NOTHING;
  IF FOUND THEN
    PERFORM public.coronas_award(p_user, 'logro', 'logro:' || p_code, p_day, p_bonus);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.coronas_achieve(uuid, text, date, integer)
  FROM PUBLIC, anon, authenticated;

-- Current streak: consecutive days with registro_dia ending today (or yesterday if today has
-- none yet).
CREATE OR REPLACE FUNCTION public.coronas_streak(p_user uuid, p_today date)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d date := p_today;
  n integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.coronas_ledger l
                  WHERE l.user_id = p_user AND l.rule = 'registro_dia' AND l.earned_on = d) THEN
    d := d - 1;
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.coronas_ledger l
                 WHERE l.user_id = p_user AND l.rule = 'registro_dia' AND l.earned_on = d) LOOP
    n := n + 1;
    d := d - 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.coronas_streak(uuid, date) FROM PUBLIC, anon, authenticated;

-- Checks the person's habits, grants what is due and returns the summary.
CREATE OR REPLACE FUNCTION public.coronas_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  tz text;
  today date;
  day_start timestamptz;
  v_started date;
  v_streak integer;
  v_prev_month date;
  v_count integer;
  g record;
  r record;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('coronas:' || uid::text));

  SELECT s.timezone INTO tz FROM public.user_settings s WHERE s.user_id = uid;
  IF tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = tz) THEN
    tz := 'America/Lima';
  END IF;
  today := (now() AT TIME ZONE tz)::date;
  day_start := today::timestamp AT TIME ZONE tz;

  INSERT INTO public.coronas_profiles (user_id, started_on) VALUES (uid, today)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.coronas_profiles SET synced_at = now() WHERE user_id = uid
  RETURNING started_on INTO v_started;

  -- Registro del día y racha.
  IF EXISTS (SELECT 1 FROM public.transactions t
              WHERE t.user_id = uid AND t.created_at >= day_start
                AND t.created_at < day_start + interval '1 day') THEN
    PERFORM public.coronas_award(uid, 'registro_dia', 'registro:' || today, today, 1);
    PERFORM public.coronas_achieve(uid, 'primer_registro', today, 3);
  END IF;
  v_streak := public.coronas_streak(uid, today);
  IF v_streak > 0 AND v_streak % 7 = 0 AND EXISTS (
    SELECT 1 FROM public.coronas_ledger l
     WHERE l.user_id = uid AND l.rule = 'registro_dia' AND l.earned_on = today) THEN
    PERFORM public.coronas_award(uid, 'racha_7', 'racha:' || today, today, 5);
  END IF;
  IF v_streak >= 7 THEN
    PERFORM public.coronas_achieve(uid, 'racha_7', today, 5);
  END IF;
  IF v_streak >= 30 THEN
    PERFORM public.coronas_achieve(uid, 'racha_30', today, 15);
  END IF;

  -- Pagos a tiempo (máx. 2 por día).
  FOR r IN
    SELECT p.id FROM public.pagos p
     WHERE p.user_id = uid AND p.status = 'pagado'
       AND p.payment_date ~ '^\d{4}-\d{2}-\d{2}$' AND left(p.payment_date, 10)::date >= today
       AND p.created_at < day_start
       AND NOT EXISTS (SELECT 1 FROM public.coronas_ledger l
                        WHERE l.user_id = uid AND l.award_key = 'pago:' || p.id)
     ORDER BY p.payment_date
  LOOP
    SELECT count(*) INTO v_count FROM public.coronas_ledger l
     WHERE l.user_id = uid AND l.rule = 'pago_a_tiempo' AND l.earned_on = today;
    EXIT WHEN v_count >= 2;
    PERFORM public.coronas_award(uid, 'pago_a_tiempo', 'pago:' || r.id, today, 2);
  END LOOP;
  SELECT count(*) INTO v_count FROM public.coronas_ledger l
   WHERE l.user_id = uid AND l.rule = 'pago_a_tiempo';
  IF v_count >= 1 THEN
    PERFORM public.coronas_achieve(uid, 'pago_puntual', today, 3);
  END IF;
  IF v_count >= 10 THEN
    PERFORM public.coronas_achieve(uid, 'pagos_10', today, 10);
  END IF;

  -- Aportes a metas (marca de agua por meta; 1 premio por semana).
  FOR g IN
    SELECT s.id, s.current_amount, s.target_amount, m.high_water
      FROM public.savings_goals s
      LEFT JOIN public.coronas_goal_marks m ON m.goal_id = s.id
     WHERE s.user_id = uid
  LOOP
    IF g.high_water IS NULL THEN
      INSERT INTO public.coronas_goal_marks (goal_id, user_id, high_water)
      VALUES (g.id, uid, coalesce(g.current_amount, 0));
    ELSIF coalesce(g.current_amount, 0) > g.high_water THEN
      UPDATE public.coronas_goal_marks SET high_water = g.current_amount WHERE goal_id = g.id;
      PERFORM public.coronas_award(uid, 'aporte_meta',
        'meta:' || pg_catalog.to_char(today, 'IYYY-IW'), today, 2);
      IF g.target_amount > 0 AND g.high_water < g.target_amount
         AND g.current_amount >= g.target_amount THEN
        PERFORM public.coronas_achieve(uid, 'meta_cumplida', today, 10);
      END IF;
    END IF;
  END LOOP;

  -- Presupuesto del mes anterior.
  v_prev_month := (pg_catalog.date_trunc('month', today) - interval '1 month')::date;
  SELECT count(*) INTO v_count FROM public.coronas_ledger l
   WHERE l.user_id = uid AND l.rule = 'registro_dia'
     AND l.earned_on >= v_prev_month AND l.earned_on < (v_prev_month + interval '1 month')::date;
  IF v_count >= 10 AND EXISTS (
       SELECT 1 FROM public.budget_categories b
        WHERE b.user_id = uid AND b.business_id IS NULL AND b.budget > 0)
     AND NOT EXISTS (
       SELECT 1 FROM public.budget_categories b
        WHERE b.user_id = uid AND b.business_id IS NULL AND b.budget > 0
          AND b.budget < (
            SELECT coalesce(sum(abs(t.amount)), 0)
              FROM public.transactions t
             WHERE t.user_id = uid AND t.business_id IS NULL
               AND t.transaction_type = 'gasto' AND t.category = b.name
               AND t.transaction_date >= (v_prev_month::timestamp AT TIME ZONE tz)
               AND t.transaction_date < ((v_prev_month + interval '1 month')::timestamp AT TIME ZONE tz)))
  THEN
    PERFORM public.coronas_award(uid, 'presupuesto_mes',
      'presupuesto:' || pg_catalog.to_char(v_prev_month, 'YYYY-MM'), today, 10);
    PERFORM public.coronas_achieve(uid, 'presupuesto', today, 5);
  END IF;

  -- Juntas completas (1 cada 30 días).
  FOR r IN
    SELECT j.id FROM public.juntas j
     WHERE j.status = 'finalizada'
       AND (j.user_id = uid OR EXISTS (SELECT 1 FROM public.junta_members jm
                                        WHERE jm.junta_id = j.id AND jm.user_id = uid))
       AND (SELECT count(DISTINCT jm.user_id) FROM public.junta_members jm
             WHERE jm.junta_id = j.id AND jm.user_id IS NOT NULL AND jm.user_id <> j.user_id) >= 3
       AND NOT EXISTS (SELECT 1 FROM public.coronas_ledger l
                        WHERE l.user_id = uid AND l.award_key = 'junta:' || j.id)
  LOOP
    EXIT WHEN EXISTS (SELECT 1 FROM public.coronas_ledger l
                       WHERE l.user_id = uid AND l.rule = 'junta_completa'
                         AND l.earned_on > today - 30);
    PERFORM public.coronas_award(uid, 'junta_completa', 'junta:' || r.id, today, 10);
    PERFORM public.coronas_achieve(uid, 'junta', today, 5);
  END LOOP;

  -- MONEO AUTO confirmado hoy (máx. 2 por día).
  FOR r IN
    SELECT a.id FROM public.auto_suggestions a
     WHERE a.user_id = uid AND a.status = 'registrada' AND a.source <> 'text'
       AND a.resolved_at >= day_start AND a.resolved_at < day_start + interval '1 day'
       AND NOT EXISTS (SELECT 1 FROM public.coronas_ledger l
                        WHERE l.user_id = uid AND l.award_key = 'auto:' || a.id)
  LOOP
    SELECT count(*) INTO v_count FROM public.coronas_ledger l
     WHERE l.user_id = uid AND l.rule = 'auto_confirmada' AND l.earned_on = today;
    EXIT WHEN v_count >= 2;
    PERFORM public.coronas_award(uid, 'auto_confirmada', 'auto:' || r.id, today, 1);
  END LOOP;

  RETURN jsonb_build_object(
    'balance', (SELECT coalesce(sum(l.amount), 0) FROM public.coronas_ledger l
                 WHERE l.user_id = uid AND l.expires_at > now()),
    'lifetime', (SELECT coalesce(sum(l.amount), 0) FROM public.coronas_ledger l
                  WHERE l.user_id = uid),
    'streak', public.coronas_streak(uid, today),
    'registeredToday', EXISTS (SELECT 1 FROM public.coronas_ledger l
                                WHERE l.user_id = uid AND l.rule = 'registro_dia'
                                  AND l.earned_on = today),
    'startedOn', v_started,
    'today', today,
    'new', coalesce((SELECT jsonb_agg(jsonb_build_object('rule', l.rule, 'key', l.award_key,
                                                         'amount', l.amount) ORDER BY l.award_key)
                       FROM public.coronas_ledger l
                      WHERE l.user_id = uid AND l.created_at = now()), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.coronas_sync() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coronas_sync() TO authenticated;

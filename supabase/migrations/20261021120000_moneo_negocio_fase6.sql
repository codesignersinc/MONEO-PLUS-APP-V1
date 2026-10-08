-- ============================================================
-- MONEO NEGOCIO, fase 6 (docs/moneo-negocio.md §12).
--
-- 1. MONEO NEGOCIO se activa solo con MONEO PLUS pagado (decisión del titular): crear un
--    negocio exige un plan propio pagado (no la prueba gratis) o un lugar en un Duo/Familiar.
--    Los negocios existentes y sus datos no se tocan; la app muestra el candado si el plan
--    termina.
-- 2. Pagos semanales (empleados): `pagos.every_days` (7 o 14). Al marcar pagado un pago
--    recurrente, mark_pago_paid crea la siguiente instancia un mes después; el trigger
--    pagos_inherit_context (de la fase 1, que ya copia el contexto a esa instancia) la mueve
--    a `payment_date + every_days`. mark_pago_paid no cambia.
--
-- MONEO AUTO hacia cuentas del negocio no necesita cambios en la base: el movimiento toma el
-- contexto de su cuenta (transactions_context) y las reglas de tarjeta guardan cualquier
-- cuenta propia.
-- ============================================================

-- 1. Paid MONEO PLUS -----------------------------------------------------------

-- Same rule as user_has_plus(), without the free trial (billing_plans.kind = 'trial').
CREATE OR REPLACE FUNCTION public.user_has_paid_plus(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.plus_pack_seat(p_user) OR EXISTS (
    SELECT 1
      FROM public.user_entitlements e
      JOIN public.billing_plans p ON p.code = e.plan_code
     WHERE e.user_id = p_user
       AND p.kind <> 'trial'
       AND ((p.kind = 'one_time' AND e.status = 'active')
         OR (p.kind <> 'one_time' AND e.current_period_end IS NOT NULL
             AND e.current_period_end > now()))
  );
$$;
REVOKE ALL ON FUNCTION public.user_has_paid_plus(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.businesses_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.user_has_paid_plus(NEW.owner_id) THEN
      RAISE EXCEPTION 'MONEO NEGOCIO se activa con un plan pagado de MONEO PLUS.'
        USING ERRCODE = '42501';
    END IF;
    IF (SELECT count(*) FROM public.businesses b WHERE b.owner_id = NEW.owner_id) >= 5 THEN
      RAISE EXCEPTION 'Puedes tener hasta 5 negocios.' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.owner_id <> OLD.owner_id THEN
    RAISE EXCEPTION 'No se puede cambiar el dueño.' USING ERRCODE = '42501';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 2. Weekly / every-two-weeks payments ------------------------------------------

ALTER TABLE public.pagos
  ADD COLUMN every_days smallint
    CHECK (every_days IS NULL OR every_days IN (7, 14)),
  ADD CONSTRAINT pagos_every_days_recurring CHECK (every_days IS NULL OR is_recurring);
GRANT INSERT (every_days) ON public.pagos TO authenticated;

CREATE OR REPLACE FUNCTION public.pagos_inherit_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business uuid;
  v_party uuid;
  v_every smallint;
  v_prev text;
BEGIN
  IF NEW.generated_from IS NOT NULL THEN
    SELECT p.business_id, p.party_id, p.every_days, p.payment_date
      INTO v_business, v_party, v_every, v_prev
      FROM public.pagos p WHERE p.id = NEW.generated_from AND p.user_id = NEW.user_id;
    IF NEW.business_id IS NULL THEN
      NEW.business_id := v_business;
      NEW.party_id := v_party;
    END IF;
    IF v_every IS NOT NULL AND v_prev ~ '^\d{4}-\d{2}-\d{2}$' THEN
      NEW.every_days := v_every;
      NEW.payment_date := pg_catalog.to_char(left(v_prev, 10)::date + v_every, 'YYYY-MM-DD');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

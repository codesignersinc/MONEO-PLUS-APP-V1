-- Admin panel: list of registered users with simple activity counts.
--
-- * public.app_admins holds who is an administrator. RLS on and no policies: clients
--   cannot read or change it; only these SECURITY DEFINER functions consult it.
-- * admin_users_overview() returns, only to admins, each user's email, name, sign-up
--   and last sign-in dates and COUNTS of records. It never returns amounts, merchants,
--   account names or any other financial content.

CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_users_overview()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  provider TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  cuentas BIGINT,
  gastos BIGINT,
  ingresos BIGINT,
  transferencias BIGINT,
  pagos BIGINT,
  cobros BIGINT,
  suscripciones BIGINT,
  deudas BIGINT,
  metas BIGINT,
  juntas_organiza BIGINT,
  juntas_participa BIGINT,
  ultimo_movimiento TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso solo para administradores.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(
      NULLIF(p.full_name, ''),
      NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(u.raw_user_meta_data ->> 'name', ''),
      ''
    )::TEXT,
    COALESCE(u.raw_app_meta_data ->> 'provider', 'email')::TEXT,
    u.created_at,
    u.last_sign_in_at,
    (SELECT count(*) FROM public.accounts x WHERE x.user_id = u.id),
    (SELECT count(*) FROM public.transactions x
      WHERE x.user_id = u.id AND x.transaction_type = 'gasto'),
    (SELECT count(*) FROM public.transactions x
      WHERE x.user_id = u.id AND x.transaction_type = 'ingreso'),
    (SELECT count(*) FROM public.transactions x
      WHERE x.user_id = u.id AND x.transaction_type = 'transferencia'
        AND x.transfer_leg IS DISTINCT FROM 'in'),
    (SELECT count(*) FROM public.pagos x WHERE x.user_id = u.id),
    (SELECT count(*) FROM public.income_entries x WHERE x.user_id = u.id),
    (SELECT count(*) FROM public.subscriptions x WHERE x.user_id = u.id),
    (SELECT count(*) FROM public.debts x WHERE x.user_id = u.id),
    (SELECT count(*) FROM public.savings_goals x WHERE x.user_id = u.id),
    (SELECT count(*) FROM public.juntas x WHERE x.user_id = u.id),
    (SELECT count(DISTINCT m.junta_id) FROM public.junta_members m
      JOIN public.juntas j ON j.id = m.junta_id
      WHERE m.user_id = u.id AND j.user_id <> u.id),
    (SELECT max(x.created_at) FROM public.transactions x WHERE x.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_overview() TO authenticated;

-- First administrator: the owner's account (no-op if that email has not signed up yet).
INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'codesignersperu@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

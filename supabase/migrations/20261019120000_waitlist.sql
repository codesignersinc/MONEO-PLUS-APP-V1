-- Global Core, step 4 (docs/global-core.md): waiting list of the country landings
-- (moneo.plus/es, /us, /au, /ae, /sg).
--
-- * public.waitlist: one row per email and country. Nobody reads it through the API
--   except admins; visitors only add themselves with join_waitlist().
-- * join_waitlist() validates everything (known country that is not live yet, email,
--   locale, answer to "how much would you pay"), stores the campaign (UTM) and never says
--   whether the email was already there.
-- * admin_waitlist_stats() gives the admin panel counts per country and per answer.

CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) <= 254 AND email = lower(email)),
  country_code text NOT NULL REFERENCES public.countries (code),
  locale text NOT NULL CHECK (locale ~ '^[a-z]{2}-[A-Z]{2}$'),
  -- Monthly price the person would pay, in their currency: 'free' (only free), 'low',
  -- 'mid', 'high' (the bands shown on each landing), or NULL when not answered.
  willing_to_pay text CHECK (willing_to_pay IN ('free', 'low', 'mid', 'high')),
  utm_source text CHECK (char_length(utm_source) <= 100),
  utm_medium text CHECK (char_length(utm_medium) <= 100),
  utm_campaign text CHECK (char_length(utm_campaign) <= 100),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, country_code)
);

CREATE INDEX waitlist_country_idx ON public.waitlist (country_code, created_at);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_admin_read ON public.waitlist FOR SELECT TO authenticated
  USING (public.is_app_admin());
REVOKE ALL ON public.waitlist FROM anon, authenticated;
GRANT SELECT ON public.waitlist TO authenticated;

CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_email text,
  p_country text,
  p_locale text,
  p_willing_to_pay text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF char_length(v_email) > 254
     OR v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Correo no válido.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.countries c
     WHERE c.code = p_country AND c.status IN ('waitlist', 'beta')
  ) THEN
    RAISE EXCEPTION 'País no disponible.' USING ERRCODE = '22023';
  END IF;
  IF p_locale IS NULL OR p_locale !~ '^[a-z]{2}-[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Idioma no válido.' USING ERRCODE = '22023';
  END IF;
  IF p_willing_to_pay IS NOT NULL AND p_willing_to_pay NOT IN ('free', 'low', 'mid', 'high') THEN
    RAISE EXCEPTION 'Respuesta no válida.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.waitlist
    (email, country_code, locale, willing_to_pay, utm_source, utm_medium, utm_campaign)
  VALUES (
    v_email, p_country, p_locale, p_willing_to_pay,
    left(nullif(btrim(p_utm_source), ''), 100),
    left(nullif(btrim(p_utm_medium), ''), 100),
    left(nullif(btrim(p_utm_campaign), ''), 100)
  )
  ON CONFLICT (email, country_code) DO UPDATE
     SET locale = EXCLUDED.locale,
         willing_to_pay = coalesce(EXCLUDED.willing_to_pay, public.waitlist.willing_to_pay),
         updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.join_waitlist(text, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_waitlist(text, text, text, text, text, text, text)
  TO anon, authenticated;

-- Admin panel: waiting list per country (counts only).
CREATE OR REPLACE FUNCTION public.admin_waitlist_stats()
RETURNS TABLE (
  code text,
  total bigint,
  last_7_days bigint,
  pay_free bigint,
  pay_low bigint,
  pay_mid bigint,
  pay_high bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo administradores.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT w.country_code,
           count(*),
           count(*) FILTER (WHERE w.created_at > now() - interval '7 days'),
           count(*) FILTER (WHERE w.willing_to_pay = 'free'),
           count(*) FILTER (WHERE w.willing_to_pay = 'low'),
           count(*) FILTER (WHERE w.willing_to_pay = 'mid'),
           count(*) FILTER (WHERE w.willing_to_pay = 'high')
      FROM public.waitlist w
     GROUP BY w.country_code;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_waitlist_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_waitlist_stats() TO authenticated;

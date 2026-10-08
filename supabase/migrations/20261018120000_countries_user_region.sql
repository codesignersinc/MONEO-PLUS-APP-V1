-- Global Core, step 3 (docs/global-core.md): countries and each user's region.
--
-- * public.countries: the country packs' base data (currency, locale, time zone, tax, launch
--   status). Public read (the landings and the sign-up use it); only admins change it.
-- * user_settings gains country_code, locale, timezone and region_confirmed_at. Existing
--   users are Peru (PE, es-PE, America/Lima), already confirmed: nothing changes for them.
-- * set_my_region() saves the region the user confirmed (validated: known country, valid
--   locale and IANA time zone). admin_country_stats() counts users per country for admins.
-- The time zone is stored now; the SQL functions start using it in step 5.

CREATE TABLE public.countries (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
  name text NOT NULL,
  flag text NOT NULL DEFAULT '',
  default_currency text NOT NULL CHECK (default_currency ~ '^[A-Z]{3}$'),
  default_locale text NOT NULL CHECK (default_locale ~ '^[a-z]{2}-[A-Z]{2}$'),
  default_timezone text NOT NULL,
  week_start smallint NOT NULL DEFAULT 1 CHECK (week_start BETWEEN 0 AND 6),
  tax_label text,
  tax_rate numeric(5, 2) CHECK (tax_rate IS NULL OR tax_rate BETWEEN 0 AND 100),
  prices_include_tax boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden', 'waitlist', 'beta', 'live')),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY countries_read ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY countries_admin_write ON public.countries FOR ALL TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
REVOKE ALL ON public.countries FROM anon, authenticated;
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.countries TO authenticated;

-- Roadmap (docs/global-core.md): Peru live; the validation markets on the waiting list.
INSERT INTO public.countries
  (code, name, flag, default_currency, default_locale, default_timezone, tax_label, tax_rate,
   status, features, sort_order) VALUES
  ('PE', 'Perú', '🇵🇪', 'PEN', 'es-PE', 'America/Lima', 'IGV', 18, 'live',
   '{"juntas": true, "juntas_label": "Juntas"}', 1),
  ('ES', 'España', '🇪🇸', 'EUR', 'es-ES', 'Europe/Madrid', 'IVA', 21, 'waitlist', '{"juntas": false}', 2),
  ('US', 'Estados Unidos', '🇺🇸', 'USD', 'es-US', 'America/New_York', 'Sales tax', NULL, 'waitlist',
   '{"juntas": true, "juntas_label": "Tandas"}', 3),
  ('AU', 'Australia', '🇦🇺', 'AUD', 'en-AU', 'Australia/Sydney', 'GST', 10, 'waitlist', '{"juntas": false}', 4),
  ('AE', 'Emiratos Árabes Unidos', '🇦🇪', 'AED', 'en-AE', 'Asia/Dubai', 'VAT', 5, 'waitlist', '{"juntas": false}', 5),
  ('SG', 'Singapur', '🇸🇬', 'SGD', 'en-SG', 'Asia/Singapore', 'GST', 9, 'waitlist', '{"juntas": false}', 6);

ALTER TABLE public.user_settings
  ADD COLUMN country_code text REFERENCES public.countries (code),
  ADD COLUMN locale text CHECK (locale IS NULL OR locale ~ '^[a-z]{2}-[A-Z]{2}$'),
  ADD COLUMN timezone text,
  ADD COLUMN region_confirmed_at timestamptz;

-- A time zone must be a real IANA name (a CHECK cannot look it up).
CREATE OR REPLACE FUNCTION public.user_settings_region_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.timezone IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names t WHERE t.name = NEW.timezone) THEN
    RAISE EXCEPTION 'Zona horaria no válida.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_settings_region_guard
  BEFORE INSERT OR UPDATE OF timezone ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.user_settings_region_guard();

-- Existing users: Peru, confirmed (they signed up in Peru's MONEO).
UPDATE public.user_settings
   SET country_code = 'PE', locale = 'es-PE', timezone = 'America/Lima',
       region_confirmed_at = coalesce(region_confirmed_at, now())
 WHERE country_code IS NULL;

-- Saves the region the user confirmed. The base currency only changes when asked for
-- (p_base_currency), e.g. a new user without accounts who picked another country.
CREATE OR REPLACE FUNCTION public.set_my_region(
  p_country text,
  p_locale text,
  p_timezone text,
  p_base_currency text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.countries c WHERE c.code = p_country) THEN
    RAISE EXCEPTION 'País no disponible.' USING ERRCODE = '22023';
  END IF;
  IF p_base_currency IS NOT NULL AND p_base_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Moneda no válida.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_settings
    (user_id, country_code, locale, timezone, region_confirmed_at, base_currency_code)
  VALUES (uid, p_country, p_locale, p_timezone, now(), coalesce(p_base_currency, 'PEN'))
  ON CONFLICT (user_id) DO UPDATE
     SET country_code = EXCLUDED.country_code,
         locale = EXCLUDED.locale,
         timezone = EXCLUDED.timezone,
         region_confirmed_at = now(),
         base_currency_code = coalesce(p_base_currency, public.user_settings.base_currency_code),
         updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_region(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_my_region(text, text, text, text) TO authenticated;

-- Admin panel: users per country (counts only).
CREATE OR REPLACE FUNCTION public.admin_country_stats()
RETURNS TABLE (code text, name text, flag text, status text, users bigint, confirmed bigint)
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
    SELECT c.code, c.name, c.flag, c.status,
           count(s.user_id), count(s.region_confirmed_at)
      FROM public.countries c
      LEFT JOIN public.user_settings s ON s.country_code = c.code
     GROUP BY c.code, c.name, c.flag, c.status, c.sort_order
    UNION ALL
    SELECT NULL::text, 'Sin país'::text, ''::text, NULL::text,
           (SELECT count(*) FROM auth.users u
             WHERE NOT EXISTS (SELECT 1 FROM public.user_settings s
                                WHERE s.user_id = u.id AND s.country_code IS NOT NULL)),
           0::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_country_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_country_stats() TO authenticated;

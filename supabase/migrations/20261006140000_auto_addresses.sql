-- MONEO AUTO, phase B: one private forwarding address per user
-- (u-<token>@auto.moneo.plus). Bank emails forwarded there become suggestions.
--
-- * The token is random and unguessable; the user can regenerate it (old address
--   stops working). Clients can only read their own row; the token is created by
--   get_or_create_auto_address() and the inbound Edge Function (service role) updates
--   last_received_at and the Gmail forwarding confirmation code.
-- * Never stores email contents.

CREATE TABLE IF NOT EXISTS public.auto_addresses (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (token ~ '^[a-z0-9]{12}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_received_at TIMESTAMPTZ,
  -- Gmail sends a confirmation code to the forwarding address; shown to the user once.
  gmail_code TEXT CHECK (gmail_code ~ '^[0-9]{6,12}$'),
  gmail_code_at TIMESTAMPTZ
);

ALTER TABLE public.auto_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_addresses_select_own ON public.auto_addresses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.auto_addresses FROM anon, authenticated;
GRANT SELECT ON public.auto_addresses TO authenticated;

-- 12 hex chars (48 bits) from gen_random_uuid(), which uses a cryptographic RNG.
CREATE OR REPLACE FUNCTION public.auto_new_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
$$;

-- Returns the caller's address, creating it on first use. regenerate = true issues a
-- new token (the previous address stops receiving).
CREATE OR REPLACE FUNCTION public.get_or_create_auto_address(regenerate BOOLEAN DEFAULT FALSE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  t TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.' USING ERRCODE = '42501';
  END IF;
  SELECT token INTO t FROM public.auto_addresses WHERE user_id = uid;
  IF t IS NULL OR regenerate THEN
    LOOP
      t := public.auto_new_token();
      BEGIN
        INSERT INTO public.auto_addresses (user_id, token) VALUES (uid, t)
        ON CONFLICT (user_id) DO UPDATE
          SET token = EXCLUDED.token, created_at = now(), gmail_code = NULL, gmail_code_at = NULL;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- token collision with another user: try another one
      END;
    END LOOP;
  END IF;
  RETURN 'u-' || t || '@auto.moneo.plus';
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_auto_address(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_auto_address(BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.auto_new_token() FROM PUBLIC, anon, authenticated;

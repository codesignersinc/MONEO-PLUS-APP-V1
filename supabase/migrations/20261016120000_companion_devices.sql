-- MONEO Companion: devices linked to show the summary outside the app (Android widget now;
-- iPhone, Windows and Mac later). A widget runs without the user's session, so each device
-- gets its own random token, shown only once and stored as sha256. The token can only read
-- the MONEO Core summary (never accounts, movements or anything else) and can be revoked
-- from Configuración. Revoking or deleting the account cuts it off at once.

CREATE TABLE public.companion_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'windows', 'mac')),
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX companion_devices_user_idx ON public.companion_devices (user_id);

ALTER TABLE public.companion_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY companion_devices_select_own ON public.companion_devices
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Writes only through the functions below; the hash is never readable from the client.
REVOKE ALL ON public.companion_devices FROM anon, authenticated;
GRANT SELECT (id, name, platform, created_at, last_seen_at, revoked_at)
  ON public.companion_devices TO authenticated;

-- Links a new device and returns its token (only this once).
CREATE OR REPLACE FUNCTION public.create_companion_device(p_name text, p_platform text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  tok text;
  dev uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.companion_devices
      WHERE user_id = uid AND revoked_at IS NULL) >= 10 THEN
    RAISE EXCEPTION 'Ya tienes 10 dispositivos vinculados. Desvincula alguno en Configuración.'
      USING ERRCODE = '22023';
  END IF;
  -- 2 random UUIDs = 244 random bits.
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.companion_devices (user_id, name, platform, token_hash)
    VALUES (uid, left(btrim(coalesce(p_name, '')), 60), p_platform,
            encode(sha256(convert_to(tok, 'UTF8')), 'hex'))
    RETURNING id INTO dev;
  RETURN jsonb_build_object('id', dev, 'token', tok);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_companion_device(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.companion_devices SET revoked_at = now()
   WHERE id = p_id AND user_id = auth.uid() AND revoked_at IS NULL;
END;
$$;

-- The widget's only door: the MONEO Core summary of the device's owner, without the list of
-- movements. NULL when the token is unknown or revoked (the widget then asks to link again).
CREATE OR REPLACE FUNCTION public.companion_widget(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dev public.companion_devices;
  prev_claims text := current_setting('request.jwt.claims', true);
  s jsonb;
BEGIN
  SELECT * INTO dev FROM public.companion_devices
   WHERE token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF dev.last_seen_at IS NULL OR dev.last_seen_at < now() - interval '5 minutes' THEN
    UPDATE public.companion_devices SET last_seen_at = now() WHERE id = dev.id;
  END IF;
  -- Run the very same summary as its owner (moneo_summary reads auth.uid()).
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', dev.user_id, 'role', 'authenticated')::text, true);
  s := public.moneo_summary(NULL);
  PERFORM set_config('request.jwt.claims', coalesce(prev_claims, ''), true);
  RETURN s - 'recent';
END;
$$;

REVOKE ALL ON FUNCTION public.create_companion_device(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_companion_device(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.revoke_companion_device(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revoke_companion_device(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.companion_widget(text) FROM public;
GRANT EXECUTE ON FUNCTION public.companion_widget(text) TO anon, authenticated;

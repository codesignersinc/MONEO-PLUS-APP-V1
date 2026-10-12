-- ============================================================
-- MONEO AUTO en Android: el celular lee las notificaciones de Yape, BCP, Interbank y BBVA y
-- las manda a la Edge Function auto-notify, que crea la sugerencia (source 'notification').
--
-- El celular se identifica con un token de MONEO Companion, pero con un permiso propio
-- (can_auto): el token del widget solo lee el resumen y no puede crear sugerencias. El token
-- se crea desde la pantalla de consentimiento (/finanzas/auto/celular), con la sesión de la
-- persona, y se desvincula igual que el widget (Configuración → Widgets y dispositivos).
-- El texto de las notificaciones nunca llega a la base: solo los campos de la sugerencia.
-- ============================================================

ALTER TABLE public.companion_devices
  ADD COLUMN can_auto boolean NOT NULL DEFAULT false;
GRANT SELECT (can_auto) ON public.companion_devices TO authenticated;

-- Links this phone for MONEO AUTO and returns its token (only this once).
CREATE OR REPLACE FUNCTION public.create_companion_auto_device(p_name text)
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
  -- One MONEO AUTO link per phone name: linking again replaces the previous one.
  UPDATE public.companion_devices SET revoked_at = now()
   WHERE user_id = uid AND can_auto AND revoked_at IS NULL
     AND name = left(btrim(coalesce(p_name, '')), 60);
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.companion_devices (user_id, name, platform, token_hash, can_auto)
    VALUES (uid, left(btrim(coalesce(p_name, '')), 60), 'android',
            encode(sha256(convert_to(tok, 'UTF8')), 'hex'), true)
    RETURNING id INTO dev;
  RETURN jsonb_build_object('id', dev, 'token', tok);
END;
$$;
REVOKE ALL ON FUNCTION public.create_companion_auto_device(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_companion_auto_device(text) TO authenticated;

-- For auto-notify only (service role): the owner of a valid MONEO AUTO token, or NULL.
CREATE OR REPLACE FUNCTION public.companion_auto_user(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dev public.companion_devices;
BEGIN
  IF coalesce(p_token, '') !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO dev FROM public.companion_devices
   WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     AND can_auto AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF dev.last_seen_at IS NULL OR dev.last_seen_at < now() - interval '5 minutes' THEN
    UPDATE public.companion_devices SET last_seen_at = now() WHERE id = dev.id;
  END IF;
  RETURN dev.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.companion_auto_user(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.companion_auto_user(text) TO service_role;

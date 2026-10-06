-- MONEO AUTO: direct mailbox connection (Gmail, read-only OAuth) instead of forwarding.
--
-- * mail_connections: one per user and provider. The OAuth tokens are encrypted by the
--   mail-oauth Edge Function (AES-GCM, key in its secrets) and are never readable by
--   clients: authenticated users can only SELECT the non-secret columns of their row.
--   Disconnecting clears the tokens but keeps the row (status 'disconnected'), so the
--   Google beta user cap can be counted.
-- * mail_oauth_states: short-lived OAuth "state" values (service role only).
-- * mail_seen_messages: hashes of the mailbox message ids already read, so a message is
--   interpreted only once (service role only). Never stores email contents.
-- * A pg_cron job calls the Edge Function every 5 minutes to read new bank emails. Its URL
--   and secret come from Vault (mail_sync_url, mail_sync_secret), set per project.

CREATE TABLE IF NOT EXISTS public.mail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  email_hint TEXT NOT NULL CHECK (char_length(email_hint) <= 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'disconnected')),
  refresh_token_enc TEXT,
  access_token_enc TEXT,
  access_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_found_at TIMESTAMPTZ,
  last_error TEXT CHECK (char_length(last_error) <= 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider),
  CHECK (status <> 'active' OR refresh_token_enc IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS mail_connections_sync_idx
  ON public.mail_connections (last_sync_at NULLS FIRST)
  WHERE status = 'active';

ALTER TABLE public.mail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY mail_connections_select_own ON public.mail_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.mail_connections FROM anon, authenticated;
GRANT SELECT (id, provider, email_hint, status, last_sync_at, last_found_at, last_error, created_at)
  ON public.mail_connections TO authenticated;

CREATE TABLE IF NOT EXISTS public.mail_oauth_states (
  state_hash TEXT PRIMARY KEY CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  code_verifier TEXT NOT NULL,
  return_origin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mail_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_oauth_states FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.mail_seen_messages (
  connection_id UUID NOT NULL REFERENCES public.mail_connections (id) ON DELETE CASCADE,
  message_hash TEXT NOT NULL CHECK (message_hash ~ '^[0-9a-f]{64}$'),
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, message_hash)
);

CREATE INDEX IF NOT EXISTS mail_seen_messages_seen_at_idx ON public.mail_seen_messages (seen_at);

ALTER TABLE public.mail_seen_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_seen_messages FROM anon, authenticated;

-- Periodic sync: every 5 minutes. Without the Vault secrets the call is skipped.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.mail_sync_tick()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sync_url TEXT;
  sync_secret TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mail_connections WHERE status = 'active') THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO sync_url FROM vault.decrypted_secrets WHERE name = 'mail_sync_url';
  SELECT decrypted_secret INTO sync_secret FROM vault.decrypted_secrets WHERE name = 'mail_sync_secret';
  IF sync_url IS NULL OR sync_secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := sync_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sync_secret
    ),
    body := jsonb_build_object('action', 'cron'),
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mail_sync_tick() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mail-sync';
SELECT cron.schedule('mail-sync', '*/5 * * * *', 'SELECT public.mail_sync_tick()');

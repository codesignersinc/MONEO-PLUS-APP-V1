-- MONEO AUTO: new suggestions (e.g. forwarded bank emails inserted by the inbound Edge
-- Function) reach the open app instantly through Supabase Realtime.
-- Realtime applies RLS (auto_suggestions_own), so each user only receives their own rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auto_suggestions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_suggestions;
  END IF;
END;
$$;

-- ============================================================
-- NOTIFICATIONS MODULE
-- ============================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  icon TEXT,
  color TEXT,
  action_url TEXT,
  entity_type TEXT,
  entity_id UUID NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "users_select_own_notifications" ON public.notifications;
CREATE POLICY "users_select_own_notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
CREATE POLICY "users_update_own_notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_notifications" ON public.notifications;
CREATE POLICY "users_insert_own_notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5. Welcome notification for existing users (safe, idempotent)
DO $$
DECLARE
  existing_user_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;
    IF existing_user_id IS NOT NULL THEN
      -- Only insert if no notifications exist for this user
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications WHERE user_id = existing_user_id LIMIT 1
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, message, icon, color, action_url, metadata)
        VALUES (
          existing_user_id,
          'system',
          'Bienvenido a MONEO+',
          'Tu dinero, más simple. Aquí verás todo lo importante sobre tus finanzas.',
          '🎉',
          '#FFD43B',
          '/finanzas',
          '{}'::jsonb
        );
      END IF;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Welcome notification skipped: %', SQLERRM;
END $$;

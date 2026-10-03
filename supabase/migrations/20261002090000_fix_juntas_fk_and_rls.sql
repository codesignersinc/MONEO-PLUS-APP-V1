-- ─── Fix Juntas: FK references and RLS circular recursion ───────────────────
-- Root causes of 500 errors:
-- 1. juntas.user_id → user_profiles(id): fails if profile not yet created
-- 2. junta_invites.created_by → user_profiles(id): same issue
-- 3. juntas_select policy queries junta_members which queries juntas → mutual recursion
--
-- Fix: change FKs to reference auth.users(id), fix RLS to avoid cross-table recursion

-- ─── 1. Fix juntas.user_id FK ────────────────────────────────────────────────

ALTER TABLE public.juntas DROP CONSTRAINT IF EXISTS juntas_user_id_fkey;
ALTER TABLE public.juntas
  ADD CONSTRAINT juntas_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── 2. Fix junta_invites.created_by FK ──────────────────────────────────────

ALTER TABLE public.junta_invites DROP CONSTRAINT IF EXISTS junta_invites_created_by_fkey;
ALTER TABLE public.junta_invites
  ADD CONSTRAINT junta_invites_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── 3. Fix junta_members.user_id FK ─────────────────────────────────────────
-- Also change to auth.users to avoid profile-not-found errors

ALTER TABLE public.junta_members DROP CONSTRAINT IF EXISTS junta_members_user_id_fkey;
ALTER TABLE public.junta_members
  ADD CONSTRAINT junta_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 4. Fix RLS: juntas_select — remove junta_members subquery (circular) ────

DROP POLICY IF EXISTS "juntas_select" ON public.juntas;
CREATE POLICY "juntas_select" ON public.juntas
  FOR SELECT USING (auth.uid() = user_id);

-- Note: members can see junta details via the junta_members table join in the app.
-- The owner-only select is safe and non-recursive.

DROP POLICY IF EXISTS "juntas_insert" ON public.juntas;
CREATE POLICY "juntas_insert" ON public.juntas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "juntas_update" ON public.juntas;
CREATE POLICY "juntas_update" ON public.juntas
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "juntas_delete" ON public.juntas;
CREATE POLICY "juntas_delete" ON public.juntas
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 5. Fix junta_members RLS — non-recursive ────────────────────────────────

DROP POLICY IF EXISTS "junta_members_select" ON public.junta_members;
CREATE POLICY "junta_members_select" ON public.junta_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "junta_members_insert" ON public.junta_members;
CREATE POLICY "junta_members_insert" ON public.junta_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id AND j.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "junta_members_update" ON public.junta_members;
CREATE POLICY "junta_members_update" ON public.junta_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "junta_members_delete" ON public.junta_members;
CREATE POLICY "junta_members_delete" ON public.junta_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id AND j.user_id = auth.uid()
    )
  );

-- ─── 6. Fix junta_cycles RLS ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "junta_cycles_select" ON public.junta_cycles;
CREATE POLICY "junta_cycles_select" ON public.junta_cycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_cycles.junta_id AND j.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.junta_members jm
      WHERE jm.junta_id = junta_cycles.junta_id AND jm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "junta_cycles_insert" ON public.junta_cycles;
CREATE POLICY "junta_cycles_insert" ON public.junta_cycles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_cycles.junta_id AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "junta_cycles_update" ON public.junta_cycles;
CREATE POLICY "junta_cycles_update" ON public.junta_cycles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_cycles.junta_id AND j.user_id = auth.uid()
    )
  );

-- ─── 7. Fix junta_turns RLS ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "junta_turns_select" ON public.junta_turns;
CREATE POLICY "junta_turns_select" ON public.junta_turns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_turns.junta_id AND j.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.junta_members jm
      WHERE jm.junta_id = junta_turns.junta_id AND jm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "junta_turns_insert" ON public.junta_turns;
CREATE POLICY "junta_turns_insert" ON public.junta_turns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_turns.junta_id AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "junta_turns_update" ON public.junta_turns;
CREATE POLICY "junta_turns_update" ON public.junta_turns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_turns.junta_id AND j.user_id = auth.uid()
    )
  );

-- ─── 8. Fix junta_events RLS ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "junta_events_select" ON public.junta_events;
CREATE POLICY "junta_events_select" ON public.junta_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_events.junta_id AND j.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.junta_members jm
      WHERE jm.junta_id = junta_events.junta_id AND jm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "junta_events_insert" ON public.junta_events;
CREATE POLICY "junta_events_insert" ON public.junta_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_events.junta_id AND j.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.junta_members jm
      WHERE jm.junta_id = junta_events.junta_id AND jm.user_id = auth.uid()
    )
  );

-- ─── 9. Fix junta_invites RLS ────────────────────────────────────────────────

DROP POLICY IF EXISTS "junta_invites_select" ON public.junta_invites;
CREATE POLICY "junta_invites_select" ON public.junta_invites
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_invites.junta_id AND j.user_id = auth.uid()
    )
    OR is_active = true
  );

DROP POLICY IF EXISTS "junta_invites_insert" ON public.junta_invites;
CREATE POLICY "junta_invites_insert" ON public.junta_invites
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "junta_invites_update" ON public.junta_invites;
CREATE POLICY "junta_invites_update" ON public.junta_invites
  FOR UPDATE USING (created_by = auth.uid());

-- ─── 10. Ensure user_profiles upsert trigger exists ──────────────────────────
-- Auto-create user_profile on signup so FK references to user_profiles still work

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

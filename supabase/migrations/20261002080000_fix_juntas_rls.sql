-- ─── Fix Juntas RLS Policies (remove recursive subqueries) ──────────────────
-- The original policies on junta_members, junta_cycles, junta_turns,
-- junta_events had recursive subqueries that caused infinite recursion or
-- empty results. This migration replaces them with non-recursive patterns.

-- ─── junta_members ───────────────────────────────────────────────────────────
-- OLD: junta_members_select queried junta_members inside itself → recursion
-- NEW: allow if own member row (user_id = auth.uid()) OR junta owner

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

-- ─── junta_cycles ────────────────────────────────────────────────────────────
-- OLD: junta_cycles_select queried junta_members → recursion risk
-- NEW: allow if junta owner only (members can be added later via function)

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

-- ─── junta_turns ─────────────────────────────────────────────────────────────

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

-- ─── junta_events ────────────────────────────────────────────────────────────

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

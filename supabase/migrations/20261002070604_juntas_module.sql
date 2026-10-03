-- ─── Juntas Module Migration ─────────────────────────────────────────────────
-- Tables: juntas, junta_members, junta_cycles, junta_turns,
--         junta_contributions, junta_invites, junta_events

-- ─── 1. Juntas ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.juntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  contribution_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'mensual',
  max_participants INTEGER NOT NULL DEFAULT 8,
  first_draw_date TEXT NOT NULL DEFAULT '',
  payment_confirmation TEXT NOT NULL DEFAULT 'comprobante',
  payment_deadline_day INTEGER NOT NULL DEFAULT 10,
  late_policy TEXT NOT NULL DEFAULT 'aviso_automatico',
  is_private BOOLEAN NOT NULL DEFAULT true,
  additional_notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'activa',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_juntas_user_id ON public.juntas(user_id);
CREATE INDEX IF NOT EXISTS idx_juntas_status ON public.juntas(status);

-- ─── 2. Junta Members ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.junta_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pendiente',
  joined_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_junta_members_junta_id ON public.junta_members(junta_id);
CREATE INDEX IF NOT EXISTS idx_junta_members_user_id ON public.junta_members(user_id);

-- ─── 3. Junta Cycles ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.junta_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  cycle_month TEXT NOT NULL DEFAULT '',
  cycle_year INTEGER NOT NULL DEFAULT 2026,
  total_expected NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_collected NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'activo',
  draw_winner_member_id UUID REFERENCES public.junta_members(id) ON DELETE SET NULL,
  draw_performed_at TIMESTAMPTZ DEFAULT NULL,
  draw_seed TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_junta_cycles_junta_id ON public.junta_cycles(junta_id);

-- ─── 4. Junta Turns ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.junta_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.junta_members(id) ON DELETE CASCADE,
  turn_order INTEGER NOT NULL DEFAULT 1,
  turn_month TEXT NOT NULL DEFAULT '',
  turn_year INTEGER NOT NULL DEFAULT 2026,
  amount_to_receive NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_junta_turns_junta_id ON public.junta_turns(junta_id);
CREATE INDEX IF NOT EXISTS idx_junta_turns_member_id ON public.junta_turns(member_id);

-- ─── 5. Junta Contributions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.junta_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.junta_cycles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.junta_members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  status TEXT NOT NULL DEFAULT 'pendiente',
  receipt_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  paid_at TIMESTAMPTZ DEFAULT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'junta_contribution',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_junta_contributions_junta_id ON public.junta_contributions(junta_id);
CREATE INDEX IF NOT EXISTS idx_junta_contributions_cycle_id ON public.junta_contributions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_junta_contributions_member_id ON public.junta_contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_junta_contributions_user_id ON public.junta_contributions(user_id);

-- ─── 6. Junta Invites ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.junta_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT '',
  created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  max_uses INTEGER DEFAULT NULL,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_junta_invites_junta_id ON public.junta_invites(junta_id);
CREATE INDEX IF NOT EXISTS idx_junta_invites_code ON public.junta_invites(invite_code);

-- ─── 7. Junta Events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.junta_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  actor_member_id UUID REFERENCES public.junta_members(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'info',
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_junta_events_junta_id ON public.junta_events(junta_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.juntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.junta_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.junta_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.junta_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.junta_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.junta_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.junta_events ENABLE ROW LEVEL SECURITY;

-- Juntas: owner can do all; members can read
CREATE POLICY "juntas_select" ON public.juntas
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.junta_members jm
      WHERE jm.junta_id = juntas.id AND jm.user_id = auth.uid()
    )
  );

CREATE POLICY "juntas_insert" ON public.juntas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "juntas_update" ON public.juntas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "juntas_delete" ON public.juntas
  FOR DELETE USING (auth.uid() = user_id);

-- Junta Members: members of the junta can read; admin can manage
CREATE POLICY "junta_members_select" ON public.junta_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id
        AND (j.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.junta_members jm2
          WHERE jm2.junta_id = j.id AND jm2.user_id = auth.uid()
        ))
    )
  );

CREATE POLICY "junta_members_insert" ON public.junta_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "junta_members_update" ON public.junta_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id AND j.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "junta_members_delete" ON public.junta_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_members.junta_id AND j.user_id = auth.uid()
    )
  );

-- Junta Cycles: members can read; admin can manage
CREATE POLICY "junta_cycles_select" ON public.junta_cycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_cycles.junta_id
        AND (j.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.junta_members jm
          WHERE jm.junta_id = j.id AND jm.user_id = auth.uid()
        ))
    )
  );

CREATE POLICY "junta_cycles_insert" ON public.junta_cycles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_cycles.junta_id AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "junta_cycles_update" ON public.junta_cycles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_cycles.junta_id AND j.user_id = auth.uid()
    )
  );

-- Junta Turns: members can read; admin can manage
CREATE POLICY "junta_turns_select" ON public.junta_turns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_turns.junta_id
        AND (j.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.junta_members jm
          WHERE jm.junta_id = j.id AND jm.user_id = auth.uid()
        ))
    )
  );

CREATE POLICY "junta_turns_insert" ON public.junta_turns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_turns.junta_id AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "junta_turns_update" ON public.junta_turns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_turns.junta_id AND j.user_id = auth.uid()
    )
  );

-- Junta Contributions: user can read/insert their own; admin can read all
CREATE POLICY "junta_contributions_select" ON public.junta_contributions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_contributions.junta_id AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "junta_contributions_insert" ON public.junta_contributions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "junta_contributions_update" ON public.junta_contributions
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_contributions.junta_id AND j.user_id = auth.uid()
    )
  );

-- Junta Invites: admin can manage; anyone with code can read active ones
CREATE POLICY "junta_invites_select" ON public.junta_invites
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_invites.junta_id AND j.user_id = auth.uid()
    )
    OR is_active = true
  );

CREATE POLICY "junta_invites_insert" ON public.junta_invites
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "junta_invites_update" ON public.junta_invites
  FOR UPDATE USING (created_by = auth.uid());

-- Junta Events: members can read; system inserts
CREATE POLICY "junta_events_select" ON public.junta_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_events.junta_id
        AND (j.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.junta_members jm
          WHERE jm.junta_id = j.id AND jm.user_id = auth.uid()
        ))
    )
  );

CREATE POLICY "junta_events_insert" ON public.junta_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juntas j
      WHERE j.id = junta_events.junta_id
        AND (j.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.junta_members jm
          WHERE jm.junta_id = j.id AND jm.user_id = auth.uid()
        ))
    )
  );

-- ─── Pagos (Manual Payments) Table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Servicios',
  category_icon TEXT NOT NULL DEFAULT '💡',
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_date TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  payment_day INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- RLS
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pagos"
  ON public.pagos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

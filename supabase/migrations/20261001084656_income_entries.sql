-- ─── Income Entries Migration ─────────────────────────────────────────────────
-- Table: income_entries (ingresos pendientes de cobrar)

CREATE TABLE IF NOT EXISTS public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Ingreso',
  category_icon TEXT NOT NULL DEFAULT '💰',
  collection_date TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'income_entries' AND policyname = 'Users can manage their own income entries'
  ) THEN
    CREATE POLICY "Users can manage their own income entries"
      ON public.income_entries
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

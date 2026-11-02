CREATE TABLE public.league_saves (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_saves TO authenticated;
GRANT ALL ON public.league_saves TO service_role;
ALTER TABLE public.league_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own save select" ON public.league_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own save insert" ON public.league_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own save update" ON public.league_saves FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own save delete" ON public.league_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);
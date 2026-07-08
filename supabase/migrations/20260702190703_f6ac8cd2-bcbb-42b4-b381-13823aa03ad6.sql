
-- Extend resumes table
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS resumes_parent_id_idx ON public.resumes(parent_id);
CREATE INDEX IF NOT EXISTS resumes_user_id_idx ON public.resumes(user_id);

-- Resume shares
CREATE TABLE IF NOT EXISTS public.resume_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  password_hash text,
  expires_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_shares TO authenticated;
GRANT SELECT ON public.resume_shares TO anon;
GRANT ALL ON public.resume_shares TO service_role;
ALTER TABLE public.resume_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shares" ON public.resume_shares FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public read active shares" ON public.resume_shares FOR SELECT
  TO anon USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE TRIGGER trg_resume_shares_updated BEFORE UPDATE ON public.resume_shares
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Download history
CREATE TABLE IF NOT EXISTS public.resume_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'app',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.resume_downloads TO authenticated;
GRANT ALL ON public.resume_downloads TO service_role;
ALTER TABLE public.resume_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own downloads" ON public.resume_downloads FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS resume_downloads_resume_id_idx ON public.resume_downloads(resume_id);

-- View analytics (public)
CREATE TABLE IF NOT EXISTS public.resume_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.resume_shares(id) ON DELETE CASCADE,
  resume_id uuid NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  referrer text,
  country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resume_views TO authenticated;
GRANT INSERT ON public.resume_views TO anon, authenticated;
GRANT ALL ON public.resume_views TO service_role;
ALTER TABLE public.resume_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads views" ON public.resume_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.resumes r WHERE r.id = resume_views.resume_id AND r.user_id = auth.uid()));
CREATE POLICY "anyone can log a view" ON public.resume_views FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.resume_shares s
    WHERE s.id = resume_views.share_id
      AND s.resume_id = resume_views.resume_id
      AND s.is_active = true
      AND (s.expires_at IS NULL OR s.expires_at > now())
  ));
CREATE INDEX IF NOT EXISTS resume_views_resume_id_idx ON public.resume_views(resume_id);
CREATE INDEX IF NOT EXISTS resume_views_share_id_idx ON public.resume_views(share_id);

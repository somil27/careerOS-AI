
CREATE TABLE public.career_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_goals TO authenticated;
GRANT ALL ON public.career_goals TO service_role;
ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.career_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER career_goals_touch BEFORE UPDATE ON public.career_goals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.career_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  current_level INTEGER NOT NULL DEFAULT 0,
  target_level INTEGER NOT NULL DEFAULT 100,
  priority TEXT NOT NULL DEFAULT 'medium',
  last_practiced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_skills TO authenticated;
GRANT ALL ON public.career_skills TO service_role;
ALTER TABLE public.career_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills" ON public.career_skills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER career_skills_touch BEFORE UPDATE ON public.career_skills FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.career_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  target_role TEXT,
  years_experience INTEGER,
  location TEXT,
  current_title TEXT,
  context_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_profile TO authenticated;
GRANT ALL ON public.career_profile TO service_role;
ALTER TABLE public.career_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own career profile" ON public.career_profile FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER career_profile_touch BEFORE UPDATE ON public.career_profile FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

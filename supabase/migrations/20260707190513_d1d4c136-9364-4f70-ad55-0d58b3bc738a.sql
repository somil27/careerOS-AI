
CREATE TABLE public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interview_type TEXT NOT NULL,
  company TEXT,
  role TEXT,
  difficulty TEXT DEFAULT 'medium',
  mode TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'in_progress',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis JSONB,
  feedback JSONB,
  overall_score NUMERIC,
  confidence_score NUMERIC,
  communication_score NUMERIC,
  technical_score NUMERIC,
  behavioral_score NUMERIC,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_sessions TO authenticated;
GRANT ALL ON public.interview_sessions TO service_role;

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own interview sessions"
  ON public.interview_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER interview_sessions_touch
  BEFORE UPDATE ON public.interview_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_interview_sessions_user_created ON public.interview_sessions(user_id, created_at DESC);

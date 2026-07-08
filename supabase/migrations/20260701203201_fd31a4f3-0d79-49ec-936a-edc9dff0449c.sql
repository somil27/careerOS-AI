
-- 1) Extend applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS board_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS applications_user_deleted_idx ON public.applications(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS applications_status_order_idx ON public.applications(status, board_order);

-- 2) Activity log
CREATE TABLE IF NOT EXISTS public.application_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  from_status text,
  to_status text,
  message text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_activities TO authenticated;
GRANT ALL ON public.application_activities TO service_role;
ALTER TABLE public.application_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.application_activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS app_activities_app_idx ON public.application_activities(application_id, created_at DESC);

-- 3) Attachments
CREATE TABLE IF NOT EXISTS public.application_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  file_path text NOT NULL,
  mime text,
  size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_attachments TO authenticated;
GRANT ALL ON public.application_attachments TO service_role;
ALTER TABLE public.application_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments" ON public.application_attachments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS app_attachments_app_idx ON public.application_attachments(application_id);

-- 4) Auto-log status changes and creates
CREATE OR REPLACE FUNCTION public.log_application_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.application_activities(application_id, user_id, type, to_status, message)
    VALUES (NEW.id, NEW.user_id, 'created', NEW.status::text, 'Application created');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.application_activities(application_id, user_id, type, from_status, to_status, message)
      VALUES (NEW.id, NEW.user_id, 'status_change', OLD.status::text, NEW.status::text,
              'Status changed from ' || OLD.status::text || ' to ' || NEW.status::text);
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.application_activities(application_id, user_id, type, message)
      VALUES (NEW.id, NEW.user_id, 'deleted', 'Application moved to trash');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_applications_activity ON public.applications;
CREATE TRIGGER trg_applications_activity
AFTER INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.log_application_change();

-- 5) Storage RLS for attachments bucket (folder-per-user)
CREATE POLICY "att read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "att write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "att update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "att delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

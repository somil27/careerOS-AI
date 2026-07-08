
-- Add a narrow public SELECT policy so anon/authenticated non-owners can look up
-- only active, non-expired shares by slug (the shared-resume viewer flow).
CREATE POLICY "public can read active non-expired shares"
ON public.resume_shares
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);

-- Remove the broad public INSERT policy on resume_views. View logging happens
-- through the getSharedResume server function using the service-role client,
-- which bypasses RLS; the previous policy allowed any anon/authenticated user
-- to spoof unlimited view records directly against the Data API.
DROP POLICY IF EXISTS "anyone can log a view" ON public.resume_views;

-- Keep resume_views locked down: only the owner can read views (existing policy),
-- and only server-side (service role) can insert. No public insert path remains.

DROP POLICY IF EXISTS "public read active shares" ON public.resume_shares;
REVOKE SELECT ON public.resume_shares FROM anon;
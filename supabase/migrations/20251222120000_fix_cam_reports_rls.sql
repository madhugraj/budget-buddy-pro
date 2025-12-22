-- Allow public/anon access to CAM monthly reports
-- This is required because MC users are authenticated via localStorage (custom auth),
-- not Supabase Auth, so they appear as 'anon' to RLS.

DROP POLICY IF EXISTS "Authenticated users can view cam monthly reports" ON public.cam_monthly_reports;
DROP POLICY IF EXISTS "Allow public read access to cam_monthly_reports" ON public.cam_monthly_reports;

CREATE POLICY "Allow public read access to cam_monthly_reports"
ON public.cam_monthly_reports
FOR SELECT
USING (true);

-- Ensure we don't accidentally block other operations (LEAD/Admin write access is strictly handled by other policies)
-- The existing insert/update policies from previous migrations check specific roles (lead/treasurer) via auth.uid(),
-- so they remain secure even with public READ access.

-- Force refresh schema cache
NOTIFY pgrst, 'reload config';

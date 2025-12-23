-- Add a public SELECT policy for cam_monthly_reports so MC users can view/download reports
-- MC users are not authenticated via Supabase Auth but via a separate mc_users table
CREATE POLICY "Public can read cam_monthly_reports" 
ON public.cam_monthly_reports 
FOR SELECT 
USING (true);
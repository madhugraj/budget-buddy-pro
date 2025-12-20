-- Add tower column to cam_monthly_reports
ALTER TABLE public.cam_monthly_reports ADD COLUMN IF NOT EXISTS tower TEXT;

-- Update unique constraint to include tower
ALTER TABLE public.cam_monthly_reports DROP CONSTRAINT IF EXISTS cam_monthly_reports_year_month_report_type_key;
ALTER TABLE public.cam_monthly_reports ADD CONSTRAINT cam_monthly_reports_year_month_tower_type_key UNIQUE(year, month, tower, report_type);

-- Update RLS for MC users to read their own tower's reports
-- Assuming mc_users table has a tower_no column and we can verify them via some session/JWT
-- For now, we allow read access as per the existing policy "Allow public read access to cam_monthly_reports"

-- Add cam_recon_flats to cam_tracking
ALTER TABLE public.cam_tracking ADD COLUMN IF NOT EXISTS cam_recon_flats INTEGER DEFAULT 0;

-- Create cam_monthly_reports table
CREATE TABLE IF NOT EXISTS public.cam_monthly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('defaulters_list', 'recon_list')),
    document_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(year, month, report_type)
);

-- Add comment to new column
COMMENT ON COLUMN public.cam_tracking.cam_recon_flats IS 'Number of flats reconciled in the follow-up month (defaulters who paid later)';

-- Enable RLS for cam_monthly_reports
ALTER TABLE public.cam_monthly_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for cam_monthly_reports
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cam_monthly_reports' AND policyname = 'Allow public read access to cam_monthly_reports'
    ) THEN
        CREATE POLICY "Allow public read access to cam_monthly_reports"
        ON public.cam_monthly_reports FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cam_monthly_reports' AND policyname = 'Allow lead users to manage cam_monthly_reports'
    ) THEN
        CREATE POLICY "Allow lead users to manage cam_monthly_reports"
        ON public.cam_monthly_reports FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('lead', 'admin', 'treasurer')
          )
        );
    END IF;
END$$;

-- Ensure 'cam' bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cam', 'cam', false)
ON CONFLICT (id) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_cam_monthly_reports_updated_at
    BEFORE UPDATE ON public.cam_monthly_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

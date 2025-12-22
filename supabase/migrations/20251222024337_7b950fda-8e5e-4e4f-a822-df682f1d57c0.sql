-- Create cam_monthly_reports table for storing monthly defaulter and recon lists
DROP TABLE IF EXISTS public.cam_monthly_reports CASCADE;
CREATE TABLE public.cam_monthly_reports (

  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tower TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('defaulters_20th', 'defaulters_30th')),
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tower, year, month, report_type)
);

-- Enable RLS
ALTER TABLE public.cam_monthly_reports ENABLE ROW LEVEL SECURITY;

-- Leads can insert their own reports
DROP POLICY IF EXISTS "Leads can insert cam monthly reports" ON public.cam_monthly_reports;
CREATE POLICY "Leads can insert cam monthly reports"
ON public.cam_monthly_reports
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'lead'::user_role) OR has_role(auth.uid(), 'treasurer'::user_role));

-- Leads can update their own reports
DROP POLICY IF EXISTS "Leads can update own cam monthly reports" ON public.cam_monthly_reports;
CREATE POLICY "Leads can update own cam monthly reports"
ON public.cam_monthly_reports
FOR UPDATE
USING ((has_role(auth.uid(), 'lead'::user_role) AND uploaded_by = auth.uid()) OR has_role(auth.uid(), 'treasurer'::user_role));

-- Anyone authenticated can view (for MCs to download)
DROP POLICY IF EXISTS "Authenticated users can view cam monthly reports" ON public.cam_monthly_reports;
CREATE POLICY "Authenticated users can view cam monthly reports"
ON public.cam_monthly_reports
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Treasurers can delete
DROP POLICY IF EXISTS "Treasurers can delete cam monthly reports" ON public.cam_monthly_reports;
CREATE POLICY "Treasurers can delete cam monthly reports"
ON public.cam_monthly_reports
FOR DELETE
USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Add storage policies for cam bucket - monthly-reports folder
-- Allow leads and treasurers to upload to monthly-reports folder
DROP POLICY IF EXISTS "Leads can upload cam monthly reports" ON storage.objects;
CREATE POLICY "Leads can upload cam monthly reports"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cam' 
  AND (storage.foldername(name))[1] = 'monthly-reports'
  AND (has_role(auth.uid(), 'lead'::user_role) OR has_role(auth.uid(), 'treasurer'::user_role))
);

-- Allow authenticated users to view/download cam monthly reports
DROP POLICY IF EXISTS "Authenticated users can view cam monthly reports files" ON storage.objects;
CREATE POLICY "Authenticated users can view cam monthly reports files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cam' 
  AND (storage.foldername(name))[1] = 'monthly-reports'
  AND auth.uid() IS NOT NULL
);

-- Allow leads and treasurers to update their uploads
DROP POLICY IF EXISTS "Leads can update cam monthly reports files" ON storage.objects;
CREATE POLICY "Leads can update cam monthly reports files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'cam' 
  AND (storage.foldername(name))[1] = 'monthly-reports'
  AND (has_role(auth.uid(), 'lead'::user_role) OR has_role(auth.uid(), 'treasurer'::user_role))
);

-- Allow treasurers to delete
DROP POLICY IF EXISTS "Treasurers can delete cam monthly reports files" ON storage.objects;
CREATE POLICY "Treasurers can delete cam monthly reports files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cam' 
  AND (storage.foldername(name))[1] = 'monthly-reports'
  AND has_role(auth.uid(), 'treasurer'::user_role)
);
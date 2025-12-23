-- Add storage policy for public read access to cam/monthly-reports folder
-- This allows MC users (who are not Supabase authenticated) to download monthly reports
CREATE POLICY "Public can read monthly reports from cam bucket"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cam' 
  AND (storage.foldername(name))[1] = 'monthly-reports'
);
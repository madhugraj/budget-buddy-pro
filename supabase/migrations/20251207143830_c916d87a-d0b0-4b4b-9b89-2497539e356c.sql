-- Create RLS policies for 'cam' storage bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload CAM documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cam' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view/download CAM documents
CREATE POLICY "Authenticated users can view CAM documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cam' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update CAM documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'cam' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete CAM documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cam' 
  AND auth.role() = 'authenticated'
);
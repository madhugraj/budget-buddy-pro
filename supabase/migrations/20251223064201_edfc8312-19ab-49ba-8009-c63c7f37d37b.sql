-- Make the cam bucket public so MC users can download files
UPDATE storage.buckets 
SET public = true 
WHERE id = 'cam';
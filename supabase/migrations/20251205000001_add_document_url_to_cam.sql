-- Add document_url column to cam_tracking to store supporting document URLs
ALTER TABLE public.cam_tracking ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add comment
COMMENT ON COLUMN public.cam_tracking.document_url IS 'URL to supporting document uploaded by Lead user (quarterly/monthly)';

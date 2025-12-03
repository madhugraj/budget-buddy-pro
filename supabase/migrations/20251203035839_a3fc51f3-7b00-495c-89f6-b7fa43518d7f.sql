
-- Add new columns for dues tracking
ALTER TABLE public.cam_tracking 
ADD COLUMN IF NOT EXISTS dues_cleared_from_previous integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS advance_payments integer NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.cam_tracking.dues_cleared_from_previous IS 'Flats that cleared dues from previous quarters';
COMMENT ON COLUMN public.cam_tracking.advance_payments IS 'Flats that paid in advance for future quarters';

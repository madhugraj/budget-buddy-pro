-- Create office_assistant role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'office_assistant') THEN
        ALTER TYPE public.user_role ADD VALUE 'office_assistant';
    END IF;
END$$;

-- Fix orphan CAM data (quarterly records with no month)
-- Map them to the last month of the quarter so they appear in the UI
UPDATE public.cam_tracking SET month = 6 WHERE quarter = 1 AND month IS NULL;
UPDATE public.cam_tracking SET month = 9 WHERE quarter = 2 AND month IS NULL;
UPDATE public.cam_tracking SET month = 12 WHERE quarter = 3 AND month IS NULL;
UPDATE public.cam_tracking SET month = 3 WHERE quarter = 4 AND month IS NULL;

-- Also specific fix for FY transitions if needed
-- (e.g. Q4 is Jan-Mar, belongs to year X. Calendar year is X+1. 
-- The application stores 'year' as Fiscal Year usually? 
-- Let's check CAMTracking.tsx logic:
-- upsertData sets 'year' to data.year (which comes from state selectedYear).
-- So 'year' in DB is Fiscal Year.
-- 'month' should be calendar month 1, 2, 3.
-- So Q4 mappings above (to month 3) are correct.

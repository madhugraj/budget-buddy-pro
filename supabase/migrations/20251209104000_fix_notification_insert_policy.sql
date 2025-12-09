-- Relax notification insert policy to allow any authenticated user to send notifications
-- as long as they mark themselves as the creator. This fixes the issue where
-- Treasurers (or potentially Leads/others) fail to send alerts due to RLS.

DO $$
BEGIN
    -- Drop the restrictive policy if it exists
    DROP POLICY IF EXISTS "Treasurers can insert notifications" ON public.notifications;
    
    -- Create a more permissive policy
    CREATE POLICY "Authenticated users can insert notifications"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
      -- Allow insert if the user is authenticated and they claim authorship correctly
      auth.uid() = created_by
    );
END$$;

-- Allow treasurers to view everyone's roles (needed for sending notifications)
-- Use a policy name that likely doesn't conflict or is descriptive

DO $$
BEGIN
    DROP POLICY IF EXISTS "Treasurers can view all user roles" ON "public"."user_roles";
    
    CREATE POLICY "Treasurers can view all user roles"
    ON "public"."user_roles"
    FOR SELECT
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'treasurer')
    );
END$$;

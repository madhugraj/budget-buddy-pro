-- Add DELETE policy for treasurers on mc_users table
CREATE POLICY "Treasurers can delete MC users"
ON public.mc_users
FOR DELETE
USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Allow treasurers to permanently delete MC users
-- (Fixes: UI shows success toast but record remains because RLS prevents actual deletion)

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.mc_users ENABLE ROW LEVEL SECURITY;

-- Ensure role has table privileges
GRANT DELETE ON TABLE public.mc_users TO authenticated;

-- Replace policy (idempotent)
DROP POLICY IF EXISTS "Treasurers can delete MC users" ON public.mc_users;
CREATE POLICY "Treasurers can delete MC users"
ON public.mc_users
FOR DELETE
USING (has_role(auth.uid(), 'treasurer'::user_role));

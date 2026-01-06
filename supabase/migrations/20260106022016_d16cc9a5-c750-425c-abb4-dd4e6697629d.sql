-- Allow anonymous users to validate password reset tokens
CREATE POLICY "Anyone can validate password reset tokens" 
ON public.mc_users 
FOR SELECT 
USING (
  password_reset_token IS NOT NULL 
  AND password_reset_expires_at > now()
  AND password_hash IS NULL
);
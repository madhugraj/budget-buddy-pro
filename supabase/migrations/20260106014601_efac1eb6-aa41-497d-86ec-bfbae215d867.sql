-- Add columns for one-time password setup link
ALTER TABLE public.mc_users 
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_mc_users_password_reset_token 
ON public.mc_users(password_reset_token) 
WHERE password_reset_token IS NOT NULL;
-- Create mc_users table for Management Committee members
CREATE TABLE public.mc_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tower_no TEXT NOT NULL,
  unit_no TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  photo_url TEXT NOT NULL,
  interest_groups TEXT[] NOT NULL DEFAULT '{}',
  login_username TEXT UNIQUE,
  password_hash TEXT,
  temp_password TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mc_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can register (insert their own record)
CREATE POLICY "Anyone can register as MC"
ON public.mc_users
FOR INSERT
WITH CHECK (true);

-- MC users can view their own record
CREATE POLICY "MC users can view own record"
ON public.mc_users
FOR SELECT
USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR has_role(auth.uid(), 'treasurer'::user_role));

-- Treasurers can view all MC users
CREATE POLICY "Treasurers can view all MC users"
ON public.mc_users
FOR SELECT
USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Treasurers can update MC users (for approval)
CREATE POLICY "Treasurers can update MC users"
ON public.mc_users
FOR UPDATE
USING (has_role(auth.uid(), 'treasurer'::user_role));

-- MC users can update their own password
CREATE POLICY "MC users can update own password"
ON public.mc_users
FOR UPDATE
USING (login_username IS NOT NULL AND status = 'approved');

-- Add trigger for updated_at
CREATE TRIGGER update_mc_users_updated_at
BEFORE UPDATE ON public.mc_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for MC photos
INSERT INTO storage.buckets (id, name, public) VALUES ('mc-photos', 'mc-photos', true);

-- Storage policies for MC photos
CREATE POLICY "Anyone can upload MC photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'mc-photos');

CREATE POLICY "MC photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'mc-photos');

CREATE POLICY "Treasurers can delete MC photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'mc-photos' AND has_role(auth.uid(), 'treasurer'::user_role));
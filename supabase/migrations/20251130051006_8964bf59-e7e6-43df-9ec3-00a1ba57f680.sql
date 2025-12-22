-- Add bill_url column to petty_cash table
ALTER TABLE public.petty_cash ADD COLUMN IF NOT EXISTS bill_url TEXT;
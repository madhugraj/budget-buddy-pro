-- Add document_url column to cam_tracking table
ALTER TABLE public.cam_tracking ADD COLUMN IF NOT EXISTS document_url text;

-- Create sports_master table for one-time sport configuration
CREATE TABLE public.sports_master (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_name text NOT NULL,
    coach_trainer_academy text NOT NULL,
    location text NOT NULL,
    training_days text[] NOT NULL DEFAULT '{}',
    duration text NOT NULL,
    num_students integer NOT NULL DEFAULT 0,
    base_fare numeric NOT NULL DEFAULT 0,
    gst_amount numeric NOT NULL DEFAULT 0,
    total_amount numeric NOT NULL DEFAULT 0,
    agreement_url text,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create sports_income table for monthly income tracking
CREATE TABLE public.sports_income (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_id uuid NOT NULL REFERENCES public.sports_master(id) ON DELETE CASCADE,
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    fiscal_year text NOT NULL,
    amount_received numeric NOT NULL DEFAULT 0,
    gst_amount numeric NOT NULL DEFAULT 0,
    total_amount numeric NOT NULL DEFAULT 0,
    notes text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sports_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_income ENABLE ROW LEVEL SECURITY;

-- RLS policies for sports_master
CREATE POLICY "Anyone authenticated can view sports_master" 
ON public.sports_master FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Office assistant and treasurer can insert sports_master" 
ON public.sports_master FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer'));

CREATE POLICY "Office assistant and treasurer can update sports_master" 
ON public.sports_master FOR UPDATE 
USING (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer'));

CREATE POLICY "Treasurer can delete sports_master" 
ON public.sports_master FOR DELETE 
USING (has_role(auth.uid(), 'treasurer'));

-- RLS policies for sports_income
CREATE POLICY "Anyone authenticated can view sports_income" 
ON public.sports_income FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Office assistant can insert sports_income" 
ON public.sports_income FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer'));

CREATE POLICY "Office assistant and treasurer can update sports_income" 
ON public.sports_income FOR UPDATE 
USING (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer') OR has_role(auth.uid(), 'accountant'));

CREATE POLICY "Treasurer can delete sports_income" 
ON public.sports_income FOR DELETE 
USING (has_role(auth.uid(), 'treasurer'));

-- Create updated_at triggers
CREATE TRIGGER update_sports_master_updated_at
    BEFORE UPDATE ON public.sports_master
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_sports_income_updated_at
    BEFORE UPDATE ON public.sports_income
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for agreements if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agreements', 'agreements', true)
ON CONFLICT (id) DO NOTHING;
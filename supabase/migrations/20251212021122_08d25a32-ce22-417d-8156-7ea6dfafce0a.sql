-- =============================================
-- SAVINGS MODULE - COMPREHENSIVE INVESTMENT TRACKING
-- =============================================

-- Main savings/investment records table
CREATE TABLE public.savings_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_type TEXT NOT NULL CHECK (investment_type IN ('FD', 'RD', 'Mutual_Fund', 'Bonds', 'Other')),
  investment_name TEXT NOT NULL,
  bank_institution TEXT NOT NULL,
  account_number TEXT,
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC, -- annual percentage for FD/RD/Bonds
  start_date DATE NOT NULL,
  maturity_date DATE, -- for FD/RD/Bonds
  duration_months INTEGER, -- for RD
  expected_maturity_amount NUMERIC,
  current_value NUMERIC NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'active' CHECK (current_status IN ('active', 'matured', 'closed', 'renewed', 'partially_withdrawn')),
  document_url TEXT,
  notes TEXT,
  fiscal_year TEXT NOT NULL,
  created_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'correction_pending', 'correction_approved')),
  correction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly tracking of investment lifecycle events
CREATE TABLE public.savings_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_id UUID NOT NULL REFERENCES savings_master(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  fiscal_year TEXT NOT NULL,
  tracking_date DATE NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('status_check', 'interest_credit', 'renewal', 'closure', 'partial_withdrawal', 'top_up', 'maturity', 'value_update')),
  amount NUMERIC DEFAULT 0, -- amount involved (interest, withdrawal, top-up)
  value_after_action NUMERIC NOT NULL, -- current value after this action
  new_maturity_date DATE, -- if renewed
  new_interest_rate NUMERIC, -- if renewed with different rate
  previous_status TEXT,
  new_status TEXT,
  document_url TEXT,
  notes TEXT,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'correction_pending', 'correction_approved')),
  correction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.savings_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for savings_master
CREATE POLICY "Anyone authenticated can view savings master"
ON public.savings_master FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountants can insert savings master"
ON public.savings_master FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::user_role) OR has_role(auth.uid(), 'treasurer'::user_role));

CREATE POLICY "Accountants can update own draft savings"
ON public.savings_master FOR UPDATE
USING (
  (auth.uid() = created_by AND status IN ('draft', 'rejected', 'correction_approved')) 
  OR has_role(auth.uid(), 'treasurer'::user_role)
);

CREATE POLICY "Treasurers can delete savings master"
ON public.savings_master FOR DELETE
USING (has_role(auth.uid(), 'treasurer'::user_role));

-- RLS Policies for savings_tracking
CREATE POLICY "Anyone authenticated can view savings tracking"
ON public.savings_tracking FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountants can insert savings tracking"
ON public.savings_tracking FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::user_role) OR has_role(auth.uid(), 'treasurer'::user_role));

CREATE POLICY "Accountants can update own draft tracking"
ON public.savings_tracking FOR UPDATE
USING (
  (auth.uid() = submitted_by AND status IN ('draft', 'rejected', 'correction_approved'))
  OR has_role(auth.uid(), 'treasurer'::user_role)
);

CREATE POLICY "Treasurers can delete savings tracking"
ON public.savings_tracking FOR DELETE
USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Indexes for performance
CREATE INDEX idx_savings_master_fiscal_year ON public.savings_master(fiscal_year);
CREATE INDEX idx_savings_master_status ON public.savings_master(status);
CREATE INDEX idx_savings_master_current_status ON public.savings_master(current_status);
CREATE INDEX idx_savings_master_investment_type ON public.savings_master(investment_type);
CREATE INDEX idx_savings_tracking_savings_id ON public.savings_tracking(savings_id);
CREATE INDEX idx_savings_tracking_month_year ON public.savings_tracking(month, fiscal_year);
CREATE INDEX idx_savings_tracking_status ON public.savings_tracking(status);

-- Trigger for updated_at
CREATE TRIGGER update_savings_master_updated_at
BEFORE UPDATE ON public.savings_master
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_savings_tracking_updated_at
BEFORE UPDATE ON public.savings_tracking
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for savings documents
INSERT INTO storage.buckets (id, name, public) VALUES ('savings', 'savings', false);

-- Storage policies for savings bucket
CREATE POLICY "Authenticated users can view savings files"
ON storage.objects FOR SELECT
USING (bucket_id = 'savings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Accountants and treasurers can upload savings files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'savings' 
  AND (has_role(auth.uid(), 'accountant'::user_role) OR has_role(auth.uid(), 'treasurer'::user_role))
);

CREATE POLICY "Accountants and treasurers can update savings files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'savings' 
  AND (has_role(auth.uid(), 'accountant'::user_role) OR has_role(auth.uid(), 'treasurer'::user_role))
);

CREATE POLICY "Treasurers can delete savings files"
ON storage.objects FOR DELETE
USING (bucket_id = 'savings' AND has_role(auth.uid(), 'treasurer'::user_role));
-- Create income categories table to store all income sources
CREATE TABLE public.income_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name TEXT NOT NULL,
  subcategory_name TEXT,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create income budget table for annual/monthly budgeted amounts
CREATE TABLE public.income_budget (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.income_categories(id) ON DELETE CASCADE,
  budgeted_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fiscal_year, category_id)
);

-- Create income actuals table for monthly income received
CREATE TABLE public.income_actuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  category_id UUID NOT NULL REFERENCES public.income_categories(id) ON DELETE CASCADE,
  actual_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fiscal_year, month, category_id)
);

-- Enable RLS
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_actuals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for income_categories
CREATE POLICY "Anyone can view income categories"
  ON public.income_categories FOR SELECT
  USING (true);

CREATE POLICY "Only treasurers can manage income categories"
  ON public.income_categories FOR ALL
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- RLS Policies for income_budget
CREATE POLICY "Anyone can view income budget"
  ON public.income_budget FOR SELECT
  USING (true);

CREATE POLICY "Only treasurers can manage income budget"
  ON public.income_budget FOR ALL
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- RLS Policies for income_actuals
CREATE POLICY "Anyone can view income actuals"
  ON public.income_actuals FOR SELECT
  USING (true);

CREATE POLICY "Accountants can insert income actuals"
  ON public.income_actuals FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Accountants can update their own income actuals"
  ON public.income_actuals FOR UPDATE
  USING (auth.uid() = recorded_by);

CREATE POLICY "Treasurers can manage all income actuals"
  ON public.income_actuals FOR ALL
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Create triggers for updated_at
CREATE TRIGGER update_income_categories_updated_at
  BEFORE UPDATE ON public.income_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_income_budget_updated_at
  BEFORE UPDATE ON public.income_budget
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_income_actuals_updated_at
  BEFORE UPDATE ON public.income_actuals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert default income categories based on the requirements
INSERT INTO public.income_categories (category_name, subcategory_name, display_order) VALUES
  ('CAM with GST', NULL, 1),
  ('CAM without GST', NULL, 2),
  ('Commercial Letout Income', 'INDUS TOWER - RENTAL INCOME', 3),
  ('Commercial Letout Income', 'INDUS TOWER - EB INCOME', 4),
  ('Commercial Letout Income', 'HDFC TOWER - RENTAL INCOME', 5),
  ('Commercial Letout Income', 'HDFC TOWER - EB INCOME', 6),
  ('Commercial Letout Income', 'AAVIN BOOTH - RENTAL INCOME', 7),
  ('Commercial Letout Income', 'AAVIN BOOTH - EB INCOME', 8),
  ('Commercial Letout Income', 'VEDHIKA FOODS - RENTAL INCOME', 9),
  ('Commercial Letout Income', 'VEDHIKA FOODS - EB INCOME', 10),
  ('Interest Earned - Savings Account', 'INTEREST INCOME - IOB', 11),
  ('Interest Earned - Savings Account', 'INTEREST INCOME - ICICI', 12),
  ('Interest Earned - Savings Account', 'Corpus Income', 13),
  ('Events and Activities', 'Sports & Training', 14),
  ('Events and Activities', 'Stalls', 15),
  ('Rental from Halls', 'Gold Hall', 16),
  ('Rental from Halls', 'Silver Hall', 17),
  ('Rental from Halls', 'Platinum Hall', 18),
  ('Others', 'Miscellaneous Income', 19);
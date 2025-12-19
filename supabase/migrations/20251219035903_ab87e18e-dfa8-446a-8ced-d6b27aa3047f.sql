-- Allow unauthenticated (public) read access for dashboard-only tables
-- NOTE: This matches the requirement "no sign-in needed for dashboard view".

-- Budget master
ALTER TABLE public.budget_master ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='budget_master' AND policyname='Public can read budget_master'
  ) THEN
    CREATE POLICY "Public can read budget_master"
    ON public.budget_master
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- Expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='expenses' AND policyname='Public can read expenses'
  ) THEN
    CREATE POLICY "Public can read expenses"
    ON public.expenses
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- Income actuals
ALTER TABLE public.income_actuals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='income_actuals' AND policyname='Public can read income_actuals'
  ) THEN
    CREATE POLICY "Public can read income_actuals"
    ON public.income_actuals
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- CAM tracking
ALTER TABLE public.cam_tracking ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cam_tracking' AND policyname='Public can read cam_tracking'
  ) THEN
    CREATE POLICY "Public can read cam_tracking"
    ON public.cam_tracking
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- Petty cash
ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='petty_cash' AND policyname='Public can read petty_cash'
  ) THEN
    CREATE POLICY "Public can read petty_cash"
    ON public.petty_cash
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- Savings master
ALTER TABLE public.savings_master ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='savings_master' AND policyname='Public can read savings_master'
  ) THEN
    CREATE POLICY "Public can read savings_master"
    ON public.savings_master
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;
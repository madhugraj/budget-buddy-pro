-- Tighten SELECT RLS policies so data is not publicly readable via anon key
-- Ensure only authenticated users (any role) can read these tables

-- budget_master: previously `USING (true)`
ALTER POLICY "Anyone can view budget master" ON public.budget_master
  USING (auth.uid() IS NOT NULL);

-- income_budget: previously `USING (true)`
ALTER POLICY "Anyone can view income budget" ON public.income_budget
  USING (auth.uid() IS NOT NULL);

-- income_categories: previously `USING (true)`
ALTER POLICY "Anyone can view income categories" ON public.income_categories
  USING (auth.uid() IS NOT NULL);

-- expenses: previously `USING (true)`
ALTER POLICY "Anyone can view expenses" ON public.expenses
  USING (auth.uid() IS NOT NULL);

-- historical_spending: previously `USING (true)`
ALTER POLICY "Authenticated users can view historical spending" ON public.historical_spending
  USING (auth.uid() IS NOT NULL);

-- cam_tracking: previously `USING (true)`
ALTER POLICY "Authenticated users can view CAM data" ON public.cam_tracking
  USING (auth.uid() IS NOT NULL);

-- petty_cash: previously `USING (true)`
ALTER POLICY "Authenticated users can view petty cash" ON public.petty_cash
  USING (auth.uid() IS NOT NULL);

-- audit_logs: previously `USING (true)`
ALTER POLICY "Authenticated users can view audit logs" ON public.audit_logs
  USING (auth.uid() IS NOT NULL);

-- Allow public read access to remaining dashboard tables
-- Missing tables: budget_master, expenses, savings_master

-- budget_master
DROP POLICY IF EXISTS "Anyone can view budget master" ON budget_master;
CREATE POLICY "Anyone can view budget master"
ON budget_master FOR SELECT
TO anon, authenticated
USING (true);

-- expenses
DROP POLICY IF EXISTS "Anyone can view expenses" ON expenses;
CREATE POLICY "Anyone can view expenses"
ON expenses FOR SELECT
TO anon, authenticated
USING (true);

-- savings_master
DROP POLICY IF EXISTS "Anyone can view savings master" ON savings_master;
CREATE POLICY "Anyone can view savings master"
ON savings_master FOR SELECT
TO anon, authenticated
USING (true);

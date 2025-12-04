-- Allow public read access to dashboard data (income, CAM, petty cash)
-- This enables the dashboard to be viewed without authentication

-- Update income_actuals policy to allow public read
DROP POLICY IF EXISTS "Users can view income actuals" ON income_actuals;

CREATE POLICY "Anyone can view income actuals" 
ON income_actuals 
FOR SELECT 
USING (true);

-- Update cam_tracking policy to allow public read
DROP POLICY IF EXISTS "Anyone can view CAM tracking" ON cam_tracking;

CREATE POLICY "Anyone can view CAM tracking" 
ON cam_tracking 
FOR SELECT 
USING (true);

-- Update petty_cash policy to allow public read
DROP POLICY IF EXISTS "Anyone can view petty cash" ON petty_cash;

CREATE POLICY "Anyone can view petty cash" 
ON petty_cash 
FOR SELECT 
USING (true);

-- Ensure income_budget and income_categories are also publicly readable
DROP POLICY IF EXISTS "Anyone can view income budget" ON income_budget;

CREATE POLICY "Anyone can view income budget" 
ON income_budget 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Anyone can view income categories" ON income_categories;

CREATE POLICY "Anyone can view income categories" 
ON income_categories 
FOR SELECT 
USING (true);

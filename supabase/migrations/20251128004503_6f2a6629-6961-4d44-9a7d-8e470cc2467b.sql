-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Accountants can insert income actuals" ON public.income_actuals;
DROP POLICY IF EXISTS "Accountants can update their own income actuals" ON public.income_actuals;

-- Create more flexible INSERT policy for authenticated users
CREATE POLICY "Authenticated users can insert income actuals"
ON public.income_actuals
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND recorded_by = auth.uid()
);

-- Create UPDATE policy that allows accountants to update any pending/rejected income records
-- and their own records regardless of status
CREATE POLICY "Users can update income actuals"
ON public.income_actuals
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    auth.uid() = recorded_by 
    OR status IN ('pending', 'rejected')
  )
)
WITH CHECK (
  recorded_by = auth.uid()
);
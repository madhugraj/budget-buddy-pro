-- Fix RLS policy for Accountants to allow updating income_actuals
-- Previously, they could only update records they created (recorded_by = auth.uid()).
-- This blocked 'upsert' operations when modifying existing records created by others.

DROP POLICY IF EXISTS "Accountants can update their own income actuals" ON income_actuals;

CREATE POLICY "Accountants can update income actuals"
ON income_actuals
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'accountant')
);

-- Also ensure they can insert (already covered by 20251127032301... but let's be safe and explicit about role if needed, 
-- though the previous one checked recorded_by = auth.uid() which is fine for new inserts).
-- The previous INSERT policy:
-- CREATE POLICY "Accountants can insert income actuals" ... WITH CHECK (auth.uid() IS NOT NULL AND (recorded_by = auth.uid()));
-- This is fine for INSERT. The issue was UPDATE during upsert.

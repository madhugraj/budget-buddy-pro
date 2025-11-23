-- Create trigger to automatically log expense actions
CREATE TRIGGER log_expense_changes
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_expense_action();
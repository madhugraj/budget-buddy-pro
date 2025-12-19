import { ExportExpenses } from '@/components/ExportExpenses';
import { ExportIncome } from '@/components/ExportIncome';
import { ExportGST } from '@/components/ExportGST';
import { ExportBudget } from '@/components/ExportBudget';
import { ExportPettyCash } from '@/components/ExportPettyCash';
import { ExportCAM } from '@/components/ExportCAM';
import { GSTR1Filing } from '@/components/GSTR1Filing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

export default function Reports() {
  const { userRole } = useAuth();
  const mcUser = localStorage.getItem('mc_user');
  const isMC = !!mcUser;

  // Role-based tab access:
  // Treasurer: All reports (Expense, Income, GST, Budget, Petty Cash, CAM)
  // Accountant: Income, Expense (no budget), Petty Cash, GST
  // Lead: Petty Cash and CAM reports
  // MC: All reports (View only)

  const canAccessExpense = userRole === 'treasurer' || userRole === 'accountant' || isMC;
  const canAccessIncome = userRole === 'treasurer' || userRole === 'accountant' || isMC;
  const canAccessGST = userRole === 'treasurer' || userRole === 'accountant' || isMC;
  const canAccessBudget = userRole === 'treasurer' || isMC;
  const canAccessPettyCash = true; // All roles can access petty cash
  const canAccessCAM = userRole === 'treasurer' || userRole === 'lead' || isMC;

  // Determine default tab based on role
  const getDefaultTab = () => {
    if (canAccessExpense) return 'expense';
    if (canAccessIncome) return 'income';
    if (canAccessCAM && userRole === 'lead') return 'cam';
    if (canAccessPettyCash) return 'petty-cash';
    return 'expense';
  };

  // Count visible tabs for grid
  const visibleTabCount = [canAccessExpense, canAccessIncome, canAccessGST, canAccessGST, canAccessBudget, canAccessPettyCash, canAccessCAM].filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Reports & Export</h1>
        <p className="text-muted-foreground mt-2">
          Export and analyze financial data across different categories
        </p>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="w-full">
        <TabsList className={`grid w-full h-auto gap-4 md:gap-0`} style={{
          gridTemplateColumns: `repeat(${Math.min(visibleTabCount, 4)}, 1fr)`,
          // For mobile/wrapping, we might want a different layout, but for now matching existing style
        }}>
          {canAccessExpense && <TabsTrigger value="expense">Expense</TabsTrigger>}
          {canAccessIncome && <TabsTrigger value="income">Income</TabsTrigger>}
          {canAccessGST && <TabsTrigger value="gst">GST Analytics</TabsTrigger>}
          {canAccessGST && <TabsTrigger value="gstr1">GSTR-1 Filing</TabsTrigger>}
          {canAccessBudget && <TabsTrigger value="budget">Budget</TabsTrigger>}
          {canAccessPettyCash && <TabsTrigger value="petty-cash">Petty Cash</TabsTrigger>}
          {canAccessCAM && <TabsTrigger value="cam">CAM</TabsTrigger>}
        </TabsList>

        {canAccessExpense && (
          <TabsContent value="expense" className="mt-6">
            <ExportExpenses />
          </TabsContent>
        )}

        {canAccessIncome && (
          <TabsContent value="income" className="mt-6">
            <ExportIncome />
          </TabsContent>
        )}

        {canAccessGST && (
          <TabsContent value="gst" className="mt-6">
            <ExportGST />
          </TabsContent>
        )}

        {canAccessGST && (
          <TabsContent value="gstr1" className="mt-6">
            <GSTR1Filing />
          </TabsContent>
        )}

        {canAccessBudget && (
          <TabsContent value="budget" className="mt-6">
            <ExportBudget />
          </TabsContent>
        )}

        {canAccessPettyCash && (
          <TabsContent value="petty-cash" className="mt-6">
            <ExportPettyCash />
          </TabsContent>
        )}

        {canAccessCAM && (
          <TabsContent value="cam" className="mt-6">
            <ExportCAM />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

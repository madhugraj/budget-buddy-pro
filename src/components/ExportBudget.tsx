import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { BarChart3 } from 'lucide-react';

export function ExportBudget() {
    const isMC = !!localStorage.getItem('mc_user');
    const [loading, setLoading] = useState(false);
    const [viewExpenseData, setViewExpenseData] = useState<any[]>([]);
    const [showExpenseView, setShowExpenseView] = useState(false);
    const [viewIncomeData, setViewIncomeData] = useState<any[]>([]);
    const [showIncomeView, setShowIncomeView] = useState(false);
    const { toast } = useToast();

    // --- Expense Logic ---

    const fetchExpenseBudget = async () => {
        const { data, error } = await supabase
            .from('budget_master')
            .select('category, item_name, annual_budget')
            .eq('fiscal_year', 'FY25-26')
            .order('category');

        if (error) throw error;

        return (data || []).map((b: any) => ({
            Category: b.category || 'N/A',
            Item: b.item_name || 'N/A',
            Budget: Number(b.annual_budget) || 0,
        }));
    };

    const handleViewExpense = async () => {
        setLoading(true);
        try {
            const data = await fetchExpenseBudget();
            setViewExpenseData(data);
            setShowExpenseView(true);
            toast({ title: 'Expense Budget loaded', description: `Showing ${data.length} items` });
        } catch (error: any) {
            toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportExpensePDF = async () => {
        setLoading(true);
        try {
            const data = await fetchExpenseBudget();
            const total = data.reduce((sum, d) => sum + d.Budget, 0);
            const byCategory: Record<string, number> = {};
            data.forEach((d: any) => {
                const cat = d.Category || 'Uncategorized';
                byCategory[cat] = (byCategory[cat] || 0) + Number(d.Budget);
            });

            const doc = new jsPDF('portrait');
            doc.setFontSize(20);
            doc.setTextColor(220, 38, 38); // Red
            doc.text('Expense Budget Report', 14, 20);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

            doc.setFontSize(14);
            doc.text('Overview', 14, 40);

            autoTable(doc, {
                startY: 44,
                head: [['Description', 'Amount']],
                body: [['Total Expense Budget', `₹${total.toLocaleString('en-IN')}`]],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [220, 38, 38] },
                columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
            });

            const yPos = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.text('Breakdown by Category', 14, yPos);

            const rows = Object.entries(byCategory).map(([cat, amount]) => [
                cat,
                `₹${amount.toLocaleString('en-IN')}`
            ]);

            autoTable(doc, {
                startY: yPos + 4,
                head: [['Category', 'Amount']],
                body: rows,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [220, 38, 38] },
                columnStyles: { 1: { halign: 'right' } },
            });

            doc.save(`expense_budget_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'PDF exported', description: 'Expense budget exported' });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportExpense = async (formatType: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchExpenseBudget();
            if (formatType === 'excel') {
                exportToExcel(data, 'expense_budget');
            } else {
                exportToCSV(data, 'expense_budget');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    // --- Income Logic ---

    const fetchIncomeBudget = async () => {
        const { data, error } = await supabase
            .from('income_budget')
            .select(`
                budgeted_amount,
                income_categories (
                    category_name,
                    subcategory_name
                )
            `)
            .eq('fiscal_year', 'FY25-26');

        if (error) throw error;

        return (data || []).map((b: any) => ({
            Category: b.income_categories?.category_name || 'N/A',
            Item: b.income_categories?.subcategory_name || '-',
            Budget: Number(b.budgeted_amount) || 0,
        }));
    };

    const handleViewIncome = async () => {
        setLoading(true);
        try {
            const data = await fetchIncomeBudget();
            setViewIncomeData(data);
            setShowIncomeView(true);
            toast({ title: 'Income Budget loaded', description: `Showing ${data.length} items` });
        } catch (error: any) {
            toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportIncomePDF = async () => {
        setLoading(true);
        try {
            const data = await fetchIncomeBudget();
            const total = data.reduce((sum, d) => sum + d.Budget, 0);
            const byCategory: Record<string, number> = {};
            data.forEach((d: any) => {
                const cat = d.Category || 'Uncategorized';
                byCategory[cat] = (byCategory[cat] || 0) + Number(d.Budget);
            });

            const doc = new jsPDF('portrait');
            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129); // Green
            doc.text('Income Budget Report', 14, 20);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

            doc.setFontSize(14);
            doc.text('Overview', 14, 40);

            autoTable(doc, {
                startY: 44,
                head: [['Description', 'Amount']],
                body: [['Total Income Budget', `₹${total.toLocaleString('en-IN')}`]],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
            });

            const yPos = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.text('Breakdown by Category', 14, yPos);

            const rows = Object.entries(byCategory).map(([cat, amount]) => [
                cat,
                `₹${amount.toLocaleString('en-IN')}`
            ]);

            autoTable(doc, {
                startY: yPos + 4,
                head: [['Category', 'Amount']],
                body: rows,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: { 1: { halign: 'right' } },
            });

            doc.save(`income_budget_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'PDF exported', description: 'Income budget exported' });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportIncome = async (formatType: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchIncomeBudget();
            if (formatType === 'excel') {
                exportToExcel(data, 'income_budget');
            } else {
                exportToCSV(data, 'income_budget');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Expense Budget Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-red-600" />
                        <CardTitle>Expense Budget</CardTitle>
                    </div>
                    <CardDescription>Download planned expense budget</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <Button onClick={handleViewExpense} disabled={loading} variant="secondary" className="flex-1 min-w-[150px]">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                            View
                        </Button>
                        {!isMC && (
                            <>
                                <Button onClick={handleExportExpensePDF} disabled={loading} variant="default" className="flex-1 min-w-[150px] bg-red-600 hover:bg-red-700">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                                    PDF
                                </Button>
                                <Button onClick={() => handleExportExpense('excel')} disabled={loading} variant="outline" className="flex-1 min-w-[150px]">
                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                                </Button>
                                <Button onClick={() => handleExportExpense('csv')} disabled={loading} variant="outline" className="flex-1 min-w-[150px]">
                                    <FileText className="mr-2 h-4 w-4" /> CSV
                                </Button>
                            </>
                        )}
                    </div>
                    {showExpenseView && viewExpenseData.length > 0 && (
                        <Card className="mt-6 border-red-100">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Expense Budget ({viewExpenseData.length} items)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <table className="w-full border text-sm">
                                    <thead className="bg-red-50">
                                        <tr>
                                            <th className="p-2 text-left">Category</th>
                                            <th className="p-2 text-left">Item</th>
                                            <th className="p-2 text-right">Budget (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewExpenseData.map((row, idx) => (
                                            <tr key={idx} className="border-t">
                                                <td className="p-2">{row.Category}</td>
                                                <td className="p-2">{row.Item}</td>
                                                <td className="p-2 text-right">₹{row.Budget.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-red-50 font-bold border-t-2 border-red-200">
                                            <td colSpan={2} className="p-2 text-right">Total Expense Budget</td>
                                            <td className="p-2 text-right">
                                                ₹{viewExpenseData.reduce((sum, item) => sum + item.Budget, 0).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>

            {/* Income Budget Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-green-600" />
                        <CardTitle>Income Budget</CardTitle>
                    </div>
                    <CardDescription>Download planned income budget</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <Button onClick={handleViewIncome} disabled={loading} variant="secondary" className="flex-1 min-w-[150px]">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                            View
                        </Button>
                        {!isMC && (
                            <>
                                <Button onClick={handleExportIncomePDF} disabled={loading} variant="default" className="flex-1 min-w-[150px] bg-green-600 hover:bg-green-700">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                                    PDF
                                </Button>
                                <Button onClick={() => handleExportIncome('excel')} disabled={loading} variant="outline" className="flex-1 min-w-[150px]">
                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                                </Button>
                                <Button onClick={() => handleExportIncome('csv')} disabled={loading} variant="outline" className="flex-1 min-w-[150px]">
                                    <FileText className="mr-2 h-4 w-4" /> CSV
                                </Button>
                            </>
                        )}
                    </div>
                    {showIncomeView && viewIncomeData.length > 0 && (
                        <Card className="mt-6 border-green-100">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Income Budget ({viewIncomeData.length} items)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <table className="w-full border text-sm">
                                    <thead className="bg-green-50">
                                        <tr>
                                            <th className="p-2 text-left">Category</th>
                                            <th className="p-2 text-left">Item</th>
                                            <th className="p-2 text-right">Budget (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewIncomeData.map((row, idx) => (
                                            <tr key={idx} className="border-t">
                                                <td className="p-2">{row.Category}</td>
                                                <td className="p-2">{row.Item}</td>
                                                <td className="p-2 text-right">₹{row.Budget.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-green-50 font-bold border-t-2 border-green-200">
                                            <td colSpan={2} className="p-2 text-right">Total Income Budget</td>
                                            <td className="p-2 text-right">
                                                ₹{viewIncomeData.reduce((sum, item) => sum + item.Budget, 0).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

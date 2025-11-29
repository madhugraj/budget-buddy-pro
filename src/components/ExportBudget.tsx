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
    const [loading, setLoading] = useState(false);
    const [viewData, setViewData] = useState<any[]>([]);
    const [showView, setShowView] = useState(false);
    const { toast } = useToast();

    const fetchBudgetData = async () => {
        const { data, error } = await supabase
            .from('budget_master')
            .select('category, item_name, annual_budget')
            .order('category');
        if (error) throw error;
        return (data || []).map((b: any) => ({
            Category: b.category || 'N/A',
            Item: b.item_name || 'N/A',
            Budget: Number(b.annual_budget) || 0,
        }));
    };

    const handleView = async () => {
        setLoading(true);
        try {
            const data = await fetchBudgetData();
            setViewData(data);
            setShowView(true);
            toast({ title: 'Budget loaded', description: `Showing ${data.length} budget items` });
        } catch (error: any) {
            toast({ title: 'Failed to load budget', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportSummaryPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchBudgetData();

            const totalBudget = data.reduce((sum: number, d: any) => sum + Number(d.Budget), 0);

            const byCategory: Record<string, number> = {};
            data.forEach((d: any) => {
                const cat = d.Category || 'Uncategorized';
                byCategory[cat] = (byCategory[cat] || 0) + Number(d.Budget);
            });

            const doc = new jsPDF('portrait');

            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129);
            doc.text('Budget Summary Report', 14, 20);
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

            doc.setFontSize(14);
            doc.text('Overview', 14, 40);

            autoTable(doc, {
                startY: 44,
                head: [['Description', 'Amount']],
                body: [
                    ['Total Annual Budget', `₹${totalBudget.toLocaleString('en-IN')}`],
                ],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: { 0: { fontStyle: 'bold' } },
            });

            let yPos = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.text('Budget by Category', 14, yPos);

            const categoryData = Object.entries(byCategory).map(([cat, amount]) => [
                cat,
                `₹${amount.toLocaleString('en-IN')}`
            ]);

            autoTable(doc, {
                startY: yPos + 4,
                head: [['Category', 'Budget Amount']],
                body: categoryData,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [79, 70, 229] },
            });

            doc.save(`budget_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'Summary PDF exported', description: 'Dashboard-style summary exported' });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (formatType: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchBudgetData();
            if (formatType === 'excel') {
                exportToExcel(data, 'budget_report');
            } else {
                exportToCSV(data, 'budget_report');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported as ${formatType.toUpperCase()}` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-primary" />
                    <CardTitle>Export Budget (Income & Expense)</CardTitle>
                </div>
                <CardDescription>Download planned budget for income and expenses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleView} disabled={loading} variant="secondary" className="flex-1 min-w-[200px]">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    View Budget
                </Button>
                <Button onClick={handleExportSummaryPDF} disabled={loading} variant="default" className="flex-1 min-w-[200px]">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                    Export Summary PDF
                </Button>
                <div className="flex gap-3 flex-wrap">
                    <Button onClick={() => handleExport('excel')} disabled={loading} className="flex-1 min-w-[200px]">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                        Export to Excel
                    </Button>
                    <Button onClick={() => handleExport('csv')} disabled={loading} variant="outline" className="flex-1 min-w-[200px]">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Export to CSV
                    </Button>
                </div>
                {showView && viewData.length > 0 && (
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Budget ({viewData.length} entries)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <table className="w-full border">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="p-2 text-left">Category</th>
                                        <th className="p-2 text-left">Item</th>
                                        <th className="p-2 text-right">Budget (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewData.map((row, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="p-2">{row.Category}</td>
                                            <td className="p-2">{row.Item}</td>
                                            <td className="p-2 text-right">₹{row.Budget.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}
            </CardContent>
        </Card>
    );
}

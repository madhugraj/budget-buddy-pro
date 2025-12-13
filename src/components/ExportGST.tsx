import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, FileSpreadsheet, FileText, Download, Eye, ChevronDown } from 'lucide-react';
import { format, getMonth, getYear, parseISO } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface GSTRow {
    type: 'Income' | 'Expense';
    category: string;
    item: string;
    gst: number;
    date: string;
    baseAmount: number;
    totalAmount: number;
}

export function ExportGST() {
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [viewData, setViewData] = useState<GSTRow[]>([]);
    const [showView, setShowView] = useState(false);
    const [groupBy, setGroupBy] = useState<string>('none');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const { toast } = useToast();

    // Fetch combined GST data with corrected logic - filter out 0 GST entries
    const fetchGSTData = async (): Promise<GSTRow[]> => {
        // Expense GST - use expense_date for filtering
        let expenseQuery = supabase
            .from('expenses')
            .select('id, amount, gst_amount, expense_date, budget_master!expenses_budget_master_id_fkey (category, item_name)')
            .eq('status', 'approved')
            .gt('gst_amount', 0); // Filter out 0 GST

        if (dateFrom) {
            const fromStr = format(dateFrom, 'yyyy-MM-dd');
            expenseQuery = expenseQuery.gte('expense_date', fromStr);
        }
        if (dateTo) {
            const toStr = format(dateTo, 'yyyy-MM-dd');
            expenseQuery = expenseQuery.lte('expense_date', toStr);
        }

        const { data: expenseData, error: expenseError } = await expenseQuery;
        if (expenseError) throw expenseError;

        // Income GST - fetch all and filter by month/fiscal_year
        const { data: incomeData, error: incomeError } = await supabase
            .from('income_actuals')
            .select('id, actual_amount, gst_amount, month, fiscal_year, income_categories!income_actuals_category_id_fkey (category_name, subcategory_name)')
            .eq('status', 'approved')
            .gt('gst_amount', 0); // Filter out 0 GST

        if (incomeError) throw incomeError;

        // Filter income by date range using month and fiscal_year
        const filteredIncome = (incomeData || []).filter((i: any) => {
            const fiscalYear = i.fiscal_year;
            const month = i.month;
            
            let year: number;
            if (fiscalYear === 'FY25-26') {
                year = month >= 4 ? 2025 : 2026;
            } else if (fiscalYear === 'FY24-25') {
                year = month >= 4 ? 2024 : 2025;
            } else {
                year = 2025;
            }
            
            const incomeDate = new Date(year, month - 1, 1);
            
            if (dateFrom && incomeDate < dateFrom) return false;
            if (dateTo && incomeDate > dateTo) return false;
            return true;
        });

        const expenseRows: GSTRow[] = (expenseData || []).map((e: any) => {
            const baseAmount = Number(e.amount) || 0;
            const gstAmount = Number(e.gst_amount) || 0;
            return {
                type: 'Expense' as const,
                category: e.budget_master?.category || 'N/A',
                item: e.budget_master?.item_name || 'N/A',
                gst: gstAmount,
                baseAmount: baseAmount,
                totalAmount: baseAmount + gstAmount,
                date: format(new Date(e.expense_date), 'dd/MM/yyyy'),
            };
        });

        const incomeRows: GSTRow[] = filteredIncome.map((i: any) => {
            const baseAmount = Number(i.actual_amount) || 0;
            const gstAmount = Number(i.gst_amount) || 0;
            
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[i.month - 1] || 'N/A';
            const fiscalYear = i.fiscal_year?.replace('FY', '20') || '';
            
            return {
                type: 'Income' as const,
                category: i.income_categories?.category_name || 'N/A',
                item: i.income_categories?.subcategory_name || '-',
                gst: gstAmount,
                baseAmount: baseAmount,
                totalAmount: baseAmount + gstAmount,
                date: `${monthName} ${fiscalYear.split('-')[0]}`,
            };
        });

        return [...expenseRows, ...incomeRows];
    };

    const handleView = async () => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            setViewData(data);
            setShowView(true);
            toast({ title: 'GST report loaded', description: `${data.length} records with GST > 0` });
        } catch (error: any) {
            toast({ title: 'Failed to load GST report', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            doc.text('Combined GST Report', 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);
            if (dateFrom || dateTo) {
                doc.text(
                    `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
                    14,
                    29,
                );
            }
            const tableData = data.map((row) => [
                row.date,
                row.type,
                row.category,
                row.item,
                `₹${row.baseAmount.toLocaleString('en-IN')}`,
                `₹${row.gst.toLocaleString('en-IN')}`,
                `₹${row.totalAmount.toLocaleString('en-IN')}`,
            ]);
            autoTable(doc, {
                startY: 35,
                head: [['Date', 'Type', 'Category', 'Item/Subcategory', 'Base Amount', 'GST', 'Total']],
                body: tableData,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [100, 116, 139] },
            });
            doc.save(`gst_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'PDF exported', description: `${data.length} records exported` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportSummaryPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            
            const expenseData = data.filter(d => d.type === 'Expense');
            const incomeData = data.filter(d => d.type === 'Income');
            
            const totalExpenseGST = expenseData.reduce((sum, d) => sum + d.gst, 0);
            const totalIncomeGST = incomeData.reduce((sum, d) => sum + d.gst, 0);
            const totalExpenseBase = expenseData.reduce((sum, d) => sum + d.baseAmount, 0);
            const totalIncomeBase = incomeData.reduce((sum, d) => sum + d.baseAmount, 0);
            const netGST = totalIncomeGST - totalExpenseGST;
            
            const expenseByCategory: Record<string, { base: number; gst: number; total: number }> = {};
            expenseData.forEach(d => {
                if (!expenseByCategory[d.category]) {
                    expenseByCategory[d.category] = { base: 0, gst: 0, total: 0 };
                }
                expenseByCategory[d.category].base += d.baseAmount;
                expenseByCategory[d.category].gst += d.gst;
                expenseByCategory[d.category].total += d.totalAmount;
            });
            
            const incomeByCategory: Record<string, { base: number; gst: number; total: number }> = {};
            incomeData.forEach(d => {
                if (!incomeByCategory[d.category]) {
                    incomeByCategory[d.category] = { base: 0, gst: 0, total: 0 };
                }
                incomeByCategory[d.category].base += d.baseAmount;
                incomeByCategory[d.category].gst += d.gst;
                incomeByCategory[d.category].total += d.totalAmount;
            });

            const doc = new jsPDF('portrait');
            
            doc.setFontSize(20);
            doc.text('GST Summary Report', 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
            if (dateFrom || dateTo) {
                doc.text(
                    `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
                    14,
                    35,
                );
            }
            
            doc.setFontSize(14);
            doc.text('GST Overview', 14, 48);
            
            autoTable(doc, {
                startY: 52,
                head: [['Description', 'Base Amount', 'GST Amount', 'Total']],
                body: [
                    ['Total Income', `₹${totalIncomeBase.toLocaleString('en-IN')}`, `₹${totalIncomeGST.toLocaleString('en-IN')}`, `₹${(totalIncomeBase + totalIncomeGST).toLocaleString('en-IN')}`],
                    ['Total Expense', `₹${totalExpenseBase.toLocaleString('en-IN')}`, `₹${totalExpenseGST.toLocaleString('en-IN')}`, `₹${(totalExpenseBase + totalExpenseGST).toLocaleString('en-IN')}`],
                    ['Net GST (Income - Expense)', '', `₹${netGST.toLocaleString('en-IN')}`, netGST >= 0 ? 'GST Collected' : 'GST Credit'],
                ],
                styles: { fontSize: 9 },
                headStyles: { fillColor: [100, 116, 139] },
                columnStyles: { 0: { fontStyle: 'bold' } },
            });
            
            let yPos = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.text('Expense GST by Category', 14, yPos);
            
            const expenseCategoryData = Object.entries(expenseByCategory).map(([cat, data]) => [
                cat,
                `₹${data.base.toLocaleString('en-IN')}`,
                `₹${data.gst.toLocaleString('en-IN')}`,
                `₹${data.total.toLocaleString('en-IN')}`,
            ]);
            
            if (expenseCategoryData.length > 0) {
                autoTable(doc, {
                    startY: yPos + 4,
                    head: [['Category', 'Base Amount', 'GST', 'Total']],
                    body: expenseCategoryData,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [100, 116, 139] },
                });
                yPos = (doc as any).lastAutoTable.finalY + 15;
            } else {
                yPos += 10;
                doc.setFontSize(10);
                doc.text('No expense data in selected period', 14, yPos);
                yPos += 15;
            }
            
            doc.setFontSize(14);
            doc.text('Income GST by Category', 14, yPos);
            
            const incomeCategoryData = Object.entries(incomeByCategory).map(([cat, data]) => [
                cat,
                `₹${data.base.toLocaleString('en-IN')}`,
                `₹${data.gst.toLocaleString('en-IN')}`,
                `₹${data.total.toLocaleString('en-IN')}`,
            ]);
            
            if (incomeCategoryData.length > 0) {
                autoTable(doc, {
                    startY: yPos + 4,
                    head: [['Category', 'Base Amount', 'GST', 'Total']],
                    body: incomeCategoryData,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [100, 116, 139] },
                });
            } else {
                doc.setFontSize(10);
                doc.text('No income data in selected period', 14, yPos + 10);
            }
            
            doc.save(`gst_summary_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'Summary PDF exported' });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (formatType: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchGSTData();
            const exportData = data.map((row) => ({
                Date: row.date,
                Type: row.type,
                Category: row.category,
                Item: row.item,
                'Base Amount': row.baseAmount,
                GST: row.gst,
                'Total Amount': row.totalAmount,
            }));
            if (formatType === 'excel') {
                exportToExcel(exportData, 'gst_report');
            } else {
                exportToCSV(exportData, 'gst_report');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    // Filter and group data
    const filteredData = useMemo(() => {
        let data = viewData;
        if (typeFilter !== 'all') {
            data = data.filter(d => d.type.toLowerCase() === typeFilter);
        }
        return data;
    }, [viewData, typeFilter]);

    // Group data based on selection
    const groupedData = useMemo(() => {
        if (groupBy === 'none') return null;
        
        const groups: Record<string, { base: number; gst: number; total: number; count: number }> = {};
        
        filteredData.forEach(row => {
            let key = '';
            if (groupBy === 'type') key = row.type;
            else if (groupBy === 'category') key = row.category;
            else if (groupBy === 'type-category') key = `${row.type} - ${row.category}`;
            
            if (!groups[key]) {
                groups[key] = { base: 0, gst: 0, total: 0, count: 0 };
            }
            groups[key].base += row.baseAmount;
            groups[key].gst += row.gst;
            groups[key].total += row.totalAmount;
            groups[key].count += 1;
        });
        
        return Object.entries(groups).sort((a, b) => b[1].gst - a[1].gst);
    }, [filteredData, groupBy]);

    const expenseTotal = filteredData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + d.gst, 0);
    const incomeTotal = filteredData.filter(d => d.type === 'Income').reduce((sum, d) => sum + d.gst, 0);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">From</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={cn('w-[140px] justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                        {dateFrom ? format(dateFrom, 'dd MMM yy') : 'Start'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">To</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className={cn('w-[140px] justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                        {dateTo ? format(dateTo, 'dd MMM yy') : 'End'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Type</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[120px] h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Group By</Label>
                            <Select value={groupBy} onValueChange={setGroupBy}>
                                <SelectTrigger className="w-[150px] h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Grouping</SelectItem>
                                    <SelectItem value="type">Type</SelectItem>
                                    <SelectItem value="category">Category</SelectItem>
                                    <SelectItem value="type-category">Type + Category</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleView} disabled={loading} size="sm">
                            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                            View
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={loading}>
                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                    Export
                                    <ChevronDown className="ml-1.5 h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExportPDF}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    PDF (Detailed)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportSummaryPDF}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    PDF (Summary)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport('excel')}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                                    Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport('csv')}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Stats */}
            {showView && filteredData.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Expense GST</p>
                        <p className="text-lg font-semibold">₹{expenseTotal.toLocaleString('en-IN')}</p>
                    </Card>
                    <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Income GST</p>
                        <p className="text-lg font-semibold">₹{incomeTotal.toLocaleString('en-IN')}</p>
                    </Card>
                    <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Net GST</p>
                        <p className={cn("text-lg font-semibold", incomeTotal - expenseTotal >= 0 ? "text-primary" : "text-destructive")}>
                            ₹{(incomeTotal - expenseTotal).toLocaleString('en-IN')}
                        </p>
                    </Card>
                </div>
            )}

            {/* Grouped View */}
            {showView && groupedData && groupedData.length > 0 && (
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium">Grouped by {groupBy === 'type-category' ? 'Type + Category' : groupBy}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="border-t">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="p-2.5 text-left font-medium">{groupBy === 'type-category' ? 'Type - Category' : groupBy === 'type' ? 'Type' : 'Category'}</th>
                                        <th className="p-2.5 text-right font-medium">Count</th>
                                        <th className="p-2.5 text-right font-medium">Base</th>
                                        <th className="p-2.5 text-right font-medium">GST</th>
                                        <th className="p-2.5 text-right font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedData.map(([key, data]) => (
                                        <tr key={key} className="border-t">
                                            <td className="p-2.5">{key}</td>
                                            <td className="p-2.5 text-right text-muted-foreground">{data.count}</td>
                                            <td className="p-2.5 text-right">₹{data.base.toLocaleString('en-IN')}</td>
                                            <td className="p-2.5 text-right font-medium">₹{data.gst.toLocaleString('en-IN')}</td>
                                            <td className="p-2.5 text-right">₹{data.total.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Detailed Table */}
            {showView && filteredData.length > 0 && groupBy === 'none' && (
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium">{filteredData.length} entries</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="border-t max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="p-2.5 text-left font-medium">Date</th>
                                        <th className="p-2.5 text-left font-medium">Type</th>
                                        <th className="p-2.5 text-left font-medium">Category</th>
                                        <th className="p-2.5 text-left font-medium">Item</th>
                                        <th className="p-2.5 text-right font-medium">Base</th>
                                        <th className="p-2.5 text-right font-medium">GST</th>
                                        <th className="p-2.5 text-right font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((row, idx) => (
                                        <tr key={idx} className="border-t hover:bg-muted/30">
                                            <td className="p-2.5 whitespace-nowrap text-muted-foreground">{row.date}</td>
                                            <td className="p-2.5">
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-xs",
                                                    row.type === 'Income' ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                                                )}>
                                                    {row.type}
                                                </span>
                                            </td>
                                            <td className="p-2.5">{row.category}</td>
                                            <td className="p-2.5 text-muted-foreground">{row.item}</td>
                                            <td className="p-2.5 text-right">₹{row.baseAmount.toLocaleString('en-IN')}</td>
                                            <td className="p-2.5 text-right font-medium">₹{row.gst.toLocaleString('en-IN')}</td>
                                            <td className="p-2.5 text-right">₹{row.totalAmount.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {showView && filteredData.length === 0 && (
                <Card className="p-6 text-center text-muted-foreground">
                    No GST entries found for the selected filters
                </Card>
            )}
        </div>
    );
}

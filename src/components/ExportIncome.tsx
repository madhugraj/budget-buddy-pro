import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Loader2, CalendarIcon, Eye, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ExportIncome() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [viewData, setViewData] = useState<any[]>([]);
    const [showView, setShowView] = useState(false);
    const [groupBy, setGroupBy] = useState<string>('none');
    const { toast } = useToast();

    const fetchIncomeData = async () => {
        // Build query
        let query = supabase
            .from('income_actuals')
            .select(`
        id,
        fiscal_year,
        month,
        actual_amount,
        gst_amount,
        notes,
        status,
        created_at,
        recorded_by,
        approved_by,
        income_categories!income_actuals_category_id_fkey (
          category_name,
          subcategory_name
        )
      `)
            .order('month', { ascending: true });

        // Apply filters
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        // Filter by month range if dates are provided
        // Convert date range to month numbers (1-12)
        if (dateFrom) {
            const fromMonth = dateFrom.getMonth() + 1; // JS months are 0-indexed
            query = query.gte('month', fromMonth);
        }

        if (dateTo) {
            const toMonth = dateTo.getMonth() + 1; // JS months are 0-indexed
            query = query.lte('month', toMonth);
        }

        const { data: incomeData, error } = await query;

        if (error) throw error;

        if (!incomeData || incomeData.length === 0) {
            throw new Error('No income records match the selected filters');
        }

        // Fetch profiles manually
        const userIds = new Set<string>();
        incomeData.forEach((item: any) => {
            if (item.recorded_by) userIds.add(item.recorded_by);
            if (item.approved_by) userIds.add(item.approved_by);
        });

        let profilesMap: Record<string, { full_name: string, email: string }> = {};

        if (userIds.size > 0) {
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', Array.from(userIds));

            if (!profilesError && profilesData) {
                profilesMap = profilesData.reduce((acc, profile) => {
                    acc[profile.id] = { full_name: profile.full_name || '', email: profile.email || '' };
                    return acc;
                }, {} as Record<string, { full_name: string, email: string }>);
            }
        }

        // Combine data
        return incomeData.map((income: any) => ({
            ...income,
            profiles: profilesMap[income.recorded_by] || { full_name: 'Unknown', email: '' },
            approver: profilesMap[income.approved_by] || { full_name: 'Pending' }
        }));
    };

    const getMonthName = (monthNumber: number): string => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[monthNumber - 1] || 'Unknown';
    };

    const handleView = async () => {
        setLoading(true);
        try {
            const data = await fetchIncomeData();

            // Transform data for view
            const transformedData = data.map((income: any) => ({
                month_name: getMonthName(income.month),
                category: income.income_categories?.category_name || 'N/A',
                subcategory: income.income_categories?.subcategory_name || '-',
                fiscal_year: income.fiscal_year,
                month: income.month,
                base_amount: Number(income.actual_amount),
                gst_amount: Number(income.gst_amount || 0),
                total_amount: Number(income.actual_amount) + Number(income.gst_amount || 0),
                notes: income.notes || '-',
                status: income.status,
                recorded_by: income.profiles?.full_name || income.profiles?.email || 'N/A',
                approved_by: income.approver?.full_name || 'Pending',
            }));

            setViewData(transformedData);
            setShowView(true);

            toast({
                title: 'Report loaded',
                description: `Showing ${transformedData.length} income records`,
            });
        } catch (error: any) {
            toast({
                title: 'Failed to load report',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchIncomeData();

            const doc = new jsPDF('landscape');

            doc.setFontSize(16);
            doc.text('Income Report', 14, 15);

            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

            if (status !== 'all') {
                doc.text(`Status: ${status}`, 14, 27);
            }
            if (dateFrom || dateTo) {
                doc.text(
                    `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
                    14,
                    32
                );
            }

            const tableData = data.map((income: any) => [
                getMonthName(income.month),
                income.income_categories?.category_name || 'N/A',
                income.income_categories?.subcategory_name || '-',
                income.fiscal_year,
                `₹${Number(income.actual_amount).toLocaleString('en-IN')}`,
                `₹${Number(income.gst_amount || 0).toLocaleString('en-IN')}`,
                `₹${(Number(income.actual_amount) + Number(income.gst_amount || 0)).toLocaleString('en-IN')}`,
                income.status,
            ]);

            autoTable(doc, {
                startY: 38,
                head: [['Month', 'Category', 'Subcategory', 'FY', 'Base', 'GST', 'Total', 'Status']],
                body: tableData,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [16, 185, 129] }, // Green for income
            });

            doc.save(`income_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

            toast({
                title: 'PDF exported',
                description: `${data.length} income records exported to PDF`,
            });
        } catch (error: any) {
            toast({
                title: 'Export failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExportSummaryPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchIncomeData();

            const totalBase = data.reduce((sum: number, d: any) => sum + Number(d.actual_amount), 0);
            const totalGST = data.reduce((sum: number, d: any) => sum + Number(d.gst_amount || 0), 0);
            const totalAmount = totalBase + totalGST;

            const byCategory: Record<string, number> = {};
            data.forEach((d: any) => {
                const cat = d.income_categories?.category_name || 'Uncategorized';
                byCategory[cat] = (byCategory[cat] || 0) + Number(d.actual_amount);
            });

            const doc = new jsPDF('portrait');

            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129);
            doc.text('Income Summary Report', 14, 20);
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

            if (dateFrom || dateTo) {
                doc.text(
                    `Period: ${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start'} - ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End'}`,
                    14,
                    35
                );
            }

            doc.setFontSize(14);
            doc.text('Overview', 14, 48);

            autoTable(doc, {
                startY: 52,
                head: [['Description', 'Amount']],
                body: [
                    ['Total Base Amount', `₹${totalBase.toLocaleString('en-IN')}`],
                    ['Total GST', `₹${totalGST.toLocaleString('en-IN')}`],
                    ['Total Amount', `₹${totalAmount.toLocaleString('en-IN')}`],
                ],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: { 0: { fontStyle: 'bold' } },
            });

            let yPos = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.text('Income by Category', 14, yPos);

            const categoryData = Object.entries(byCategory).map(([cat, amount]) => [
                cat,
                `₹${amount.toLocaleString('en-IN')}`
            ]);

            autoTable(doc, {
                startY: yPos + 4,
                head: [['Category', 'Base Amount']],
                body: categoryData,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
            });

            doc.save(`income_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast({ title: 'Summary PDF exported', description: 'Dashboard-style summary exported' });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (exportFormat: 'excel' | 'csv') => {
        setLoading(true);
        try {
            const data = await fetchIncomeData();

            // Transform data for export with proper headers
            const exportData = data.map((income: any) => ({
                'Month': getMonthName(income.month),
                'Category': income.income_categories?.category_name || 'N/A',
                'Subcategory': income.income_categories?.subcategory_name || '-',
                'Fiscal Year': income.fiscal_year,
                'Base Amount (₹)': Number(income.actual_amount),
                'GST Amount (₹)': Number(income.gst_amount || 0),
                'Total Amount (₹)': Number(income.actual_amount) + Number(income.gst_amount || 0),
                'Notes': income.notes || '-',
                'Status': income.status,
                'Recorded By': income.profiles?.full_name || income.profiles?.email || 'N/A',
                'Approved By': income.approver?.full_name || 'N/A',
            }));

            // Export based on format
            if (exportFormat === 'excel') {
                exportToExcel(exportData, 'income_report');
            } else {
                exportToCSV(exportData, 'income_report');
            }

            toast({
                title: 'Export successful',
                description: `${data.length} income records exported as ${exportFormat.toUpperCase()}`,
            });
        } catch (error: any) {
            toast({
                title: 'Export failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        <CardTitle>Export Income</CardTitle>
                    </div>
                    <CardDescription>
                        Download income reports in Excel or CSV format
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Status Filter</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Date From</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !dateFrom && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFrom ? format(dateFrom, 'PPP') : 'Select date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateFrom}
                                        onSelect={setDateFrom}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label>Date To</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !dateTo && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateTo ? format(dateTo, 'PPP') : 'Select date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateTo}
                                        onSelect={setDateTo}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        <Button
                            onClick={handleView}
                            disabled={loading}
                            size="sm"
                            variant="default"
                        >
                            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                            View
                        </Button>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={loading}>
                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                    Export
                                    <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
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

            {showView && viewData.length > 0 && (
                <Card className="mt-4">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Income Report ({viewData.length} entries)</CardTitle>
                                <CardDescription className="text-xs">Filtered results</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Group by:</Label>
                                <Select value={groupBy} onValueChange={setGroupBy}>
                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="category">Category</SelectItem>
                                        <SelectItem value="month">Month</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {groupBy === 'none' ? (
                            <div className="border rounded-lg overflow-hidden">
                                <div className="max-h-[400px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-muted z-10">
                                            <TableRow>
                                                <TableHead className="text-xs">Month</TableHead>
                                                <TableHead className="text-xs">Category</TableHead>
                                                <TableHead className="text-xs text-right">Base</TableHead>
                                                <TableHead className="text-xs text-right">GST</TableHead>
                                                <TableHead className="text-xs text-right">Total</TableHead>
                                                <TableHead className="text-xs">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {viewData.map((row, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="text-xs whitespace-nowrap">{row.month_name}</TableCell>
                                                    <TableCell className="text-xs font-medium max-w-[150px] truncate">{row.category}</TableCell>
                                                    <TableCell className="text-xs text-right">{formatCurrency(row.base_amount)}</TableCell>
                                                    <TableCell className="text-xs text-right">{formatCurrency(row.gst_amount)}</TableCell>
                                                    <TableCell className="text-xs text-right font-medium">{formatCurrency(row.total_amount)}</TableCell>
                                                    <TableCell>
                                                        <span className={cn(
                                                            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                                                            row.status === 'approved' && "bg-green-100 text-green-700",
                                                            row.status === 'pending' && "bg-yellow-100 text-yellow-700",
                                                            row.status === 'rejected' && "bg-red-100 text-red-700"
                                                        )}>
                                                            {row.status}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <IncomeGroupedView data={viewData} groupBy={groupBy} formatCurrency={formatCurrency} />
                        )}

                        <div className="mt-3 p-3 bg-muted rounded-lg">
                            <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                    <p className="text-muted-foreground">Total Base</p>
                                    <p className="text-sm font-semibold">
                                        {formatCurrency(viewData.reduce((sum, row) => sum + row.base_amount, 0))}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Total GST</p>
                                    <p className="text-sm font-semibold">
                                        {formatCurrency(viewData.reduce((sum, row) => sum + row.gst_amount, 0))}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Total Amount</p>
                                    <p className="text-sm font-bold text-primary">
                                        {formatCurrency(viewData.reduce((sum, row) => sum + row.total_amount, 0))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}

function IncomeGroupedView({ data, groupBy, formatCurrency }: { data: any[], groupBy: string, formatCurrency: (n: number) => string }) {
    const grouped = useMemo(() => {
        const groups: Record<string, { items: any[], totals: { base: number, gst: number, total: number } }> = {};
        
        data.forEach(row => {
            let key = '';
            switch (groupBy) {
                case 'category': key = row.category || 'Unknown'; break;
                case 'month': key = row.month_name || 'Unknown'; break;
                case 'status': key = row.status || 'Unknown'; break;
                default: key = 'All';
            }
            
            if (!groups[key]) {
                groups[key] = { items: [], totals: { base: 0, gst: 0, total: 0 } };
            }
            groups[key].items.push(row);
            groups[key].totals.base += row.base_amount;
            groups[key].totals.gst += row.gst_amount;
            groups[key].totals.total += row.total_amount;
        });
        
        return Object.entries(groups).sort((a, b) => b[1].totals.total - a[1].totals.total);
    }, [data, groupBy]);

    return (
        <div className="space-y-2">
            {grouped.map(([key, { items, totals }]) => (
                <div key={key} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{key}</span>
                            <span className="text-xs text-muted-foreground">({items.length} items)</span>
                        </div>
                        <span className="font-semibold text-sm">{formatCurrency(totals.total)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>Base: {formatCurrency(totals.base)}</div>
                        <div>GST: {formatCurrency(totals.gst)}</div>
                        <div className="font-medium text-foreground">Total: {formatCurrency(totals.total)}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

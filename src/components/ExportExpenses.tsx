import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Loader2, CalendarIcon, Eye, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export function ExportExpenses() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [viewData, setViewData] = useState<any[]>([]);
  const [showView, setShowView] = useState(false);
  const [groupBy, setGroupBy] = useState<string>('none');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchExpenseData = async () => {
    // Build query
    let query = supabase
      .from('expenses')
      .select(`
        id,
        description,
        amount,
        gst_amount,
        tds_amount,
        status,
        expense_date,
        budget_master!expenses_budget_master_id_fkey (
          item_name,
          category,
          committee
        ),
        profiles!expenses_claimed_by_fkey (full_name, email),
        approver:profiles!expenses_approved_by_fkey (full_name)
      `)
      .order('expense_date', { ascending: false });

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('expense_date', format(dateFrom, 'yyyy-MM-dd'));
    }

    if (dateTo) {
      query = query.lte('expense_date', format(dateTo, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error('No expenses match the selected filters');
    }

    return data;
  };

  const handleView = async () => {
    setLoading(true);
    try {
      const data = await fetchExpenseData();

      // Transform data for view
      const transformedData = data.map((expense: any) => ({
        id: expense.id,
        date: format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        description: expense.description,
        category: expense.budget_master?.category || 'N/A',
        committee: expense.budget_master?.committee || 'N/A',
        item_name: expense.budget_master?.item_name || 'N/A',
        base_amount: Number(expense.amount),
        gst_amount: Number(expense.gst_amount || 0),
        tds_amount: Number(expense.tds_amount || 0),
        gross_amount: Number(expense.amount) + Number(expense.gst_amount || 0),
        net_payment: Number(expense.amount) + Number(expense.gst_amount || 0) - Number(expense.tds_amount || 0),
        status: expense.status,
        claimed_by: expense.profiles?.full_name || expense.profiles?.email || 'N/A',
        approved_by: expense.approver?.full_name || 'Pending',
      }));

      setViewData(transformedData);
      setShowView(true);
      setSelectedIds(new Set()); // Reset selection on new view

      toast({
        title: 'Report loaded',
        description: `Showing ${transformedData.length} expenses`,
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
      const data = await fetchExpenseData();

      const doc = new jsPDF('landscape');

      doc.setFontSize(16);
      doc.text('Expense Report', 14, 15);

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

      const tableData = data.map((expense: any) => [
        format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        expense.budget_master?.item_name || 'N/A',
        expense.description,
        `₹${Number(expense.amount).toLocaleString('en-IN')}`,
        `₹${Number(expense.gst_amount || 0).toLocaleString('en-IN')}`,
        `₹${Number(expense.tds_amount || 0).toLocaleString('en-IN')}`,
        `₹${(Number(expense.amount) + Number(expense.gst_amount || 0) - Number(expense.tds_amount || 0)).toLocaleString('en-IN')}`,
        expense.status,
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['Date', 'Item', 'Description', 'Base', 'GST', 'TDS', 'Net Payment', 'Status']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`expense_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast({
        title: 'PDF exported',
        description: `${data.length} expenses exported to PDF`,
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
      const data = await fetchExpenseData();

      const totalBase = data.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const totalGST = data.reduce((sum: number, d: any) => sum + Number(d.gst_amount || 0), 0);
      const totalTDS = data.reduce((sum: number, d: any) => sum + Number(d.tds_amount || 0), 0);
      const totalNet = totalBase + totalGST - totalTDS;

      const byCategory: Record<string, number> = {};
      data.forEach((d: any) => {
        const cat = d.budget_master?.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + Number(d.amount);
      });

      const doc = new jsPDF('portrait');

      doc.setFontSize(20);
      doc.setTextColor(16, 185, 129);
      doc.text('Expense Summary Report', 14, 20);
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
          ['Total TDS', `₹${totalTDS.toLocaleString('en-IN')}`],
          ['Total Net Payment', `₹${totalNet.toLocaleString('en-IN')}`],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [16, 185, 129] },
        columnStyles: { 0: { fontStyle: 'bold' } },
      });

      let yPos = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Expenses by Category', 14, yPos);

      const categoryData = Object.entries(byCategory).map(([cat, amount]) => [
        cat,
        `₹${amount.toLocaleString('en-IN')}`
      ]);

      autoTable(doc, {
        startY: yPos + 4,
        head: [['Category', 'Base Amount']],
        body: categoryData,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`expense_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
      const data = await fetchExpenseData();

      // Transform data for export
      // Transform data for export with proper headers
      const exportData = data.map((expense: any) => ({
        'Date': format(new Date(expense.expense_date), 'dd/MM/yyyy'),
        'Description': expense.description,
        'Category': expense.budget_master?.category || 'N/A',
        'Committee': expense.budget_master?.committee || 'N/A',
        'Budget Item': expense.budget_master?.item_name || 'N/A',
        'Amount (₹)': Number(expense.amount),
        'Status': expense.status,
        'Claimed By': expense.profiles?.full_name || expense.profiles?.email || 'N/A',
        'Approved By': expense.approver?.full_name || 'N/A',
      }));

      // Export based on format
      if (exportFormat === 'excel') {
        exportToExcel(exportData, 'expense_report');
      } else {
        exportToCSV(exportData, 'expense_report');
      }

      toast({
        title: 'Export successful',
        description: `${data.length} expenses exported as ${exportFormat.toUpperCase()}`,
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

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = (ids: string[]) => {
    if (ids.every(id => selectedIds.has(id))) {
      // Deselect all
      const newSelection = new Set(selectedIds);
      ids.forEach(id => newSelection.delete(id));
      setSelectedIds(newSelection);
    } else {
      // Select all
      const newSelection = new Set(selectedIds);
      ids.forEach(id => newSelection.add(id));
      setSelectedIds(newSelection);
    }
  };

  const selectedStats = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const selectedItems = viewData.filter(d => selectedIds.has(d.id));
    const count = selectedItems.length;
    const totalNet = selectedItems.reduce((sum, d) => sum + d.net_payment, 0);
    const avgNet = totalNet / count;

    const min = selectedItems.length > 0 ? Math.min(...selectedItems.map(d => d.net_payment)) : 0;
    const max = selectedItems.length > 0 ? Math.max(...selectedItems.map(d => d.net_payment)) : 0;

    return { count, totalNet, avgNet, min, max, items: selectedItems };
  }, [selectedIds, viewData]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <CardTitle>Export Expenses</CardTitle>
          </div>
          <CardDescription>
            Download expense reports in Excel or CSV format
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
                <CardTitle className="text-base">Expense Report ({viewData.length} entries)</CardTitle>
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
                    <SelectItem value="item">Item</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
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
                        <TableHead className="w-[30px]">
                          <Checkbox
                            checked={viewData.length > 0 && viewData.every(d => selectedIds.has(d.id))}
                            onCheckedChange={() => selectAll(viewData.map(d => d.id))}
                          />
                        </TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs text-right">Base</TableHead>
                        <TableHead className="text-xs text-right">GST</TableHead>
                        <TableHead className="text-xs text-right">TDS</TableHead>
                        <TableHead className="text-xs text-right">Net</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={() => toggleSelection(row.id)}
                            />
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                          <TableCell className="text-xs font-medium max-w-[150px] truncate">{row.item_name}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(row.base_amount)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(row.gst_amount)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(row.tds_amount)}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{formatCurrency(row.net_payment)}</TableCell>
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
              <GroupedAnalyticsView
                data={viewData}
                groupBy={groupBy}
                formatCurrency={formatCurrency}
                selectedIds={selectedIds}
                toggleSelection={toggleSelection}
                selectAll={selectAll}
              />
            )}

            <div className="mt-3 p-3 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
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
                  <p className="text-muted-foreground">Total TDS</p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(viewData.reduce((sum, row) => sum + row.tds_amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Payment</p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(viewData.reduce((sum, row) => sum + row.net_payment, 0))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedStats && (
        <Sheet modal={false}>
          <SheetTrigger asChild>
            <Button
              className="fixed bottom-6 right-6 z-50 shadow-xl rounded-full h-14 px-6 gap-2"
              size="lg"
            >
              <Calculator className="h-5 w-5" />
              <span>Analysis ({selectedStats.count})</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
            <div className="p-6 pt-12 pb-4 border-b bg-card z-10">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Analysis View
                  </SheetTitle>
                  <SheetDescription>
                    Reviewing {selectedStats.count} selected records
                  </SheetDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-8 px-2 lg:px-3"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-muted/5">
              <ScrollArea className="h-full w-full">
                <div className="p-4 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="w-[50px] text-xs font-semibold h-8 text-primary">#</TableHead>
                        <TableHead className="text-xs font-semibold h-8 text-primary">Item Description</TableHead>
                        <TableHead className="text-xs font-semibold h-8 text-right text-primary">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStats.items.map((item: any, index: number) => (
                        <TableRow key={item.id} className="hover:bg-muted/50 border-b border-muted/50">
                          <TableCell className="py-2 text-xs text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="py-2 text-xs font-medium text-foreground/90">{item.item_name}</TableCell>
                          <TableCell className="py-2 text-right text-xs font-mono">{formatCurrency(item.net_payment)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>

            <div className="bg-background border-t p-4 pb-6 space-y-3 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-20">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-2 rounded-md bg-muted/30">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-1">Count</p>
                  <p className="text-xl font-bold text-foreground">{selectedStats.count}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-muted/30">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-1">Average</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground break-words" title={formatCurrency(selectedStats.avgNet)}>{formatCurrency(selectedStats.avgNet)}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-muted/30">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-1">Minimum</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground break-words" title={formatCurrency(selectedStats.min)}>{formatCurrency(selectedStats.min)}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-muted/30">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-1">Maximum</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground break-words" title={formatCurrency(selectedStats.max)}>{formatCurrency(selectedStats.max)}</p>
                </div>
              </div>

              <div className="bg-primary rounded-lg p-3 shadow-lg shadow-primary/20 flex items-center justify-between text-primary-foreground">
                <span className="text-xs sm:text-sm font-medium uppercase tracking-wide opacity-90">Total Sum</span>
                <span className="text-lg sm:text-2xl font-bold tracking-tight break-words">{formatCurrency(selectedStats.totalNet)}</span>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function GroupedAnalyticsView({
  data,
  groupBy,
  formatCurrency,
  selectedIds,
  toggleSelection,
  selectAll
}: {
  data: any[],
  groupBy: string,
  formatCurrency: (n: number) => string,
  selectedIds: Set<string>,
  toggleSelection: (id: string) => void,
  selectAll: (ids: string[]) => void
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, { items: any[], totals: { base: number, gst: number, tds: number, net: number } }> = {};

    data.forEach(row => {
      let key = '';
      switch (groupBy) {
        case 'item': key = row.item_name || 'Unknown'; break;
        case 'category': key = row.category || 'Unknown'; break;
        case 'status': key = row.status || 'Unknown'; break;
        case 'month': key = row.date?.substring(3, 10) || 'Unknown'; break; // MM/YYYY
        default: key = 'All';
      }

      if (!groups[key]) {
        groups[key] = { items: [], totals: { base: 0, gst: 0, tds: 0, net: 0 } };
      }
      groups[key].items.push(row);
      groups[key].totals.base += row.base_amount;
      groups[key].totals.gst += row.gst_amount;
      groups[key].totals.tds += row.tds_amount;
      groups[key].totals.net += row.net_payment;
    });

    return Object.entries(groups).sort((a, b) => b[1].totals.net - a[1].totals.net);
  }, [data, groupBy]);

  return (
    <div className="space-y-2">
      {grouped.map(([key, { items, totals }]) => (
        <CollapsibleGroup
          key={key}
          title={key}
          items={items}
          totals={totals}
          formatCurrency={formatCurrency}
          selectedIds={selectedIds}
          toggleSelection={toggleSelection}
          selectAll={selectAll}
        />
      ))}
    </div>
  );
}

function CollapsibleGroup({
  title,
  items,
  totals,
  formatCurrency,
  selectedIds,
  toggleSelection,
  selectAll
}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const allSelected = items.every((i: any) => selectedIds.has(i.id));

  return (
    <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => selectAll(items.map((i: any) => i.id))}
            />
          </div>
          <div>
            <span className="font-medium text-sm block">{title}</span>
            <span className="text-xs text-muted-foreground">{items.length} items</span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-semibold text-sm block">{formatCurrency(totals.net)}</span>
          <span className="text-xs text-muted-foreground">Net Total</span>
        </div>
      </div>

      {isOpen && (
        <div className="p-0 border-t bg-muted/10 animate-in slide-in-from-top-1 fade-in-0 duration-200">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={() => toggleSelection(row.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs">{row.date}</TableCell>
                    <TableCell className="text-xs truncate max-w-[200px]">{row.item_name}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{formatCurrency(row.net_payment)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground p-2 px-3 border-t border-dashed bg-muted/20">
        <div>Base: {formatCurrency(totals.base)}</div>
        <div>GST: {formatCurrency(totals.gst)}</div>
        <div>TDS: {formatCurrency(totals.tds)}</div>
        <div className="font-medium text-foreground">Net: {formatCurrency(totals.net)}</div>
      </div>
    </div>
  );
}

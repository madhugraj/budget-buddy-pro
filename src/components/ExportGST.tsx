import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, FileSpreadsheet, FileText, Download, Eye, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
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
  const isMC = !!localStorage.getItem('mc_user');
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [viewData, setViewData] = useState<GSTRow[]>([]);
  const [showView, setShowView] = useState(false);
  const [groupBy, setGroupBy] = useState<string>('none');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchGSTData = async (): Promise<GSTRow[]> => {
    // Expense GST - filter out 0 GST entries
    let expenseQuery = supabase
      .from('expenses')
      .select('id, amount, gst_amount, expense_date, budget_master!expenses_budget_master_id_fkey (category, item_name)')
      .eq('status', 'approved')
      .gt('gst_amount', 0);

    if (dateFrom) {
      expenseQuery = expenseQuery.gte('expense_date', format(dateFrom, 'yyyy-MM-dd'));
    }
    if (dateTo) {
      expenseQuery = expenseQuery.lte('expense_date', format(dateTo, 'yyyy-MM-dd'));
    }

    const { data: expenseData, error: expenseError } = await expenseQuery;
    if (expenseError) throw expenseError;

    // Income GST - filter out 0 GST entries
    const { data: incomeData, error: incomeError } = await supabase
      .from('income_actuals')
      .select('id, actual_amount, gst_amount, month, fiscal_year, income_categories!income_actuals_category_id_fkey (category_name, subcategory_name)')
      .eq('status', 'approved')
      .gt('gst_amount', 0);

    if (incomeError) throw incomeError;

    // Filter income by date range
    const filteredIncome = (incomeData || []).filter((i: any) => {
      if (!i.gst_amount || i.gst_amount <= 0) return false;

      const fiscalYear = i.fiscal_year;
      const month = i.month;
      let year = fiscalYear === 'FY25-26' ? (month >= 4 ? 2025 : 2026) :
        fiscalYear === 'FY24-25' ? (month >= 4 ? 2024 : 2025) : 2025;

      const incomeDate = new Date(year, month - 1, 1);
      if (dateFrom && incomeDate < dateFrom) return false;
      if (dateTo && incomeDate > dateTo) return false;
      return true;
    });

    const expenseRows: GSTRow[] = (expenseData || [])
      .filter((e: any) => e.gst_amount && e.gst_amount > 0)
      .map((e: any) => ({
        type: 'Expense' as const,
        category: e.budget_master?.category || 'N/A',
        item: e.budget_master?.item_name || 'N/A',
        gst: Number(e.gst_amount) || 0,
        baseAmount: Number(e.amount) || 0,
        totalAmount: (Number(e.amount) || 0) + (Number(e.gst_amount) || 0),
        date: format(new Date(e.expense_date), 'dd/MM/yyyy'),
      }));

    const incomeRows: GSTRow[] = filteredIncome.map((i: any) => {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return {
        type: 'Income' as const,
        category: i.income_categories?.category_name || 'N/A',
        item: i.income_categories?.subcategory_name || '-',
        gst: Number(i.gst_amount) || 0,
        baseAmount: Number(i.actual_amount) || 0,
        totalAmount: (Number(i.actual_amount) || 0) + (Number(i.gst_amount) || 0),
        date: `${monthNames[i.month - 1]} ${i.fiscal_year?.replace('FY', '').split('-')[0]}`,
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
      toast({ title: `${data.length} GST entries loaded` });
    } catch (error: any) {
      toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
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
      doc.text('GST Report', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 22);

      autoTable(doc, {
        startY: 30,
        head: [['Date', 'Type', 'Category', 'Item', 'Base', 'GST', 'Total']],
        body: data.map((row) => [
          row.date, row.type, row.category, row.item,
          `₹${row.baseAmount.toLocaleString('en-IN')}`,
          `₹${row.gst.toLocaleString('en-IN')}`,
          `₹${row.totalAmount.toLocaleString('en-IN')}`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 116, 139] },
      });
      doc.save(`gst_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'PDF exported' });
    } catch (error: any) {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (formatType: 'excel' | 'csv') => {
    setLoading(true);
    try {
      const data = await fetchGSTData();
      const exportData = data.map((row) => ({
        Date: row.date, Type: row.type, Category: row.category, Item: row.item,
        'Base Amount': row.baseAmount, GST: row.gst, 'Total Amount': row.totalAmount,
      }));
      formatType === 'excel' ? exportToExcel(exportData, 'gst_report') : exportToCSV(exportData, 'gst_report');
      toast({ title: 'Exported successfully' });
    } catch (error: any) {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let data = viewData;
    if (typeFilter !== 'all') {
      data = data.filter(d => d.type.toLowerCase() === typeFilter);
    }
    return data;
  }, [viewData, typeFilter]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;

    const groups: Record<string, { base: number; gst: number; total: number; count: number }> = {};
    filteredData.forEach(row => {
      const key = groupBy === 'type' ? row.type :
        groupBy === 'category' ? row.category :
          `${row.type} • ${row.category}`;

      if (!groups[key]) groups[key] = { base: 0, gst: 0, total: 0, count: 0 };
      groups[key].base += row.baseAmount;
      groups[key].gst += row.gst;
      groups[key].total += row.totalAmount;
      groups[key].count += 1;
    });

    return Object.entries(groups).sort((a, b) => b[1].gst - a[1].gst);
  }, [filteredData, groupBy]);

  const expenseGST = filteredData.filter(d => d.type === 'Expense').reduce((sum, d) => sum + d.gst, 0);
  const incomeGST = filteredData.filter(d => d.type === 'Income').reduce((sum, d) => sum + d.gst, 0);

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('w-32 justify-start', !dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'dd MMM yy') : 'Start'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('w-32 justify-start', !dateTo && 'text-muted-foreground')}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'dd MMM yy') : 'End'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
            </PopoverContent>
          </Popover>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Grouping</SelectItem>
            <SelectItem value="type">By Type</SelectItem>
            <SelectItem value="category">By Category</SelectItem>
            <SelectItem value="type-category">Type + Category</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleView} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}
          View
        </Button>
        {!isMC && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading}>
                <Download className="mr-1.5 h-4 w-4" />
                Export
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="mr-2 h-4 w-4" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Summary */}
      {showView && filteredData.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">Expense GST</p>
            <p className="text-lg font-semibold">₹{expenseGST.toLocaleString('en-IN')}</p>
          </Card>
          <Card className="p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">Income GST</p>
            <p className="text-lg font-semibold">₹{incomeGST.toLocaleString('en-IN')}</p>
          </Card>
          <Card className="p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">Net GST</p>
            <p className={cn("text-lg font-semibold", incomeGST - expenseGST >= 0 ? "text-primary" : "text-destructive")}>
              ₹{(incomeGST - expenseGST).toLocaleString('en-IN')}
            </p>
          </Card>
        </div>
      )}

      {/* Grouped View */}
      {showView && groupedData && groupedData.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-muted/20">
            <p className="text-sm font-medium">Grouped by {groupBy === 'type-category' ? 'Type + Category' : groupBy}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-2.5 text-left font-medium">Group</th>
                <th className="p-2.5 text-right font-medium">Count</th>
                <th className="p-2.5 text-right font-medium">Base</th>
                <th className="p-2.5 text-right font-medium">GST</th>
                <th className="p-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map(([key, data]) => (
                <tr key={key} className="border-t hover:bg-muted/20">
                  <td className="p-2.5 font-medium">{key}</td>
                  <td className="p-2.5 text-right text-muted-foreground">{data.count}</td>
                  <td className="p-2.5 text-right">₹{data.base.toLocaleString('en-IN')}</td>
                  <td className="p-2.5 text-right font-semibold">₹{data.gst.toLocaleString('en-IN')}</td>
                  <td className="p-2.5 text-right">₹{data.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Detail Table */}
      {showView && filteredData.length > 0 && groupBy === 'none' && (
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-muted/20">
            <p className="text-sm font-medium">{filteredData.length} entries</p>
          </div>
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
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
                  <tr key={idx} className="border-t hover:bg-muted/20">
                    <td className="p-2.5 text-muted-foreground">{row.date}</td>
                    <td className="p-2.5">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-xs font-medium",
                        row.type === 'Income' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {row.type}
                      </span>
                    </td>
                    <td className="p-2.5">{row.category}</td>
                    <td className="p-2.5 text-muted-foreground">{row.item}</td>
                    <td className="p-2.5 text-right">₹{row.baseAmount.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right font-semibold">₹{row.gst.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right">₹{row.totalAmount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showView && filteredData.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No GST entries found
        </Card>
      )}
    </div>
  );
}

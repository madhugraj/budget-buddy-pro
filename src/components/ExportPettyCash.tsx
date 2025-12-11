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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Calculator, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';

interface PettyCashRow {
    id: string;
    item_name: string;
    description: string;
    amount: number;
    date: string;
    status: string;
    submitted_by: string;
    submitter_name: string;
}

export function ExportPettyCash() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [viewData, setViewData] = useState<PettyCashRow[]>([]);
    const [showView, setShowView] = useState(false);
    const [groupBy, setGroupBy] = useState<string>('none');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const fetchPettyCashData = async (): Promise<PettyCashRow[]> => {
        let query = supabase
            .from('petty_cash')
            .select('*, profiles!petty_cash_submitted_by_fkey (full_name)')
            .order('date', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        if (dateFrom) {
            query = query.gte('date', format(dateFrom, 'yyyy-MM-dd'));
        }
        if (dateTo) {
            query = query.lte('date', format(dateTo, 'yyyy-MM-dd'));
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((item: any) => ({
            id: item.id,
            item_name: item.item_name,
            description: item.description,
            amount: Number(item.amount),
            date: format(new Date(item.date), 'dd/MM/yyyy'),
            status: item.status,
            submitted_by: item.submitted_by,
            submitter_name: item.profiles?.full_name || 'Unknown',
        }));


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
            const newSelection = new Set(selectedIds);
            ids.forEach(id => newSelection.delete(id));
            setSelectedIds(newSelection);
        } else {
            const newSelection = new Set(selectedIds);
            ids.forEach(id => newSelection.add(id));
            setSelectedIds(newSelection);
        }
    };

    const selectedStats = useMemo(() => {
        if (selectedIds.size === 0) return null;
        const selectedItems = viewData.filter(d => selectedIds.has(d.id));
        const count = selectedItems.length;
        const totalNet = selectedItems.reduce((sum, d) => sum + d.amount, 0);
        const avgNet = totalNet / count;

        const min = selectedItems.length > 0 ? Math.min(...selectedItems.map(d => d.amount)) : 0;
        const max = selectedItems.length > 0 ? Math.max(...selectedItems.map(d => d.amount)) : 0;

        return { count, totalNet, avgNet, min, max, items: selectedItems };
    }, [selectedIds, viewData]);

    const handleView = async () => {
        setLoading(true);
        try {
            const data = await fetchPettyCashData();
            setViewData(data);
            setShowView(true);
            toast({ title: 'Petty Cash report loaded', description: `Showing ${data.length} records` });
        } catch (error: any) {
            toast({ title: 'Failed to load report', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        setLoading(true);
        try {
            const data = await fetchPettyCashData();
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            doc.text('Petty Cash Report', 14, 15);
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
                row.item_name,
                row.description,
                row.submitter_name,
                row.status,
                `₹${row.amount.toLocaleString('en-IN')}`,
            ]);
            autoTable(doc, {
                startY: 35,
                head: [['Date', 'Item', 'Description', 'Submitted By', 'Status', 'Amount']],
                body: tableData,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [16, 185, 129] },
            });
            doc.save(`petty_cash_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
            const data = await fetchPettyCashData();

            const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);
            const approvedAmount = data.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.amount, 0);
            const pendingAmount = data.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0);

            const doc = new jsPDF('portrait');

            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129);
            doc.text('Petty Cash Summary Report', 14, 20);
            doc.setTextColor(0, 0, 0);
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
            doc.text('Overview', 14, 48);

            autoTable(doc, {
                startY: 52,
                head: [['Description', 'Amount']],
                body: [
                    ['Total Petty Cash', `₹${totalAmount.toLocaleString('en-IN')}`],
                    ['Approved Amount', `₹${approvedAmount.toLocaleString('en-IN')}`],
                    ['Pending Amount', `₹${pendingAmount.toLocaleString('en-IN')}`],
                ],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [16, 185, 129] },
                columnStyles: { 0: { fontStyle: 'bold' } },
            });

            doc.save(`petty_cash_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
            const data = await fetchPettyCashData();
            const exportData = data.map((row) => ({
                Date: row.date,
                Item: row.item_name,
                Description: row.description,
                'Submitted By': row.submitter_name,
                Status: row.status,
                Amount: row.amount,
            }));
            if (formatType === 'excel') {
                exportToExcel(exportData, 'petty_cash_report');
            } else {
                exportToCSV(exportData, 'petty_cash_report');
            }
            toast({ title: 'Export successful', description: `${data.length} records exported as ${formatType.toUpperCase()}` });
        } catch (error: any) {
            toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const totalAmount = viewData.reduce((sum, d) => sum + d.amount, 0);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Export Petty Cash</CardTitle>
                </div>
                <CardDescription className="text-xs">Download petty cash reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal text-xs', !dateFrom && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                    {dateFrom ? format(dateFrom, 'PP') : 'Select'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal text-xs', !dateTo && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                    {dateTo ? format(dateTo, 'PP') : 'Select'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Group by:</Label>
                    <Select value={groupBy} onValueChange={setGroupBy}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="submitter">Submitted By</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex gap-2 items-center">
                    <Button onClick={handleView} disabled={loading} size="sm" variant="default">
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
                {showView && viewData.length > 0 && (
                    <Card className="mt-6">
                        <CardHeader className="pb-3">
                            <CardTitle>Petty Cash Report ({viewData.length} entries)</CardTitle>
                            <CardDescription className="text-xs">
                                Filtered results
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {groupBy === 'none' ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="max-h-[600px] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-muted sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="w-[30px]">
                                                        <Checkbox
                                                            checked={viewData.length > 0 && viewData.every(d => selectedIds.has(d.id))}
                                                            onCheckedChange={() => selectAll(viewData.map(d => d.id))}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-xs">Date</TableHead>
                                                    <TableHead className="text-xs">Item</TableHead>
                                                    <TableHead className="text-xs">Description</TableHead>
                                                    <TableHead className="text-xs">Submitted By</TableHead>
                                                    <TableHead className="text-xs">Status</TableHead>
                                                    <TableHead className="text-xs text-right">Amount</TableHead>
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
                                                        <TableCell className="text-xs font-medium">{row.item_name}</TableCell>
                                                        <TableCell className="text-xs max-w-[200px] truncate">{row.description}</TableCell>
                                                        <TableCell className="text-xs">{row.submitter_name}</TableCell>
                                                        <TableCell>
                                                            <span className={cn(
                                                                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                                                                row.status === 'approved' && "bg-green-100 text-green-700",
                                                                row.status === 'pending' && "bg-yellow-100 text-yellow-700",
                                                                row.status === 'rejected' && "bg-red-100 text-red-700"
                                                            )}>
                                                                {row.status}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-right font-medium">₹{row.amount.toLocaleString('en-IN')}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <PettyCashGroupedView
                                    data={viewData}
                                    groupBy={groupBy}
                                    selectedIds={selectedIds}
                                    toggleSelection={toggleSelection}
                                    selectAll={selectAll}
                                />
                            )}

                            <div className="mt-3 p-3 bg-muted rounded-lg flex justify-between items-center">
                                <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                                <span className="text-lg font-bold text-primary">₹{totalAmount.toLocaleString('en-IN')}</span>
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
                        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
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
                                                    <TableHead className="text-xs font-semibold h-8 text-primary">Date</TableHead>
                                                    <TableHead className="text-xs font-semibold h-8 text-primary">Item</TableHead>
                                                    <TableHead className="text-xs font-semibold h-8 text-right text-primary">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedStats.items.map((item: any, index: number) => (
                                                    <TableRow key={index} className="hover:bg-muted/50 border-b border-muted/50">
                                                        <TableCell className="py-2 text-xs text-muted-foreground">{index + 1}</TableCell>
                                                        <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">{item.date}</TableCell>
                                                        <TableCell className="py-2 text-xs font-medium text-foreground/90">{item.item_name}</TableCell>
                                                        <TableCell className="py-2 text-right text-xs font-mono">₹{item.amount.toLocaleString('en-IN')}</TableCell>
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
                                        <p className="text-xs sm:text-sm font-semibold text-foreground break-words" title={`₹${selectedStats.avgNet.toLocaleString('en-IN')}`}>₹{selectedStats.avgNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="text-center p-2 rounded-md bg-muted/30">
                                        <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-1">Minimum</p>
                                        <p className="text-xs sm:text-sm font-semibold text-foreground break-words" title={`₹${selectedStats.min.toLocaleString('en-IN')}`}>₹{selectedStats.min.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="text-center p-2 rounded-md bg-muted/30">
                                        <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-1">Maximum</p>
                                        <p className="text-xs sm:text-sm font-semibold text-foreground break-words" title={`₹${selectedStats.max.toLocaleString('en-IN')}`}>₹{selectedStats.max.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>

                                <div className="bg-primary rounded-lg p-3 shadow-lg shadow-primary/20 flex items-center justify-between text-primary-foreground">
                                    <span className="text-xs sm:text-sm font-medium uppercase tracking-wide opacity-90">Total Sum</span>
                                    <span className="text-lg sm:text-2xl font-bold tracking-tight break-words">₹{selectedStats.totalNet.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                )}
            </CardContent>
        </Card>
    );
}

function PettyCashGroupedView({
    data,
    groupBy,
    selectedIds,
    toggleSelection,
    selectAll
}: {
    data: any[],
    groupBy: string,
    selectedIds: Set<string>,
    toggleSelection: (id: string) => void,
    selectAll: (ids: string[]) => void
}) {
    const grouped = useMemo(() => {
        const groups: Record<string, { items: any[], totals: { amount: number } }> = {};

        data.forEach(row => {
            let key = '';
            switch (groupBy) {
                case 'submitter': key = row.submitter_name || 'Unknown'; break;
                case 'month': key = row.date.substring(3, 10) || 'Unknown'; break;
                case 'status': key = row.status || 'Unknown'; break;
                default: key = 'All';
            }

            if (!groups[key]) {
                groups[key] = { items: [], totals: { amount: 0 } };
            }
            groups[key].items.push(row);
            groups[key].totals.amount += row.amount;
        });

        return Object.entries(groups).sort((a, b) => b[1].totals.amount - a[1].totals.amount);
    }, [data, groupBy]);

    return (
        <div className="space-y-2">
            {grouped.map(([key, { items, totals }]) => (
                <CollapsibleGroup
                    key={key}
                    title={key}
                    items={items}
                    totals={totals}
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
                    <span className="font-semibold text-sm block">₹{totals.amount.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-muted-foreground">Total</span>
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
                                    <TableHead className="text-xs">Description</TableHead>
                                    <TableHead className="text-xs">Submitted By</TableHead>
                                    <TableHead className="text-xs text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((row: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(row.id)}
                                                onCheckedChange={() => toggleSelection(row.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                                        <TableCell className="text-xs font-medium">{row.item_name}</TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate">{row.description}</TableCell>
                                        <TableCell className="text-xs">{row.submitter_name}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">₹{row.amount.toLocaleString('en-IN')}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            <div className="flex justify-end p-2 px-3 border-t border-dashed bg-muted/20">
                <div className="font-medium text-foreground text-xs">Total: ₹{totals.amount.toLocaleString('en-IN')}</div>
            </div>
        </div>
    );
}

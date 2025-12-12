import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, FileSpreadsheet, AlertCircle, RefreshCw, Calculator, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GSTR1Data {
    id: string;
    date: string;
    invoice_no: string;
    customer: string;
    gstin: string;
    taxable_value: number;
    gst_rate: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    hsn_sac: string;
    pos: string;
    type: 'B2B' | 'B2C' | 'Export';
    category_name: string;
}

interface WorksheetRow {
    description: string;
    taxable: number;
    gst: number;
    total: number;
    is_header?: boolean;
    is_total?: boolean;
}

export function GSTR1Filing() {
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState<string>(new Date().getMonth().toString());
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [gstr1Data, setGstr1Data] = useState<GSTR1Data[]>([]);
    const [worksheetData, setWorksheetData] = useState<{
        incomeRows: WorksheetRow[];
        expenseTotal: { taxable: number; gst: number };
        netPayable: number;
    } | null>(null);
    const [summary, setSummary] = useState<any>(null);
    const { toast } = useToast();

    // Helper to determine Fiscal Year from selected month/year
    const getFiscalYear = (m: number, y: number) => {
        return m >= 3 ? `FY${(y % 100)}-${(y % 100) + 1}` : `FY${(y % 100) - 1}-${(y % 100)}`;
    };

    const fetchGSTR1Data = async () => {
        setLoading(true);
        try {
            const selectedMonth = parseInt(month) + 1; // 1-12
            const selectedYear = parseInt(year);

            // 1. Fetch Approved Income Actuals (Output Liability)
            const { data: incomeData, error: incomeError } = await supabase
                .from('income_actuals')
                .select(`
                    id, 
                    created_at, 
                    actual_amount, 
                    gst_amount, 
                    month, 
                    fiscal_year,
                    notes,
                    income_categories!income_actuals_category_id_fkey (category_name)
                `)
                .eq('status', 'approved')
                .eq('month', selectedMonth)
                .like('fiscal_year', `%${selectedYear - (selectedMonth < 4 ? 1 : 0)}%`);

            if (incomeError) throw incomeError;

            // 2. Fetch Approved Expenses (Input Credit)
            // Construct start and end date for the selected month to filter expenses
            const startDate = new Date(selectedYear, selectedMonth - 1, 1);
            const endDate = new Date(selectedYear, selectedMonth, 0); // Last day of month

            const { data: expenseData, error: expenseError } = await supabase
                .from('expenses')
                .select('amount, gst_amount')
                .eq('status', 'approved')
                .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
                .lte('expense_date', format(endDate, 'yyyy-MM-dd'));

            if (expenseError) throw expenseError;

            // Helper to extract GSTIN
            const extractGSTIN = (text: string | null) => {
                if (!text) return null;
                const match = text.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/);
                return match ? match[0] : null;
            };

            // Process GSTR-1 Data (Invoice Level)
            const processedData: GSTR1Data[] = (incomeData || []).map((item: any) => {
                const taxable = Number(item.actual_amount) || 0;
                const gst = Number(item.gst_amount) || 0;
                let rate = 0;
                if (taxable > 0) {
                    rate = (gst / taxable) * 100;
                    if (Math.abs(rate - 18) < 1) rate = 18;
                    else if (Math.abs(rate - 12) < 1) rate = 12;
                    else if (Math.abs(rate - 5) < 1) rate = 5;
                    else if (Math.abs(rate - 28) < 1) rate = 28;
                    else if (rate < 1) rate = 0;
                }

                // Identify B2B based on GSTIN in notes
                const foundGSTIN = extractGSTIN(item.notes);
                const isB2B = !!foundGSTIN;

                return {
                    id: item.id,
                    date: format(new Date(item.created_at), 'dd-MM-yyyy'),
                    invoice_no: `INV-${item.id.substring(0, 6).toUpperCase()}`,
                    customer: isB2B ? 'Registered Business' : 'Resident',
                    gstin: foundGSTIN || '',
                    taxable_value: taxable,
                    gst_rate: rate,
                    igst: 0,
                    cgst: gst / 2,
                    sgst: gst / 2,
                    cess: 0,
                    hsn_sac: '999598',
                    pos: 'Local',
                    type: isB2B ? 'B2B' : 'B2C',
                    category_name: item.income_categories?.category_name || 'Income'
                };
            });

            setGstr1Data(processedData);

            // Process Monthly Worksheet (Aggregated View)
            const incomeMap = new Map<string, { taxable: number; gst: number }>();
            processedData.forEach(d => {
                const cat = d.category_name;
                if (!incomeMap.has(cat)) incomeMap.set(cat, { taxable: 0, gst: 0 });
                const entry = incomeMap.get(cat)!;
                entry.taxable += d.taxable_value;
                entry.gst += (d.cgst + d.sgst + d.igst);
            });

            const incomeRows: WorksheetRow[] = Array.from(incomeMap.entries()).map(([cat, val]) => ({
                description: cat,
                taxable: val.taxable,
                gst: val.gst,
                total: val.taxable + val.gst
            }));

            // Totals
            const totalIncomeTaxable = incomeRows.reduce((sum, r) => sum + r.taxable, 0);
            const totalIncomeGST = incomeRows.reduce((sum, r) => sum + r.gst, 0);

            // Expenses totals
            const totalExpenseTaxable = (expenseData || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const totalExpenseGST = (expenseData || []).reduce((sum, e) => sum + (Number(e.gst_amount) || 0), 0);

            setWorksheetData({
                incomeRows,
                expenseTotal: { taxable: totalExpenseTaxable, gst: totalExpenseGST },
                netPayable: totalIncomeGST - totalExpenseGST
            });

            setSummary({
                count: processedData.length,
                totalTaxable: totalIncomeTaxable,
                totalGST: totalIncomeGST,
                totalInvoiceValue: totalIncomeTaxable + totalIncomeGST
            });

            toast({ title: 'Worksheet Generated', description: `Calculated liability and input credit for ${format(startDate, 'MMM yyyy')}` });

        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (type: 'b2c' | 'b2b' | 'hsn' | 'full' | 'worksheet') => {
        if (!gstr1Data.length && !worksheetData) return;

        let dataToExport = [];
        let filename = `GSTR_${format(new Date(), 'yyyyMMdd')}`;

        if (type === 'worksheet' && worksheetData) {
            dataToExport = [
                { Description: '--- OUTPUT LIABILITY (SALES) ---', Taxable: '', GST: '', Total: '' },
                ...worksheetData.incomeRows.map(r => ({
                    Description: r.description,
                    Taxable: r.taxable,
                    GST: r.gst,
                    Total: r.total
                })),
                { Description: 'TOTAL SALES', Taxable: summary.totalTaxable, GST: summary.totalGST, Total: summary.totalInvoiceValue },
                { Description: '', Taxable: '', GST: '', Total: '' },
                { Description: '--- INPUT CREDIT (PURCHASES) ---', Taxable: '', GST: '', Total: '' },
                { Description: 'Total Eligible EXPENSES', Taxable: worksheetData.expenseTotal.taxable, GST: worksheetData.expenseTotal.gst, Total: worksheetData.expenseTotal.taxable + worksheetData.expenseTotal.gst },
                { Description: '', Taxable: '', GST: '', Total: '' },
                { Description: '--- NET PAYABLE ---', Taxable: '', GST: worksheetData.netPayable, Total: '' },
            ];
            filename += '_Worksheet';
        } else if (type === 'b2c') {
            const map = new Map();
            gstr1Data.filter(d => d.type === 'B2C').forEach(d => {
                const key = `${d.pos}-${d.gst_rate}`;
                if (!map.has(key)) map.set(key, { 'Place Of Supply': d.pos, 'Rate (%)': d.gst_rate, 'Taxable Value': 0, 'Cess Amount': 0 });
                map.get(key)['Taxable Value'] += d.taxable_value;
            });
            dataToExport = Array.from(map.values());
            filename += '_B2C';
        } else if (type === 'b2b') {
            dataToExport = gstr1Data.filter(d => d.type === 'B2B').map(d => ({
                'GSTIN/UIN': d.gstin,
                'Invoice Number': d.invoice_no,
                'Invoice Date': d.date,
                'Invoice Value': d.taxable_value + d.cgst + d.sgst,
                'Place Of Supply': d.pos,
                'Reverse Charge': 'N',
                'Invoice Type': 'Regular',
                'E-Commerce GSTIN': '',
                'Rate (%)': d.gst_rate,
                'Taxable Value': d.taxable_value,
                'Cess Amount': d.cess
            }));
            filename += '_B2B';
        } else if (type === 'hsn') {
            const map = new Map();
            gstr1Data.forEach(d => {
                const key = `${d.hsn_sac}`;
                if (!map.has(key)) map.set(key, {
                    'HSN/SAC': d.hsn_sac, 'Description': 'Maintenance Services', 'UQC': 'NA',
                    'Total Quantity': 0, 'Total Value': 0, 'Taxable Value': 0,
                    'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0
                });
                const entry = map.get(key);
                entry['Total Value'] += (d.taxable_value + d.cgst + d.sgst + d.igst);
                entry['Taxable Value'] += d.taxable_value;
                entry['IGST'] += d.igst; entry['CGST'] += d.cgst; entry['SGST'] += d.sgst;
            });
            dataToExport = Array.from(map.values());
            filename += '_HSN';
        } else {
            dataToExport = gstr1Data;
            filename += '_Detailed';
        }

        exportToExcel(dataToExport, filename);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Monthly GST Workings & Filing
                    </CardTitle>
                    <CardDescription>
                        Generate "Workings Sheet" for GSTR-3B (Net Liability) and GSTR-1 (Sales Reporting).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
                        <div className="space-y-2 w-full sm:w-40">
                            <Label>Month</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                            {format(new Date(2025, i, 1), 'MMMM')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 w-full sm:w-40">
                            <Label>Year</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2023, 2024, 2025, 2026].map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={fetchGSTR1Data} disabled={loading} className="w-full sm:w-auto">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Generate Workings
                        </Button>
                    </div>

                    <Alert className="bg-blue-50 text-blue-800 border-blue-200 mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Reconciliation Note</AlertTitle>
                        <AlertDescription>
                            This tool reconciles <strong>Approved Income</strong> (Output Tax) against <strong>Approved Expenses</strong> (Input Credit)
                            to estimate your Net GST Payable (GSTR-3B). Detailed invocies are prepared for GSTR-1.
                        </AlertDescription>
                    </Alert>

                    {summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground uppercase font-bold">Total Sales</p>
                                <p className="text-2xl font-bold">₹{summary.totalInvoiceValue.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground uppercase font-bold">Output GST</p>
                                <p className="text-2xl font-bold text-red-600">₹{summary.totalGST.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground uppercase font-bold">Input Credit</p>
                                <p className="text-2xl font-bold text-green-600">₹{worksheetData?.expenseTotal.gst.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-primary/10 p-4 rounded-lg text-center border-2 border-primary/20">
                                <p className="text-sm text-primary uppercase font-bold">Net Payable</p>
                                <p className="text-2xl font-bold text-primary">₹{worksheetData?.netPayable.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    )}

                    {gstr1Data.length > 0 && worksheetData && (
                        <div className="space-y-4">
                            <Tabs defaultValue="worksheet" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="worksheet"><Calculator className="w-4 h-4 mr-2" />Monthly Worksheet</TabsTrigger>
                                    <TabsTrigger value="b2b-4a">GSTR-1 (B2B)</TabsTrigger>
                                    <TabsTrigger value="b2c-small">GSTR-1 (B2C)</TabsTrigger>
                                    <TabsTrigger value="hsn">GSTR-1 (HSN)</TabsTrigger>
                                    <TabsTrigger value="docs">All Invoices</TabsTrigger>
                                </TabsList>

                                <TabsContent value="worksheet" className="mt-4 animate-in fade-in-50">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-medium">Monthly GST Workings</h3>
                                        <Button variant="outline" size="sm" onClick={() => handleExport('worksheet')}>
                                            <Download className="mr-2 h-4 w-4" /> Export Worksheet
                                        </Button>
                                    </div>
                                    <Card>
                                        <CardContent className="p-0 overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted">
                                                    <TableRow>
                                                        <TableHead className="w-[40%]">Description</TableHead>
                                                        <TableHead className="text-right">Taxable Value</TableHead>
                                                        <TableHead className="text-right">GST Amount</TableHead>
                                                        <TableHead className="text-right">Total Value</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    <TableRow className="bg-slate-50 font-semibold text-xs uppercase text-muted-foreground">
                                                        <TableCell colSpan={4}>Output Liability (Approved Income)</TableCell>
                                                    </TableRow>
                                                    {worksheetData.incomeRows.length === 0 ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No income records found</TableCell></TableRow>
                                                    ) : worksheetData.incomeRows.map((row, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell className="font-medium">{row.description}</TableCell>
                                                            <TableCell className="text-right">₹{row.taxable.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right text-red-600">₹{row.gst.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right font-medium">₹{row.total.toLocaleString('en-IN')}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    <TableRow className="bg-slate-100 font-bold">
                                                        <TableCell>Total Sales (A)</TableCell>
                                                        <TableCell className="text-right">₹{summary.totalTaxable.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right text-red-700">₹{summary.totalGST.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right">₹{summary.totalInvoiceValue.toLocaleString('en-IN')}</TableCell>
                                                    </TableRow>

                                                    <TableRow className="h-4 bg-transparent border-none"><TableCell colSpan={4}></TableCell></TableRow>

                                                    <TableRow className="bg-slate-50 font-semibold text-xs uppercase text-muted-foreground">
                                                        <TableCell colSpan={4}>Input Tax Credit (Approved Expenses)</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell>Total Eligible Purchases</TableCell>
                                                        <TableCell className="text-right">₹{worksheetData.expenseTotal.taxable.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right text-green-600">₹{worksheetData.expenseTotal.gst.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right font-medium">₹{(worksheetData.expenseTotal.taxable + worksheetData.expenseTotal.gst).toLocaleString('en-IN')}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="bg-slate-100 font-bold">
                                                        <TableCell>Total Input Credit (B)</TableCell>
                                                        <TableCell className="text-right"></TableCell>
                                                        <TableCell className="text-right text-green-700">₹{worksheetData.expenseTotal.gst.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right"></TableCell>
                                                    </TableRow>

                                                    <TableRow className="h-4 bg-transparent border-none"><TableCell colSpan={4}></TableCell></TableRow>

                                                    <TableRow className="bg-primary/5 font-bold text-lg border-t-2 border-primary">
                                                        <TableCell>NET GST PAYABLE (A - B)</TableCell>
                                                        <TableCell className="text-right"></TableCell>
                                                        <TableCell className="text-right text-primary">₹{worksheetData.netPayable.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right flex items-center justify-end gap-2">

                                                            {worksheetData.netPayable > 0 ? (
                                                                <span className="text-sm font-normal text-muted-foreground">(Payable)</span>
                                                            ) : (
                                                                <span className="text-sm font-normal text-muted-foreground">(Credit)</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="b2b-4a" className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-medium">B2B (Registered) Details</h3>
                                        <Button variant="outline" size="sm" onClick={() => handleExport('b2b')}>
                                            <Download className="mr-2 h-4 w-4" /> Export Excel
                                        </Button>
                                    </div>
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted">
                                                    <TableHead>GSTIN/UIN</TableHead>
                                                    <TableHead>Invoice No</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead className="text-right">Taxable Value</TableHead>
                                                    <TableHead className="text-right">Total Tax</TableHead>
                                                    <TableHead className="text-right">Invoice Value</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {gstr1Data.filter(d => d.type === 'B2B').length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                                            No B2B transactions found containing GSTIN in notes.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    gstr1Data.filter(d => d.type === 'B2B').map((row) => (
                                                        <TableRow key={row.id}>
                                                            <TableCell className="font-mono text-xs">{row.gstin}</TableCell>
                                                            <TableCell className="text-xs">{row.invoice_no}</TableCell>
                                                            <TableCell>{row.date}</TableCell>
                                                            <TableCell className="text-right">₹{row.taxable_value.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right">₹{(row.cgst + row.sgst).toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right font-medium">₹{(row.taxable_value + row.cgst + row.sgst).toLocaleString('en-IN')}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                <TabsContent value="b2c-small" className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-medium">B2C (Small) Details</h3>
                                        <Button variant="outline" size="sm" onClick={() => handleExport('b2c')}>
                                            <Download className="mr-2 h-4 w-4" /> Export Excel
                                        </Button>
                                    </div>
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted">
                                                    <TableHead>Place of Supply</TableHead>
                                                    <TableHead className="text-right">Rate (%)</TableHead>
                                                    <TableHead className="text-right">Taxable Value</TableHead>
                                                    <TableHead className="text-right">Cess</TableHead>
                                                    <TableHead className="text-right">E-Commerce GSTIN</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(() => {
                                                    const map = new Map();
                                                    gstr1Data.filter(d => d.type === 'B2C').forEach(d => {
                                                        const key = `${d.pos}-${d.gst_rate}`;
                                                        if (!map.has(key)) map.set(key, { pos: d.pos, rate: d.gst_rate, val: 0 });
                                                        map.get(key).val += d.taxable_value;
                                                    });
                                                    return Array.from(map.values()).map((row, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{row.pos}</TableCell>
                                                            <TableCell className="text-right">{row.rate}%</TableCell>
                                                            <TableCell className="text-right">₹{row.val.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right">₹0</TableCell>
                                                            <TableCell className="text-right">-</TableCell>
                                                        </TableRow>
                                                    ));
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                {/* GSTR-1 HSN & Docs Tabs kept same */}
                                <TabsContent value="hsn" className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-medium">HSN Wise Summary</h3>
                                        <Button variant="outline" size="sm" onClick={() => handleExport('hsn')}>
                                            <Download className="mr-2 h-4 w-4" /> Export Excel
                                        </Button>
                                    </div>
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted">
                                                    <TableHead>HSN/SAC</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead>UQC</TableHead>
                                                    <TableHead className="text-right">Total Quantity</TableHead>
                                                    <TableHead className="text-right">Total Value</TableHead>
                                                    <TableHead className="text-right">Taxable Value</TableHead>
                                                    <TableHead className="text-right">IGST</TableHead>
                                                    <TableHead className="text-right">CGST</TableHead>
                                                    <TableHead className="text-right">SGST</TableHead>
                                                    <TableHead className="text-right">Cess</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(() => {
                                                    const map = new Map();
                                                    gstr1Data.forEach(d => {
                                                        const key = `${d.hsn_sac}`;
                                                        if (!map.has(key)) map.set(key, {
                                                            hsn: d.hsn_sac, val: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0
                                                        });
                                                        const item = map.get(key);
                                                        item.val += (d.taxable_value + d.cgst + d.sgst + d.igst);
                                                        item.taxable += d.taxable_value;
                                                        item.igst += d.igst;
                                                        item.cgst += d.cgst;
                                                        item.sgst += d.sgst;
                                                    });
                                                    return Array.from(map.values()).map((row, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{row.hsn}</TableCell>
                                                            <TableCell>Maintenance Services</TableCell>
                                                            <TableCell>NA</TableCell>
                                                            <TableCell className="text-right">0</TableCell>
                                                            <TableCell className="text-right">₹{row.val.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right">₹{row.taxable.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right">₹{row.igst.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right">₹{row.cgst.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right">₹{row.sgst.toLocaleString('en-IN')}</TableCell>
                                                            <TableCell className="text-right">0</TableCell>
                                                        </TableRow>
                                                    ));
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                <TabsContent value="docs" className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-medium">Document Issued Details</h3>
                                        <Button variant="outline" size="sm" onClick={() => handleExport('full')}>
                                            <Download className="mr-2 h-4 w-4" /> Export Full List
                                        </Button>
                                    </div>
                                    <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-muted">
                                                <TableRow>
                                                    <TableHead>Invoice No</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead className="text-right">Taxable</TableHead>
                                                    <TableHead className="text-right">Tax</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {gstr1Data.map((row) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-mono text-xs">{row.invoice_no}</TableCell>
                                                        <TableCell>{row.date}</TableCell>
                                                        <TableCell>{row.category_name}</TableCell>
                                                        <TableCell className="text-right">₹{row.taxable_value.toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right">₹{(row.cgst + row.sgst).toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="text-right font-medium">₹{(row.taxable_value + row.cgst + row.sgst).toLocaleString('en-IN')}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

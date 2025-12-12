import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, FileSpreadsheet, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GSTR1Data {
    id: string;
    date: string;
    invoice_no: string; // Placeholder (using ID)
    customer: string; // "Resident" or "Member"
    gstin: string; // Empty for now
    taxable_value: number;
    gst_rate: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    hsn_sac: string;
    pos: string; // Place of Supply
    type: 'B2B' | 'B2C' | 'Export';
    category_name: string;
}

export function GSTR1Filing() {
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState<string>(new Date().getMonth().toString());
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [gstr1Data, setGstr1Data] = useState<GSTR1Data[]>([]);
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

            // Fetch Approved Income Actuals
            const { data: incomeData, error: incomeError } = await supabase
                .from('income_actuals')
                .select(`
                    id, 
                    created_at, 
                    actual_amount, 
                    gst_amount, 
                    month, 
                    fiscal_year,
                    income_categories!income_actuals_category_id_fkey (category_name)
                `)
                .eq('status', 'approved')
                .eq('month', selectedMonth)
                .like('fiscal_year', `%${selectedYear - (selectedMonth < 4 ? 1 : 0)}%`); // Rough matching, strict equality better if FY logic refined

            if (incomeError) throw incomeError;

            // Normalize Data
            // Assumption: Intra-state supply (CGST+SGST)
            // Assumption: All B2C (Small) for now as no GSTIN stored
            const processedData: GSTR1Data[] = (incomeData || []).map((item: any) => {
                const taxable = Number(item.actual_amount) || 0;
                const gst = Number(item.gst_amount) || 0;
                let rate = 0;

                if (taxable > 0) {
                    rate = (gst / taxable) * 100;
                    // Round to nearest standard rate (5, 12, 18, 28) to handle float errors
                    if (Math.abs(rate - 18) < 1) rate = 18;
                    else if (Math.abs(rate - 12) < 1) rate = 12;
                    else if (Math.abs(rate - 5) < 1) rate = 5;
                    else if (Math.abs(rate - 28) < 1) rate = 28;
                    else if (rate < 1) rate = 0; // Nil rated or Exempt
                }

                // Split GST
                const cgst = gst / 2;
                const sgst = gst / 2;

                return {
                    id: item.id,
                    date: format(new Date(item.created_at), 'dd-MM-yyyy'),
                    invoice_no: `INV-${item.id.substring(0, 6).toUpperCase()}`, // Simulated Invoice No
                    customer: 'Resident',
                    gstin: '',
                    taxable_value: taxable,
                    gst_rate: rate,
                    igst: 0,
                    cgst: cgst,
                    sgst: sgst,
                    cess: 0,
                    hsn_sac: '999598', // Maintenance Services SAC
                    pos: 'Local',
                    type: 'B2C',
                    category_name: item.income_categories?.category_name || 'Income'
                };
            });

            setGstr1Data(processedData);

            // Calculate Summary
            const totalTaxable = processedData.reduce((sum, d) => sum + d.taxable_value, 0);
            const totalGST = processedData.reduce((sum, d) => sum + d.cgst + d.sgst + d.igst, 0);
            const totalInvoiceValue = totalTaxable + totalGST;

            setSummary({
                count: processedData.length,
                totalTaxable,
                totalGST,
                totalInvoiceValue
            });

            toast({ title: 'GSTR-1 Data Calculated', description: `${processedData.length} invoices processed.` });

        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (type: 'b2c' | 'hsn' | 'full') => {
        if (gstr1Data.length === 0) return;

        let dataToExport = [];
        let filename = `GSTR1_${format(new Date(), 'yyyyMMdd')}`;

        if (type === 'b2c') {
            // Aggregate by Rate
            const map = new Map();
            gstr1Data.forEach(d => {
                const key = `${d.pos}-${d.gst_rate}`;
                if (!map.has(key)) {
                    map.set(key, {
                        'Place Of Supply': d.pos,
                        'Rate (%)': d.gst_rate,
                        'Taxable Value': 0,
                        'Cess Amount': 0
                    });
                }
                const entry = map.get(key);
                entry['Taxable Value'] += d.taxable_value;
            });
            dataToExport = Array.from(map.values());
            filename += '_B2C';
        } else if (type === 'hsn') {
            // Aggregate by HSN
            const map = new Map();
            gstr1Data.forEach(d => {
                const key = `${d.hsn_sac}`;
                if (!map.has(key)) {
                    map.set(key, {
                        'HSN/SAC': d.hsn_sac,
                        'Description': 'Maintenance Services',
                        'UQC': 'NA',
                        'Total Quantity': 0,
                        'Total Value': 0,
                        'Taxable Value': 0,
                        'IGST': 0,
                        'CGST': 0,
                        'SGST': 0,
                        'Cess': 0
                    });
                }
                const entry = map.get(key);
                entry['Total Value'] += (d.taxable_value + d.cgst + d.sgst + d.igst);
                entry['Taxable Value'] += d.taxable_value;
                entry['CGST'] += d.cgst;
                entry['SGST'] += d.sgst;
            });
            dataToExport = Array.from(map.values());
            filename += '_HSN';
        } else {
            // Full Dump
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
                        GSTR-1 Preparation
                    </CardTitle>
                    <CardDescription>
                        Generate monthly GSTR-1 data for outward supplies (Sales/Income).
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
                            Process Data
                        </Button>
                    </div>

                    <Alert className="bg-blue-50 text-blue-800 border-blue-200 mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                            Currently, all income is treated as <strong>B2C Small (Intra-state)</strong> as resident GSTINs are not recorded.
                            Default SAC Code <strong>999598</strong> is applied.
                        </AlertDescription>
                    </Alert>

                    {summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground uppercase font-bold">Invoices</p>
                                <p className="text-2xl font-bold">{summary.count}</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground uppercase font-bold">Taxable Value</p>
                                <p className="text-2xl font-bold">₹{summary.totalTaxable.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground uppercase font-bold">Total Tax</p>
                                <p className="text-2xl font-bold text-red-600">₹{summary.totalGST.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground uppercase font-bold">Total Value</p>
                                <p className="text-2xl font-bold text-green-600">₹{summary.totalInvoiceValue.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    )}

                    {gstr1Data.length > 0 && (
                        <div className="space-y-4">
                            <Tabs defaultValue="b2c-small" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="b2c-small">B2C (Small) - Table 7</TabsTrigger>
                                    <TabsTrigger value="hsn">HSN Summary - Table 12</TabsTrigger>
                                    <TabsTrigger value="docs">Document Details - Table 13</TabsTrigger>
                                </TabsList>

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
                                                {/* Aggregate by Rate */}
                                                {(() => {
                                                    const map = new Map();
                                                    gstr1Data.forEach(d => {
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
                                                {/* Aggregate by HSN */}
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

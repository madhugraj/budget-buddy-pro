import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ALL_TOWERS = [
    '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
    '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
    '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

const TOWERS = ['All', ...ALL_TOWERS];

const PERIOD_TYPES = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'half_yearly', label: 'Half Yearly' },
    { value: 'yearly', label: 'Yearly' }
];

const QUARTERS = [
    { value: 1, label: 'Q1 (Apr-Jun)', months: [4, 5, 6] },
    { value: 2, label: 'Q2 (Jul-Sep)', months: [7, 8, 9] },
    { value: 3, label: 'Q3 (Oct-Dec)', months: [10, 11, 12] },
    { value: 4, label: 'Q4 (Jan-Mar)', months: [1, 2, 3] }
];

const HALF_YEARS = [
    { value: 'H1', label: 'H1 (Apr-Sep)', months: [4, 5, 6, 7, 8, 9] },
    { value: 'H2', label: 'H2 (Oct-Mar)', months: [10, 11, 12, 1, 2, 3] }
];

const MONTHS = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

interface CAMDocument {
    id: string;
    tower: string;
    quarter: number;
    year: number;
    month: number | null;
    document_url: string | null;
    status: string;
    submitted_at: string | null;
    approved_at: string | null;
    paid_flats: number;
    pending_flats: number;
    total_flats: number;
}

interface MissingDocument {
    tower: string;
    month: number;
    year: number;
    hasRecord: boolean;
    hasDocument: boolean;
}

export default function CAMReports() {
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState<CAMDocument[]>([]);
    const [missingDocuments, setMissingDocuments] = useState<MissingDocument[]>([]);
    const [selectedTower, setSelectedTower] = useState('All');
    const [selectedPeriodType, setSelectedPeriodType] = useState('monthly');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));
    const [selectedHalfYear, setSelectedHalfYear] = useState<string>(new Date().getMonth() < 6 ? 'H1' : 'H2');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState('documents');

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        if (userRole === 'treasurer' || userRole === 'lead') {
            loadDocuments();
        }
    }, [selectedTower, selectedPeriodType, selectedMonth, selectedQuarter, selectedHalfYear, selectedYear, userRole]);

    const getMonthsForPeriod = (): number[] => {
        if (selectedPeriodType === 'monthly') {
            return [selectedMonth];
        } else if (selectedPeriodType === 'quarterly') {
            return QUARTERS.find(q => q.value === selectedQuarter)?.months || [];
        } else if (selectedPeriodType === 'half_yearly') {
            return HALF_YEARS.find(h => h.value === selectedHalfYear)?.months || [];
        } else {
            // Yearly - all 12 months
            return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        }
    };

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const monthsToQuery = getMonthsForPeriod();
            
            let query = supabase
                .from('cam_tracking')
                .select('id, tower, quarter, year, month, document_url, status, submitted_at, approved_at, paid_flats, pending_flats, total_flats')
                .eq('year', selectedYear)
                .in('month', monthsToQuery)
                .in('status', ['submitted', 'approved'])
                .order('tower')
                .order('month');

            // Tower filter
            if (selectedTower !== 'All') {
                query = query.eq('tower', selectedTower);
            }

            const { data, error } = await query;

            if (error) throw error;

            setDocuments(data as CAMDocument[] || []);
            
            // Calculate missing documents
            const towersToCheck = selectedTower === 'All' ? ALL_TOWERS : [selectedTower];
            const missing: MissingDocument[] = [];
            
            towersToCheck.forEach(tower => {
                monthsToQuery.forEach(month => {
                    const record = data?.find(d => d.tower === tower && d.month === month);
                    if (!record || !record.document_url) {
                        missing.push({
                            tower,
                            month,
                            year: selectedYear,
                            hasRecord: !!record,
                            hasDocument: false
                        });
                    }
                });
            });
            
            setMissingDocuments(missing);
        } catch (error: any) {
            toast.error('Failed to load CAM records: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getQuarterLabel = (quarter: number) => {
        return QUARTERS.find(q => q.value === quarter)?.label || `Q${quarter}`;
    };

    const getMonthLabel = (month: number | null) => {
        if (month === null) return '-';
        return MONTHS.find(m => m.value === month)?.label || `M${month}`;
    };

    // Extract file path from invoices bucket URL
    const extractInvoicesPath = (url: string): string | null => {
        const match = url.match(/\/storage\/v1\/object\/public\/invoices\/(.+)$/);
        return match ? match[1] : null;
    };

    // Check if document_url is a full URL or a file path
    const isFullUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

    const getSignedUrl = async (documentUrl: string): Promise<string> => {
        // Check if it's from the old invoices bucket (private bucket, public URL won't work)
        const invoicesPath = extractInvoicesPath(documentUrl);
        if (invoicesPath) {
            const { data, error } = await supabase.storage
                .from('invoices')
                .createSignedUrl(invoicesPath, 3600);
            if (error) throw error;
            return data.signedUrl;
        }
        
        // If it's a file path (not full URL), it's in the 'cam' bucket
        if (!isFullUrl(documentUrl)) {
            const { data, error } = await supabase.storage
                .from('cam')
                .createSignedUrl(documentUrl, 3600);
            if (error) throw error;
            return data.signedUrl;
        }
        
        // Otherwise return as-is (truly public URL)
        return documentUrl;
    };

    const downloadDocument = async (documentUrl: string, tower: string, month: number | null, year: number) => {
        try {
            const downloadUrl = await getSignedUrl(documentUrl);
            const monthLabel = month ? getMonthLabel(month).substring(0, 3) : '';

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `CAM_${tower}_${monthLabel}_${year}.xlsx`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Document download started');
        } catch (error: any) {
            toast.error('Failed to download document: ' + error.message);
        }
    };

    const getPeriodDisplay = (doc: CAMDocument) => {
        return getMonthLabel(doc.month);
    };

    if (userRole !== 'treasurer' && userRole !== 'lead') {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-muted-foreground">
                            This page is only accessible to Treasurers and Leads.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <FileText className="h-8 w-8" />
                    CAM Supporting Documents
                </h1>
                <p className="text-muted-foreground mt-1">
                    View status and download CAM documents uploaded by Lead users
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filter Documents</CardTitle>
                    <CardDescription>
                        Select filters to view CAM supporting documents
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tower</label>
                            <Select value={selectedTower} onValueChange={setSelectedTower}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TOWERS.map(tower => (
                                        <SelectItem key={tower} value={tower}>{tower}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Year</label>
                            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Period Type</label>
                            <Select value={selectedPeriodType} onValueChange={setSelectedPeriodType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERIOD_TYPES.map(pt => (
                                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedPeriodType === 'monthly' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Month</label>
                                <Select 
                                    value={selectedMonth.toString()} 
                                    onValueChange={(val) => setSelectedMonth(parseInt(val))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map(month => (
                                            <SelectItem key={month.value} value={month.value.toString()}>
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {selectedPeriodType === 'quarterly' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Quarter</label>
                                <Select 
                                    value={selectedQuarter.toString()} 
                                    onValueChange={(val) => setSelectedQuarter(parseInt(val))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {QUARTERS.map(q => (
                                            <SelectItem key={q.value} value={q.value.toString()}>
                                                {q.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {selectedPeriodType === 'half_yearly' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Half Year</label>
                                <Select value={selectedHalfYear} onValueChange={setSelectedHalfYear}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HALF_YEARS.map(h => (
                                            <SelectItem key={h.value} value={h.value}>
                                                {h.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            {documents.length} document(s) found | {missingDocuments.length} missing
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedTower('All');
                                setSelectedPeriodType('monthly');
                                setSelectedMonth(new Date().getMonth() + 1);
                                setSelectedQuarter(Math.ceil((new Date().getMonth() + 1) / 3));
                                setSelectedHalfYear(new Date().getMonth() < 6 ? 'H1' : 'H2');
                            }}
                        >
                            Reset Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="documents">
                                Uploaded Documents ({documents.filter(d => d.document_url).length})
                            </TabsTrigger>
                            <TabsTrigger value="missing" className="text-destructive">
                                Missing Documents ({missingDocuments.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="documents">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : documents.length === 0 ? (
                                <p className="text-center py-8 text-muted-foreground">
                                    No records found for the selected filters
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tower</TableHead>
                                                <TableHead>Month</TableHead>
                                                <TableHead>Year</TableHead>
                                                <TableHead className="text-center">Paid</TableHead>
                                                <TableHead className="text-center">Pending</TableHead>
                                                <TableHead className="text-center">Total</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Submitted</TableHead>
                                                <TableHead>Approved</TableHead>
                                                <TableHead className="text-right">Document</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {documents.map((doc) => (
                                                <TableRow key={doc.id}>
                                                    <TableCell className="font-medium">{doc.tower}</TableCell>
                                                    <TableCell>{getPeriodDisplay(doc)}</TableCell>
                                                    <TableCell>{doc.year}</TableCell>
                                                    <TableCell className="text-center text-green-600 font-medium">
                                                        {doc.paid_flats}
                                                    </TableCell>
                                                    <TableCell className="text-center text-red-600 font-medium">
                                                        {doc.pending_flats}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {doc.total_flats}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={doc.status === 'approved' ? 'default' : 'secondary'}>
                                                            {doc.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString() : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {doc.approved_at ? new Date(doc.approved_at).toLocaleDateString() : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {doc.document_url ? (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => downloadDocument(doc.document_url!, doc.tower, doc.month, doc.year)}
                                                            >
                                                                <Download className="w-4 h-4 mr-1" />
                                                                Download
                                                            </Button>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">No document</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="missing">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : missingDocuments.length === 0 ? (
                                <div className="text-center py-8 text-green-600">
                                    All documents are uploaded for the selected period!
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                                        <AlertTriangle className="h-5 w-5" />
                                        <span className="text-sm font-medium">
                                            {missingDocuments.length} tower-month combinations are missing documents
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Tower</TableHead>
                                                    <TableHead>Month</TableHead>
                                                    <TableHead>Year</TableHead>
                                                    <TableHead>CAM Record</TableHead>
                                                    <TableHead>Document Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {missingDocuments.map((item, idx) => (
                                                    <TableRow key={`${item.tower}-${item.month}-${item.year}-${idx}`}>
                                                        <TableCell className="font-medium">{item.tower}</TableCell>
                                                        <TableCell>{getMonthLabel(item.month)}</TableCell>
                                                        <TableCell>{item.year}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={item.hasRecord ? 'secondary' : 'destructive'}>
                                                                {item.hasRecord ? 'Record exists' : 'No record'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="destructive">
                                                                Not uploaded
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

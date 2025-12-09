import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, Loader2, AlertTriangle, Eye, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ExcelPreviewDialog } from '@/components/ExcelPreviewDialog';

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

interface MissingQuarter {
    tower: string;
    quarter: number;
    year: number;
    quarterLabel: string;
    hasAnyRecord: boolean;
    hasDocument: boolean;
    recordCount: number;
}

export default function CAMReports() {
    const { userRole, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sendingReminders, setSendingReminders] = useState(false);
    const [documents, setDocuments] = useState<CAMDocument[]>([]);
    const [missingQuarters, setMissingQuarters] = useState<MissingQuarter[]>([]);
    const [selectedTower, setSelectedTower] = useState('All');
    const [selectedPeriodType, setSelectedPeriodType] = useState('quarterly');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));
    const [selectedHalfYear, setSelectedHalfYear] = useState<string>(new Date().getMonth() < 6 ? 'H1' : 'H2');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState('documents');
    const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set());

    // Preview state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [currentDownloadFn, setCurrentDownloadFn] = useState<(() => void) | null>(null);

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
            return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        }
    };

    const getQuartersForPeriod = (): number[] => {
        if (selectedPeriodType === 'monthly') {
            // Find which quarter this month belongs to
            const q = QUARTERS.find(q => q.months.includes(selectedMonth));
            return q ? [q.value] : [];
        } else if (selectedPeriodType === 'quarterly') {
            return [selectedQuarter];
        } else if (selectedPeriodType === 'half_yearly') {
            if (selectedHalfYear === 'H1') return [1, 2];
            return [3, 4];
        } else {
            return [1, 2, 3, 4];
        }
    };

    const isQuarterStarted = (quarter: number, year: number) => {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        const currentYear = currentDate.getFullYear();

        // Quarter start months: Q1->Apr(4), Q2->Jul(7), Q3->Oct(10), Q4->Jan(1).
        // Note: Q4 of FY Year X starts in Jan of Year X+1.
        const quarterStartMonths: Record<number, number> = { 1: 4, 2: 7, 3: 10, 4: 1 };
        const startMonth = quarterStartMonths[quarter];

        // Adjust calendar year for the quarter start
        const quarterStartYear = quarter === 4 ? year + 1 : year;

        // If start year is in the past, it definitely started
        if (quarterStartYear < currentYear) return true;

        // If start year is in the future, it definitely hasn't started
        if (quarterStartYear > currentYear) return false;

        // Same year, check month
        return currentMonth >= startMonth;
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

            if (selectedTower !== 'All') {
                query = query.eq('tower', selectedTower);
            }

            const { data, error } = await query;

            if (error) throw error;

            setDocuments(data as CAMDocument[] || []);

            // Calculate missing quarters (CAM is quarterly-based)
            const towersToCheck = selectedTower === 'All' ? ALL_TOWERS : [selectedTower];
            const quartersToCheck = getQuartersForPeriod();
            const missing: MissingQuarter[] = [];

            towersToCheck.forEach(tower => {
                quartersToCheck.forEach(quarter => {
                    const quarterData = QUARTERS.find(q => q.value === quarter);
                    if (!quarterData) return;

                    // Skip future quarters
                    if (!isQuarterStarted(quarter, selectedYear)) return;

                    // Check if any record exists for this tower in this quarter
                    const quarterRecords = data?.filter(d =>
                        d.tower === tower &&
                        quarterData.months.includes(d.month as number)
                    ) || [];

                    // Check if any record has a document
                    // Logic: If at least one document exists (even partial), don't show in missing
                    const hasDocument = quarterRecords.some(r => r.document_url);

                    // A quarter is considered missing if there's no document for the quarter
                    if (!hasDocument) {
                        missing.push({
                            tower,
                            quarter,
                            year: selectedYear,
                            quarterLabel: quarterData.label,
                            hasAnyRecord: quarterRecords.length > 0,
                            hasDocument: false,
                            recordCount: quarterRecords.length
                        });
                    }
                });
            });

            setMissingQuarters(missing);
            setSelectedMissing(new Set());
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

    const extractInvoicesPath = (url: string): string | null => {
        const match = url.match(/\/storage\/v1\/object\/public\/invoices\/(.+)$/);
        return match ? match[1] : null;
    };

    const isFullUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

    const getSignedUrl = async (documentUrl: string): Promise<string> => {
        const invoicesPath = extractInvoicesPath(documentUrl);
        if (invoicesPath) {
            const { data, error } = await supabase.storage
                .from('invoices')
                .createSignedUrl(invoicesPath, 3600);
            if (error) throw error;
            return data.signedUrl;
        }

        if (!isFullUrl(documentUrl)) {
            const { data, error } = await supabase.storage
                .from('cam')
                .createSignedUrl(documentUrl, 3600);
            if (error) throw error;
            return data.signedUrl;
        }

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

    const previewDocument = async (documentUrl: string, tower: string, month: number | null, year: number) => {
        try {
            const signedUrl = await getSignedUrl(documentUrl);
            const monthLabel = month ? getMonthLabel(month).substring(0, 3) : '';

            setPreviewUrl(signedUrl);
            setPreviewTitle(`CAM Document - Tower ${tower} - ${monthLabel} ${year}`);
            setCurrentDownloadFn(() => () => downloadDocument(documentUrl, tower, month, year));
            setPreviewOpen(true);
        } catch (error: any) {
            toast.error('Failed to load document preview: ' + error.message);
        }
    };

    const toggleSelectMissing = (key: string) => {
        setSelectedMissing(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const toggleSelectAllMissing = () => {
        if (selectedMissing.size === missingQuarters.length) {
            setSelectedMissing(new Set());
        } else {
            setSelectedMissing(new Set(missingQuarters.map(m => `${m.tower}-${m.quarter}-${m.year}`)));
        }
    };

    const sendReminders = async () => {
        if (selectedMissing.size === 0) {
            toast.error('Please select at least one missing record');
            return;
        }

        if (userRole !== 'treasurer') {
            toast.error('Only treasurers can send reminders');
            return;
        }

        setSendingReminders(true);
        try {
            // Get all lead users
            const { data: leadRoles, error: rolesError } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'lead');

            if (rolesError) throw rolesError;

            if (!leadRoles || leadRoles.length === 0) {
                toast.error('No lead users found to notify');
                return;
            }

            // Create notifications for each selected missing item for each lead
            const selectedItems = missingQuarters.filter(m =>
                selectedMissing.has(`${m.tower}-${m.quarter}-${m.year}`)
            );

            const notifications = leadRoles.flatMap(lead =>
                selectedItems.map(item => ({
                    user_id: lead.user_id,
                    type: 'cam_reminder',
                    title: `CAM Document Missing - Tower ${item.tower}`,
                    message: `Please upload CAM document for Tower ${item.tower}, ${item.quarterLabel} ${item.year}`,
                    created_by: user?.id
                }))
            );

            const { error: insertError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (insertError) throw insertError;

            toast.success(`Reminders sent for ${selectedItems.length} missing document(s) to ${leadRoles.length} lead(s)`);
            setSelectedMissing(new Set());
        } catch (error: any) {
            console.error('Error sending reminders:', error);
            toast.error('Failed to send reminders: ' + error.message);
        } finally {
            setSendingReminders(false);
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
                        Select filters to view CAM supporting documents. CAM invoices are generated quarterly.
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
                            {documents.filter(d => d.document_url).length} document(s) found | {missingQuarters.length} quarter(s) missing
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedTower('All');
                                setSelectedPeriodType('quarterly');
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
                                Missing Documents ({missingQuarters.length})
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
                                                <TableHead className="text-right">Actions</TableHead>
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
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => previewDocument(doc.document_url!, doc.tower, doc.month, doc.year)}
                                                                >
                                                                    <Eye className="w-4 h-4 mr-1" />
                                                                    View
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => downloadDocument(doc.document_url!, doc.tower, doc.month, doc.year)}
                                                                >
                                                                    <Download className="w-4 h-4 mr-1" />
                                                                    Download
                                                                </Button>
                                                            </div>
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
                            ) : missingQuarters.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-green-600">
                                    <CheckCircle2 className="h-12 w-12 mb-2" />
                                    <span>All CAM documents are uploaded for the selected period!</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg flex-1">
                                            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                                            <span className="text-sm font-medium">
                                                {missingQuarters.length} tower-quarter combinations are missing documents
                                            </span>
                                        </div>
                                        {userRole === 'treasurer' && (
                                            <Button
                                                onClick={sendReminders}
                                                disabled={selectedMissing.size === 0 || sendingReminders}
                                                className="ml-4"
                                            >
                                                {sendingReminders ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4 mr-2" />
                                                )}
                                                Send Reminder ({selectedMissing.size})
                                            </Button>
                                        )}
                                    </div>

                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {userRole === 'treasurer' && (
                                                        <TableHead className="w-12">
                                                            <Checkbox
                                                                checked={selectedMissing.size === missingQuarters.length && missingQuarters.length > 0}
                                                                onCheckedChange={toggleSelectAllMissing}
                                                            />
                                                        </TableHead>
                                                    )}
                                                    <TableHead>Tower</TableHead>
                                                    <TableHead>Quarter</TableHead>
                                                    <TableHead>Year</TableHead>
                                                    <TableHead>CAM Records</TableHead>
                                                    <TableHead>Document Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {missingQuarters.map((item) => {
                                                    const key = `${item.tower}-${item.quarter}-${item.year}`;
                                                    return (
                                                        <TableRow key={key}>
                                                            {userRole === 'treasurer' && (
                                                                <TableCell>
                                                                    <Checkbox
                                                                        checked={selectedMissing.has(key)}
                                                                        onCheckedChange={() => toggleSelectMissing(key)}
                                                                    />
                                                                </TableCell>
                                                            )}
                                                            <TableCell className="font-medium">{item.tower}</TableCell>
                                                            <TableCell>{item.quarterLabel}</TableCell>
                                                            <TableCell>{item.year}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={item.hasAnyRecord ? 'secondary' : 'outline'}>
                                                                    {item.hasAnyRecord
                                                                        ? `${item.recordCount} record(s) - no doc`
                                                                        : 'No records'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="destructive">
                                                                    Not uploaded
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <p className="text-xs text-muted-foreground mt-2">
                                        Note: CAM invoices are generated quarterly. Payments can be made monthly within the quarter.
                                        A quarter is marked as "missing" if no document has been uploaded for that period.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Excel Preview Dialog */}
            <ExcelPreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                documentUrl={previewUrl}
                title={previewTitle}
                onDownload={() => currentDownloadFn?.()}
            />
        </div>
    );
}
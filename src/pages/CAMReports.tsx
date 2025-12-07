import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, Loader2, ExternalLink, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const TOWERS = [
    'All', '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
    '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
    '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

const PERIOD_TYPES = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'half_yearly', label: 'Half Yearly' },
    { value: 'yearly', label: 'Yearly' }
];

const QUARTERS = [
    { value: 1, label: 'Q1 (Apr-Jun)' },
    { value: 2, label: 'Q2 (Jul-Sep)' },
    { value: 3, label: 'Q3 (Oct-Dec)' },
    { value: 4, label: 'Q4 (Jan-Mar)' }
];

const HALF_YEARS = [
    { value: 'H1', label: 'H1 (Apr-Sep)' },
    { value: 'H2', label: 'H2 (Oct-Mar)' }
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

export default function CAMReports() {
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState<CAMDocument[]>([]);
    const [selectedTower, setSelectedTower] = useState('All');
    const [selectedPeriodType, setSelectedPeriodType] = useState('monthly');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
    const [selectedHalfYear, setSelectedHalfYear] = useState<string>('H1');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        if (userRole === 'treasurer' || userRole === 'lead') {
            loadDocuments();
        }
    }, [selectedTower, selectedPeriodType, selectedMonth, selectedQuarter, selectedHalfYear, selectedYear, userRole]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('cam_tracking')
                .select('id, tower, quarter, year, month, document_url, status, submitted_at, approved_at, paid_flats, pending_flats, total_flats')
                .eq('year', selectedYear)
                .in('status', ['submitted', 'approved'])
                .order('tower')
                .order('quarter');

            // Tower filter
            if (selectedTower !== 'All') {
                query = query.eq('tower', selectedTower);
            }

            // Period-based filtering
            if (selectedPeriodType === 'monthly') {
                query = query.eq('month', selectedMonth);
            } else if (selectedPeriodType === 'quarterly') {
                query = query.eq('quarter', selectedQuarter);
            } else if (selectedPeriodType === 'half_yearly') {
                if (selectedHalfYear === 'H1') {
                    query = query.in('quarter', [1, 2]);
                } else {
                    query = query.in('quarter', [3, 4]);
                }
            }
            // For 'yearly', no additional filter needed

            const { data, error } = await query;

            if (error) throw error;

            // Group by tower and period to get unique records
            const uniqueDocs = new Map<string, CAMDocument>();

            data?.forEach(record => {
                let key: string;
                if (selectedPeriodType === 'monthly') {
                    key = `${record.tower}-${record.month}-${record.year}`;
                } else if (selectedPeriodType === 'quarterly') {
                    key = `${record.tower}-Q${record.quarter}-${record.year}`;
                } else if (selectedPeriodType === 'half_yearly') {
                    const halfYear = record.quarter <= 2 ? 'H1' : 'H2';
                    key = `${record.tower}-${halfYear}-${record.year}`;
                } else {
                    key = `${record.tower}-${record.year}`;
                }

                if (!uniqueDocs.has(key)) {
                    uniqueDocs.set(key, record as CAMDocument);
                }
            });

            setDocuments(Array.from(uniqueDocs.values()));
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

    const downloadDocument = async (filePath: string, tower: string, year: number) => {
        try {
            // Create a signed URL for the private 'cam' bucket
            const { data, error } = await supabase.storage
                .from('cam')
                .createSignedUrl(filePath, 3600); // 1 hour expiry

            if (error) throw error;

            const link = document.createElement('a');
            link.href = data.signedUrl;
            link.download = `CAM_${tower}_${year}.pdf`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Document download started');
        } catch (error: any) {
            toast.error('Failed to download document: ' + error.message);
        }
    };

    const previewDocument = async (filePath: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('cam')
                .createSignedUrl(filePath, 3600);

            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error: any) {
            toast.error('Failed to preview document: ' + error.message);
        }
    };

    const getPeriodDisplay = (doc: CAMDocument) => {
        if (selectedPeriodType === 'monthly') {
            return getMonthLabel(doc.month);
        } else if (selectedPeriodType === 'quarterly') {
            return getQuarterLabel(doc.quarter);
        } else if (selectedPeriodType === 'half_yearly') {
            return doc.quarter <= 2 ? 'H1 (Apr-Sep)' : 'H2 (Oct-Mar)';
        } else {
            return `FY ${doc.year}`;
        }
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
                            {documents.length} record(s) found
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedTower('All');
                                setSelectedPeriodType('monthly');
                                setSelectedMonth(new Date().getMonth() + 1);
                                setSelectedQuarter(1);
                                setSelectedHalfYear('H1');
                            }}
                        >
                            Reset Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>CAM Records</CardTitle>
                    <CardDescription>
                        View status and download supporting documents
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                                        <TableHead>Period</TableHead>
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
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => previewDocument(doc.document_url!)}
                                                        >
                                                            <Eye className="w-4 h-4 mr-1" />
                                                            Preview
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => downloadDocument(doc.document_url!, doc.tower, doc.year)}
                                                        >
                                                            <Download className="w-4 h-4 mr-1" />
                                                            Download
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">No document uploaded</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
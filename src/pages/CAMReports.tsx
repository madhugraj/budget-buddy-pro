import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileText, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const TOWERS = [
    'All', '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
    '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
    '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

const QUARTERS = [
    { value: 'all', label: 'All Quarters' },
    { value: 1, label: 'Q1 (Apr-Jun)' },
    { value: 2, label: 'Q2 (Jul-Sep)' },
    { value: 3, label: 'Q3 (Oct-Dec)' },
    { value: 4, label: 'Q4 (Jan-Mar)' }
];

const MONTHS = [
    { value: 'all', label: 'All Months' },
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
];

interface CAMDocument {
    id: string;
    tower: string;
    quarter: number;
    year: number;
    month: number;
    document_url: string | null;
    status: string;
    submitted_at: string | null;
    approved_at: string | null;
}

export default function CAMReports() {
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState<CAMDocument[]>([]);
    const [selectedTower, setSelectedTower] = useState('All');
    const [selectedQuarter, setSelectedQuarter] = useState<string | number>('all');
    const [selectedMonth, setSelectedMonth] = useState<string | number>('all');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        if (userRole === 'treasurer') {
            loadDocuments();
        }
    }, [selectedTower, selectedQuarter, selectedMonth, selectedYear, userRole]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('cam_tracking')
                .select('id, tower, quarter, year, month, document_url, status, submitted_at, approved_at')
                .eq('year', selectedYear)
                .in('status', ['submitted', 'approved'])
                .not('document_url', 'is', null)
                .order('tower')
                .order('quarter');

            // Tower filter
            if (selectedTower !== 'All') {
                query = query.eq('tower', selectedTower);
            }

            // Quarter filter
            if (selectedQuarter !== 'all') {
                query = query.eq('quarter', selectedQuarter);
            }

            // Month filter
            if (selectedMonth !== 'all') {
                query = query.eq('month', selectedMonth);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Group by tower and quarter to get unique documents, UNLESS a specific month is selected
            // If a specific month is selected, we show that specific record
            const uniqueDocs = new Map<string, CAMDocument>();

            data?.forEach(record => {
                // If filtering by month, we want to show that specific month's record
                // If filtering by quarter/all, we want to show one per quarter (since usually it's one doc per quarter)
                const isMonthView = selectedMonth !== 'all';
                const key = isMonthView
                    ? `${record.tower}-${record.month}-${record.year}` // Unique per month
                    : `${record.tower}-${record.quarter}-${record.year}`; // Unique per quarter

                if (!uniqueDocs.has(key) && record.document_url) {
                    uniqueDocs.set(key, record as CAMDocument);
                }
            });

            setDocuments(Array.from(uniqueDocs.values()));
        } catch (error: any) {
            toast.error('Failed to load documents: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getQuarterLabel = (quarter: number) => {
        return QUARTERS.find(q => q.value === quarter)?.label || `Q${quarter}`;
    };

    const getMonthLabel = (month: number) => {
        return MONTHS.find(m => m.value === month)?.label || `M${month}`;
    };

    const downloadDocument = (url: string, tower: string, quarter: number, month: number, year: number) => {
        const link = document.createElement('a');
        link.href = url;
        const period = selectedMonth !== 'all' ? getMonthLabel(month) : `Q${quarter}`;
        link.download = `CAM_${tower}_${period}_${year}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Document download started');
    };

    if (userRole !== 'treasurer') {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-muted-foreground">
                            This page is only accessible to Treasurers.
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
                    View and download quarterly/monthly CAM supporting documents uploaded by Lead users
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filter Documents</CardTitle>
                    <CardDescription>
                        Select filters to view and download CAM supporting documents
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            <label className="text-sm font-medium">Quarter</label>
                            <Select
                                value={selectedQuarter.toString()}
                                onValueChange={(val) => {
                                    setSelectedQuarter(val === 'all' ? 'all' : parseInt(val));
                                    if (val !== 'all') setSelectedMonth('all'); // Reset month if quarter changes
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {QUARTERS.map(quarter => (
                                        <SelectItem key={quarter.value} value={quarter.value.toString()}>{quarter.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Month</label>
                            <Select
                                value={selectedMonth.toString()}
                                onValueChange={(val) => {
                                    setSelectedMonth(val === 'all' ? 'all' : parseInt(val));
                                    if (val !== 'all' && selectedQuarter !== 'all') {
                                        // Optional: Check if month matches quarter, but for now allow flexibility
                                    }
                                }}
                                disabled={false}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(month => (
                                        <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            {documents.length} document(s) found
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedTower('All');
                                setSelectedQuarter('all');
                                setSelectedMonth('all');
                            }}
                        >
                            Reset Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Documents</CardTitle>
                    <CardDescription>
                        Supporting documents uploaded by Lead users for CAM tracking
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : documents.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">
                            No documents found for the selected filters
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tower</TableHead>
                                        <TableHead>Quarter</TableHead>
                                        {selectedMonth !== 'all' && <TableHead>Month</TableHead>}
                                        <TableHead>Year</TableHead>
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
                                            <TableCell>{getQuarterLabel(doc.quarter)}</TableCell>
                                            {selectedMonth !== 'all' && <TableCell>{getMonthLabel(doc.month)}</TableCell>}
                                            <TableCell>{doc.year}</TableCell>
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
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => window.open(doc.document_url!, '_blank')}
                                                    >
                                                        <ExternalLink className="w-4 h-4 mr-1" />
                                                        View
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => downloadDocument(doc.document_url!, doc.tower, doc.quarter, doc.month, doc.year)}
                                                    >
                                                        <Download className="w-4 h-4 mr-1" />
                                                        Download
                                                    </Button>
                                                </div>
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

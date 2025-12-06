import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Upload, FileText, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

const MONTHS = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

const TRAINING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_SPORTS = [
    'Badminton', 'Swimming', 'Football', 'Basketball', 'Skating', 'Tennis',
    'Yoga', 'Bharatanatyam', 'Dance/Zumba', 'Cricket', 'Aerofitness', 'Chess',
    'Kalarippayattu', 'Silambattam'
];

interface SportMaster {
    id: string;
    sport_name: string;
    coach_trainer_academy: string;
    location: string;
    training_days: string[];
    duration: string;
    num_students: number;
    base_fare: number;
    gst_amount: number;
    total_amount: number;
    agreement_url: string | null;
    is_active: boolean;
}

interface SportsIncomeRecord {
    id: string;
    sport_id: string;
    month: number;
    fiscal_year: string;
    amount_received: number;
    gst_amount: number;
    total_amount: number;
    notes: string | null;
    status: string;
    sports_master?: SportMaster;
}

export default function SportsIncome() {
    const { user, userRole } = useAuth();
    const [sports, setSports] = useState<SportMaster[]>([]);
    const [incomeRecords, setIncomeRecords] = useState<SportsIncomeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddSport, setShowAddSport] = useState(false);
    const [showAddIncome, setShowAddIncome] = useState(false);
    const [editingSport, setEditingSport] = useState<SportMaster | null>(null);

    // Sport form state
    const [sportName, setSportName] = useState('');
    const [customSportName, setCustomSportName] = useState('');
    const [coachAcademy, setCoachAcademy] = useState('');
    const [location, setLocation] = useState('');
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [duration, setDuration] = useState('');
    const [numStudents, setNumStudents] = useState('0');
    const [baseFare, setBaseFare] = useState('0');
    const [gstPercentage, setGstPercentage] = useState('18');
    const [agreementFile, setAgreementFile] = useState<File | null>(null);

    // Income form state
    const [selectedSportId, setSelectedSportId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [fiscalYear, setFiscalYear] = useState('FY25-26');
    const [amountReceived, setAmountReceived] = useState('0');
    const [incomeNotes, setIncomeNotes] = useState('');

    const canAccessPage = userRole === 'treasurer' || userRole === 'accountant';

    useEffect(() => {
        if (canAccessPage) {
            loadSports();
            loadIncomeRecords();
        }
    }, [userRole]);

    const loadSports = async () => {
        try {
            const { data, error } = await supabase
                .from('sports_master')
                .select('*')
                .order('sport_name');

            if (error) throw error;
            setSports((data || []) as SportMaster[]);
        } catch (error: any) {
            toast.error('Failed to load sports: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadIncomeRecords = async () => {
        try {
            const { data, error } = await supabase
                .from('sports_income')
                .select(`*, sports_master (*)`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setIncomeRecords((data || []) as SportsIncomeRecord[]);
        } catch (error: any) {
            toast.error('Failed to load income records: ' + error.message);
        }
    };

    const calculateGST = (base: string, gstPercent: string) => {
        const baseAmount = parseFloat(base) || 0;
        const gst = (baseAmount * parseFloat(gstPercent)) / 100;
        return { gst, total: baseAmount + gst };
    };

    const handleSaveSport = async () => {
        if (!user) return;

        const finalSportName = sportName === 'Other' ? customSportName : sportName;
        if (!finalSportName) {
            toast.error('Please enter a sport name');
            return;
        }

        try {
            const { gst, total } = calculateGST(baseFare, gstPercentage);

            let agreementUrl = editingSport?.agreement_url || null;

            // Upload agreement if file selected
            if (agreementFile) {
                const fileExt = agreementFile.name.split('.').pop();
                const fileName = `${Date.now()}_${finalSportName.replace(/\s+/g, '_')}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('agreements')
                    .upload(fileName, agreementFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('agreements')
                    .getPublicUrl(fileName);

                agreementUrl = publicUrl;
            }

            const sportData = {
                sport_name: finalSportName,
                coach_trainer_academy: coachAcademy,
                location,
                training_days: selectedDays,
                duration,
                num_students: parseInt(numStudents) || 0,
                base_fare: parseFloat(baseFare) || 0,
                gst_amount: gst,
                total_amount: total,
                agreement_url: agreementUrl,
                is_active: true,
                created_by: user.id
            };

            if (editingSport) {
                const { error } = await supabase
                    .from('sports_master')
                    .update(sportData)
                    .eq('id', editingSport.id);

                if (error) throw error;
                toast.success('Sport updated successfully');
            } else {
                const { error } = await supabase
                    .from('sports_master')
                    .insert([sportData]);

                if (error) throw error;
                toast.success('Sport added successfully');
            }

            resetSportForm();
            setShowAddSport(false);
            loadSports();
        } catch (error: any) {
            toast.error('Failed to save sport: ' + error.message);
        }
    };

    const handleSaveIncome = async () => {
        if (!user) return;

        try {
            const selectedSport = sports.find(s => s.id === selectedSportId);
            if (!selectedSport) {
                toast.error('Please select a sport');
                return;
            }

            const amount = parseFloat(amountReceived) || 0;
            const gstPercent = selectedSport.base_fare > 0 
                ? (selectedSport.gst_amount / selectedSport.base_fare) * 100 
                : 18;
            const { gst, total } = calculateGST(amountReceived, gstPercent.toString());

            const { error } = await supabase
                .from('sports_income')
                .insert([{
                    sport_id: selectedSportId,
                    month: selectedMonth,
                    fiscal_year: fiscalYear,
                    amount_received: amount,
                    gst_amount: gst,
                    total_amount: total,
                    notes: incomeNotes || null,
                    status: 'pending',
                    submitted_by: user.id
                }]);

            if (error) throw error;

            toast.success('Income record added successfully');
            resetIncomeForm();
            setShowAddIncome(false);
            loadIncomeRecords();
        } catch (error: any) {
            toast.error('Failed to save income: ' + error.message);
        }
    };

    const resetSportForm = () => {
        setSportName('');
        setCustomSportName('');
        setCoachAcademy('');
        setLocation('');
        setSelectedDays([]);
        setDuration('');
        setNumStudents('0');
        setBaseFare('0');
        setGstPercentage('18');
        setAgreementFile(null);
        setEditingSport(null);
    };

    const resetIncomeForm = () => {
        setSelectedSportId('');
        setSelectedMonth(new Date().getMonth() + 1);
        setFiscalYear('FY25-26');
        setAmountReceived('0');
        setIncomeNotes('');
    };

    const handleEditSport = (sport: SportMaster) => {
        setEditingSport(sport);
        if (DEFAULT_SPORTS.includes(sport.sport_name)) {
            setSportName(sport.sport_name);
            setCustomSportName('');
        } else {
            setSportName('Other');
            setCustomSportName(sport.sport_name);
        }
        setCoachAcademy(sport.coach_trainer_academy);
        setLocation(sport.location);
        setSelectedDays(sport.training_days || []);
        setDuration(sport.duration);
        setNumStudents(sport.num_students.toString());
        setBaseFare(sport.base_fare.toString());
        const gstPercent = sport.base_fare > 0 ? (sport.gst_amount / sport.base_fare * 100).toFixed(0) : '18';
        setGstPercentage(gstPercent);
        setShowAddSport(true);
    };

    const handleDeleteSport = async (id: string) => {
        if (!confirm('Are you sure you want to delete this sport?')) return;

        try {
            const { error } = await supabase
                .from('sports_master')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Sport deleted successfully');
            loadSports();
        } catch (error: any) {
            toast.error('Failed to delete sport: ' + error.message);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    if (!canAccessPage) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-muted-foreground">
                            This page is only accessible to Office Assistants, Accountants, and Treasurers.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Sports Income Management</h1>
                <p className="text-muted-foreground mt-1">
                    Manage sports activities and track monthly income
                </p>
            </div>

            <Tabs defaultValue="sports" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="sports">Sports Master</TabsTrigger>
                    <TabsTrigger value="income">Income Records</TabsTrigger>
                </TabsList>

                <TabsContent value="sports" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Sports Activities</CardTitle>
                                    <CardDescription>Configure sports, coaches, and pricing (One-time setup)</CardDescription>
                                </div>
                                {(userRole === 'treasurer') && (
                                    <Dialog open={showAddSport} onOpenChange={setShowAddSport}>
                                        <DialogTrigger asChild>
                                            <Button onClick={() => { resetSportForm(); setShowAddSport(true); }}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add Sport
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle>{editingSport ? 'Edit' : 'Add'} Sport</DialogTitle>
                                                <DialogDescription>
                                                    Configure sport details, coach information, and pricing
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="sportName">Sport Name *</Label>
                                                    <Select value={sportName} onValueChange={setSportName}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a sport" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {DEFAULT_SPORTS.map(sport => (
                                                                <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                                                            ))}
                                                            <SelectItem value="Other">Other (Custom)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {sportName === 'Other' && (
                                                        <Input
                                                            placeholder="Enter custom sport name"
                                                            value={customSportName}
                                                            onChange={(e) => setCustomSportName(e.target.value)}
                                                        />
                                                    )}
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="coachAcademy">Coach/Trainer/Academy *</Label>
                                                    <Input
                                                        id="coachAcademy"
                                                        value={coachAcademy}
                                                        onChange={(e) => setCoachAcademy(e.target.value)}
                                                        placeholder="Name and contact details"
                                                    />
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="location">Location in Apartment *</Label>
                                                    <Input
                                                        id="location"
                                                        value={location}
                                                        onChange={(e) => setLocation(e.target.value)}
                                                        placeholder="e.g., Clubhouse, Court 1"
                                                    />
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label>Training Days *</Label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {TRAINING_DAYS.map(day => (
                                                            <div key={day} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={day}
                                                                    checked={selectedDays.includes(day)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setSelectedDays([...selectedDays, day]);
                                                                        } else {
                                                                            setSelectedDays(selectedDays.filter(d => d !== day));
                                                                        }
                                                                    }}
                                                                />
                                                                <label htmlFor={day} className="text-sm cursor-pointer">{day}</label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="duration">Duration *</Label>
                                                        <Input
                                                            id="duration"
                                                            value={duration}
                                                            onChange={(e) => setDuration(e.target.value)}
                                                            placeholder="e.g., 1 hour, 90 mins"
                                                        />
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label htmlFor="numStudents">Number of Students</Label>
                                                        <Input
                                                            id="numStudents"
                                                            type="number"
                                                            value={numStudents}
                                                            onChange={(e) => setNumStudents(e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="baseFare">Base Fare (₹) *</Label>
                                                        <Input
                                                            id="baseFare"
                                                            type="number"
                                                            value={baseFare}
                                                            onChange={(e) => setBaseFare(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label htmlFor="gstPercentage">GST %</Label>
                                                        <Select value={gstPercentage} onValueChange={setGstPercentage}>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="0">0%</SelectItem>
                                                                <SelectItem value="5">5%</SelectItem>
                                                                <SelectItem value="12">12%</SelectItem>
                                                                <SelectItem value="18">18%</SelectItem>
                                                                <SelectItem value="28">28%</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label>Total Amount</Label>
                                                        <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                                                            {formatCurrency(calculateGST(baseFare, gstPercentage).total)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="agreement">Agreement Document</Label>
                                                    <Input
                                                        id="agreement"
                                                        type="file"
                                                        accept=".pdf,.doc,.docx"
                                                        onChange={(e) => setAgreementFile(e.target.files?.[0] || null)}
                                                    />
                                                    {editingSport?.agreement_url && (
                                                        <a
                                                            href={editingSport.agreement_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm text-primary hover:underline flex items-center gap-1"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                            View existing agreement
                                                        </a>
                                                    )}
                                                </div>

                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={() => setShowAddSport(false)}>
                                                        Cancel
                                                    </Button>
                                                    <Button onClick={handleSaveSport}>
                                                        {editingSport ? 'Update' : 'Save'} Sport
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {sports.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    No sports configured yet. Add a sport to get started.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Sport</TableHead>
                                                <TableHead>Coach/Academy</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead>Training Days</TableHead>
                                                <TableHead>Duration</TableHead>
                                                <TableHead>Students</TableHead>
                                                <TableHead className="text-right">Total Amount</TableHead>
                                                <TableHead>Agreement</TableHead>
                                                {(userRole === 'treasurer') && (
                                                    <TableHead className="text-right">Actions</TableHead>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sports.map((sport) => (
                                                <TableRow key={sport.id}>
                                                    <TableCell className="font-medium">{sport.sport_name}</TableCell>
                                                    <TableCell>{sport.coach_trainer_academy}</TableCell>
                                                    <TableCell>{sport.location}</TableCell>
                                                    <TableCell>{sport.training_days?.join(', ') || '-'}</TableCell>
                                                    <TableCell>{sport.duration}</TableCell>
                                                    <TableCell>{sport.num_students}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(sport.total_amount)}</TableCell>
                                                    <TableCell>
                                                        {sport.agreement_url ? (
                                                            <a
                                                                href={sport.agreement_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary hover:underline flex items-center gap-1"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                                View
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    {(userRole === 'treasurer') && (
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button size="sm" variant="outline" onClick={() => handleEditSport(sport)}>
                                                                    <Edit className="w-4 h-4" />
                                                                </Button>
                                                                {userRole === 'treasurer' && (
                                                                    <Button size="sm" variant="destructive" onClick={() => handleDeleteSport(sport.id)}>
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="income" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Monthly Income Records</CardTitle>
                                    <CardDescription>Track monthly income from sports activities</CardDescription>
                                </div>
                                {(userRole === 'treasurer') && (
                                    <Dialog open={showAddIncome} onOpenChange={setShowAddIncome}>
                                        <DialogTrigger asChild>
                                            <Button onClick={() => { resetIncomeForm(); setShowAddIncome(true); }}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add Income
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Add Monthly Income</DialogTitle>
                                                <DialogDescription>
                                                    Record monthly income for a sport
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Sport *</Label>
                                                    <Select value={selectedSportId} onValueChange={setSelectedSportId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a sport" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {sports.map(sport => (
                                                                <SelectItem key={sport.id} value={sport.id}>
                                                                    {sport.sport_name} - {sport.coach_trainer_academy}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label>Month *</Label>
                                                        <Select 
                                                            value={selectedMonth.toString()} 
                                                            onValueChange={(val) => setSelectedMonth(parseInt(val))}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {MONTHS.map(m => (
                                                                    <SelectItem key={m.value} value={m.value.toString()}>
                                                                        {m.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label>Fiscal Year *</Label>
                                                        <Select value={fiscalYear} onValueChange={setFiscalYear}>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="FY24-25">FY24-25</SelectItem>
                                                                <SelectItem value="FY25-26">FY25-26</SelectItem>
                                                                <SelectItem value="FY26-27">FY26-27</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="amountReceived">Amount Received (₹) *</Label>
                                                    <Input
                                                        id="amountReceived"
                                                        type="number"
                                                        value={amountReceived}
                                                        onChange={(e) => setAmountReceived(e.target.value)}
                                                    />
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="incomeNotes">Notes</Label>
                                                    <Textarea
                                                        id="incomeNotes"
                                                        value={incomeNotes}
                                                        onChange={(e) => setIncomeNotes(e.target.value)}
                                                        placeholder="Any additional notes..."
                                                    />
                                                </div>

                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={() => setShowAddIncome(false)}>
                                                        Cancel
                                                    </Button>
                                                    <Button onClick={handleSaveIncome}>
                                                        Save Income
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {incomeRecords.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    No income records yet.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Sport</TableHead>
                                                <TableHead>Month</TableHead>
                                                <TableHead>Fiscal Year</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="text-right">GST</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Notes</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {incomeRecords.map((record) => (
                                                <TableRow key={record.id}>
                                                    <TableCell className="font-medium">
                                                        {record.sports_master?.sport_name || 'Unknown'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {MONTHS.find(m => m.value === record.month)?.label || record.month}
                                                    </TableCell>
                                                    <TableCell>{record.fiscal_year}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(record.amount_received)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(record.gst_amount)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(record.total_amount)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={
                                                            record.status === 'approved' ? 'default' :
                                                            record.status === 'rejected' ? 'destructive' : 'secondary'
                                                        }>
                                                            {record.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate">
                                                        {record.notes || '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
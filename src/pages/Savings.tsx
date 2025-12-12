import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Plus, Upload, FileText, Edit2, Trash2, Send, Eye, TrendingUp, Calendar, Landmark, PiggyBank } from "lucide-react";
import { useSearchParams } from "react-router-dom";

type InvestmentType = 'FD' | 'RD' | 'Mutual_Fund' | 'Bonds' | 'Other';
type InvestmentStatus = 'active' | 'matured' | 'closed' | 'renewed' | 'partially_withdrawn';
type ApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'correction_pending' | 'correction_approved';
type ActionType = 'status_check' | 'interest_credit' | 'renewal' | 'closure' | 'partial_withdrawal' | 'top_up' | 'maturity' | 'value_update';

interface SavingsMaster {
  id: string;
  investment_type: InvestmentType;
  investment_name: string;
  bank_institution: string;
  account_number: string | null;
  principal_amount: number;
  interest_rate: number | null;
  start_date: string;
  maturity_date: string | null;
  duration_months: number | null;
  expected_maturity_amount: number | null;
  current_value: number;
  current_status: InvestmentStatus;
  document_url: string | null;
  notes: string | null;
  fiscal_year: string;
  created_by: string;
  status: ApprovalStatus;
  created_at: string;
}

interface SavingsTracking {
  id: string;
  savings_id: string;
  month: number;
  fiscal_year: string;
  tracking_date: string;
  action_type: ActionType;
  amount: number;
  value_after_action: number;
  new_maturity_date: string | null;
  new_interest_rate: number | null;
  previous_status: string | null;
  new_status: string | null;
  document_url: string | null;
  notes: string | null;
  submitted_by: string;
  status: ApprovalStatus;
  created_at: string;
  savings_master?: SavingsMaster;
}

const INVESTMENT_TYPES: { value: InvestmentType; label: string }[] = [
  { value: 'FD', label: 'Fixed Deposit' },
  { value: 'RD', label: 'Recurring Deposit' },
  { value: 'Mutual_Fund', label: 'Mutual Fund' },
  { value: 'Bonds', label: 'Bonds' },
  { value: 'Other', label: 'Other' },
];

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'status_check', label: 'Status Check' },
  { value: 'interest_credit', label: 'Interest Credit' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'closure', label: 'Closure' },
  { value: 'partial_withdrawal', label: 'Partial Withdrawal' },
  { value: 'top_up', label: 'Top Up' },
  { value: 'maturity', label: 'Maturity' },
  { value: 'value_update', label: 'Value Update' },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getStatusBadgeVariant = (status: ApprovalStatus) => {
  switch (status) {
    case 'approved': return 'default';
    case 'submitted': return 'secondary';
    case 'rejected': return 'destructive';
    case 'draft': return 'outline';
    default: return 'outline';
  }
};

const getInvestmentStatusBadge = (status: InvestmentStatus) => {
  switch (status) {
    case 'active': return 'default';
    case 'matured': return 'secondary';
    case 'closed': return 'outline';
    case 'renewed': return 'default';
    case 'partially_withdrawn': return 'secondary';
    default: return 'outline';
  }
};

const getCurrentFiscalYear = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
};

const getCurrentMonth = () => {
  return new Date().getMonth() + 1;
};

export default function Savings() {
  const { user, userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("investments");
  const [savingsList, setSavingsList] = useState<SavingsMaster[]>([]);
  const [trackingList, setTrackingList] = useState<SavingsTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTrackingDialogOpen, setIsTrackingDialogOpen] = useState(false);
  const [selectedSaving, setSelectedSaving] = useState<SavingsMaster | null>(null);
  const [editingItem, setEditingItem] = useState<SavingsMaster | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form states for new investment
  const [formData, setFormData] = useState({
    investment_type: 'FD' as InvestmentType,
    investment_name: '',
    bank_institution: '',
    account_number: '',
    principal_amount: '',
    interest_rate: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    maturity_date: '',
    duration_months: '',
    expected_maturity_amount: '',
    notes: '',
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Form states for tracking
  const [trackingFormData, setTrackingFormData] = useState({
    savings_id: '',
    month: getCurrentMonth(),
    fiscal_year: getCurrentFiscalYear(),
    tracking_date: format(new Date(), 'yyyy-MM-dd'),
    action_type: 'status_check' as ActionType,
    amount: '',
    value_after_action: '',
    new_maturity_date: '',
    new_interest_rate: '',
    new_status: '',
    notes: '',
  });
  const [trackingDocumentFile, setTrackingDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['investments', 'tracking', 'summary'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchSavings();
    fetchTracking();
  }, []);

  const fetchSavings = async () => {
    try {
      const { data, error } = await supabase
        .from('savings_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavingsList((data as SavingsMaster[]) || []);
    } catch (error: any) {
      console.error('Error fetching savings:', error);
      toast.error('Failed to fetch savings');
    } finally {
      setLoading(false);
    }
  };

  const fetchTracking = async () => {
    try {
      const { data, error } = await supabase
        .from('savings_tracking')
        .select('*, savings_master(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrackingList((data as SavingsTracking[]) || []);
    } catch (error: any) {
      console.error('Error fetching tracking:', error);
    }
  };

  const uploadDocument = async (file: File, folder: string): Promise<string | null> => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('savings')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = await supabase.storage
        .from('savings')
        .createSignedUrl(fileName, 31536000); // 1 year

      return data?.signedUrl || fileName;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAddInvestment = async () => {
    if (!user) return;

    try {
      let documentUrl = null;
      if (documentFile) {
        documentUrl = await uploadDocument(documentFile, 'investments');
      }

      const principal = parseFloat(formData.principal_amount) || 0;

      const { error } = await supabase.from('savings_master').insert({
        investment_type: formData.investment_type,
        investment_name: formData.investment_name,
        bank_institution: formData.bank_institution,
        account_number: formData.account_number || null,
        principal_amount: principal,
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : null,
        start_date: formData.start_date,
        maturity_date: formData.maturity_date || null,
        duration_months: formData.duration_months ? parseInt(formData.duration_months) : null,
        expected_maturity_amount: formData.expected_maturity_amount ? parseFloat(formData.expected_maturity_amount) : null,
        current_value: principal,
        current_status: 'active',
        document_url: documentUrl,
        notes: formData.notes || null,
        fiscal_year: getCurrentFiscalYear(),
        created_by: user.id,
        status: 'draft',
      });

      if (error) throw error;

      toast.success('Investment added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchSavings();
    } catch (error: any) {
      console.error('Error adding investment:', error);
      toast.error(error.message || 'Failed to add investment');
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      const { error } = await supabase
        .from('savings_master')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Submitted for approval');
      fetchSavings();
    } catch (error: any) {
      toast.error('Failed to submit');
    }
  };

  const handleAddTracking = async () => {
    if (!user || !trackingFormData.savings_id) return;

    try {
      let documentUrl = null;
      if (trackingDocumentFile) {
        documentUrl = await uploadDocument(trackingDocumentFile, 'tracking');
      }

      const selectedInvestment = savingsList.find(s => s.id === trackingFormData.savings_id);
      const valueAfter = parseFloat(trackingFormData.value_after_action) || selectedInvestment?.current_value || 0;

      const { error } = await supabase.from('savings_tracking').insert({
        savings_id: trackingFormData.savings_id,
        month: trackingFormData.month,
        fiscal_year: trackingFormData.fiscal_year,
        tracking_date: trackingFormData.tracking_date,
        action_type: trackingFormData.action_type,
        amount: parseFloat(trackingFormData.amount) || 0,
        value_after_action: valueAfter,
        new_maturity_date: trackingFormData.new_maturity_date || null,
        new_interest_rate: trackingFormData.new_interest_rate ? parseFloat(trackingFormData.new_interest_rate) : null,
        previous_status: selectedInvestment?.current_status || null,
        new_status: trackingFormData.new_status || null,
        document_url: documentUrl,
        notes: trackingFormData.notes || null,
        submitted_by: user.id,
        status: 'draft',
      });

      if (error) throw error;

      toast.success('Tracking entry added');
      setIsTrackingDialogOpen(false);
      resetTrackingForm();
      fetchTracking();
    } catch (error: any) {
      console.error('Error adding tracking:', error);
      toast.error(error.message || 'Failed to add tracking entry');
    }
  };

  const handleSubmitTracking = async (id: string) => {
    try {
      const { error } = await supabase
        .from('savings_tracking')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Tracking submitted for approval');
      fetchTracking();
    } catch (error: any) {
      toast.error('Failed to submit');
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) return;

    try {
      const { error } = await supabase.from('savings_master').delete().eq('id', id);
      if (error) throw error;
      toast.success('Investment deleted');
      fetchSavings();
    } catch (error: any) {
      toast.error('Failed to delete');
    }
  };

  const resetForm = () => {
    setFormData({
      investment_type: 'FD',
      investment_name: '',
      bank_institution: '',
      account_number: '',
      principal_amount: '',
      interest_rate: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      maturity_date: '',
      duration_months: '',
      expected_maturity_amount: '',
      notes: '',
    });
    setDocumentFile(null);
    setEditingItem(null);
  };

  const resetTrackingForm = () => {
    setTrackingFormData({
      savings_id: '',
      month: getCurrentMonth(),
      fiscal_year: getCurrentFiscalYear(),
      tracking_date: format(new Date(), 'yyyy-MM-dd'),
      action_type: 'status_check',
      amount: '',
      value_after_action: '',
      new_maturity_date: '',
      new_interest_rate: '',
      new_status: '',
      notes: '',
    });
    setTrackingDocumentFile(null);
  };

  // Calculate summary stats
  const approvedSavings = savingsList.filter(s => s.status === 'approved');
  const totalInvested = approvedSavings.reduce((sum, s) => sum + s.principal_amount, 0);
  const totalCurrentValue = approvedSavings.reduce((sum, s) => sum + s.current_value, 0);
  const activeInvestments = approvedSavings.filter(s => s.current_status === 'active').length;
  const upcomingMaturities = approvedSavings.filter(s => {
    if (!s.maturity_date) return false;
    const maturity = new Date(s.maturity_date);
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return maturity >= today && maturity <= thirtyDaysLater;
  });

  const canManage = userRole === 'accountant' || userRole === 'treasurer';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Savings & Investments</h1>
          <p className="text-sm text-muted-foreground">Track and manage organization investments</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <PiggyBank className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Invested</p>
                <p className="text-lg font-semibold">{formatCurrency(totalInvested)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Value</p>
                <p className="text-lg font-semibold">{formatCurrency(totalCurrentValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Investments</p>
                <p className="text-lg font-semibold">{activeInvestments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Maturing (30 days)</p>
                <p className="text-lg font-semibold">{upcomingMaturities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="tracking">Monthly Tracking</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="investments" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Add Investment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Investment</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Investment Type *</Label>
                        <Select value={formData.investment_type} onValueChange={(v: InvestmentType) => setFormData({ ...formData, investment_type: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVESTMENT_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Investment Name *</Label>
                        <Input
                          value={formData.investment_name}
                          onChange={(e) => setFormData({ ...formData, investment_name: e.target.value })}
                          placeholder="e.g., ICICI FD - 12 months"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bank/Institution *</Label>
                        <Input
                          value={formData.bank_institution}
                          onChange={(e) => setFormData({ ...formData, bank_institution: e.target.value })}
                          placeholder="e.g., ICICI Bank"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account/Folio Number</Label>
                        <Input
                          value={formData.account_number}
                          onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Principal Amount *</Label>
                        <Input
                          type="number"
                          value={formData.principal_amount}
                          onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interest Rate (% p.a.)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.interest_rate}
                          onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                          placeholder="7.5"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date *</Label>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Maturity Date</Label>
                        <Input
                          type="date"
                          value={formData.maturity_date}
                          onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Duration (Months)</Label>
                        <Input
                          type="number"
                          value={formData.duration_months}
                          onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                          placeholder="12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Maturity Amount</Label>
                        <Input
                          type="number"
                          value={formData.expected_maturity_amount}
                          onChange={(e) => setFormData({ ...formData, expected_maturity_amount: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Document (FD Receipt, Certificate, etc.)</Label>
                      <Input
                        type="file"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional details..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddInvestment} disabled={uploading || !formData.investment_name || !formData.bank_institution || !formData.principal_amount}>
                      {uploading ? 'Uploading...' : 'Save Investment'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Institution</TableHead>
                    <TableHead className="text-xs text-right">Principal</TableHead>
                    <TableHead className="text-xs text-right">Rate</TableHead>
                    <TableHead className="text-xs">Start</TableHead>
                    <TableHead className="text-xs">Maturity</TableHead>
                    <TableHead className="text-xs text-right">Current Value</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Approval</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savingsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        No investments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    savingsList.map((saving) => (
                      <TableRow key={saving.id}>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-xs">
                            {INVESTMENT_TYPES.find(t => t.value === saving.investment_type)?.label || saving.investment_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[150px] truncate">{saving.investment_name}</TableCell>
                        <TableCell className="text-xs">{saving.bank_institution}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{formatCurrency(saving.principal_amount)}</TableCell>
                        <TableCell className="text-xs text-right">{saving.interest_rate ? `${saving.interest_rate}%` : '-'}</TableCell>
                        <TableCell className="text-xs">{format(parseISO(saving.start_date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-xs">{saving.maturity_date ? format(parseISO(saving.maturity_date), 'dd/MM/yy') : '-'}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(saving.current_value)}</TableCell>
                        <TableCell>
                          <Badge variant={getInvestmentStatusBadge(saving.current_status)} className="text-xs capitalize">
                            {saving.current_status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(saving.status)} className="text-xs capitalize">
                            {saving.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {saving.document_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={saving.document_url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            {canManage && saving.status === 'draft' && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSubmitForApproval(saving.id)}>
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                                {userRole === 'treasurer' && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteInvestment(saving.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={isTrackingDialogOpen} onOpenChange={setIsTrackingDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { resetTrackingForm(); setIsTrackingDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Add Tracking Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Add Tracking Entry</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Select Investment *</Label>
                      <Select value={trackingFormData.savings_id} onValueChange={(v) => setTrackingFormData({ ...trackingFormData, savings_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose investment" />
                        </SelectTrigger>
                        <SelectContent>
                          {savingsList.filter(s => s.status === 'approved').map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.investment_name} - {s.bank_institution}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Select value={String(trackingFormData.month)} onValueChange={(v) => setTrackingFormData({ ...trackingFormData, month: parseInt(v) })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <SelectItem key={m} value={String(m)}>{format(new Date(2024, m - 1, 1), 'MMMM')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tracking Date</Label>
                        <Input
                          type="date"
                          value={trackingFormData.tracking_date}
                          onChange={(e) => setTrackingFormData({ ...trackingFormData, tracking_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Action Type *</Label>
                        <Select value={trackingFormData.action_type} onValueChange={(v: ActionType) => setTrackingFormData({ ...trackingFormData, action_type: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Amount (if applicable)</Label>
                        <Input
                          type="number"
                          value={trackingFormData.amount}
                          onChange={(e) => setTrackingFormData({ ...trackingFormData, amount: e.target.value })}
                          placeholder="Interest earned, withdrawal, etc."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Value After Action *</Label>
                        <Input
                          type="number"
                          value={trackingFormData.value_after_action}
                          onChange={(e) => setTrackingFormData({ ...trackingFormData, value_after_action: e.target.value })}
                          placeholder="Current value after this action"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>New Status (if changed)</Label>
                        <Select value={trackingFormData.new_status} onValueChange={(v) => setTrackingFormData({ ...trackingFormData, new_status: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="No change" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="matured">Matured</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="renewed">Renewed</SelectItem>
                            <SelectItem value="partially_withdrawn">Partially Withdrawn</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(trackingFormData.action_type === 'renewal') && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>New Maturity Date</Label>
                          <Input
                            type="date"
                            value={trackingFormData.new_maturity_date}
                            onChange={(e) => setTrackingFormData({ ...trackingFormData, new_maturity_date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>New Interest Rate (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={trackingFormData.new_interest_rate}
                            onChange={(e) => setTrackingFormData({ ...trackingFormData, new_interest_rate: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Supporting Document</Label>
                      <Input
                        type="file"
                        onChange={(e) => setTrackingDocumentFile(e.target.files?.[0] || null)}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={trackingFormData.notes}
                        onChange={(e) => setTrackingFormData({ ...trackingFormData, notes: e.target.value })}
                        placeholder="Details about this tracking entry..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTrackingDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddTracking} disabled={uploading || !trackingFormData.savings_id || !trackingFormData.value_after_action}>
                      {uploading ? 'Uploading...' : 'Save Entry'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Investment</TableHead>
                    <TableHead className="text-xs">Month</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs text-right">Value After</TableHead>
                    <TableHead className="text-xs">New Status</TableHead>
                    <TableHead className="text-xs">Approval</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trackingList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No tracking entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    trackingList.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs font-medium max-w-[150px] truncate">
                          {entry.savings_master?.investment_name || '-'}
                        </TableCell>
                        <TableCell className="text-xs">{format(new Date(2024, entry.month - 1, 1), 'MMM')} {entry.fiscal_year}</TableCell>
                        <TableCell className="text-xs">{format(parseISO(entry.tracking_date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-xs">
                            {ACTION_TYPES.find(a => a.value === entry.action_type)?.label || entry.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">{entry.amount ? formatCurrency(entry.amount) : '-'}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(entry.value_after_action)}</TableCell>
                        <TableCell className="text-xs">
                          {entry.new_status ? (
                            <Badge variant="secondary" className="text-xs capitalize">{entry.new_status.replace('_', ' ')}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(entry.status)} className="text-xs capitalize">{entry.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {entry.document_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={entry.document_url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            {canManage && entry.status === 'draft' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSubmitTracking(entry.id)}>
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Investment by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {INVESTMENT_TYPES.map(type => {
                    const typeInvestments = approvedSavings.filter(s => s.investment_type === type.value);
                    const total = typeInvestments.reduce((sum, s) => sum + s.current_value, 0);
                    if (total === 0) return null;
                    return (
                      <div key={type.value} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{type.label}</span>
                        <div className="text-right">
                          <span className="text-sm font-medium">{formatCurrency(total)}</span>
                          <span className="text-xs text-muted-foreground ml-2">({typeInvestments.length})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Maturities (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingMaturities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming maturities</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingMaturities.map(saving => (
                      <div key={saving.id} className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{saving.investment_name}</p>
                          <p className="text-xs text-muted-foreground">{saving.bank_institution}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatCurrency(saving.expected_maturity_amount || saving.current_value)}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(saving.maturity_date!), 'dd MMM yyyy')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">All Approved Investments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Investment</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Institution</TableHead>
                    <TableHead className="text-xs text-right">Principal</TableHead>
                    <TableHead className="text-xs text-right">Current Value</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Maturity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedSavings.map(saving => (
                    <TableRow key={saving.id}>
                      <TableCell className="text-xs font-medium">{saving.investment_name}</TableCell>
                      <TableCell className="text-xs">{INVESTMENT_TYPES.find(t => t.value === saving.investment_type)?.label}</TableCell>
                      <TableCell className="text-xs">{saving.bank_institution}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatCurrency(saving.principal_amount)}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(saving.current_value)}</TableCell>
                      <TableCell>
                        <Badge variant={getInvestmentStatusBadge(saving.current_status)} className="text-xs capitalize">
                          {saving.current_status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{saving.maturity_date ? format(parseISO(saving.maturity_date), 'dd/MM/yy') : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

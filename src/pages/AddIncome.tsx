import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface IncomeCategory {
  id: string;
  category_name: string;
  subcategory_name: string | null;
  display_order: number;
  parent_category_id: string | null;
}

interface IncomeEntry {
  id: string;
  category_id: string;
  category_name: string;
  actual_amount: string;
  gst_percentage: number;
  gst_amount: number;
  total_amount: number;
  notes: string;
  isEditing?: boolean;
}

const MONTHS = [
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
];

export default function AddIncome() {
  const [fiscalYear, setFiscalYear] = useState<string>('FY25-26');
  const [selectedMonth, setSelectedMonth] = useState<number>(4);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [actualAmount, setActualAmount] = useState<string>('');
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [gstAmount, setGstAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();
  const { userRole } = useAuth();

  const totalAmount = (parseFloat(actualAmount) || 0) + gstAmount;

  useEffect(() => {
    fetchCategories();
  }, []);

  // Auto-calculate GST when amount or percentage changes
  useEffect(() => {
    if (actualAmount && parseFloat(actualAmount) > 0) {
      const baseAmount = parseFloat(actualAmount);
      const gst = (baseAmount * gstPercentage) / 100;
      setGstAmount(Math.round(gst * 100) / 100);
    }
  }, [actualAmount, gstPercentage]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      
      // Filter to only show leaf categories (categories without children or that are children themselves)
      const allCategories = data || [];
      const leafCategories = allCategories.filter(cat => {
        // If it has a parent, it's a leaf
        if (cat.parent_category_id !== null) return true;
        // If it doesn't have a parent, check if it has children
        const hasChildren = allCategories.some(c => c.parent_category_id === cat.id);
        return !hasChildren; // Include if it has no children
      });
      
      setCategories(leafCategories);
    } catch (error: any) {
      toast({
        title: 'Error loading categories',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddIncome = () => {
    if (!selectedCategory) {
      toast({
        title: 'Missing category',
        description: 'Please select an income category.',
        variant: 'destructive',
      });
      return;
    }

    if (!actualAmount || parseFloat(actualAmount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Base amount must be greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    const category = categories.find(cat => cat.id === selectedCategory);
    if (!category) return;

    // Check if CAM without GST - if so, GST should be 0
    const isCAMWithoutGST = category.category_name.toLowerCase().includes('cam without gst');
    const finalGstPercentage = isCAMWithoutGST ? 0 : gstPercentage;
    const finalGstAmount = isCAMWithoutGST ? 0 : gstAmount;

    const newEntry: IncomeEntry = {
      id: Date.now().toString(),
      category_id: selectedCategory,
      category_name: category.subcategory_name || category.category_name,
      actual_amount: actualAmount,
      gst_percentage: finalGstPercentage,
      gst_amount: finalGstAmount,
      total_amount: (parseFloat(actualAmount) || 0) + finalGstAmount,
      notes,
      isEditing: false,
    };

    setIncomeEntries([...incomeEntries, newEntry]);

    // Reset form
    setSelectedCategory('');
    setActualAmount('');
    setGstPercentage(18);
    setGstAmount(0);
    setNotes('');

    toast({
      title: 'Income added',
      description: 'Add more income entries or submit all for approval.',
    });
  };

  const handleRemoveIncome = (id: string) => {
    setIncomeEntries(incomeEntries.filter(entry => entry.id !== id));
  };

  const handleEditIncome = (id: string, field: string, value: any) => {
    setIncomeEntries(incomeEntries.map(entry => {
      if (entry.id !== id) return entry;
      
      const updated = { ...entry, [field]: value };
      
      // Recalculate GST if amount or percentage changes
      if (field === 'actual_amount' || field === 'gst_percentage') {
        const baseAmount = parseFloat(updated.actual_amount) || 0;
        updated.gst_amount = (baseAmount * updated.gst_percentage) / 100;
        updated.total_amount = baseAmount + updated.gst_amount;
      }
      
      return updated;
    }));
  };

  const handleSubmitAll = () => {
    if (incomeEntries.length === 0) {
      toast({
        title: 'No income to submit',
        description: 'Please add at least one income entry before submitting.',
        variant: 'destructive',
      });
      return;
    }
    setPreviewOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const incomeRecords = incomeEntries.map(entry => ({
        fiscal_year: fiscalYear,
        month: selectedMonth,
        category_id: entry.category_id,
        actual_amount: parseFloat(entry.actual_amount),
        gst_amount: entry.gst_amount,
        notes: entry.notes,
        recorded_by: user.id,
        status: 'pending',
      }));

      const { error } = await supabase
        .from('income_actuals')
        .upsert(incomeRecords, {
          onConflict: 'fiscal_year,month,category_id',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      // Fetch the saved records to get their IDs for notification
      const { data: savedRecords } = await supabase
        .from('income_actuals')
        .select('id')
        .eq('fiscal_year', fiscalYear)
        .eq('month', selectedMonth)
        .in('category_id', incomeRecords.map(r => r.category_id));

      // Send notifications to treasurers
      if (savedRecords && savedRecords.length > 0) {
        for (const record of savedRecords) {
          try {
            await supabase.functions.invoke('send-income-notification', {
              body: {
                incomeId: record.id,
                action: 'submitted',
              },
            });
          } catch (notifError) {
            console.error('Failed to send notification:', notifError);
          }
        }
      }

      toast({
        title: 'Submitted for approval',
        description: `${incomeEntries.length} income entry/entries submitted to treasurer for approval.`,
      });

      // Reset
      setIncomeEntries([]);
      setPreviewOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error submitting income',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold">Add Income</h1>
        <p className="text-muted-foreground mt-2">
          Record actual income received for the selected month
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Entry Details</CardTitle>
          <CardDescription>
            Select fiscal year and month, then add income entries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiscal-year">Fiscal Year</Label>
              <Input
                id="fiscal-year"
                type="text"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                placeholder="e.g., FY25-26"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger id="month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Income Entry</CardTitle>
          <CardDescription>
            Fill in the details and add to the list below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="income-category">Income Category *</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="income-category">
                  <SelectValue placeholder="Select income category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.subcategory_name || cat.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual-amount">Base Amount (₹) *</Label>
              <Input
                id="actual-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gst-percentage">GST %</Label>
              <Select
                value={gstPercentage.toString()}
                onValueChange={(value) => setGstPercentage(parseFloat(value))}
              >
                <SelectTrigger id="gst-percentage">
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
              <p className="text-sm text-muted-foreground">
                GST Amount: {formatCurrency(gstAmount)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Total Amount</Label>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(totalAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                Base: {formatCurrency(parseFloat(actualAmount) || 0)} + GST: {formatCurrency(gstAmount)}
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this income..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t mt-6">
            <Button onClick={handleAddIncome} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add to List
            </Button>
          </div>
        </CardContent>
      </Card>

      {incomeEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Income Entries to Submit ({incomeEntries.length})</CardTitle>
            <CardDescription>
              Review and submit all income entries for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead className="w-[120px]">Base</TableHead>
                    <TableHead className="w-[100px]">GST %</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium text-sm">{entry.category_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={entry.actual_amount}
                          onChange={(e) => handleEditIncome(entry.id, 'actual_amount', e.target.value)}
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={entry.gst_percentage.toString()}
                          onValueChange={(value) => handleEditIncome(entry.id, 'gst_percentage', parseFloat(value))}
                        >
                          <SelectTrigger className="h-8 text-xs">
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
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">{formatCurrency(entry.total_amount)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIncome(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-6 border-t mt-6">
              <Button onClick={handleSubmitAll} size="lg" className="min-w-[200px]">
                Submit All for Approval
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Income Entries Before Submitting</DialogTitle>
            <DialogDescription>
              Please verify all calculated amounts before sending to the treasurer for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.category_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(entry.actual_amount) || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.gst_amount)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(entry.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Base Amount</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(incomeEntries.reduce((sum, e) => sum + (parseFloat(e.actual_amount) || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total GST</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(incomeEntries.reduce((sum, e) => sum + e.gst_amount, 0))}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Total Amount (Base + GST)</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(incomeEntries.reduce((sum, e) => sum + e.total_amount, 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={loading}
            >
              Back to Edit
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Approval'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

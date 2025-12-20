import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, Upload, Building2, AlertCircle, Download, Send, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';

const TOWERS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
  '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
  '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

// Tower-specific total flats: 67 per tower, except 12, 13, 14 which have 201 each
const TOWER_TOTAL_FLATS: Record<string, number> = {
  '1A': 67, '1B': 67, '2A': 67, '2B': 67, '3A': 67, '3B': 67,
  '4A': 67, '4B': 67, '5': 67, '6': 67, '7': 67, '8': 67,
  '9A': 67, '9B': 67, '9C': 67, '10': 67, '11': 67,
  '12': 201, '13': 201, '14': 201,
  '15A': 67, '15B': 67,
  '16A': 67, '16B': 67, '17A': 67, '17B': 67,
  '18A': 67, '18B': 67, '18C': 67, '19': 67,
  '20A': 67, '20B': 67, '20C': 67
};

const TOTAL_FLATS_IN_COMPLEX = 2613;

// Fiscal Year Quarters (Q1 starts April)
const FISCAL_QUARTERS = [
  { value: 1, label: 'Q1 (Apr-Jun)', months: [4, 5, 6] },
  { value: 2, label: 'Q2 (Jul-Sep)', months: [7, 8, 9] },
  { value: 3, label: 'Q3 (Oct-Dec)', months: [10, 11, 12] },
  { value: 4, label: 'Q4 (Jan-Mar)', months: [1, 2, 3] }
];

const MONTH_NAMES: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
};

interface CAMData {
  id?: string;
  tower: string;
  year: number;
  quarter: number;
  month?: number;
  paid_flats: number;
  pending_flats: number;
  total_flats: number;
  dues_cleared_from_previous: number;
  advance_payments: number;
  cam_recon_flats?: number;
  notes?: string;
  is_locked?: boolean;
  status?: string;
  document_url?: string | null;
}

interface CAMDataFromDB {
  id: string;
  tower: string;
  year: number;
  quarter: number;
  month: number | null;
  paid_flats: number;
  pending_flats: number;
  total_flats: number;
  dues_cleared_from_previous: number;
  advance_payments: number;
  cam_recon_flats: number;
  notes: string | null;
  is_locked: boolean;
  status: string;
  uploaded_by: string;
  updated_at: string;
  document_url?: string | null;
}

interface MonthlyReport {
  id: string;
  year: number;
  month: number;
  report_type: 'defaulters_list' | 'recon_list';
  document_url: string;
  uploaded_at: string;
  uploaded_by: string;
}

export default function CAMTracking() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Parse URL parameters for pre-selection from discrepancy report
  const urlTower = searchParams.get('tower');
  const urlQuarter = searchParams.get('quarter');
  const urlYear = searchParams.get('year');
  const urlTab = searchParams.get('tab');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(urlTab || 'tower-entry');

  // Update activeTab when URL param changes (for navigation from notifications)
  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
  const [selectedYear, setSelectedYear] = useState(() => {
    return urlYear ? parseInt(urlYear) : new Date().getFullYear();
  });
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    return urlQuarter ? parseInt(urlQuarter) : 1;
  });
  const [selectedTower, setSelectedTower] = useState<string>(() => {
    return urlTower && TOWERS.includes(urlTower) ? urlTower : '1A';
  });
  // Map: Tower -> Month -> Data
  const [camData, setCamData] = useState<Record<string, Record<number, CAMData>>>({});
  const [supportingDocs, setSupportingDocs] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [draftRecords, setDraftRecords] = useState<CAMDataFromDB[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [discrepancyCount, setDiscrepancyCount] = useState(0);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const isMC = !!localStorage.getItem('mc_user');

  const years = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    fetchUserRole();
    fetchDiscrepancyCount();
  }, [user]);

  useEffect(() => {
    fetchCAMData();
    fetchMonthlyReports();
    if (userRole === 'lead') {
      loadDraftRecords();
    }
  }, [selectedYear, selectedQuarter, userRole]);

  const fetchDiscrepancyCount = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .or(`and(year.eq.${currentYear},month.gte.4),and(year.eq.${currentYear + 1},month.lte.3)`);

      if (error) throw error;
      const records = data as CAMDataFromDB[];
      let count = 0;

      TOWERS.forEach(tower => {
        FISCAL_QUARTERS.forEach(quarter => {
          const qMonths = quarter.months;
          const towerQData = records.filter(r => r.tower === tower && qMonths.includes(r.month || 0));
          towerQData.sort((a, b) => qMonths.indexOf(a.month || 0) - qMonths.indexOf(b.month || 0));

          if (towerQData.length < 2) return;

          let previousPending = -1;
          towerQData.forEach(record => {
            if (previousPending !== -1 && record.pending_flats > previousPending) {
              count++;
            }
            previousPending = record.pending_flats;
          });
        });
      });

      setDiscrepancyCount(count);
    } catch (error) {
      console.error('Error fetching discrepancy count:', error);
    }
  };

  const fetchUserRole = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    setUserRole(data?.role || null);
  };

  const getCalendarYearAndMonths = () => {
    const quarterConfig = FISCAL_QUARTERS.find(q => q.value === selectedQuarter);
    if (!quarterConfig) return { year: selectedYear, months: [] };

    const months = quarterConfig.months;
    // If Q4 (Jan-Mar), it falls in the next calendar year
    const calendarYear = selectedQuarter === 4 ? selectedYear + 1 : selectedYear;

    return { calendarYear, months };
  };

  const fetchCAMData = async () => {
    setLoading(true);
    try {
      const { calendarYear, months } = getCalendarYearAndMonths();

      // Fetch data for the specific months in the calendar year
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', calendarYear);

      if (error) throw error;

      // Cast data to our expected type (types.ts may not have month/is_locked yet)
      const typedData = (data || []) as unknown as CAMDataFromDB[];

      const dataMap: Record<string, Record<number, CAMData>> = {};

      // Initialize structure
      TOWERS.forEach(tower => {
        dataMap[tower] = {};
        months.forEach(month => {
          const existing = typedData.find(d => d.tower === tower && d.month === month);
          dataMap[tower][month] = existing ? {
            id: existing.id,
            tower: existing.tower,
            year: existing.year,
            quarter: existing.quarter,
            month: existing.month || month,
            paid_flats: existing.paid_flats,
            pending_flats: existing.pending_flats,
            total_flats: existing.total_flats,
            dues_cleared_from_previous: existing.dues_cleared_from_previous,
            advance_payments: existing.advance_payments,
            cam_recon_flats: (existing as any).cam_recon_flats || 0,
            notes: existing.notes || undefined,
            is_locked: existing.is_locked,
            status: existing.status,
            document_url: existing.document_url
          } : {
            tower,
            year: calendarYear,
            quarter: Math.ceil(month / 3),
            month,
            paid_flats: 0,
            pending_flats: 0,
            total_flats: TOWER_TOTAL_FLATS[tower],
            dues_cleared_from_previous: 0,
            advance_payments: 0,
            cam_recon_flats: 0,
            is_locked: false,
            status: 'draft'
          };
        });
      });

      // Populate supportingDocs from fetched data
      const docsMap: Record<string, string> = {};
      typedData.forEach(d => {
        if (d.tower && d.document_url) {
          docsMap[d.tower] = d.document_url;
        }
      });
      setSupportingDocs(docsMap);

      setCamData(dataMap);
      setValidationErrors({});
    } catch (error: any) {
      toast.error('Failed to fetch CAM data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDraftRecords = async () => {
    if (!user) return;
    setLoadingDrafts(true);
    try {
      const { calendarYear } = getCalendarYearAndMonths();

      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', calendarYear)
        .eq('status', 'draft')
        .eq('uploaded_by', user.id)
        .order('tower')
        .order('month');

      if (error) throw error;

      setDraftRecords((data || []) as CAMDataFromDB[]);
    } catch (error: any) {
      toast.error('Failed to load draft records: ' + error.message);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (!user || selectedDrafts.size === 0) return;

    const confirmed = confirm(`Submit ${selectedDrafts.size} draft record(s) for approval?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const idsToSubmit = Array.from(selectedDrafts);

      const { error } = await supabase
        .from('cam_tracking')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          uploaded_by: user.id
        } as any)
        .in('id', idsToSubmit);

      if (error) throw error;

      toast.success(`${idsToSubmit.length} record(s) submitted for approval`);
      setSelectedDrafts(new Set());
      loadDraftRecords();
      fetchCAMData();
    } catch (error: any) {
      toast.error('Failed to submit records: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const validateTowerData = (tower: string, month: number, data: CAMData): string | null => {
    const maxFlats = TOWER_TOTAL_FLATS[tower];

    if (data.paid_flats < 0 || data.pending_flats < 0) {
      return 'Values cannot be negative';
    }

    if (data.paid_flats > maxFlats) {
      return `Paid flats cannot exceed ${maxFlats} for tower ${tower}`;
    }

    if (data.pending_flats > maxFlats) {
      return `Pending flats cannot exceed ${maxFlats} for tower ${tower}`;
    }

    if (data.paid_flats + data.pending_flats > maxFlats) {
      return `Total (paid + pending) cannot exceed ${maxFlats} flats in ${MONTH_NAMES[month]}`;
    }

    return null;
  };

  const handleInputChange = (
    tower: string,
    month: number,
    field: 'paid_flats' | 'pending_flats' | 'dues_cleared_from_previous' | 'advance_payments' | 'cam_recon_flats',
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    const currentMonthData = camData[tower][month];

    const updatedMonthData = {
      ...currentMonthData,
      [field]: numValue,
      total_flats: TOWER_TOTAL_FLATS[tower]
    };

    setCamData(prev => ({
      ...prev,
      [tower]: {
        ...prev[tower],
        [month]: updatedMonthData
      }
    }));

    const error = validateTowerData(tower, month, updatedMonthData);
    setValidationErrors(prev => ({
      ...prev,
      [`${tower}-${month}`]: error || ''
    }));
  };

  const handleSaveTower = async (tower: string) => {
    if (!user) return;

    const { months } = getCalendarYearAndMonths();
    const towerMonthsData = camData[tower];

    // Validate all months first
    for (const month of months) {
      const error = validateTowerData(tower, month, towerMonthsData[month]);
      if (error) {
        toast.error(`Error in ${MONTH_NAMES[month]}: ${error}`);
        return;
      }
    }

    setSaving(true);
    try {
      const upsertData = months.map(month => {
        const data = towerMonthsData[month];
        return {
          tower: data.tower,
          year: data.year,
          quarter: data.quarter, // Calendar quarter
          month: month,
          paid_flats: data.paid_flats,
          pending_flats: data.pending_flats,
          total_flats: TOWER_TOTAL_FLATS[tower],
          dues_cleared_from_previous: data.dues_cleared_from_previous || 0,
          advance_payments: data.advance_payments || 0,
          cam_recon_flats: data.cam_recon_flats || 0,
          notes: data.notes || null,
          uploaded_by: user.id,
          // Use newly uploaded doc OR existing one from data if looking at same month/tower
          document_url: supportingDocs[tower] || data.document_url || null
        };
      });

      // We need to upsert each record. 
      // Since we have a unique constraint on (tower, year, month), we can use upsert.
      // However, we need to handle the ID if it exists to avoid creating new IDs if not needed, 
      // but upsert handles that if we match the unique key? 
      // Supabase upsert matches on Primary Key by default, or we can specify `onConflict`.

      // Cast to any to bypass type checking until types.ts is regenerated
      const { error } = await supabase
        .from('cam_tracking')
        .upsert(upsertData as any, { onConflict: 'tower,year,month' });

      if (error) throw error;

      toast.success(`Tower ${tower} data saved as draft`);
      fetchCAMData();
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitTower = async (tower: string) => {
    if (!user) return;

    const { months } = getCalendarYearAndMonths();
    const towerMonthsData = camData[tower];

    // Validate all months first
    for (const month of months) {
      const error = validateTowerData(tower, month, towerMonthsData[month]);
      if (error) {
        toast.error(`Error in ${MONTH_NAMES[month]}: ${error}`);
        return;
      }
    }

    // Check if all months have data (paid_flats > 0 or pending_flats > 0)
    const hasData = months.every(month => {
      const data = towerMonthsData[month];
      return data.paid_flats > 0 || data.pending_flats > 0;
    });

    if (!hasData) {
      toast.error('Please enter data for all months before submitting');
      return;
    }

    setSaving(true);
    try {
      const { calendarYear } = getCalendarYearAndMonths();

      console.log('=== SUBMITTING CAM FOR APPROVAL ===');
      console.log('Tower:', tower);
      console.log('Year:', calendarYear);
      console.log('Months:', months);

      // Update status to 'submitted' for all months of this tower
      const { error } = await supabase
        .from('cam_tracking')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          uploaded_by: user.id
        } as any)
        .eq('tower', tower)
        .eq('year', calendarYear)
        .in('month', months);

      if (error) {
        console.error('CAM Submission Error:', error);
        throw error;
      }

      console.log('CAM submission update successful');

      // Send notification to treasurers (asynchronously, don't block on it)
      // Get the IDs of records that were just submitted
      const { data: submittedRecords } = await supabase
        .from('cam_tracking')
        .select('id')
        .eq('tower', tower)
        .eq('year', calendarYear)
        .in('month', months)
        .eq('status', 'submitted');

      console.log('Submitted Records:', submittedRecords);

      // Send notifications for each record
      if (submittedRecords && submittedRecords.length > 0) {
        for (const record of submittedRecords) {
          supabase.functions.invoke('send-cam-notification', {
            body: { camId: record.id, action: 'submitted' }
          }).catch(err => console.error('Notification failed:', err));
        }
      }

      console.log('=== END CAM SUBMISSION ===');

      toast.success(`Tower ${tower} data submitted for approval`);
      fetchCAMData();
    } catch (error: any) {
      toast.error('Failed to submit: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getTowerStatus = (tower: string): string => {
    const { months } = getCalendarYearAndMonths();
    const statuses = months.map(m => camData[tower]?.[m]?.status || 'draft');

    if (statuses.every(s => s === 'approved')) return 'approved';
    if (statuses.some(s => s === 'submitted')) return 'submitted';
    if (statuses.some(s => s === 'correction_pending')) return 'correction_pending';
    if (statuses.some(s => s === 'correction_approved')) return 'correction_approved';
    return 'draft';
  };

  const canEditTower = (tower: string): boolean => {
    const status = getTowerStatus(tower);
    return status === 'draft' || status === 'correction_approved';
  };

  const handleDownload = () => {
    if (!camData) return;

    const { months } = getCalendarYearAndMonths();
    const exportData: any[] = [];

    TOWERS.forEach(tower => {
      const row: any = { Tower: tower };
      months.forEach(month => {
        const data = camData[tower]?.[month];
        if (data) {
          const mName = MONTH_NAMES[month];
          row[`${mName} Paid`] = data.paid_flats;
          row[`${mName} Pending`] = data.pending_flats;
          row[`${mName} Dues Cleared`] = data.dues_cleared_from_previous;
          row[`${mName} Advance`] = data.advance_payments;
        }
      });
      exportData.push(row);
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CAM Data");
    XLSX.writeFile(wb, `CAM_Report_FY${selectedYear}_Q${selectedQuarter}.xlsx`);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, tower: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error('You must be logged in to upload files');
      return;
    }

    try {
      // Upload file to 'cam' bucket (private bucket for security)
      const fileExt = file.name.split('.').pop();
      const { calendarYear, months } = getCalendarYearAndMonths();
      const fileName = `${tower}/${calendarYear}/Q${selectedQuarter}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('cam')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the file path (not public URL since bucket is private)
      // We'll use signed URLs when downloading
      setSupportingDocs(prev => ({
        ...prev,
        [tower]: fileName
      }));

      toast.success(`Supporting document uploaded for Tower ${tower}`);
    } catch (error: any) {
      toast.error('Failed to upload file: ' + error.message);
    }
    event.target.value = '';
  };

  const getTowerMonthData = (tower: string, month: number) => camData[tower]?.[month] || {
    tower,
    year: selectedYear,
    quarter: selectedQuarter,
    month,
    paid_flats: 0,
    pending_flats: 0,
    total_flats: TOWER_TOTAL_FLATS[tower],
    dues_cleared_from_previous: 0,
    advance_payments: 0,
    cam_recon_flats: 0
  };

  const fetchMonthlyReports = async () => {
    try {
      setLoadingReports(true);
      const { data, error } = await supabase
        .from('cam_monthly_reports')
        .select('*')
        .eq('year', selectedYear)
        .order('month', { ascending: false });

      if (error) throw error;
      setMonthlyReports(data as MonthlyReport[]);
    } catch (error: any) {
      console.error('Error fetching monthly reports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleReportUpload = async (event: React.ChangeEvent<HTMLInputElement>, month: number, type: 'defaulters_list' | 'recon_list') => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      setSaving(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `monthly_reports/${selectedYear}/${month}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('cam')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('cam_monthly_reports')
        .upsert({
          year: selectedYear,
          month: month,
          report_type: type,
          document_url: fileName,
          uploaded_by: user.id
        }, { onConflict: 'year,month,report_type' });

      if (dbError) throw dbError;

      toast.success(`${type === 'defaulters_list' ? 'Defaulters List' : 'Recon List'} uploaded for ${MONTH_NAMES[month]}`);
      fetchMonthlyReports();
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  };

  const downloadReport = async (report: MonthlyReport) => {
    try {
      const { data, error } = await supabase.storage
        .from('cam')
        .createSignedUrl(report.document_url, 3600);

      if (error) throw error;

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = `${report.report_type}_${MONTH_NAMES[report.month]}_${report.year}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      toast.error('Download failed: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            CAM Tracking
          </h1>
          <p className="text-muted-foreground">
            Track Common Area Maintenance payments by tower (Total: {TOTAL_FLATS_IN_COMPLEX} flats)
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tower-entry">Tower-wise Entry</TabsTrigger>
          <TabsTrigger value="overview">All Towers Overview</TabsTrigger>
          <TabsTrigger value="monthly-reports">Monthly Reports (30th/20th)</TabsTrigger>
          <TabsTrigger value="discrepancies">
            Discrepancy Check {discrepancyCount > 0 && `(${discrepancyCount})`}
          </TabsTrigger>
          <TabsTrigger value="summary">Quarterly Summary</TabsTrigger>
          {userRole === 'lead' && (
            <TabsTrigger value="drafts">Draft Records ({draftRecords.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tower-entry" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={selectedTower} onValueChange={setSelectedTower}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Tower" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOWERS.map(tower => (
                      <SelectItem key={tower} value={tower}>
                        Tower {tower} ({TOWER_TOTAL_FLATS[tower]} flats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={String(year)}>FY {year}-{year + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {FISCAL_QUARTERS.map(q => (
                      <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Tower {selectedTower} has <strong>{TOWER_TOTAL_FLATS[selectedTower]}</strong> total flats.
                  Paid + Pending cannot exceed this limit.
                </AlertDescription>
              </Alert>

              <div className="space-y-6">
                {getCalendarYearAndMonths().months.map(month => (
                  <div key={month} className="p-4 border rounded-lg bg-muted/20">
                    <h3 className="font-semibold mb-3 text-primary">{MONTH_NAMES[month]}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Paid Flats</label>
                        <Input
                          type="number"
                          min="0"
                          max={TOWER_TOTAL_FLATS[selectedTower]}
                          value={getTowerMonthData(selectedTower, month).paid_flats || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'paid_flats', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Pending Flats</label>
                        <Input
                          type="number"
                          min="0"
                          max={TOWER_TOTAL_FLATS[selectedTower]}
                          value={getTowerMonthData(selectedTower, month).pending_flats || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'pending_flats', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Dues Cleared</label>
                        <Input
                          type="number"
                          min="0"
                          value={getTowerMonthData(selectedTower, month).dues_cleared_from_previous || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'dues_cleared_from_previous', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Advance</label>
                        <Input
                          type="number"
                          min="0"
                          value={getTowerMonthData(selectedTower, month).advance_payments || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'advance_payments', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">CAM Recon</label>
                        <Input
                          type="number"
                          min="0"
                          value={getTowerMonthData(selectedTower, month).cam_recon_flats || ''}
                          onChange={(e) => handleInputChange(selectedTower, month, 'cam_recon_flats', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {validationErrors[`${selectedTower}-${month}`] && (
                      <p className="text-sm text-destructive mt-2">{validationErrors[`${selectedTower}-${month}`]}</p>
                    )}
                  </div>
                ))}
              </div>



              <div className="flex items-center justify-between gap-3 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => handleFileUpload(e, selectedTower)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={!canEditTower(selectedTower)}
                    />
                    <Button variant="outline" size="sm" disabled={!canEditTower(selectedTower)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>

                  {supportingDocs[selectedTower] && (
                    <div className="flex items-center gap-2">
                      <a
                        href={supportingDocs[selectedTower]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        View Document
                      </a>
                    </div>
                  )}

                  <Button
                    onClick={() => handleSaveTower(selectedTower)}
                    disabled={saving || !!validationErrors[selectedTower] || !canEditTower(selectedTower)}
                    variant="outline"
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Draft
                  </Button>
                  {userRole === 'lead' && getTowerStatus(selectedTower) === 'draft' && (
                    <Button
                      onClick={() => handleSubmitTower(selectedTower)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Submit for Approval
                    </Button>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant={
                    getTowerStatus(selectedTower) === 'approved' ? 'default' :
                      getTowerStatus(selectedTower) === 'submitted' ? 'secondary' :
                        getTowerStatus(selectedTower) === 'correction_pending' ? 'destructive' :
                          'outline'
                  }>
                    {getTowerStatus(selectedTower) === 'draft' ? 'Draft' :
                      getTowerStatus(selectedTower) === 'submitted' ? 'Pending Approval' :
                        getTowerStatus(selectedTower) === 'approved' ? 'Approved' :
                          getTowerStatus(selectedTower) === 'correction_pending' ? 'Correction Pending' :
                            getTowerStatus(selectedTower) === 'correction_approved' ? 'Edit Allowed' :
                              'Draft'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-lg">All Towers - {FISCAL_QUARTERS.find(q => q.value === selectedQuarter)?.label} {selectedYear}</CardTitle>
                <div className="flex items-center gap-3">
                  {(userRole === 'treasurer' || userRole === 'lead') && (
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  )}
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>FY {year}-{year + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_QUARTERS.map(q => (
                        <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[80px]">Tower</TableHead>
                      <TableHead className="w-[80px]">Total</TableHead>
                      {getCalendarYearAndMonths().months.map(m => (
                        <TableHead key={m} className="text-center border-l" colSpan={2}>{MONTH_NAMES[m]}</TableHead>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      {getCalendarYearAndMonths().months.map(m => (
                        <>
                          <TableHead key={`${m}-paid`} className="text-xs text-center border-l text-green-600">Paid</TableHead>
                          <TableHead key={`${m}-pending`} className="text-xs text-center text-red-600">Pending</TableHead>
                        </>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TOWERS.map(tower => {
                      const maxFlats = TOWER_TOTAL_FLATS[tower];
                      const months = getCalendarYearAndMonths().months;

                      return (
                        <TableRow key={tower}>
                          <TableCell className="font-medium">{tower}</TableCell>
                          <TableCell>{maxFlats}</TableCell>
                          {months.map(m => {
                            const data = getTowerMonthData(tower, m);
                            return (
                              <>
                                <TableCell className="text-center border-l text-green-600">{data.paid_flats}</TableCell>
                                <TableCell className="text-center text-red-600">{data.pending_flats}</TableCell>
                              </>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell>{TOTAL_FLATS_IN_COMPLEX}</TableCell>
                      {getCalendarYearAndMonths().months.map(m => {
                        const totalPaid = Object.values(camData).reduce((sum, tData) => sum + (tData[m]?.paid_flats || 0), 0);
                        const totalPending = Object.values(camData).reduce((sum, tData) => sum + (tData[m]?.pending_flats || 0), 0);
                        return (
                          <>
                            <TableCell className="text-center border-l text-green-600">{totalPaid}</TableCell>
                            <TableCell className="text-center text-red-600">{totalPending}</TableCell>
                          </>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-4">
          <DiscrepancyReport />
        </TabsContent>

        <TabsContent value="summary">
          <QuarterlySummary />
        </TabsContent>

        {userRole === 'lead' && (
          <TabsContent value="drafts">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Draft CAM Records</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select records to submit for approval
                    </p>
                  </div>
                  {selectedDrafts.size > 0 && (
                    <Button onClick={handleBulkSubmit} disabled={saving}>
                      <Send className="w-4 h-4 mr-2" />
                      Submit {selectedDrafts.size} Record{selectedDrafts.size > 1 ? 's' : ''}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingDrafts ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : draftRecords.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No draft records found. All data has been submitted.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedDrafts.size === draftRecords.length && draftRecords.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedDrafts(new Set(draftRecords.map(r => r.id)));
                                } else {
                                  setSelectedDrafts(new Set());
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Tower</TableHead>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Paid Flats</TableHead>
                          <TableHead className="text-right">Pending Flats</TableHead>
                          <TableHead className="text-right">Total Flats</TableHead>
                          <TableHead className="text-right">Dues Cleared</TableHead>
                          <TableHead className="text-right">Advance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draftRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedDrafts.has(record.id)}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedDrafts);
                                  if (checked) {
                                    newSelected.add(record.id);
                                  } else {
                                    newSelected.delete(record.id);
                                  }
                                  setSelectedDrafts(newSelected);
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{record.tower}</TableCell>
                            <TableCell>
                              {MONTH_NAMES[record.month || 0] || record.month}
                            </TableCell>
                            <TableCell className="text-right">{record.paid_flats}</TableCell>
                            <TableCell className="text-right">{record.pending_flats}</TableCell>
                            <TableCell className="text-right">{record.total_flats}</TableCell>
                            <TableCell className="text-right">{record.dues_cleared_from_previous}</TableCell>
                            <TableCell className="text-right">{record.advance_payments}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="monthly-reports">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Defaulters & Recon Lists</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>FY {year}-{year + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-muted-foreground">
                    <p>Lead users upload Defaulters List on 30th and Recon List on 20th.</p>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Defaulters List (30th)</TableHead>
                        <TableHead>Recon List (20th)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[3, 2, 1, 12, 11, 10, 9, 8, 7, 6, 5, 4].map(month => {
                        const mYear = month <= 3 ? selectedYear + 1 : selectedYear;
                        const defaulterReport = monthlyReports.find(r => r.month === month && r.year === selectedYear && r.report_type === 'defaulters_list');
                        const reconReport = monthlyReports.find(r => r.month === month && r.year === selectedYear && r.report_type === 'recon_list');

                        return (
                          <TableRow key={month}>
                            <TableCell className="font-medium">{MONTH_NAMES[month]} {mYear}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {defaulterReport ? (
                                  <Button variant="ghost" size="sm" onClick={() => downloadReport(defaulterReport)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not uploaded</span>
                                )}
                                {(userRole === 'lead' || userRole === 'admin' || userRole === 'treasurer' || isMC) && (
                                  <div className="relative">
                                    <input
                                      type="file"
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      onChange={(e) => handleReportUpload(e, month, 'defaulters_list')}
                                    />
                                    <Button variant="outline" size="sm">
                                      <Upload className="h-3 w-3 mr-1" />
                                      {defaulterReport ? 'Update' : 'Upload'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {reconReport ? (
                                  <Button variant="ghost" size="sm" onClick={() => downloadReport(reconReport)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not uploaded</span>
                                )}
                                {(userRole === 'lead' || userRole === 'admin' || userRole === 'treasurer' || isMC) && (
                                  <div className="relative">
                                    <input
                                      type="file"
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      onChange={(e) => handleReportUpload(e, month, 'recon_list')}
                                    />
                                    <Button variant="outline" size="sm">
                                      <Upload className="h-3 w-3 mr-1" />
                                      {reconReport ? 'Update' : 'Upload'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuarterlySummary() {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<CAMData[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    fetchSummary();
  }, [selectedYear]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      // Fetch data for the fiscal year (Apr of selectedYear to Mar of selectedYear + 1)
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .or(`and(year.eq.${selectedYear},month.gte.4),and(year.eq.${selectedYear + 1},month.lte.3)`);

      if (error) throw error;
      setSummaryData(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch summary: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getQuarterTotals = (quarter: number) => {
    const quarterConfig = FISCAL_QUARTERS.find(q => q.value === quarter);
    if (!quarterConfig) return { paid: 0, pending: 0, duesCleared: 0, advance: 0, total: TOTAL_FLATS_IN_COMPLEX };

    const qData = summaryData.filter(d => quarterConfig.months.includes(d.month || 0));

    // Group data by tower to find the latest month for each tower
    const towerLatestData: Record<string, CAMData> = {};

    qData.forEach(d => {
      if (!towerLatestData[d.tower] || (d.month || 0) > (towerLatestData[d.tower].month || 0)) {
        towerLatestData[d.tower] = d;
      }
    });

    // For Paid and Pending, we take the status from the LATEST month of the quarter for each tower
    // This represents the final position for the quarter
    const totalPaid = Object.values(towerLatestData).reduce((sum, d) => sum + d.paid_flats, 0);
    const totalPending = Object.values(towerLatestData).reduce((sum, d) => sum + d.pending_flats, 0);

    // For Total Demand: Since it's a quarterly invoice, the demand is just the total flats (1 invoice per flat)
    // We don't multiply by 3 anymore.
    const totalDemand = TOTAL_FLATS_IN_COMPLEX;

    return {
      paid: totalPaid,
      pending: totalPending,
      // Dues cleared and Advance are flows/transactions, so we sum them up across all months
      duesCleared: qData.reduce((sum, d) => sum + (d.dues_cleared_from_previous || 0), 0),
      advance: qData.reduce((sum, d) => sum + (d.advance_payments || 0), 0),
      total: totalDemand
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={String(year)}>FY {year}-{year + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FISCAL_QUARTERS.map(q => {
          const totals = getQuarterTotals(q.value);
          return (
            <Card key={q.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{q.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Demand (3 months):</span>
                  <span className="font-medium">{totals.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-medium text-green-600">{totals.paid}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-medium text-red-600">{totals.pending}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dues Cleared:</span>
                  <span className="font-medium text-blue-600">{totals.duesCleared}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Advance Paid:</span>
                  <span className="font-medium text-purple-600">{totals.advance}</span>
                </div>
                {totals.paid > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Collection Rate</div>
                    <div className="text-lg font-bold">
                      {((totals.paid / totals.total) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tower-wise Quarterly Comparison - Pending Flats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tower</TableHead>
                  <TableHead className="text-center">Total Flats</TableHead>
                  {FISCAL_QUARTERS.map(q => (
                    <TableHead key={q.value} className="text-center">{q.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TOWERS.map(tower => (
                  <TableRow key={tower}>
                    <TableCell className="font-medium">{tower}</TableCell>
                    <TableCell className="text-center">{TOWER_TOTAL_FLATS[tower]}</TableCell>
                    {FISCAL_QUARTERS.map(q => {
                      const qMonths = q.months;
                      const towerData = summaryData.filter(d => d.tower === tower && qMonths.includes(d.month || 0));

                      // Find the record for the latest month in this quarter
                      // We sort simply by finding the max month
                      const latestRecord = towerData.reduce<CAMData | null>((prev, current) => {
                        return (!prev || (current.month || 0) > (prev.month || 0)) ? current : prev;
                      }, null);

                      // Use pending flats from the latest record, or 0 if no data
                      const totalPending = latestRecord ? latestRecord.pending_flats : 0;

                      return (
                        <TableCell key={q.value} className="text-center">
                          <span className={totalPending > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {totalPending}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DiscrepancyReport() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sendingAlert, setSendingAlert] = useState(false);

  // Logic to identify impossible scenarios:
  // 1. Pending count increasing within a quarter (e.g. Apr: 5, May: 7) - Impossible unless invoice generated mid-quarter?
  //    Actually, user said: "residents have rights to pay in April or May... we cannot accumulate".
  //    User logic: "Q1 April there are 5 defaulters and May 7... condition not possible."
  //    So, Pending count should NEVER increase within a quarter. It can only stay same or decrease.

  useEffect(() => {
    checkDiscrepancies();
  }, [selectedYear]);

  const checkDiscrepancies = async () => {
    setLoading(true);
    try {
      // Fetch all data for the fiscal year
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .or(`and(year.eq.${selectedYear},month.gte.4),and(year.eq.${selectedYear + 1},month.lte.3)`)
        .order('tower')
        .order('month');

      if (error) throw error;
      const records = data as CAMDataFromDB[];
      const foundDiscrepancies: any[] = [];

      TOWERS.forEach(tower => {
        // Check each quarter
        FISCAL_QUARTERS.forEach(quarter => {
          const qMonths = quarter.months;
          const towerQData = records.filter(r => r.tower === tower && qMonths.includes(r.month || 0));

          // Sort by month index to ensure order
          towerQData.sort((a, b) => qMonths.indexOf(a.month || 0) - qMonths.indexOf(b.month || 0));

          if (towerQData.length < 2) return; // Need at least 2 months to compare

          let previousPending = -1;
          let previousMonth = -1;

          towerQData.forEach(record => {
            const currentPending = record.pending_flats;
            const currentMonth = record.month || 0;

            if (previousPending !== -1) {
              // Check logic: Pending should not increase
              if (currentPending > previousPending) {
                foundDiscrepancies.push({
                  id: `${tower}-${quarter.value}-${currentMonth}`,
                  tower,
                  quarter: quarter.label,
                  quarterValue: quarter.value,
                  month1: MONTH_NAMES[previousMonth],
                  val1: previousPending,
                  month2: MONTH_NAMES[currentMonth],
                  val2: currentPending,
                  type: 'Pending count increased', // "Impossible" increase
                  description: `Pending count increased from ${previousPending} (${MONTH_NAMES[previousMonth]}) to ${currentPending} (${MONTH_NAMES[currentMonth]})`
                });
              }
            }
            previousPending = currentPending;
            previousMonth = currentMonth;
          });
        });
      });

      setDiscrepancies(foundDiscrepancies);
    } catch (error: any) {
      toast.error('Error checking discrepancies: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendAlert = async (item: any) => {
    if (!user) return;
    setSendingAlert(true);
    try {
      // Find lead users to notify
      const { data: leadRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'lead');

      if (!leadRoles || leadRoles.length === 0) {
        toast.error("No lead users found to alert");
        return;
      }

      const notifications = leadRoles.map(lead => ({
        user_id: lead.user_id,
        type: 'data_discrepancy',
        title: `Data Discrepancy in Tower ${item.tower}`,
        message: `${item.description}. Please verify data.`,
        created_by: user.id
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;

      toast.success("Alert sent to Lead users");
    } catch (error: any) {
      toast.error("Failed to send alert: " + error.message);
    } finally {
      setSendingAlert(false);
    }
  };

  const navigateToCorrectEntry = (item: any) => {
    // Navigate to CAM Tracking with the tower and quarter pre-selected
    window.location.href = `/cam-tracking?tower=${item.tower}&quarter=${item.quarterValue}&year=${selectedYear}`;
  };

  if (loading || authLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-5 w-5" />
          Data Discrepancy Report
        </CardTitle>
        <p className="text-muted-foreground">
          Identify potential data entry errors. Pending counts should typically decrease or stay same within a quarter.
        </p>
      </CardHeader>
      <CardContent>
        {discrepancies.length === 0 ? (
          <div className="text-center py-8 text-green-600 flex flex-col items-center">
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-xl">✓</span>
            </div>
            <p>No logical discrepancies found in pending counts.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tower</TableHead>
                  <TableHead>Quarter</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.tower}</TableCell>
                    <TableCell>{item.quarter}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-700">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">
                      {userRole === 'treasurer' ? (
                        <Button size="sm" variant="outline" onClick={() => sendAlert(item)} disabled={sendingAlert}>
                          <Send className="h-4 w-4 mr-1" />
                          Alert Lead
                        </Button>
                      ) : userRole === 'lead' ? (
                        <Button size="sm" variant="outline" onClick={() => navigateToCorrectEntry(item)}>
                          <FileText className="h-4 w-4 mr-1" />
                          Correct Entry
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

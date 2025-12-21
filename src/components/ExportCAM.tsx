import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Download, Building2, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TOWERS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
  '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
  '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

const TOWER_TOTAL_FLATS: Record<string, number> = {
  '1A': 67, '1B': 67, '2A': 67, '2B': 67, '3A': 67, '3B': 67,
  '4A': 67, '4B': 67, '5': 67, '6': 67, '7': 67, '8': 67,
  '9A': 67, '9B': 67, '9C': 67, '10': 67,
  '11': 201, '12': 201, '13': 201,
  '14': 67, '15A': 67, '15B': 67,
  '16A': 67, '16B': 67, '17A': 67, '17B': 67,
  '18A': 67, '18B': 67, '18C': 67, '19': 67,
  '20A': 67, '20B': 67, '20C': 67
};

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

interface CAMRecord {
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
  status: string;
  notes: string | null;
}

export function ExportCAM() {
  const [loading, setLoading] = useState(true);
  const getCurrentFiscal = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Fiscal year starts in April
    const fYear = month <= 3 ? year - 1 : year;
    let quarter = 1;
    if (month >= 4 && month <= 6) quarter = 1;
    else if (month >= 7 && month <= 9) quarter = 2;
    else if (month >= 10 && month <= 12) quarter = 3;
    else quarter = 4;

    return { year: fYear, quarter };
  };

  const initialFiscal = getCurrentFiscal();
  const [selectedYear, setSelectedYear] = useState(initialFiscal.year);
  const [selectedQuarter, setSelectedQuarter] = useState(initialFiscal.quarter);
  const [camData, setCamData] = useState<CAMRecord[]>([]);
  const [mcUser, setMcUser] = useState<any>(null);
  const [monthlyReports, setMonthlyReports] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Dynamic year generation: Start from 2024 up to current year + 1
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2024 + i);

  useEffect(() => {
    const stored = localStorage.getItem('mc_user');
    if (stored) {
      setMcUser(JSON.parse(stored));
    }
    fetchCAMData();
    fetchMonthlyReports();
  }, [selectedYear, selectedQuarter]);

  const fetchCAMData = async () => {
    setLoading(true);
    try {
      // Fetch all records for the fiscal year to have a complete picture
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('status', 'approved')
        .in('year', [selectedYear, selectedYear + 1]);

      if (error) throw error;

      setCamData((data || []) as unknown as CAMRecord[]);
    } catch (error: any) {
      console.error('Error fetching CAM data:', error);
      toast.error('Failed to load CAM data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReports = async () => {
    try {
      const quarterConfig = FISCAL_QUARTERS.find(q => q.value === selectedQuarter);
      const months = quarterConfig?.months || [];

      let query = (supabase as any)
        .from('cam_monthly_reports')
        .select('*')
        .eq('year', selectedYear)
        .in('month', months);

      if (mcUser) {
        query = query.eq('tower', mcUser.tower_no);
      }

      const { data, error } = await query
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as Array<{
        year: number;
        month: number;
        report_type: 'defaulters_list' | 'recon_list';
        document_url: string;
        status?: string | null;
      }>;

      // Group by year and month
      const grouped: Record<string, any> = {};
      rows.forEach((row) => {
        const key = `${row.year}-${row.month}`;
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            year: row.year,
            month: row.month,
            status: row.status || 'draft',
            defaulters_list_url: null,
            recon_list_url: null,
          };
        }
        if (row.report_type === 'defaulters_list') {
          grouped[key].defaulters_list_url = row.document_url;
        } else if (row.report_type === 'recon_list') {
          grouped[key].recon_list_url = row.document_url;
        }
      });

      setMonthlyReports(Object.values(grouped));
    } catch (error: any) {
      console.error('Error fetching monthly reports:', error);
    }
  };

  const handleReportUpload = async (event: React.ChangeEvent<HTMLInputElement>, month: number, year: number, type: 'defaulters_list' | 'recon_list') => {
    const file = event.target.files?.[0];
    if (!file || !mcUser) return;

    try {
      setSaving(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `monthly_reports/${year}/${month}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('cam')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await (supabase as any)
        .from('cam_monthly_reports')
        .upsert({
          year: year,
          month: month,
          tower: mcUser.tower_no,
          report_type: type,
          document_url: fileName,
          uploaded_by: mcUser.id,
        }, { onConflict: 'year,month,tower,report_type' });

      if (dbError) throw dbError;

      toast.success(`${type === 'defaulters_list' ? 'Defaulters List' : 'Recon List'} uploaded for ${MONTH_NAMES[month]}`);
      fetchMonthlyReports();
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setSaving(true); // Small delay to let DB catch up
      setTimeout(() => setSaving(false), 500);
      event.target.value = '';
    }
  };

  const downloadReport = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('cam')
        .createSignedUrl(path, 3600);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      toast.error('Download failed: ' + error.message);
    }
  };

  const getQuarterSummary = () => {
    const quarterConfig = FISCAL_QUARTERS.find(q => q.value === selectedQuarter);
    const monthsInQuarter = quarterConfig?.months || [];

    const summary: Record<string, {
      tower: string;
      totalFlats: number;
      paidFlats: number;
      pendingFlats: number;
      duesCleared: number;
      advance: number;
      camRecon: number;
      month?: number;
      isFromSelectedPeriod: boolean;
    }> = {};

    // Initialize with defaults
    TOWERS.forEach(tower => {
      summary[tower] = {
        tower,
        totalFlats: TOWER_TOTAL_FLATS[tower],
        paidFlats: 0,
        pendingFlats: TOWER_TOTAL_FLATS[tower],
        duesCleared: 0,
        advance: 0,
        camRecon: 0,
        isFromSelectedPeriod: false
      };
    });

    // We want the latest approved month recorded for each tower.
    // Preference 1: Latest month WITHIN the selected quarter
    // Preference 2: If none, latest month overall in the fiscal year
    camData.forEach(record => {
      if (!record.month) return;

      const existing = summary[record.tower];
      const isInQuarter = monthsInQuarter.includes(record.month);

      // Determine if we should update this tower's stats
      let shouldUpdate = false;

      if (isInQuarter) {
        // If this record is in the quarter, and existing is NOT in quarter, OR this is a later month in quarter
        if (!existing.isFromSelectedPeriod || record.month > (existing.month || 0)) {
          shouldUpdate = true;
        }
      } else if (!existing.isFromSelectedPeriod) {
        // If record is NOT in quarter, only update if existing is also not and this is later
        if (!existing.month || record.month > existing.month) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        summary[record.tower] = {
          tower: record.tower,
          totalFlats: record.total_flats,
          paidFlats: record.paid_flats,
          pendingFlats: record.pending_flats,
          duesCleared: record.dues_cleared_from_previous,
          advance: record.advance_payments,
          cam_recon_flats: (record as any).cam_recon_flats || 0,
          month: record.month,
          isFromSelectedPeriod: isInQuarter
        } as any;
      }
    });

    return Object.values(summary);
  };

  const exportToExcel = () => {
    const summary = getQuarterSummary();
    const exportData = summary.map(row => ({
      'Tower': row.tower,
      'Total Flats': row.totalFlats,
      'Paid Flats': row.paidFlats,
      'Pending Flats': row.pendingFlats,
      'Dues Cleared': row.duesCleared,
      'Advance Payments': row.advance,
      'CAM Recon': row.camRecon,
      'Collection Rate (%)': ((row.paidFlats / row.totalFlats) * 100).toFixed(1)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CAM Report");
    XLSX.writeFile(wb, `CAM_Report_FY${selectedYear}_Q${selectedQuarter}.xlsx`);
    toast.success('Excel file downloaded');
  };

  const exportToPDF = () => {
    const summary = getQuarterSummary();
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`CAM Collection Report - FY${selectedYear} Q${selectedQuarter}`, 14, 20);

    const tableData = summary.map(row => [
      row.tower,
      row.totalFlats.toString(),
      row.paidFlats.toString(),
      row.pendingFlats.toString(),
      row.duesCleared.toString(),
      row.advance.toString(),
      row.camRecon.toString(),
      `${((row.paidFlats / row.totalFlats) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      head: [['Tower', 'Total', 'Paid', 'Pending', 'Dues Cleared', 'Advance', 'CAM Recon', 'Rate']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    const totalPaid = summary.reduce((sum, r) => sum + r.paidFlats, 0);
    const totalPending = summary.reduce((sum, r) => sum + r.pendingFlats, 0);
    const totalFlats = summary.reduce((sum, r) => sum + r.totalFlats, 0);

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total Flats: ${totalFlats} | Paid: ${totalPaid} | Pending: ${totalPending} | Collection Rate: ${((totalPaid / totalFlats) * 100).toFixed(1)}%`, 14, finalY);

    doc.save(`CAM_Report_FY${selectedYear}_Q${selectedQuarter}.pdf`);
    toast.success('PDF file downloaded');
  };

  const summary = getQuarterSummary();
  const totalPaid = summary.reduce((sum, r) => sum + r.paidFlats, 0);
  const totalPending = summary.reduce((sum, r) => sum + r.pendingFlats, 0);
  const totalFlats = summary.reduce((sum, r) => sum + r.totalFlats, 0);

  const towerStats = mcUser ? summary.find(s => s.tower === mcUser.tower_no) : null;

  return (
    <div className="space-y-6">
      {/* Global Filters */}
      <Card className="bg-muted/30 border-none">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Fiscal Year</label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Fiscal Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>FY {year}-{(year + 1).toString().slice(-2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Quarter</label>
              <Select value={selectedQuarter.toString()} onValueChange={(v) => setSelectedQuarter(parseInt(v))}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_QUARTERS.map(q => (
                    <SelectItem key={q.value} value={q.value.toString()}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mcUser && (
              <Badge variant="outline" className="ml-auto bg-primary/5 text-primary border-primary/20 h-9 px-3">
                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                Tower {mcUser.tower_no}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      {/* MC Member's Tower Overview */}
      {mcUser && towerStats && (
        <Card className="bg-primary/5 border-primary/20 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Building2 className="h-5 w-5" />
              Tower {mcUser.tower_no} Summary - FY {selectedYear}-{selectedYear + 1} Q{selectedQuarter}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {towerStats.isFromSelectedPeriod ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  Showing data for Q{selectedQuarter} {selectedYear}-{selectedYear + 1}
                </span>
              ) : towerStats.month ? (
                <span className="flex items-center gap-1 text-amber-600 font-medium italic">
                  No data for selected period. Showing latest available: {MONTH_NAMES[towerStats.month]}
                </span>
              ) : (
                <span className="text-muted-foreground">No approved data available yet.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-background p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Residents</p>
                <p className="text-xl font-bold">{towerStats.totalFlats}</p>
              </div>
              <div className="bg-background p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Paid Residents</p>
                <p className="text-xl font-bold text-green-600">{towerStats.paidFlats}</p>
              </div>
              <div className="bg-background p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pending/Defaulters</p>
                <p className="text-xl font-bold text-red-600">{towerStats.pendingFlats}</p>
              </div>
              <div className="bg-background p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Collection Rate</p>
                <p className="text-xl font-bold text-primary">
                  {((towerStats.paidFlats / towerStats.totalFlats) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Reports (Defaulters & Recon lists) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Download Monthly Lists</CardTitle>
          <CardDescription>Download detailed defaulter and reconciliation lists uploaded by administration</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyReports.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg">
              No monthly lists uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthlyReports.slice(0, 6).map((report) => (
                <div key={report.id} className="flex flex-col p-3 border rounded-lg hover:border-primary transition-colors gap-3 relative overflow-hidden group">
                  {saving && <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{MONTH_NAMES[report.month]} {report.year}</p>
                      <p className="text-[10px] text-muted-foreground">Tower {mcUser?.tower_no} Reports</p>
                    </div>
                    <Badge variant={report.status === 'final' ? 'default' : 'secondary'} className="text-[9px] h-4">
                      {report.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground">20th Report (Without Recon)</p>
                      <div className="flex gap-1">
                        {report.defaulters_list_url ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={() => downloadReport(report.defaulters_list_url)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <div className="relative flex-1">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            onChange={(e) => handleReportUpload(e, report.month, report.year, 'defaulters_list')}
                            disabled={saving}
                          />
                          <Button variant="outline" size="sm" className="h-7 w-full text-[10px] gap-1">
                            <Upload className="h-3 w-3" /> {report.defaulters_list_url ? 'Update' : 'Upload'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground">30th Report (With Recon)</p>
                      <div className="flex gap-1">
                        {report.recon_list_url ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={() => downloadReport(report.recon_list_url)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <div className="relative flex-1">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            onChange={(e) => handleReportUpload(e, report.month, report.year, 'recon_list')}
                            disabled={saving}
                          />
                          <Button variant="outline" size="sm" className="h-7 w-full text-[10px] gap-1">
                            <Upload className="h-3 w-3" /> {report.recon_list_url ? 'Update' : 'Upload'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!mcUser && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Detailed Collection Report
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
                <p className="text-2xl font-bold">{totalFlats}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 mb-1 font-medium">Paid</p>
                <p className="text-2xl font-bold text-green-700">{totalPaid}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 mb-1 font-medium">Pending</p>
                <p className="text-2xl font-bold text-red-700">{totalPending}</p>
              </div>
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-primary mb-1 font-medium">Overall Rate</p>
                <p className="text-2xl font-bold text-primary">
                  {totalFlats > 0 ? ((totalPaid / totalFlats) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
              </div>
            ) : (
              <div className="rounded-xl border shadow-sm">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Tower</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Dues Clr</TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.map((row) => (
                        <TableRow
                          key={row.tower}
                          className={mcUser?.tower_no === row.tower ? "bg-primary/5 ring-1 ring-primary/20" : ""}
                        >
                          <TableCell className="font-bold flex items-center gap-2">
                            {row.tower}
                            {mcUser?.tower_no === row.tower && <Badge variant="default" className="text-[9px] h-4 px-1">Your Tower</Badge>}
                          </TableCell>
                          <TableCell className="text-right">{row.totalFlats}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">{row.paidFlats}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">{row.pendingFlats}</TableCell>
                          <TableCell className="text-right">{row.duesCleared}</TableCell>
                          <TableCell className="text-right">{row.advance}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={row.paidFlats / row.totalFlats >= 0.9 ? 'default' : 'secondary'}
                              className={row.paidFlats / row.totalFlats >= 0.9 ? "bg-green-600" : ""}
                            >
                              {((row.paidFlats / row.totalFlats) * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
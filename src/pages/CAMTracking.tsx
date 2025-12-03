import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Save, Upload, Building2, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';

const TOWERS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5', '6', '7', '8',
  '9A', '9B', '9C', '10', '11', '12', '13', '14', '15A', '15B',
  '16A', '16B', '17A', '17B', '18A', '18B', '18C', '19', '20A', '20B', '20C'
];

// Tower-specific total flats: 67 per tower, except 11, 12, 13 which have 201 each
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

const TOTAL_FLATS_IN_COMPLEX = 2613;

const QUARTERS = [
  { value: 1, label: 'Q1 (Jan-Mar)' },
  { value: 2, label: 'Q2 (Apr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dec)' }
];

interface CAMData {
  id?: string;
  tower: string;
  year: number;
  quarter: number;
  paid_flats: number;
  pending_flats: number;
  total_flats: number;
  dues_cleared_from_previous: number;
  advance_payments: number;
  notes?: string;
}

export default function CAMTracking() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [selectedTower, setSelectedTower] = useState<string>('1A');
  const [camData, setCamData] = useState<Record<string, CAMData>>({});
  const [existingData, setExistingData] = useState<CAMData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const years = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    fetchCAMData();
  }, [selectedYear, selectedQuarter]);

  const fetchCAMData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', selectedYear)
        .eq('quarter', selectedQuarter);

      if (error) throw error;

      const dataMap: Record<string, CAMData> = {};
      TOWERS.forEach(tower => {
        const existing = data?.find(d => d.tower === tower);
        dataMap[tower] = existing || {
          tower,
          year: selectedYear,
          quarter: selectedQuarter,
          paid_flats: 0,
          pending_flats: 0,
          total_flats: TOWER_TOTAL_FLATS[tower],
          dues_cleared_from_previous: 0,
          advance_payments: 0
        };
      });
      setCamData(dataMap);
      setExistingData(data || []);
      setValidationErrors({});
    } catch (error: any) {
      toast.error('Failed to fetch CAM data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateTowerData = (tower: string, data: CAMData): string | null => {
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
      return `Total (paid + pending) cannot exceed ${maxFlats} flats`;
    }
    
    return null;
  };

  const handleInputChange = (
    tower: string, 
    field: 'paid_flats' | 'pending_flats' | 'dues_cleared_from_previous' | 'advance_payments', 
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    const updatedData = {
      ...camData[tower],
      [field]: numValue,
      total_flats: TOWER_TOTAL_FLATS[tower]
    };
    
    setCamData(prev => ({
      ...prev,
      [tower]: updatedData
    }));

    const error = validateTowerData(tower, updatedData);
    setValidationErrors(prev => ({
      ...prev,
      [tower]: error || ''
    }));
  };

  const handleSaveTower = async (tower: string) => {
    if (!user) return;
    
    const data = camData[tower];
    const error = validateTowerData(tower, data);
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const item = {
        tower: data.tower,
        year: selectedYear,
        quarter: selectedQuarter,
        paid_flats: data.paid_flats,
        pending_flats: data.pending_flats,
        total_flats: TOWER_TOTAL_FLATS[tower],
        dues_cleared_from_previous: data.dues_cleared_from_previous || 0,
        advance_payments: data.advance_payments || 0,
        notes: data.notes || null,
        uploaded_by: user.id
      };

      const existing = existingData.find(d => d.tower === tower);
      if (existing?.id) {
        const { error } = await supabase
          .from('cam_tracking')
          .update({
            paid_flats: item.paid_flats,
            pending_flats: item.pending_flats,
            total_flats: item.total_flats,
            dues_cleared_from_previous: item.dues_cleared_from_previous,
            advance_payments: item.advance_payments,
            notes: item.notes
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cam_tracking')
          .insert(item);
        if (error) throw error;
      }

      toast.success(`Tower ${tower} data saved successfully`);
      fetchCAMData();
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, tower: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length > 0) {
          const row = jsonData[0];
          const updatedData = {
            ...camData[tower],
            paid_flats: parseInt(row.Paid || row.paid || row.PAID || row['Paid Flats'] || 0),
            pending_flats: parseInt(row.Pending || row.pending || row.PENDING || row['Pending Flats'] || 0),
            dues_cleared_from_previous: parseInt(row['Dues Cleared'] || row.dues_cleared || 0),
            advance_payments: parseInt(row['Advance'] || row.advance || row['Advance Payments'] || 0),
            total_flats: TOWER_TOTAL_FLATS[tower]
          };
          
          const error = validateTowerData(tower, updatedData);
          if (error) {
            toast.error(`Validation error: ${error}`);
            return;
          }
          
          setCamData(prev => ({
            ...prev,
            [tower]: updatedData
          }));
          toast.success(`Data loaded for Tower ${tower}. Review and save.`);
        }
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast.error('Failed to parse file: ' + error.message);
    }
    event.target.value = '';
  };

  const getTowerData = (tower: string) => camData[tower] || {
    paid_flats: 0,
    pending_flats: 0,
    total_flats: TOWER_TOTAL_FLATS[tower],
    dues_cleared_from_previous: 0,
    advance_payments: 0
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

      <Tabs defaultValue="tower-entry" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tower-entry">Tower-wise Entry</TabsTrigger>
          <TabsTrigger value="overview">All Towers Overview</TabsTrigger>
          <TabsTrigger value="summary">Quarterly Summary</TabsTrigger>
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
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map(q => (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Paid Flats (Current Quarter)</label>
                  <Input
                    type="number"
                    min="0"
                    max={TOWER_TOTAL_FLATS[selectedTower]}
                    value={getTowerData(selectedTower).paid_flats || ''}
                    onChange={(e) => handleInputChange(selectedTower, 'paid_flats', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pending Flats (Current Quarter)</label>
                  <Input
                    type="number"
                    min="0"
                    max={TOWER_TOTAL_FLATS[selectedTower]}
                    value={getTowerData(selectedTower).pending_flats || ''}
                    onChange={(e) => handleInputChange(selectedTower, 'pending_flats', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dues Cleared from Previous Quarters</label>
                  <Input
                    type="number"
                    min="0"
                    value={getTowerData(selectedTower).dues_cleared_from_previous || ''}
                    onChange={(e) => handleInputChange(selectedTower, 'dues_cleared_from_previous', e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Residents who cleared past dues this quarter</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Advance Payments</label>
                  <Input
                    type="number"
                    min="0"
                    value={getTowerData(selectedTower).advance_payments || ''}
                    onChange={(e) => handleInputChange(selectedTower, 'advance_payments', e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Residents who paid in advance for future quarters</p>
                </div>
              </div>

              {validationErrors[selectedTower] && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationErrors[selectedTower]}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-3 pt-4 border-t">
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileUpload(e, selectedTower)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload for Tower {selectedTower}
                  </Button>
                </div>
                <Button 
                  onClick={() => handleSaveTower(selectedTower)} 
                  disabled={saving || !!validationErrors[selectedTower]}
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Tower {selectedTower}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-lg">All Towers - {QUARTERS.find(q => q.value === selectedQuarter)?.label} {selectedYear}</CardTitle>
                <div className="flex items-center gap-3">
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUARTERS.map(q => (
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
                      <TableHead className="w-[90px]">Paid</TableHead>
                      <TableHead className="w-[90px]">Pending</TableHead>
                      <TableHead className="w-[110px]">Dues Cleared</TableHead>
                      <TableHead className="w-[90px]">Advance</TableHead>
                      <TableHead className="w-[90px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TOWERS.map(tower => {
                      const data = getTowerData(tower);
                      const maxFlats = TOWER_TOTAL_FLATS[tower];
                      const isValid = data.paid_flats + data.pending_flats <= maxFlats;
                      return (
                        <TableRow key={tower} className={!isValid ? 'bg-destructive/10' : ''}>
                          <TableCell className="font-medium">{tower}</TableCell>
                          <TableCell>{maxFlats}</TableCell>
                          <TableCell className="text-green-600">{data.paid_flats}</TableCell>
                          <TableCell className="text-red-600">{data.pending_flats}</TableCell>
                          <TableCell className="text-blue-600">{data.dues_cleared_from_previous || 0}</TableCell>
                          <TableCell className="text-purple-600">{data.advance_payments || 0}</TableCell>
                          <TableCell>
                            {isValid ? (
                              <span className="text-xs text-green-600">✓ Valid</span>
                            ) : (
                              <span className="text-xs text-destructive">⚠ Exceeds</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell>{TOTAL_FLATS_IN_COMPLEX}</TableCell>
                      <TableCell className="text-green-600">
                        {Object.values(camData).reduce((sum, d) => sum + (d.paid_flats || 0), 0)}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {Object.values(camData).reduce((sum, d) => sum + (d.pending_flats || 0), 0)}
                      </TableCell>
                      <TableCell className="text-blue-600">
                        {Object.values(camData).reduce((sum, d) => sum + (d.dues_cleared_from_previous || 0), 0)}
                      </TableCell>
                      <TableCell className="text-purple-600">
                        {Object.values(camData).reduce((sum, d) => sum + (d.advance_payments || 0), 0)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <QuarterlySummary />
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
      const { data, error } = await supabase
        .from('cam_tracking')
        .select('*')
        .eq('year', selectedYear)
        .order('quarter')
        .order('tower');

      if (error) throw error;
      setSummaryData(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch summary: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getQuarterTotals = (quarter: number) => {
    const qData = summaryData.filter(d => d.quarter === quarter);
    return {
      paid: qData.reduce((sum, d) => sum + d.paid_flats, 0),
      pending: qData.reduce((sum, d) => sum + d.pending_flats, 0),
      duesCleared: qData.reduce((sum, d) => sum + (d.dues_cleared_from_previous || 0), 0),
      advance: qData.reduce((sum, d) => sum + (d.advance_payments || 0), 0),
      total: TOTAL_FLATS_IN_COMPLEX
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
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUARTERS.map(q => {
          const totals = getQuarterTotals(q.value);
          return (
            <Card key={q.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{q.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Flats:</span>
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
                  <TableHead className="text-center">Total</TableHead>
                  {QUARTERS.map(q => (
                    <TableHead key={q.value} className="text-center">{q.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TOWERS.map(tower => (
                  <TableRow key={tower}>
                    <TableCell className="font-medium">{tower}</TableCell>
                    <TableCell className="text-center">{TOWER_TOTAL_FLATS[tower]}</TableCell>
                    {QUARTERS.map(q => {
                      const towerData = summaryData.find(d => d.tower === tower && d.quarter === q.value);
                      return (
                        <TableCell key={q.value} className="text-center">
                          {towerData ? (
                            <span className={towerData.pending_flats > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                              {towerData.pending_flats}
                            </span>
                          ) : '-'}
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

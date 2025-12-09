import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ExcelPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentUrl: string;
  title: string;
  onDownload: () => void;
}

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export function ExcelPreviewDialog({
  open,
  onOpenChange,
  documentUrl,
  title,
  onDownload
}: ExcelPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && documentUrl) {
      loadExcel();
    } else {
      setSheets([]);
      setActiveSheet('');
      setError(null);
    }
  }, [open, documentUrl]);

  const loadExcel = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(documentUrl);
      if (!response.ok) throw new Error('Failed to fetch document');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetsData: SheetData[] = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
        
        // Filter out empty rows
        const filteredData = jsonData.filter(row => 
          row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
        );
        
        const headers = filteredData[0]?.map(h => String(h || '')) || [];
        const rows = filteredData.slice(1).map(row => 
          row.map(cell => cell !== null && cell !== undefined ? String(cell) : '')
        );
        
        return { name: sheetName, headers, rows };
      });
      
      setSheets(sheetsData);
      if (sheetsData.length > 0) {
        setActiveSheet(sheetsData[0].name);
      }
    } catch (err: any) {
      console.error('Error loading Excel:', err);
      setError(err.message || 'Failed to load document');
      toast.error('Failed to preview document');
    } finally {
      setLoading(false);
    }
  };

  const currentSheet = sheets.find(s => s.name === activeSheet);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>{title}</DialogTitle>
            <Button onClick={onDownload} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading document...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-destructive">
              <X className="h-12 w-12 mb-2" />
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={onDownload}>
                Download Instead
              </Button>
            </div>
          ) : sheets.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No data to display
            </div>
          ) : (
            <Tabs value={activeSheet} onValueChange={setActiveSheet} className="h-full flex flex-col">
              {sheets.length > 1 && (
                <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto">
                  {sheets.map(sheet => (
                    <TabsTrigger key={sheet.name} value={sheet.name} className="min-w-fit">
                      {sheet.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}
              
              {sheets.map(sheet => (
                <TabsContent key={sheet.name} value={sheet.name} className="flex-1 min-h-0 mt-2">
                  <ScrollArea className="h-[60vh] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {sheet.headers.map((header, idx) => (
                            <TableHead key={idx} className="bg-muted font-semibold whitespace-nowrap">
                              {header || `Column ${idx + 1}`}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheet.rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={sheet.headers.length} className="text-center text-muted-foreground py-8">
                              No data in this sheet
                            </TableCell>
                          </TableRow>
                        ) : (
                          sheet.rows.map((row, rowIdx) => (
                            <TableRow key={rowIdx}>
                              {sheet.headers.map((_, colIdx) => (
                                <TableCell key={colIdx} className="whitespace-nowrap">
                                  {row[colIdx] || ''}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
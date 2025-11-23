import * as XLSX from 'xlsx';

const workbook = XLSX.readFile('user-uploads://Outflow_-_14-11-2025_1-3.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const updates: Array<{ serial_no: number, monthly_budget: number }> = [];
let total = 0;

// Skip first 10 header rows
for (let i = 10; i < data.length; i++) {
  const row = data[i];
  if (!row || !row[0]) continue;
  
  const serialNo = parseInt(row[0]);
  if (isNaN(serialNo)) continue;
  
  // Column 6 (index 5) = MONTHLY AMOUNT WITH TAX
  let monthlyValue = row[5];
  
  if (typeof monthlyValue === 'string') {
    monthlyValue = parseFloat(monthlyValue.replace(/[₹,\s]/g, ''));
  }
  
  if (!isNaN(monthlyValue) && monthlyValue >= 0) {
    updates.push({ serial_no: serialNo, monthly_budget: monthlyValue });
    total += monthlyValue;
  }
}

console.log(`Total from Excel: ₹${total.toLocaleString('en-IN')}`);
console.log(`Updates count: ${updates.length}\n`);
console.log(JSON.stringify(updates, null, 2));

import type { PersonTotal } from '../model/payroll';
import type { Person } from '../model/types';

/** Writes the payday table to an .xlsx file. ExcelJS loads only when she clicks. */
export async function downloadPayday(rows: PersonTotal[], people: Person[], title: string, fileName: string): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payday');
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const head = ws.addRow(['Name', 'Total hours', 'Regular', 'Overtime', 'Days (day rate)']);
  head.font = { bold: true };
  for (const t of rows) {
    const p = people.find((x) => x.id === t.personId);
    if (!p) continue;
    const showHours = t.hours > 0 || t.days === 0;
    ws.addRow([p.name, showHours ? t.hours : null, showHours ? t.regular : null, showHours ? t.overtime : null, t.days > 0 ? t.days : null]);
  }
  ws.getColumn(1).width = 22;
  for (const c of [2, 3, 4, 5]) ws.getColumn(c).width = 14;
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

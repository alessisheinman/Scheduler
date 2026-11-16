// Reads the owner's old schedule workbook into plain data. The only file that knows about ExcelJS.
import type { Minutes } from '../model/time';
import { excelSerialToISO, mondayOf, type ISODate } from '../model/week';
import { parseShift } from '../model/time';
import { parseThemeColors } from './theme';

export interface RawCell { text: string | null; time: Minutes | null; color: string | null /* color key */ }
export interface RawRow { name: string; rowNumber: number; cells: RawCell[] /* 7 */ }
export interface RawTab { tab: string; monday: ISODate | null; rows: RawRow[]; legend: { color: string; venue: string }[]; namelessRows: number[] }
export interface RawWorkbook { tabs: RawTab[]; theme: string[] }

// Minimal shapes of what ExcelJS hands back, so this file type-checks without its full types.
interface XCell { value: unknown; fill?: { type?: string; fgColor?: { argb?: string; theme?: number; tint?: number } } }
interface XSheet { name: string; rowCount: number; getCell(r: number, c: number): XCell }

const DAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const FIRST_DAY_COL = 2; // column B
const LEGEND_FROM_ROW = 17;

async function loadExcel() {
  return (await import('exceljs')).default;
}

export async function readWorkbook(buf: ArrayBuffer): Promise<RawWorkbook> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const theme = await readTheme(buf);
  const tabs = (wb.worksheets as unknown as XSheet[]).map(readTab);
  return { tabs, theme };
}

async function readTheme(buf: ArrayBuffer): Promise<string[]> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('xl/theme/theme1.xml')?.async('string');
    return parseThemeColors(xml ?? '');
  } catch {
    return parseThemeColors('');
  }
}

function colorKey(cell: XCell): string | null {
  const f = cell.fill;
  if (!f || f.type !== 'pattern' || !f.fgColor) return null;
  const { argb, theme, tint } = f.fgColor;
  if (argb) {
    const up = argb.toUpperCase();
    return up === 'FFFFFFFF' || up === '00000000' ? null : `argb:${up}`;
  }
  if (theme !== undefined) return `theme:${theme}:${tint ?? 0}`;
  return null;
}

function cellText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join('').trim() || null;
    if (o.result !== undefined) return cellText(o.result);
    if (typeof o.text === 'string') return o.text.trim() || null;
  }
  return null;
}

/** A Date before 1900 is Excel's way of storing a time of day. */
function asTime(v: unknown): Minutes | null {
  if (v instanceof Date && v.getUTCFullYear() < 1900) return v.getUTCHours() * 60 + v.getUTCMinutes();
  if (typeof v === 'number' && v >= 0 && v < 1) return Math.round(v * 1440);
  return null;
}

function asDate(v: unknown): ISODate | null {
  if (v instanceof Date && v.getUTCFullYear() >= 1900) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 30000 && v < 80000) return excelSerialToISO(v);
  return null;
}

function readTab(ws: XSheet): RawTab {
  // Header: the row holding day names; dates sit in the row next to it.
  let monday: ISODate | null = null;
  let headerRow = 2;
  for (let r = 1; r <= 5; r++) {
    const vals = Array.from({ length: 8 }, (_, i) => cellText(ws.getCell(r, FIRST_DAY_COL + i).value)?.toUpperCase());
    if (vals.some((v) => v && DAY_NAMES.includes(v))) { headerRow = r; break; }
  }
  for (const r of [headerRow - 1, headerRow + 1, headerRow]) {
    if (monday || r < 1) continue;
    for (let i = 0; i < 7 && !monday; i++) {
      const d = asDate(ws.getCell(r, FIRST_DAY_COL + i).value);
      if (d) monday = mondayOf(d);
    }
  }
  const firstPersonRow = Math.max(headerRow, 3) + 1;

  const rows: RawRow[] = [];
  const legend: RawTab['legend'] = [];
  const namelessRows: number[] = [];
  for (let r = firstPersonRow; r <= Math.max(ws.rowCount, firstPersonRow); r++) {
    const name = cellText(ws.getCell(r, 1).value);
    const cells: RawCell[] = Array.from({ length: 7 }, (_, i) => {
      const c = ws.getCell(r, FIRST_DAY_COL + i);
      const time = asTime(c.value);
      return { text: time === null ? cellText(c.value) : null, time, color: colorKey(c) };
    });
    if (name) {
      rows.push({ name, rowNumber: r, cells });
      continue;
    }
    // No name in column A: either part of the color key (lower down) or stray boxes.
    if (r >= LEGEND_FROM_ROW) {
      for (let col = 3; col <= 5; col++) {
        const c = ws.getCell(r, col);
        const text = cellText(c.value);
        const color = colorKey(c);
        if (text && color && !parseShift(text)) legend.push({ color, venue: text.toUpperCase().replace(/\s+/g, ' ').trim() });
      }
    } else if (cells.some((c) => c.text || c.time !== null)) {
      namelessRows.push(r);
    }
  }
  return { tab: ws.name, monday, rows, legend, namelessRows };
}

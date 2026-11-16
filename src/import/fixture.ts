// Builds small workbooks shaped like the owner's schedule file, with made-up names, for tests.
import ExcelJS from 'exceljs';

type Fill = { argb: string } | { theme: number; tint?: number };
export type FixtureCell = string | { time: [number, number] } | null;
export interface FixtureTab {
  name: string;
  /** Monday of the week, YYYY-MM-DD. */
  monday: string;
  /** Put day names on row 3 and dates on row 2 (only Thu–Sun filled), like the first tab of the real file. */
  swapped?: boolean;
  rows: { name: string | null; cells: [FixtureCell, Fill | null][] }[];
  legend: [string, Fill][];
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
export const BLUE = { argb: 'FF0000FF' };
export const RED = { argb: 'FFFF0000' };
export const GREEN = { argb: 'FF00FF00' };
export const BLACK = { argb: 'FF000000' };
export const THEME5 = { theme: 5, tint: -0.25 };
export const NEAR_BLUE = { argb: 'FF1010EE' };

export async function buildFixture(tabs: FixtureTab[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const t of tabs) {
    const ws = wb.addWorksheet(t.name);
    ws.getCell('C1').value = t.name;
    const [y, m, d] = t.monday.split('-').map(Number);
    const dayRow = t.swapped ? 3 : 2;
    const dateRow = t.swapped ? 2 : 3;
    for (let i = 0; i < 7; i++) {
      ws.getCell(dayRow, 2 + i).value = DAYS[i];
      if (!t.swapped || i >= 3) {
        const c = ws.getCell(dateRow, 2 + i);
        c.value = new Date(Date.UTC(y, m - 1, d + i));
        c.numFmt = 'm/d/yyyy';
      }
    }
    t.rows.forEach((r, ri) => {
      const row = 4 + ri;
      if (r.name) ws.getCell(row, 1).value = r.name;
      r.cells.forEach(([value, fill], i) => {
        const c = ws.getCell(row, 2 + i);
        if (typeof value === 'string') c.value = value;
        else if (value) { c.value = new Date(Date.UTC(1899, 11, 30, value.time[0], value.time[1])); c.numFmt = 'h:mm'; }
        if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: fill };
      });
    });
    t.legend.forEach(([venue, fill], i) => {
      const c = ws.getCell(20 + i, 3);
      c.value = venue;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: fill };
    });
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export const week = (...cells: [FixtureCell, Fill | null][]): [FixtureCell, Fill | null][] => {
  const out = [...cells];
  while (out.length < 7) out.push([null, null]);
  return out;
};

/** The standard test workbook: three tabs exercising every import rule. */
export function standardTabs(): FixtureTab[] {
  return [
    {
      name: 'NOVEMBER 2026 WEEK 1',
      monday: '2026-11-02',
      rows: [
        { name: 'ANA', cells: week(['7AM-9PM', BLUE], ['9PAM-9PM', BLUE], ['7AM-3PM', GREEN]) },
        { name: 'BEN', cells: week([null, null], [null, null], ['7AM-3PM', GREEN], [null, RED]) },
        { name: 'DEV', cells: week([{ time: [5, 0] }, BLACK], [{ time: [4, 30] }, BLACK]) },
        { name: 'MILO', cells: week([null, null], [null, null], [null, null], [null, null], ['7am-8pm', THEME5]) },
        { name: 'CARLA', cells: week([null, null], [null, null], [null, null], [null, null], [null, null], ['8AM-4PM', NEAR_BLUE]) },
        { name: null, cells: week(['11am-9pm', null]) },
      ],
      legend: [['BARCLAYS', BLUE], ['MSG', RED], ['HULU', THEME5]],
    },
    {
      name: 'NOV 2024 WEEK 2',
      monday: '2026-11-09',
      swapped: true,
      rows: [
        { name: 'MYLO', cells: week(['7AM-9PM', RED]) },
        { name: 'ANA 1', cells: week([null, null], ['7AM-3PM', BLUE]) },
        { name: 'ANA 2', cells: week([null, null], ['4PM-9PM', BLUE]) },
        { name: 'DEV', cells: week([{ time: [5, 0] }, BLACK]) },
      ],
      legend: [['MSG', RED], [' barclays  ', BLUE]],
    },
    {
      name: 'NOVEMBER 2026 WEEK 2 COPY',
      monday: '2026-11-09',
      rows: [{ name: 'ANA', cells: week(['7AM-9PM', BLUE]) }],
      legend: [['BARCLAYS CENTER', BLUE]],
    },
  ];
}

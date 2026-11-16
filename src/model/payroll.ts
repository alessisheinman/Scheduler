import { getWeek } from './ops';
import { shiftHours } from './time';
import type { AppData, ID } from './types';
import type { ISODate } from './week';

export const OVERTIME_AFTER = 40;

export interface PersonTotal { personId: ID; hours: number; regular: number; overtime: number; days: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Each person's hours for one Monday–Sunday week, with overtime past 40. */
export function weekTotals(data: AppData, monday: ISODate): Map<ID, PersonTotal> {
  const out = new Map<ID, PersonTotal>();
  const w = getWeek(data, monday);
  if (!w) return out;
  for (const [personId, row] of Object.entries(w.boxes)) {
    let hours = 0;
    let days = 0;
    for (const b of row) {
      if (!b) continue;
      days++;
      if (b.kind === 'shift') hours += shiftHours(b.start, b.end);
    }
    if (days === 0) continue;
    hours = round2(hours);
    out.set(personId, {
      personId, hours, days,
      regular: Math.min(hours, OVERTIME_AFTER),
      overtime: round2(Math.max(0, hours - OVERTIME_AFTER)),
    });
  }
  return out;
}

/** Totals over one or more weeks; overtime is worked out week by week, then added up. */
export function periodTotals(data: AppData, mondays: ISODate[]): PersonTotal[] {
  const sums = new Map<ID, PersonTotal>();
  for (const monday of mondays) {
    for (const t of weekTotals(data, monday).values()) {
      const s = sums.get(t.personId) ?? { personId: t.personId, hours: 0, regular: 0, overtime: 0, days: 0 };
      sums.set(t.personId, {
        personId: t.personId,
        hours: round2(s.hours + t.hours),
        regular: round2(s.regular + t.regular),
        overtime: round2(s.overtime + t.overtime),
        days: s.days + t.days,
      });
    }
  }
  return data.people.filter((p) => sums.has(p.id)).map((p) => sums.get(p.id)!);
}

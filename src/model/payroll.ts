import { getWeek } from './ops';
import { shiftHours } from './time';
import type { AppData, ID } from './types';
import type { ISODate } from './week';

export const OVERTIME_AFTER = 40;

/** `hours` come from shift boxes and `days` from day-rate boxes, so a later change to someone's pay type never rewrites past totals. */
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
    let boxes = 0;
    for (const b of row) {
      if (!b) continue;
      boxes++;
      if (b.kind === 'shift') hours += shiftHours(b.start, b.end);
      else days++;
    }
    if (boxes === 0) continue;
    hours = round2(hours);
    out.set(personId, {
      personId, hours, days,
      regular: Math.min(hours, OVERTIME_AFTER),
      overtime: round2(Math.max(0, hours - OVERTIME_AFTER)),
    });
  }
  return out;
}

/** The week payday opens on: the newest week that has already started (not next week's plan). */
export function defaultPaydayWeek(mondays: ISODate[], today: ISODate): ISODate | undefined {
  const sorted = [...mondays].sort();
  const started = sorted.filter((m) => m <= today);
  return started[started.length - 1] ?? sorted[sorted.length - 1];
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

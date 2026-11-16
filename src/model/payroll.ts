import { getWeek } from './ops';
import { shiftHours } from './time';
import type { AppData, ID } from './types';
import { addDays, mondayOf, type ISODate } from './week';

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

/**
 * Totals for any run of dates. Overtime looks at each whole Monday–Sunday week in day order: hours past 40
 * are overtime, and only the part that falls inside the dates is counted here.
 */
export function rangeTotals(data: AppData, start: ISODate, end: ISODate): PersonTotal[] {
  const sums = new Map<ID, PersonTotal>();
  for (let monday = mondayOf(start); monday <= end; monday = addDays(monday, 7)) {
    const w = getWeek(data, monday);
    if (!w) continue;
    for (const [personId, row] of Object.entries(w.boxes)) {
      let before = 0;
      const s = sums.get(personId) ?? { personId, hours: 0, regular: 0, overtime: 0, days: 0 };
      let touched = false;
      row.forEach((b, day) => {
        if (!b) return;
        const h = b.kind === 'shift' ? shiftHours(b.start, b.end) : 0;
        const ot = Math.min(h, Math.max(0, before + h - OVERTIME_AFTER));
        before += h;
        const date = addDays(monday, day);
        if (date < start || date > end) return;
        touched = true;
        s.hours += h;
        s.overtime += ot;
        s.regular += h - ot;
        if (b.kind === 'day') s.days++;
      });
      if (touched) sums.set(personId, s);
    }
  }
  return data.people
    .filter((p) => sums.has(p.id))
    .map((p) => {
      const t = sums.get(p.id)!;
      return { ...t, hours: round2(t.hours), regular: round2(t.regular), overtime: round2(t.overtime) };
    });
}

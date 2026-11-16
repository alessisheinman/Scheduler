/** A calendar date "YYYY-MM-DD". All math is done in UTC so time zones never shift a day. */
export type ISODate = string;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_MS = 86_400_000;

function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUTC(t: Date): ISODate {
  return t.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(new Date(toUTC(d).getTime() + n * DAY_MS));
}

export function mondayOf(d: ISODate): ISODate {
  const weekday = (toUTC(d).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(d, -weekday);
}

export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function weekLabel(monday: ISODate): string {
  const a = toUTC(monday);
  const b = toUTC(addDays(monday, 6));
  const [am, ad, ay] = [MONTHS[a.getUTCMonth()], a.getUTCDate(), a.getUTCFullYear()];
  const [bm, bd, by] = [MONTHS[b.getUTCMonth()], b.getUTCDate(), b.getUTCFullYear()];
  if (ay !== by) return `Week of ${am} ${ad}, ${ay} – ${bm} ${bd}, ${by}`;
  if (am !== bm) return `Week of ${am} ${ad} – ${bm} ${bd}, ${by}`;
  return `Week of ${am} ${ad} – ${bd}, ${by}`;
}

export function dayHeader(d: ISODate): { day: string; date: string } {
  const t = toUTC(d);
  return { day: DAYS[(t.getUTCDay() + 6) % 7], date: `${t.getUTCMonth() + 1}/${t.getUTCDate()}` };
}

/** Excel's 1900 date system: serial 25569 is 1970-01-01. */
export function excelSerialToISO(serial: number): ISODate {
  return fromUTC(new Date(Math.round((Math.floor(serial) - 25569) * DAY_MS)));
}

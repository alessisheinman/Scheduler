/** Minutes after midnight, 0–1439. */
export type Minutes = number;

const STRICT = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i;
const LENIENT = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A|P)?$/i;

/**
 * Reads a clock time like "7AM", "7:30 pm", "12AM".
 * Strict (the default, used for the old workbook) requires AM/PM so nothing is guessed.
 * Lenient (typing in the app) also takes "7p", "7a", and a bare hour:
 * 7–11 means morning, 12 means noon, 1–6 means afternoon.
 */
export function parseTime(text: string, opts: { lenient?: boolean } = {}): Minutes | null {
  const m = text.trim().match(opts.lenient ? LENIENT : STRICT);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] === undefined ? 0 : Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  let suffix = m[3]?.toUpperCase().charAt(0);
  if (!suffix) suffix = hour >= 7 && hour <= 11 ? 'A' : 'P';
  const h24 = (hour % 12) + (suffix === 'P' ? 12 : 0);
  return h24 * 60 + minute;
}

/** Reads "7AM-9PM" (spaces around the dash allowed). Null if either side is unreadable or both are equal. */
export function parseShift(text: string, opts: { lenient?: boolean } = {}): { start: Minutes; end: Minutes } | null {
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const start = parseTime(parts[0], opts);
  const end = parseTime(parts[1], opts);
  if (start === null || end === null || start === end) return null;
  return { start, end };
}

/** Full span in hours; an end at or before the start means the shift runs past midnight. */
export function shiftHours(start: Minutes, end: Minutes): number {
  const minutes = end > start ? end - start : end + 1440 - start;
  return minutes / 60;
}

export function formatTime(m: Minutes): string {
  const h24 = Math.floor(m / 60);
  const minute = m % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  return minute === 0 ? `${hour}${suffix}` : `${hour}:${String(minute).padStart(2, '0')}${suffix}`;
}

export function formatShift(start: Minutes, end: Minutes): string {
  return `${formatTime(start)}-${formatTime(end)}`;
}

/** 14 → "14", 6.5 → "6.5", 13.25 → "13.25". */
export function formatHours(h: number): string {
  return String(Math.round(h * 100) / 100);
}

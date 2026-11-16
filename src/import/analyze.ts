// Looks over the raw workbook and lists what she needs to decide before importing. Nothing is guessed:
// unreadable boxes, unknown colors, look-alike names and duplicate weeks all become questions.
import { parseShift } from '../model/time';
import type { RawCell, RawWorkbook } from './readWorkbook';
import { colorKeyToHex } from './theme';

export type IssueKind = 'unreadable' | 'colored-empty' | 'no-name-row' | 'duplicate-week' | 'two-boxes-one-day';
export interface Issue { id: string; kind: IssueKind; tab: string; name?: string; day?: number; text?: string; venue?: string }
export interface ColorQuestion {
  key: string; // `${tab}|${color}`
  tab: string;
  color: string;
  hex: string;
  count: number;
  legendVenues: string[];
  /** The venue whose key color is closest, when one is reasonably close. */
  suggestion: string | null;
  /** True when that closest color is clearly a shade of one key color (shown pre-filled for her to check). */
  confident: boolean;
}
export interface ImportDraft {
  names: { name: string; count: number; dayRateLikely: boolean }[];
  mergeSuggestions: string[][];
  venueMergeSuggestions: string[][];
  colorQuestions: ColorQuestion[];
  venues: string[];
  issues: Issue[];
  weekCount: number;
}

/** "  ana  1 " → "ANA": trims, uppercases, collapses spaces, drops a trailing row number. */
export function normalizeName(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, ' ').trim().replace(/ [12]$/, '');
}

export const hasEntry = (c: RawCell) => c.text !== null || c.time !== null;
export const issueId = (kind: IssueKind, tab: string, row: number | string, day: number | string = '') => `${kind}|${tab}|${row}|${day}`;
export const colorQuestionKey = (tab: string, color: string) => `${tab}|${color}`;

export function analyze(raw: RawWorkbook): ImportDraft {
  const issues: Issue[] = [];
  const venues: string[] = [];
  const nameStats = new Map<string, { count: number; times: number }>();
  const questions = new Map<string, ColorQuestion>();

  for (const tab of raw.tabs) {
    for (const l of tab.legend) if (!venues.includes(l.venue)) venues.push(l.venue);
    if (!tab.monday) issues.push({ id: issueId('unreadable', tab.tab, 'tab'), kind: 'unreadable', tab: tab.tab, text: 'No dates found on this tab' });
    for (const r of tab.namelessRows) issues.push({ id: issueId('no-name-row', tab.tab, r), kind: 'no-name-row', tab: tab.tab, text: `Row ${r} has hours but no name` });

    const legendColors = new Set(tab.legend.map((l) => l.color));
    const perDay = new Map<string, { texts: string[]; row: number }>();

    for (const row of tab.rows) {
      const name = normalizeName(row.name);
      const stats = nameStats.get(name) ?? { count: 0, times: 0 };
      row.cells.forEach((c, day) => {
        if (hasEntry(c)) {
          stats.count++;
          if (c.time !== null) stats.times++;
          const key = `${name}|${day}`;
          const seen = perDay.get(key) ?? { texts: [], row: row.rowNumber };
          seen.texts.push(c.text ?? `${c.time}`);
          perDay.set(key, seen);
        }
        if (c.text !== null && !parseShift(c.text)) {
          const venue = tab.legend.find((l) => l.color === c.color)?.venue;
          issues.push({ id: issueId('unreadable', tab.tab, row.rowNumber, day), kind: 'unreadable', tab: tab.tab, name, day, text: c.text, venue });
        }
        if (!hasEntry(c) && c.color) {
          issues.push({ id: issueId('colored-empty', tab.tab, row.rowNumber, day), kind: 'colored-empty', tab: tab.tab, name, day });
        }
        if (c.text !== null && c.color && !legendColors.has(c.color)) {
          const key = colorQuestionKey(tab.tab, c.color);
          const q = questions.get(key) ?? newQuestion(key, tab.tab, c.color, tab.legend, raw.theme);
          q.count++;
          questions.set(key, q);
        }
      });
      nameStats.set(name, stats);
    }
    for (const [key, v] of perDay) {
      if (v.texts.length < 2) continue;
      const [name, day] = key.split('|');
      issues.push({ id: issueId('two-boxes-one-day', tab.tab, name, day), kind: 'two-boxes-one-day', tab: tab.tab, name, day: Number(day), text: v.texts.join(' / ') });
    }
  }

  // Time-only boxes for people who aren't paid by the day can't be read as a shift.
  const names = [...nameStats].map(([name, s]) => ({ name, count: s.count, dayRateLikely: s.count > 0 && s.times / s.count > 0.5 }));
  const dayRate = new Set(names.filter((n) => n.dayRateLikely).map((n) => n.name));
  for (const tab of raw.tabs) {
    for (const row of tab.rows) {
      const name = normalizeName(row.name);
      if (dayRate.has(name)) continue;
      row.cells.forEach((c, day) => {
        if (c.time !== null) {
          issues.push({ id: issueId('unreadable', tab.tab, row.rowNumber, day), kind: 'unreadable', tab: tab.tab, name, day, text: `Only a time: ${Math.floor(c.time / 60)}:${String(c.time % 60).padStart(2, '0')}` });
        }
      });
    }
  }

  const byMonday = new Map<string, string[]>();
  for (const t of raw.tabs) if (t.monday) byMonday.set(t.monday, [...(byMonday.get(t.monday) ?? []), t.tab]);
  for (const [monday, tabs] of byMonday) {
    if (tabs.length > 1) issues.push({ id: issueId('duplicate-week', monday, 'week'), kind: 'duplicate-week', tab: tabs[0], text: tabs.join(' and ') });
  }

  return {
    names,
    mergeSuggestions: suggestMerges(names.map((n) => n.name)),
    venueMergeSuggestions: suggestMerges(venues),
    colorQuestions: [...questions.values()],
    venues,
    issues,
    weekCount: byMonday.size,
  };
}

const SUGGEST_WITHIN = 160; // RGB distance: a different shade of the same color
const CONFIDENT_WITHIN = 110;
const CONFIDENT_MARGIN = 60; // the next-closest key color must be clearly further away

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function newQuestion(key: string, tab: string, color: string, legend: { color: string; venue: string }[], theme: string[]): ColorQuestion {
  const hex = colorKeyToHex(color, theme);
  const [r, g, b] = rgb(hex);
  const ranked = legend
    .map((l) => {
      const [lr, lg, lb] = rgb(colorKeyToHex(l.color, theme));
      return { venue: l.venue, dist: Math.hypot(r - lr, g - lg, b - lb) };
    })
    .sort((x, y) => x.dist - y.dist);
  const best = ranked[0];
  const next = ranked[1];
  const suggestion = best && best.dist <= SUGGEST_WITHIN ? best.venue : null;
  const confident = !!suggestion && best.dist <= CONFIDENT_WITHIN && (!next || next.dist - best.dist >= CONFIDENT_MARGIN);
  return { key, tab, color, hex, count: 0, legendVenues: legend.map((l) => l.venue), suggestion, confident };
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Groups of names that are probably one person: one starts the other, or they differ by one letter. */
function suggestMerges(names: string[]): string[][] {
  const parent = new Map(names.map((n) => [n, n]));
  const find = (n: string): string => (parent.get(n) === n ? n : find(parent.get(n)!));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [names[i], names[j]].sort((x, y) => x.length - y.length);
      const prefix = a.length >= 3 && b.startsWith(a);
      const typo = a.length >= 3 && levenshtein(a, b) <= 1;
      if (prefix || typo) parent.set(find(names[i]), find(names[j]));
    }
  }
  const groups = new Map<string, string[]>();
  for (const n of names) groups.set(find(n), [...(groups.get(find(n)) ?? []), n]);
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort());
}

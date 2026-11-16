// Turns the old workbook plus her answers into the app's data. Anything she didn't answer is left out,
// never guessed: unreadable boxes, unanswered colors (no venue), colored blanks.
import { newId } from '../model/ops';
import { suggestVenueColor } from '../model/palette';
import { parseShift, type Minutes } from '../model/time';
import { emptyData, type AppData, type Box, type Person, type Venue, type Week } from '../model/types';
import { addDays } from '../model/week';
import { colorQuestionKey, hasEntry, issueId, normalizeName, type ImportDraft } from './analyze';
import type { RawTab, RawWorkbook } from './readWorkbook';

export type FixBox = { kind: 'shift'; venue: string | null; start: Minutes; end: Minutes } | { kind: 'day'; start: Minutes | null };

export interface ImportAnswers {
  merges: Record<string, string>; // normalized name → final name (absent = keep)
  venueNames: Record<string, string>; // key venue name → final venue name (absent = keep)
  dayRate: Record<string, boolean>; // final name → paid by the day
  colorVenue: Record<string, string | null>; // ColorQuestion.key → key venue name, or null for no venue
  fixes: Record<string, FixBox | 'skip'>; // Issue.id → replacement box, or skip
  coloredEmptyAsDaysFor: string[]; // final names (day-rate) whose colored blank boxes count as days worked
  duplicateWeekKeep: Record<string, string>; // duplicate-week Issue.id → tab name to keep
}

const HIDE_AFTER_WEEKS = 8;

export function defaultAnswers(draft: ImportDraft): ImportAnswers {
  const duplicateWeekKeep: Record<string, string> = {};
  for (const i of draft.issues) if (i.kind === 'duplicate-week') duplicateWeekKeep[i.id] = i.tab;
  return {
    merges: {},
    venueNames: {},
    dayRate: Object.fromEntries(draft.names.map((n) => [n.name, n.dayRateLikely])),
    colorVenue: Object.fromEntries(draft.colorQuestions.filter((q) => q.confident).map((q) => [q.key, q.suggestion])),
    fixes: {},
    coloredEmptyAsDaysFor: [],
    duplicateWeekKeep,
  };
}

export function buildData(raw: RawWorkbook, draft: ImportDraft, a: ImportAnswers): AppData {
  const finalName = (rawName: string) => {
    const n = normalizeName(rawName);
    return a.merges[n] ?? n;
  };
  const finalVenue = (v: string) => a.venueNames[v] ?? v;

  // Which tabs make it in: dated ones, and for a duplicated week only the tab she chose.
  const dropped = new Set<string>();
  for (const i of draft.issues) {
    if (i.kind !== 'duplicate-week') continue;
    const keep = a.duplicateWeekKeep[i.id] ?? i.tab;
    for (const t of i.text!.split(' and ')) if (t !== keep) dropped.add(t);
  }
  const tabs = raw.tabs
    .filter((t): t is RawTab & { monday: string } => !!t.monday && !dropped.has(t.tab))
    .sort((x, y) => x.monday.localeCompare(y.monday));
  const newest = [...tabs].reverse();

  // Venues: newest weeks first, so the venues she uses now get the first palette colors.
  const venues: Venue[] = [];
  const venueId = (name: string | null): string | null => {
    if (!name) return null;
    const final = finalVenue(name);
    let v = venues.find((x) => x.name === final);
    if (!v) {
      v = { id: newId(), name: final, color: suggestVenueColor(venues.map((x) => x.color)) };
      venues.push(v);
    }
    return v.id;
  };
  for (const t of newest) for (const l of t.legend) venueId(l.venue);

  // People: order of the newest tab, then everyone else by how recently they appear.
  const people: Person[] = [];
  const personFor = (name: string): Person => {
    let p = people.find((x) => x.name === name);
    if (!p) {
      p = { id: newId(), name, dayRate: !!a.dayRate[name], hidden: false };
      people.push(p);
    }
    return p;
  };
  for (const t of newest) for (const r of t.rows) personFor(finalName(r.name));

  const fromFix = (f: FixBox): Box =>
    f.kind === 'day' ? { kind: 'day', start: f.start } : { kind: 'shift', venueId: venueId(f.venue), start: f.start, end: f.end };

  const weeks: Week[] = [];
  for (const t of tabs) {
    const boxes: Week['boxes'] = {};
    const legend = new Map(t.legend.map((l) => [l.color, l.venue]));
    for (const row of t.rows) {
      const name = finalName(row.name);
      const p = personFor(name);
      const slots = (boxes[p.id] ??= [null, null, null, null, null, null, null]);
      row.cells.forEach((c, day) => {
        const fix = a.fixes[issueId('unreadable', t.tab, row.rowNumber, day)] ?? a.fixes[issueId('colored-empty', t.tab, row.rowNumber, day)];
        let box: Box | null = null;
        if (fix) {
          box = fix === 'skip' ? null : fromFix(fix);
        } else if (c.text !== null) {
          const s = parseShift(c.text);
          if (s) {
            const venue = c.color === null ? null : legend.get(c.color) ?? a.colorVenue[colorQuestionKey(t.tab, c.color)] ?? null;
            box = { kind: 'shift', venueId: venueId(venue), start: s.start, end: s.end };
          }
        } else if (c.time !== null) {
          if (p.dayRate) box = { kind: 'day', start: c.time };
        } else if (c.color && p.dayRate && a.coloredEmptyAsDaysFor.includes(name)) {
          box = { kind: 'day', start: null };
        }
        if (!box) return;
        const twoFix = hasEntry(c) ? a.fixes[issueId('two-boxes-one-day', t.tab, normalizeName(row.name), day)] : undefined;
        if (twoFix) slots[day] = twoFix === 'skip' ? null : fromFix(twoFix);
        else if (!slots[day]) slots[day] = box; // two boxes on one day: the first one stays
      });
    }
    for (const [id, row] of Object.entries(boxes)) if (!row.some(Boolean)) delete boxes[id];
    weeks.push({ monday: t.monday, boxes });
  }

  // Hide people with nothing in the newest weeks; their past hours stay.
  const latest = weeks[weeks.length - 1]?.monday;
  if (latest) {
    const cutoff = addDays(latest, -7 * (HIDE_AFTER_WEEKS - 1));
    const recent = new Set(weeks.filter((w) => w.monday >= cutoff).flatMap((w) => Object.keys(w.boxes)));
    for (const p of people) p.hidden = !recent.has(p.id);
  }

  return { ...emptyData(), people, venues, weeks };
}

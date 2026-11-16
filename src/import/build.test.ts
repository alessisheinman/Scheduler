import { beforeAll, expect, test } from 'vitest';
import { getWeek } from '../model/ops';
import { periodTotals } from '../model/payroll';
import type { AppData } from '../model/types';
import { analyze, issueId, type ImportDraft } from './analyze';
import { buildData, defaultAnswers, type ImportAnswers } from './build';
import { buildFixture, standardTabs } from './fixture';
import { readWorkbook, type RawWorkbook } from './readWorkbook';

const W1 = '2026-11-02';
const W2 = '2026-11-09';
let raw: RawWorkbook;
let draft: ImportDraft;
beforeAll(async () => {
  raw = await readWorkbook(await buildFixture(standardTabs()));
  draft = analyze(raw);
});

const person = (d: AppData, name: string) => d.people.find((p) => p.name === name)!;
const boxesOf = (d: AppData, monday: string, name: string) => getWeek(d, monday)!.boxes[person(d, name).id];

function answers(patch: Partial<ImportAnswers> = {}): ImportAnswers {
  return { ...defaultAnswers(draft), ...patch };
}

test('default answers take suggestions but merge nothing on their own', () => {
  const a = defaultAnswers(draft);
  expect(a.merges).toEqual({});
  expect(a.dayRate).toMatchObject({ DEV: true, ANA: false });
  expect(a.colorVenue).toEqual({ 'NOVEMBER 2026 WEEK 1|argb:FF1010EE': 'BARCLAYS' });
  expect(a.duplicateWeekKeep[issueId('duplicate-week', W2, 'week')]).toBe('NOV 2024 WEEK 2');
});

test('merged names become one person with both weeks', () => {
  const d = buildData(raw, draft, answers({ merges: { MYLO: 'MILO' } }));
  expect(d.people.filter((p) => p.name.startsWith('M')).map((p) => p.name)).toEqual(['MILO']);
  expect(boxesOf(d, W1, 'MILO')[4]).toMatchObject({ kind: 'shift', start: 420, end: 1200 });
  expect(boxesOf(d, W2, 'MILO')[0]).toMatchObject({ kind: 'shift', start: 420, end: 1260 });
});

test('shifts get the venue from that tab’s own key; merged venues share one venue', () => {
  const d = buildData(raw, draft, answers({ venueNames: { 'BARCLAYS CENTER': 'BARCLAYS' } }));
  const ana = boxesOf(d, W1, 'ANA')[0];
  const venue = d.venues.find((v) => ana?.kind === 'shift' && v.id === ana.venueId)!;
  expect(venue.name).toBe('BARCLAYS');
  expect(d.venues.map((v) => v.name).sort()).toEqual(['BARCLAYS', 'HULU', 'MSG']);
  expect(new Set(d.venues.map((v) => v.color)).size).toBe(3);
});

test('color answers set the venue; unanswered unknown colors leave no venue', () => {
  const d = buildData(raw, draft, answers({ colorVenue: { 'NOVEMBER 2026 WEEK 1|argb:FF00FF00': 'MSG' } }));
  const ben = boxesOf(d, W1, 'BEN')[2];
  expect(ben?.kind === 'shift' && d.venues.find((v) => v.id === ben.venueId)?.name).toBe('MSG');
  const d2 = buildData(raw, draft, answers({ colorVenue: {} }));
  expect(boxesOf(d2, W1, 'BEN')[2]).toMatchObject({ kind: 'shift', venueId: null });
});

test('fixes replace unreadable boxes; skip leaves them empty; untouched ones are left out', () => {
  const id = issueId('unreadable', 'NOVEMBER 2026 WEEK 1', 4, 1);
  const fixed = buildData(raw, draft, answers({ fixes: { [id]: { kind: 'shift', venue: 'BARCLAYS', start: 540, end: 1260 } } }));
  expect(boxesOf(fixed, W1, 'ANA')[1]).toMatchObject({ kind: 'shift', start: 540, end: 1260 });
  const skipped = buildData(raw, draft, answers({ fixes: { [id]: 'skip' } }));
  expect(boxesOf(skipped, W1, 'ANA')[1]).toBeNull();
  expect(boxesOf(buildData(raw, draft, answers()), W1, 'ANA')[1]).toBeNull();
});

test('colored-empty boxes: skipped by default, or counted as days for a day-rate person', () => {
  expect(boxesOf(buildData(raw, draft, answers()), W1, 'BEN')[3]).toBeNull();
  const d = buildData(raw, draft, answers({ dayRate: { ...defaultAnswers(draft).dayRate, BEN: true }, coloredEmptyAsDaysFor: ['BEN'] }));
  expect(boxesOf(d, W1, 'BEN')[3]).toEqual({ kind: 'day', start: null });
});

test('day-rate people get day boxes with their start time', () => {
  const d = buildData(raw, draft, answers());
  expect(person(d, 'DEV').dayRate).toBe(true);
  expect(boxesOf(d, W1, 'DEV').slice(0, 2)).toEqual([{ kind: 'day', start: 300 }, { kind: 'day', start: 270 }]);
});

test('two boxes on one day keep the first unless fixed', () => {
  const d = buildData(raw, draft, answers());
  expect(boxesOf(d, W2, 'ANA')[1]).toMatchObject({ start: 420, end: 900 });
});

test('the duplicate week keeps the chosen tab', () => {
  const id = issueId('duplicate-week', W2, 'week');
  const d = buildData(raw, draft, answers({ duplicateWeekKeep: { [id]: 'NOVEMBER 2026 WEEK 2 COPY' } }));
  expect(boxesOf(d, W2, 'ANA')[0]).toMatchObject({ start: 420, end: 1260 });
  expect(getWeek(d, W2)!.boxes[person(d, 'DEV').id]).toBeUndefined();
  expect(d.weeks.map((w) => w.monday)).toEqual([W1, W2]);
});

test('payday on imported data adds up', () => {
  const d = buildData(raw, draft, answers());
  const ana = periodTotals(d, [W1]).find((t) => t.personId === person(d, 'ANA').id)!;
  expect(ana.hours).toBe(22); // 7AM-9PM (14) + 7AM-3PM (8); the unreadable box is left out
});

test('people order follows the newest tab first', () => {
  const d = buildData(raw, draft, answers());
  expect(d.people.slice(0, 3).map((p) => p.name)).toEqual(['MYLO', 'ANA', 'DEV']);
});

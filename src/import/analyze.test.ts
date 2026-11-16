import { beforeAll, expect, test } from 'vitest';
import { analyze, normalizeName, type ImportDraft } from './analyze';
import { buildFixture, standardTabs } from './fixture';
import { readWorkbook } from './readWorkbook';

let draft: ImportDraft;
beforeAll(async () => { draft = analyze(await readWorkbook(await buildFixture(standardTabs()))); });

const kinds = () => draft.issues.map((i) => i.kind).sort();

test('normalizeName', () => {
  expect(normalizeName('  ana  1 ')).toBe('ANA');
  expect(normalizeName('Rosa  Smith')).toBe('ROSA SMITH');
});

test('finds every kind of problem once', () => {
  expect(kinds()).toEqual(['colored-empty', 'duplicate-week', 'no-name-row', 'two-boxes-one-day', 'unreadable']);
  const unreadable = draft.issues.find((i) => i.kind === 'unreadable')!;
  expect(unreadable).toMatchObject({ tab: 'NOVEMBER 2026 WEEK 1', name: 'ANA', day: 1, text: '9PAM-9PM', venue: 'BARCLAYS' });
  expect(draft.issues.find((i) => i.kind === 'colored-empty')).toMatchObject({ name: 'BEN', day: 3 });
  expect(draft.issues.find((i) => i.kind === 'two-boxes-one-day')).toMatchObject({ name: 'ANA', day: 1 });
});

test('two tabs on the same Monday are flagged, not merged silently', () => {
  const dup = draft.issues.find((i) => i.kind === 'duplicate-week')!;
  expect(dup.text).toContain('NOV 2024 WEEK 2');
  expect(dup.text).toContain('NOVEMBER 2026 WEEK 2 COPY');
});

test('colors missing from that tab’s key become one question per tab and color', () => {
  expect(draft.colorQuestions).toHaveLength(2);
  expect(draft.colorQuestions[0]).toMatchObject({
    tab: 'NOVEMBER 2026 WEEK 1', color: 'argb:FF00FF00', hex: '#00ff00', count: 2,
    legendVenues: ['BARCLAYS', 'MSG', 'HULU'], suggestion: null, confident: false,
  });
});

test('a near shade of a key color is suggested as that venue', () => {
  expect(draft.colorQuestions[1]).toMatchObject({ color: 'argb:FF1010EE', suggestion: 'BARCLAYS', confident: true, count: 1 });
});

test('look-alike venue names are suggested for merging', () => {
  expect(draft.venueMergeSuggestions).toEqual([['BARCLAYS', 'BARCLAYS CENTER']]);
});

test('names: counts, merge suggestions, day-rate guess', () => {
  expect(draft.names.map((n) => n.name).sort()).toEqual(['ANA', 'BEN', 'CARLA', 'DEV', 'MYLO', 'MILO']);
  expect(draft.mergeSuggestions).toContainEqual(['MYLO', 'MILO']);
  expect(draft.names.find((n) => n.name === 'DEV')!.dayRateLikely).toBe(true);
  expect(draft.names.find((n) => n.name === 'ANA')!.dayRateLikely).toBe(false);
});

test('venues and weeks', () => {
  expect(draft.venues).toEqual(['BARCLAYS', 'MSG', 'HULU', 'BARCLAYS CENTER']);
  expect(draft.weekCount).toBe(2);
});

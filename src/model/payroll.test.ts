import { describe, expect, test } from 'vitest';
import { addPerson, setBox } from './ops';
import { defaultPaydayWeek, periodTotals, rangeTotals, weekTotals } from './payroll';
import { emptyData, type AppData } from './types';

const W1 = '2026-11-02';
const W2 = '2026-11-09';

function people(): AppData {
  let d = addPerson(addPerson(emptyData(), 'ANA'), 'BEN');
  d = addPerson(d, 'DEV', true);
  return d;
}
const id = (d: AppData, n: string) => d.people.find((p) => p.name === n)!.id;
const shift = (start: number, end: number) => ({ kind: 'shift' as const, venueId: null, start, end });

test('weekly overtime is hours over 40', () => {
  let d = people();
  for (let day = 0; day < 6; day++) d = setBox(d, W2, id(d, 'ANA'), day, shift(420, 1260)); // 6 × 14h
  expect(weekTotals(d, W2).get(id(d, 'ANA'))).toMatchObject({ hours: 84, regular: 40, overtime: 44 });
});

test('two-week period adds each week’s overtime, not overtime against 80', () => {
  let d = people();
  for (let day = 0; day < 3; day++) d = setBox(d, W1, id(d, 'ANA'), day, shift(480, 1080)); // 3 × 10h = 30
  for (let day = 0; day < 5; day++) d = setBox(d, W2, id(d, 'ANA'), day, shift(480, 1080)); // 5 × 10h = 50
  const [ana] = periodTotals(d, [W1, W2]);
  expect(ana).toMatchObject({ hours: 80, regular: 70, overtime: 10 });
});

test('day-rate people are counted in days', () => {
  let d = people();
  for (let day = 0; day < 7; day++) d = setBox(d, W2, id(d, 'DEV'), day, { kind: 'day', start: 300 });
  expect(periodTotals(d, [W2]).find((t) => t.personId === id(d, 'DEV'))).toMatchObject({ days: 7, hours: 0 });
});

test('quarter hours stay exact', () => {
  let d = people();
  d = setBox(d, W2, id(d, 'ANA'), 0, shift(465, 1260));
  expect(periodTotals(d, [W2])[0].hours).toBe(13.25);
});

test('people with nothing in the period are left out, order follows the people list', () => {
  let d = people();
  d = setBox(d, W2, id(d, 'BEN'), 0, shift(420, 600));
  d = setBox(d, W2, id(d, 'ANA'), 1, shift(420, 600));
  expect(periodTotals(d, [W2]).map((t) => t.personId)).toEqual([id(d, 'ANA'), id(d, 'BEN')]);
});

test('payday defaults to the newest week that has started, not next week’s plan', () => {
  const mondays = ['2026-11-02', '2026-11-09', '2026-11-16'];
  expect(defaultPaydayWeek(mondays, '2026-11-14')).toBe('2026-11-09');
  expect(defaultPaydayWeek(mondays, '2026-11-16')).toBe('2026-11-16');
  expect(defaultPaydayWeek(['2026-12-07'], '2026-11-14')).toBe('2026-12-07');
  expect(defaultPaydayWeek([], '2026-11-14')).toBeUndefined();
});

test('days count only day boxes, so changing someone’s pay type never hides past hours', () => {
  let d = people();
  d = setBox(d, W2, id(d, 'ANA'), 0, shift(420, 1260));
  d = setBox(d, W2, id(d, 'ANA'), 1, { kind: 'day', start: 300 });
  expect(periodTotals(d, [W2])[0]).toMatchObject({ hours: 14, days: 1 });
});

describe('rangeTotals (pay by dates)', () => {
  const tenHourDays = (d: AppData, monday: string, days: number[]) => {
    for (const day of days) d = setBox(d, monday, id(d, 'ANA'), day, shift(480, 1080)); // 8AM-6PM = 10h
    return d;
  };

  test('a full Monday–Sunday range matches the week totals', () => {
    const d = tenHourDays(people(), W2, [0, 1, 2, 3, 4]);
    expect(rangeTotals(d, '2026-11-09', '2026-11-15')[0]).toMatchObject({ hours: 50, regular: 40, overtime: 10 });
  });

  test('a range starting mid-week still pays overtime where it happened (whole week counts toward 40)', () => {
    const d = tenHourDays(people(), W2, [0, 1, 2, 3, 4]); // Mon..Fri = 10, 20, 30, 40, 50
    expect(rangeTotals(d, '2026-11-11', '2026-11-15')[0]).toMatchObject({ hours: 30, regular: 20, overtime: 10 });
    expect(rangeTotals(d, '2026-11-09', '2026-11-11')[0]).toMatchObject({ hours: 30, regular: 30, overtime: 0 });
  });

  test('a shift that crosses 40 is split into regular and overtime', () => {
    let d = tenHourDays(people(), W2, [0, 1, 2]); // 30h
    d = setBox(d, W2, id(d, 'ANA'), 3, shift(420, 1260)); // +14h → 44
    expect(rangeTotals(d, '2026-11-12', '2026-11-12')[0]).toMatchObject({ hours: 14, regular: 10, overtime: 4 });
  });

  test('a range across two weeks adds each week, and days count only inside the range', () => {
    let d = tenHourDays(people(), W1, [5, 6]);
    d = tenHourDays(d, W2, [0]);
    d = setBox(d, W1, id(d, 'DEV'), 6, { kind: 'day', start: 300 });
    d = setBox(d, W2, id(d, 'DEV'), 1, { kind: 'day', start: 300 });
    const t = rangeTotals(d, '2026-11-08', '2026-11-09');
    expect(t.find((x) => x.personId === id(d, 'ANA'))).toMatchObject({ hours: 20, overtime: 0 });
    expect(t.find((x) => x.personId === id(d, 'DEV'))).toMatchObject({ days: 1 });
  });
});

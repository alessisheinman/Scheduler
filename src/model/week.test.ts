import { expect, test } from 'vitest';
import { addDays, dayHeader, excelSerialToISO, mondayOf, weekDates, weekLabel } from './week';

test('mondayOf finds the Monday of the week', () => {
  expect(mondayOf('2026-11-15')).toBe('2026-11-09');
  expect(mondayOf('2026-11-09')).toBe('2026-11-09');
  expect(mondayOf('2027-01-01')).toBe('2026-12-28');
});

test('addDays crosses years', () => {
  expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  expect(addDays('2026-11-09', -7)).toBe('2026-11-02');
});

test('weekDates lists Monday to Sunday', () => {
  expect(weekDates('2026-11-09')).toEqual([
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
  ]);
});

test('weekLabel within a month, across months, across years', () => {
  expect(weekLabel('2026-11-09')).toBe('Week of Nov 9 – 15, 2026');
  expect(weekLabel('2026-10-26')).toBe('Week of Oct 26 – Nov 1, 2026');
  expect(weekLabel('2026-12-28')).toBe('Week of Dec 28, 2026 – Jan 3, 2027');
});

test('dayHeader', () => {
  expect(dayHeader('2026-11-10')).toEqual({ day: 'TUE', date: '11/10' });
});

test('excelSerialToISO', () => {
  expect(excelSerialToISO(46335)).toBe('2026-11-09');
});

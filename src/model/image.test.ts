import { expect, test } from 'vitest';
import { buildImageModel, wrapText } from './image';
import { addPerson, addVenue, setBox, updatePerson, updateVenue } from './ops';
import { weekTotals } from './payroll';
import { emptyData, type AppData } from './types';

const MON = '2026-11-09';

function fixture(): AppData {
  let d = addPerson(addPerson(addPerson(emptyData(), 'ANA'), 'BEN'), 'DEV', true);
  d = addVenue(d, 'UNITED PALACE');
  const ana = d.people[0].id;
  for (let day = 0; day < 5; day++) d = setBox(d, MON, ana, day, { kind: 'shift', venueId: d.venues[0].id, start: 420, end: 1260 });
  d = setBox(d, MON, d.people[2].id, 1, { kind: 'day', start: 300 });
  return d;
}

test('only people working that week appear, in list order', () => {
  const m = buildImageModel(fixture(), MON);
  expect(m.title).toBe('Week of Nov 9 – 15, 2026');
  expect(m.rows.map((r) => r.name)).toEqual(['ANA', 'DEV']);
  expect(m.days[0]).toEqual({ day: 'MON', date: '11/9' });
});

test('cells carry the full venue name and the shift, day-rate shows the start', () => {
  const m = buildImageModel(fixture(), MON);
  expect(m.rows[0].cells[0]).toEqual({ kind: 'shift', venue: 'UNITED PALACE', color: '#a9c8f5', time: '7AM-9PM' });
  expect(m.rows[0].cells[6]).toEqual({ kind: 'empty' });
  expect(m.rows[1].cells[1]).toEqual({ kind: 'day', time: 'Day · 5AM' });
});

test('the picture never carries totals or overtime', () => {
  const d = fixture();
  const m = buildImageModel(d, MON);
  const text = JSON.stringify(m);
  expect(text).not.toMatch(/\bOT\b|hrs|total|overtime/i);
  const anaHours = weekTotals(d, MON).get(d.people[0].id)!.hours; // 70
  expect(text).not.toContain(String(anaHours));
});

test('hidden people with shifts that week still appear; renamed venues show the new name', () => {
  let d = fixture();
  d = updatePerson(d, d.people[0].id, { hidden: true });
  d = updateVenue(d, d.venues[0].id, { name: 'THE UNITED PALACE' });
  const m = buildImageModel(d, MON);
  expect(m.rows[0].name).toBe('ANA');
  expect(m.rows[0].cells[0]).toMatchObject({ venue: 'THE UNITED PALACE' });
});

test('wrapText breaks between words and never cuts a word', () => {
  const measure = (s: string) => s.length * 10;
  expect(wrapText('UNITED PALACE', 60, measure)).toEqual(['UNITED', 'PALACE']);
  expect(wrapText('PRUDENTIAL', 60, measure)).toEqual(['PRUDENTIAL']);
  expect(wrapText('MSG', 60, measure)).toEqual(['MSG']);
  expect(wrapText('RADIO CITY MUSIC HALL', 110, measure)).toEqual(['RADIO CITY', 'MUSIC HALL']);
});

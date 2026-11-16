import { describe, expect, test } from 'vitest';
import {
  addCrew, addPerson, addVenue, countReplacements, deleteVenue, getWeek, movePerson, peopleForWeek, setBox,
  startNextWeek, updatePerson, updateVenue,
} from './ops';
import { VENUE_PALETTE, suggestVenueColor } from './palette';
import { emptyData, type AppData } from './types';

const MON = '2026-11-09';

function fixture(): AppData {
  let d = emptyData();
  for (const n of ['ANA', 'BEN', 'CARLA']) d = addPerson(d, n);
  d = addVenue(d, 'BARCLAYS');
  d = addVenue(d, 'UNITED PALACE');
  return d;
}
const id = (d: AppData, name: string) => d.people.find((p) => p.name === name)!.id;
const venue = (d: AppData, name: string) => d.venues.find((v) => v.name === name)!.id;

describe('addCrew', () => {
  test('fills every person × day with the same shift and leaves the input untouched', () => {
    const d = fixture();
    const before = structuredClone(d);
    const vid = venue(d, 'BARCLAYS');
    const out = addCrew(d, { monday: MON, venueId: vid, days: [0, 4], start: 420, end: 1260, personIds: d.people.map((p) => p.id) });
    expect(d).toEqual(before);
    const w = getWeek(out, MON)!;
    const filled = Object.values(w.boxes).flat().filter(Boolean);
    expect(filled).toHaveLength(6);
    expect(w.boxes[id(d, 'ANA')][4]).toEqual({ kind: 'shift', venueId: vid, start: 420, end: 1260 });
  });

  test('empty days or people change nothing', () => {
    const d = fixture();
    expect(addCrew(d, { monday: MON, venueId: venue(d, 'BARCLAYS'), days: [], start: 420, end: 1260, personIds: [id(d, 'ANA')] })).toBe(d);
  });

  test('countReplacements counts boxes that already have something', () => {
    let d = fixture();
    d = setBox(d, MON, id(d, 'ANA'), 0, { kind: 'shift', venueId: null, start: 300, end: 600 });
    const crew = { monday: MON, venueId: venue(d, 'BARCLAYS'), days: [0, 1], start: 420, end: 1260, personIds: [id(d, 'ANA'), id(d, 'BEN')] };
    expect(countReplacements(d, crew)).toBe(1);
  });
});

describe('startNextWeek', () => {
  test('copies boxes, skips hidden people, never duplicates the week', () => {
    let d = fixture();
    d = setBox(d, MON, id(d, 'ANA'), 2, { kind: 'shift', venueId: null, start: 420, end: 1260 });
    d = setBox(d, MON, id(d, 'BEN'), 2, { kind: 'shift', venueId: null, start: 420, end: 1260 });
    d = updatePerson(d, id(d, 'BEN'), { hidden: true });
    const first = startNextWeek(d, MON, true);
    expect(first.monday).toBe('2026-11-16');
    const next = getWeek(first.data, '2026-11-16')!;
    expect(next.boxes[id(d, 'ANA')][2]).toEqual({ kind: 'shift', venueId: null, start: 420, end: 1260 });
    expect(next.boxes[id(d, 'BEN')]).toBeUndefined();
    const again = startNextWeek(first.data, MON, true);
    expect(again.data.weeks.filter((w) => w.monday === '2026-11-16')).toHaveLength(1);
  });

  test('without copying, the new week is empty', () => {
    let d = fixture();
    d = setBox(d, MON, id(d, 'ANA'), 2, { kind: 'shift', venueId: null, start: 420, end: 1260 });
    const { data } = startNextWeek(d, MON, false);
    expect(Object.values(getWeek(data, '2026-11-16')!.boxes).flat().filter(Boolean)).toHaveLength(0);
  });
});

describe('venues', () => {
  test('a venue in use cannot be deleted; an unused one can', () => {
    let d = fixture();
    d = setBox(d, MON, id(d, 'ANA'), 0, { kind: 'shift', venueId: venue(d, 'BARCLAYS'), start: 420, end: 1260 });
    expect(() => deleteVenue(d, venue(d, 'BARCLAYS'))).toThrow('Venue is used in the schedule');
    expect(deleteVenue(d, venue(d, 'UNITED PALACE')).venues.map((v) => v.name)).toEqual(['BARCLAYS']);
  });

  test('renaming keeps boxes pointing at the venue', () => {
    let d = fixture();
    const vid = venue(d, 'BARCLAYS');
    d = setBox(d, MON, id(d, 'ANA'), 0, { kind: 'shift', venueId: vid, start: 420, end: 1260 });
    d = updateVenue(d, vid, { name: 'BARCLAYS CENTER' });
    const box = getWeek(d, MON)!.boxes[id(d, 'ANA')][0];
    expect(box && box.kind === 'shift' && d.venues.find((v) => v.id === box.venueId)!.name).toBe('BARCLAYS CENTER');
  });

  test('new venues get distinct palette colors', () => {
    const d = fixture();
    expect(d.venues.map((v) => v.color)).toEqual([VENUE_PALETTE[0], VENUE_PALETTE[1]]);
    expect(suggestVenueColor([VENUE_PALETTE[0]])).toBe(VENUE_PALETTE[1]);
  });
});

describe('people', () => {
  test('a hidden person still shows in weeks where they have boxes', () => {
    let d = fixture();
    d = setBox(d, MON, id(d, 'BEN'), 1, { kind: 'shift', venueId: null, start: 420, end: 1260 });
    d = updatePerson(d, id(d, 'BEN'), { hidden: true });
    expect(peopleForWeek(d, MON).map((p) => p.name)).toEqual(['ANA', 'BEN', 'CARLA']);
    expect(peopleForWeek(d, '2026-11-16').map((p) => p.name)).toEqual(['ANA', 'CARLA']);
  });

  test('movePerson reorders', () => {
    const d = fixture();
    expect(movePerson(d, id(d, 'CARLA'), 0).people.map((p) => p.name)).toEqual(['CARLA', 'ANA', 'BEN']);
  });
});

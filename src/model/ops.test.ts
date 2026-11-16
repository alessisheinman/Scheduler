import { describe, expect, test } from 'vitest';
import {
  addPerson, addVenue, cellsInRect, clearBoxes, countFilled, deleteVenue, fillBoxes, getWeek, movePerson, peopleForWeek, peopleWorkingWeek, setBox,
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

describe('fillBoxes', () => {
  test('fills every picked box with the same shift and leaves the input untouched', () => {
    const d = fixture();
    const before = structuredClone(d);
    const vid = venue(d, 'BARCLAYS');
    const cells = [id(d, 'ANA'), id(d, 'BEN'), id(d, 'CARLA')].flatMap((personId) => [0, 4].map((day) => ({ personId, day })));
    const out = fillBoxes(d, MON, cells, { venueId: vid, start: 420, end: 1260 });
    expect(d).toEqual(before);
    const w = getWeek(out, MON)!;
    expect(Object.values(w.boxes).flat().filter(Boolean)).toHaveLength(6);
    expect(w.boxes[id(d, 'ANA')][4]).toEqual({ kind: 'shift', venueId: vid, start: 420, end: 1260 });
  });

  test('people paid by the day get a day box with the start time', () => {
    let d = fixture();
    d = addPerson(d, 'DEV', true);
    const out = fillBoxes(d, MON, [{ personId: id(d, 'DEV'), day: 2 }, { personId: id(d, 'ANA'), day: 2 }], { venueId: null, start: 300, end: 1260 });
    expect(getWeek(out, MON)!.boxes[id(d, 'DEV')][2]).toEqual({ kind: 'day', start: 300 });
    expect(getWeek(out, MON)!.boxes[id(d, 'ANA')][2]).toMatchObject({ kind: 'shift', start: 300, end: 1260 });
  });

  test('clearing empties every picked box', () => {
    let d = fixture();
    d = fillBoxes(d, MON, [{ personId: id(d, 'ANA'), day: 0 }, { personId: id(d, 'ANA'), day: 1 }], { venueId: null, start: 420, end: 600 });
    d = clearBoxes(d, MON, [{ personId: id(d, 'ANA'), day: 0 }, { personId: id(d, 'ANA'), day: 1 }]);
    expect(peopleWorkingWeek(d, MON)).toEqual([]);
  });

  test('countFilled counts picked boxes that already have something', () => {
    let d = fixture();
    d = setBox(d, MON, id(d, 'ANA'), 0, { kind: 'shift', venueId: null, start: 300, end: 600 });
    expect(countFilled(d, MON, [{ personId: id(d, 'ANA'), day: 0 }, { personId: id(d, 'BEN'), day: 0 }])).toBe(1);
  });
});

describe('cellsInRect (drag to pick)', () => {
  test('dragging picks every box between the two corners, any direction', () => {
    const rows = ['a', 'b', 'c'];
    expect(cellsInRect(rows, { row: 2, day: 3 }, { row: 1, day: 1 })).toEqual([
      { personId: 'b', day: 1 }, { personId: 'b', day: 2 }, { personId: 'b', day: 3 },
      { personId: 'c', day: 1 }, { personId: 'c', day: 2 }, { personId: 'c', day: 3 },
    ]);
    expect(cellsInRect(rows, { row: 0, day: 5 }, { row: 0, day: 5 })).toEqual([{ personId: 'a', day: 5 }]);
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

describe('peopleWorkingWeek', () => {
  test('only people with at least one box that week, in list order', () => {
    let d = fixture();
    d = setBox(d, MON, id(d, 'CARLA'), 3, { kind: 'shift', venueId: null, start: 420, end: 1260 });
    d = setBox(d, MON, id(d, 'ANA'), 0, { kind: 'day', start: 300 });
    expect(peopleWorkingWeek(d, MON).map((p) => p.name)).toEqual(['ANA', 'CARLA']);
    expect(peopleWorkingWeek(d, '2026-11-16')).toEqual([]);
  });
});

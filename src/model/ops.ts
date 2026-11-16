// Pure edits: every function returns new data and never changes what it was given.
import { suggestVenueColor } from './palette';
import type { Minutes } from './time';
import type { AppData, Box, ID, Person, Venue, Week } from './types';
import { addDays, type ISODate } from './week';

export const newId = (): string => crypto.randomUUID();

/** One box in a week: a person and a day (0 = Monday). */
export interface Cell { personId: ID; day: number }

export function getWeek(data: AppData, monday: ISODate): Week | undefined {
  return data.weeks.find((w) => w.monday === monday);
}

export function ensureWeek(data: AppData, monday: ISODate): AppData {
  if (getWeek(data, monday)) return data;
  const weeks = [...data.weeks, { monday, boxes: {} }].sort((a, b) => a.monday.localeCompare(b.monday));
  return { ...data, weeks };
}

function editWeek(data: AppData, monday: ISODate, edit: (boxes: Week['boxes']) => void): AppData {
  const d = ensureWeek(data, monday);
  return {
    ...d,
    weeks: d.weeks.map((w) => {
      if (w.monday !== monday) return w;
      const boxes = Object.fromEntries(Object.entries(w.boxes).map(([k, v]) => [k, [...v]]));
      edit(boxes);
      return { ...w, boxes };
    }),
  };
}

const slots = (boxes: Week['boxes'], personId: ID) =>
  (boxes[personId] ??= [null, null, null, null, null, null, null]);

export function setBox(data: AppData, monday: ISODate, personId: ID, day: number, box: Box | null): AppData {
  return editWeek(data, monday, (boxes) => { slots(boxes, personId)[day] = box; });
}

/**
 * Fills every picked box with one shift. People paid by the day get a day box with the start time instead.
 */
export function fillBoxes(data: AppData, monday: ISODate, cells: Cell[], fill: { venueId: ID | null; start: Minutes; end: Minutes }): AppData {
  if (cells.length === 0) return data;
  const dayRate = new Set(data.people.filter((p) => p.dayRate).map((p) => p.id));
  return editWeek(data, monday, (boxes) => {
    for (const c of cells) {
      slots(boxes, c.personId)[c.day] = dayRate.has(c.personId)
        ? { kind: 'day', start: fill.start }
        : { kind: 'shift', venueId: fill.venueId, start: fill.start, end: fill.end };
    }
  });
}

export function clearBoxes(data: AppData, monday: ISODate, cells: Cell[]): AppData {
  if (cells.length === 0) return data;
  return editWeek(data, monday, (boxes) => { for (const c of cells) if (boxes[c.personId]) boxes[c.personId][c.day] = null; });
}

/** How many of the picked boxes already have something in them. */
export function countFilled(data: AppData, monday: ISODate, cells: Cell[]): number {
  const w = getWeek(data, monday);
  return cells.filter((c) => w?.boxes[c.personId]?.[c.day]).length;
}

/** Every box between two dragged-to corners (rows are the grid's person order). */
export function cellsInRect(rows: ID[], a: { row: number; day: number }, b: { row: number; day: number }): Cell[] {
  const out: Cell[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let day = Math.min(a.day, b.day); day <= Math.max(a.day, b.day); day++) out.push({ personId: rows[r], day });
  }
  return out;
}

export function startNextWeek(data: AppData, fromMonday: ISODate, copyBoxes: boolean): { data: AppData; monday: ISODate } {
  const monday = addDays(fromMonday, 7);
  if (getWeek(data, monday)) return { data, monday };
  const from = getWeek(data, fromMonday);
  const boxes: Week['boxes'] = {};
  if (copyBoxes && from) {
    for (const p of data.people) {
      if (!p.hidden && from.boxes[p.id]) boxes[p.id] = structuredClone(from.boxes[p.id]);
    }
  }
  const weeks = [...data.weeks, { monday, boxes }].sort((a, b) => a.monday.localeCompare(b.monday));
  return { data: { ...data, weeks }, monday };
}

export function addPerson(data: AppData, name: string, dayRate = false): AppData {
  return { ...data, people: [...data.people, { id: newId(), name, dayRate, hidden: false }] };
}

export function updatePerson(data: AppData, id: ID, patch: Partial<Omit<Person, 'id'>>): AppData {
  return { ...data, people: data.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

export function movePerson(data: AppData, id: ID, toIndex: number): AppData {
  const people = data.people.filter((p) => p.id !== id);
  const person = data.people.find((p) => p.id === id);
  if (!person) return data;
  people.splice(Math.max(0, Math.min(toIndex, people.length)), 0, person);
  return { ...data, people };
}

export function addVenue(data: AppData, name: string, color?: string): AppData {
  const venue: Venue = { id: newId(), name, color: color ?? suggestVenueColor(data.venues.map((v) => v.color)) };
  return { ...data, venues: [...data.venues, venue] };
}

export function updateVenue(data: AppData, id: ID, patch: Partial<Omit<Venue, 'id'>>): AppData {
  return { ...data, venues: data.venues.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
}

export function venueInUse(data: AppData, id: ID): boolean {
  return data.weeks.some((w) => Object.values(w.boxes).some((row) => row.some((b) => b?.kind === 'shift' && b.venueId === id)));
}

export function deleteVenue(data: AppData, id: ID): AppData {
  if (venueInUse(data, id)) throw new Error('Venue is used in the schedule');
  return { ...data, venues: data.venues.filter((v) => v.id !== id) };
}

/** Only the people with at least one box this week, in list order — the rows of the grid and the picture. */
export function peopleWorkingWeek(data: AppData, monday: ISODate): Person[] {
  const w = getWeek(data, monday);
  return data.people.filter((p) => w?.boxes[p.id]?.some(Boolean) ?? false);
}

/** Everyone not hidden, plus hidden people who have something in this week — in list order. */
export function peopleForWeek(data: AppData, monday: ISODate): Person[] {
  const w = getWeek(data, monday);
  return data.people.filter((p) => !p.hidden || (w?.boxes[p.id]?.some(Boolean) ?? false));
}

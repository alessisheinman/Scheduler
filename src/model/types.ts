import type { Minutes } from './time';
import type { ISODate } from './week';

export type ID = string;
export interface Person { id: ID; name: string; dayRate: boolean; hidden: boolean }
export interface Venue { id: ID; name: string; color: string /* '#rrggbb' */ }
export type Box =
  | { kind: 'shift'; venueId: ID | null; start: Minutes; end: Minutes }
  | { kind: 'day'; start: Minutes | null };
export interface Week { monday: ISODate; boxes: Record<ID, (Box | null)[]> /* personId → 7 slots, Mon..Sun */ }
export interface AppData {
  schemaVersion: 1;
  people: Person[]; // array order = display order (grid and image)
  venues: Venue[];
  weeks: Week[]; // sorted by monday ascending, unique monday
}
export const emptyData = (): AppData => ({ schemaVersion: 1, people: [], venues: [], weeks: [] });

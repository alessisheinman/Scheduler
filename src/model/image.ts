// What goes on the picture workers receive. Built only from shifts — totals and overtime never enter it.
import { getWeek, peopleForWeek } from './ops';
import { formatShift, formatTime } from './time';
import type { AppData } from './types';
import { dayHeader, weekDates, weekLabel, type ISODate } from './week';

export type ImageCell =
  | { kind: 'empty' }
  | { kind: 'shift'; venue: string; color: string; time: string }
  | { kind: 'day'; time: string };

export interface ImageModel {
  title: string;
  days: { day: string; date: string }[];
  rows: { name: string; cells: ImageCell[] }[];
}

export function buildImageModel(data: AppData, monday: ISODate): ImageModel {
  const week = getWeek(data, monday);
  const rows = peopleForWeek(data, monday)
    .filter((p) => week?.boxes[p.id]?.some(Boolean))
    .map((p) => ({
      name: p.name,
      cells: (week!.boxes[p.id]).map((b): ImageCell => {
        if (!b) return { kind: 'empty' };
        if (b.kind === 'day') return { kind: 'day', time: b.start === null ? 'Day' : `Day · ${formatTime(b.start)}` };
        const venue = data.venues.find((v) => v.id === b.venueId);
        return { kind: 'shift', venue: venue?.name ?? '', color: venue?.color ?? '#ffffff', time: formatShift(b.start, b.end) };
      }),
    }));
  return { title: weekLabel(monday), days: weekDates(monday).map(dayHeader), rows };
}

/** Splits text into lines that fit maxWidth, breaking only between words. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const tryLine = line ? `${line} ${word}` : word;
    if (line && measure(tryLine) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

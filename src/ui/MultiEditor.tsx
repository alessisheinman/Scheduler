import { useState } from 'react';
import { countFilled, type Cell } from '../model/ops';
import { formatHours, shiftHours, type Minutes } from '../model/time';
import type { AppData } from '../model/types';
import type { ISODate } from '../model/week';
import { TimeInput } from './TimeInput';

/** One venue + one set of times for every picked box. People paid by the day only take the start time. */
export function MultiEditor({ data, monday, cells, defaultVenueId, onFill, onClear, onCancel }: {
  data: AppData;
  monday: ISODate;
  cells: Cell[];
  defaultVenueId: string | null;
  onFill(fill: { venueId: string | null; start: Minutes; end: Minutes }): void;
  onClear(): void;
  onCancel(): void;
}) {
  const [venueId, setVenueId] = useState<string | null>(defaultVenueId);
  const [start, setStart] = useState<Minutes | null>(null);
  const [end, setEnd] = useState<Minutes | null>(null);
  const dayRate = new Set(data.people.filter((p) => p.dayRate).map((p) => p.id));
  const allDayRate = cells.every((c) => dayRate.has(c.personId));
  const valid = start !== null && (allDayRate || (end !== null && end !== start));
  const replaces = countFilled(data, monday, cells);
  const venue = data.venues.find((v) => v.id === venueId);
  const people = new Set(cells.map((c) => c.personId)).size;
  const done = () => valid && onFill({ venueId, start: start!, end: end ?? start! });

  return (
    <div className="box-editor" role="dialog" aria-label={`Fill ${cells.length} boxes`}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
        if (e.key === 'Enter') { e.preventDefault(); done(); }
      }}>
      <div className="box-editor-title">
        {cells.length} boxes · {people} {people === 1 ? 'person' : 'people'}
        {replaces > 0 && <span className="muted"> · replaces {replaces}</span>}
      </div>
      {!allDayRate && (
        <select value={venueId ?? ''} onChange={(e) => setVenueId(e.target.value || null)} aria-label="Venue"
          style={{ background: venue?.color ?? '#fff' }} className="venue-select">
          <option value="">No venue</option>
          {data.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      )}
      <div className="row">
        {allDayRate && <span className="muted">Day rate · start</span>}
        <TimeInput label="Start time" value={start} onChange={setStart} autoFocus />
        {!allDayRate && <><span>–</span><TimeInput label="End time" value={end} onChange={setEnd} /></>}
        {!allDayRate && valid && <span className="muted">= {formatHours(shiftHours(start!, end!))} hrs each</span>}
      </div>
      {!allDayRate && cells.some((c) => dayRate.has(c.personId)) && (
        <small className="muted">People paid by the day get "Day" with the start time.</small>
      )}
      <div className="row box-editor-actions">
        <button type="button" className="remove" onClick={onClear}>Clear boxes</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={!valid} onClick={done}>Fill {cells.length} boxes</button>
      </div>
    </div>
  );
}

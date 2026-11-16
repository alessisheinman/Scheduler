import { useState } from 'react';
import { formatHours, shiftHours, type Minutes } from '../model/time';
import type { Box, Person, Venue } from '../model/types';
import { TimeInput } from './TimeInput';

/** Small editor that opens over a clicked box. */
export function BoxEditor({ person, dayLabel, box, venues, defaultVenueId, onDone, onCancel }: {
  person: Person;
  dayLabel: string;
  box: Box | null;
  venues: Venue[];
  defaultVenueId: string | null;
  onDone(b: Box | null): void;
  onCancel(): void;
}) {
  const shift = box?.kind === 'shift' ? box : null;
  const [venueId, setVenueId] = useState<string | null>(shift ? shift.venueId : defaultVenueId);
  const [start, setStart] = useState<Minutes | null>(box ? box.start : null);
  const [end, setEnd] = useState<Minutes | null>(shift ? shift.end : null);

  const valid = person.dayRate ? true : start !== null && end !== null && start !== end;
  const result = (): Box | null => {
    if (person.dayRate) return { kind: 'day', start };
    return { kind: 'shift', venueId, start: start!, end: end! };
  };
  const venue = venues.find((v) => v.id === venueId);

  return (
    <div className="box-editor" role="dialog" aria-label={`${person.name}, ${dayLabel}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
        if (e.key === 'Enter' && valid) { e.preventDefault(); onDone(result()); }
      }}>
      <div className="box-editor-title">{person.name} · {dayLabel}</div>
      {person.dayRate ? (
        <div className="row">
          <span className="muted">Day rate · start</span>
          <TimeInput label="Start time" value={start} onChange={setStart} autoFocus />
        </div>
      ) : (
        <>
          <select value={venueId ?? ''} onChange={(e) => setVenueId(e.target.value || null)} aria-label="Venue"
            style={{ background: venue?.color ?? '#fff' }} className="venue-select">
            <option value="">No venue</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <div className="row">
            <TimeInput label="Start time" value={start} onChange={setStart} autoFocus />
            <span>–</span>
            <TimeInput label="End time" value={end} onChange={setEnd} />
            <span className="muted">{valid ? `= ${formatHours(shiftHours(start!, end!))} hrs` : ''}</span>
          </div>
        </>
      )}
      <div className="row box-editor-actions">
        <button type="button" className="remove" onClick={() => onDone(null)}>Clear box</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={!valid} onClick={() => onDone(result())}>Done</button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { addCrew, countReplacements, type Crew } from '../model/ops';
import type { Minutes } from '../model/time';
import type { AppData } from '../model/types';
import { dayHeader, weekDates, type ISODate } from '../model/week';
import { TimeInput } from './TimeInput';

/** Fill many boxes at once: one venue, some days, the same hours, a group of people. */
export function AddCrewPanel({ data, monday, people, update }: {
  data: AppData;
  monday: ISODate;
  people: AppData['people'];
  update(fn: (d: AppData) => AppData): void;
}) {
  const [venueId, setVenueId] = useState<string>('');
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState<Minutes | null>(null);
  const [end, setEnd] = useState<Minutes | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const crewPeople = people.filter((p) => !p.dayRate && !p.hidden);
  const venue = data.venues.find((v) => v.id === venueId) ?? data.venues[0];
  const headers = weekDates(monday).map(dayHeader);

  if (!venue) return <div className="card crew-panel"><p className="empty">Add a venue on the Venues tab to start building crews.</p></div>;

  const ready = days.length > 0 && picked.length > 0 && start !== null && end !== null && start !== end;
  const crew: Crew | null = ready ? { monday, venueId: venue.id, days, start: start!, end: end!, personIds: picked } : null;
  const replaces = crew ? countReplacements(data, crew) : 0;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <section className="card crew-panel" aria-label="Add a crew">
      <h3>Add a crew</h3>
      <div className="row">
        <select value={venue.id} onChange={(e) => setVenueId(e.target.value)} aria-label="Venue"
          className="venue-select" style={{ background: venue.color }}>
          {data.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <span className="day-toggles" role="group" aria-label="Days">
          {headers.map((h, i) => (
            <button key={h.day} type="button" className={`toggle${days.includes(i) ? ' on' : ''}`}
              aria-pressed={days.includes(i)} onClick={() => setDays(toggle(days, i).sort())}>{h.day}</button>
          ))}
        </span>
        <span className="row">
          <TimeInput label="Crew start time" value={start} onChange={setStart} />
          <span>–</span>
          <TimeInput label="Crew end time" value={end} onChange={setEnd} />
        </span>
      </div>
      <div className="row crew-people">
        {crewPeople.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked(toggle(picked, p.id))} />
            {p.name}
          </label>
        ))}
        <button type="button" className="primary crew-go" disabled={!crew}
          onClick={() => { if (crew) { update((d) => addCrew(d, crew)); setPicked([]); } }}>
          Fill {days.length * picked.length} boxes{replaces > 0 && ` (replaces ${replaces})`}
        </button>
      </div>
    </section>
  );
}

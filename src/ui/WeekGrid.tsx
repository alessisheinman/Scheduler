import { useState } from 'react';
import { getWeek, peopleForWeek, peopleWorkingWeek, setBox } from '../model/ops';
import { formatShift, formatTime } from '../model/time';
import type { AppData, Box } from '../model/types';
import { dayHeader, weekDates, type ISODate } from '../model/week';
import { BoxEditor } from './BoxEditor';

export function BoxView({ box, data }: { box: Box | null; data: AppData }) {
  if (!box) return null;
  if (box.kind === 'day') {
    return <div className="box box-day">{box.start === null ? 'Day' : `Day · ${formatTime(box.start)}`}</div>;
  }
  const venue = data.venues.find((v) => v.id === box.venueId);
  return (
    <div className={`box${venue ? '' : ' box-novenue'}`} style={venue ? { background: venue.color } : undefined}>
      {venue && <span className="box-venue">{venue.name}</span>}
      <span className="box-time">{formatShift(box.start, box.end)}</span>
    </div>
  );
}

export function WeekGrid({ data, monday, update }: {
  data: AppData;
  monday: ISODate;
  update(fn: (d: AppData) => AppData): void;
}) {
  const [open, setOpen] = useState<{ personId: string; day: number } | null>(null);
  const [lastVenue, setLastVenue] = useState<string | null>(null);
  // People added to this week by hand before they have a box (so she can click one).
  const [added, setAdded] = useState<Record<string, string[]>>({});
  const extra = added[monday] ?? [];
  const working = new Set(peopleWorkingWeek(data, monday).map((p) => p.id));
  const people = data.people.filter((p) => working.has(p.id) || extra.includes(p.id));
  const addable = peopleForWeek(data, monday).filter((p) => !people.includes(p));
  const week = getWeek(data, monday);
  const days = weekDates(monday).map(dayHeader);

  if (data.people.length === 0) return <p className="empty">No people yet. Add them on the People tab, or import the old spreadsheet.</p>;

  const addPicker = addable.length > 0 && (
    <div className="row add-to-week">
      <select value="" aria-label="Add someone to this week"
        onChange={(e) => e.target.value && setAdded({ ...added, [monday]: [...extra, e.target.value] })}>
        <option value="">+ Add someone to this week…</option>
        {addable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <span className="muted">Only people with hours show here and on the picture.</span>
    </div>
  );

  if (people.length === 0) {
    return (
      <>
        <p className="empty">No one is scheduled this week yet. Use "Add a crew" above, or add someone below.</p>
        {addPicker}
      </>
    );
  }

  return (
    <div className="grid-wrap">
      <table className="week-grid">
        <thead>
          <tr>
            <th />
            {days.map((d) => <th key={d.day}>{d.day}<span>{d.date}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.name}{p.dayRate && <small> day rate</small>}</th>
              {days.map((d, day) => {
                const box = week?.boxes[p.id]?.[day] ?? null;
                const isOpen = open?.personId === p.id && open.day === day;
                return (
                  <td key={day} className={isOpen ? 'open' : ''}>
                    <button type="button" className="cell" aria-label={`${p.name} ${d.day} ${d.date}`}
                      onClick={() => setOpen({ personId: p.id, day })}>
                      <BoxView box={box} data={data} />
                    </button>
                    {isOpen && (
                      <BoxEditor
                        person={p}
                        dayLabel={`${d.day} ${d.date}`}
                        box={box}
                        venues={data.venues}
                        defaultVenueId={lastVenue ?? data.venues[0]?.id ?? null}
                        onCancel={() => setOpen(null)}
                        onDone={(b) => {
                          if (b?.kind === 'shift') setLastVenue(b.venueId);
                          update((x) => setBox(x, monday, p.id, day, b));
                          setOpen(null);
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {addPicker}
    </div>
  );
}

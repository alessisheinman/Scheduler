import { useState } from 'react';
import { getWeek, peopleForWeek, setBox } from '../model/ops';
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
  const people = peopleForWeek(data, monday);
  const week = getWeek(data, monday);
  const days = weekDates(monday).map(dayHeader);

  if (people.length === 0) return <p className="empty">No people yet. Add them on the People tab, or import the old spreadsheet.</p>;

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
    </div>
  );
}

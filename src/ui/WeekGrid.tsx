import { useEffect, useRef, useState } from 'react';
import { cellsInRect, clearBoxes, fillBoxes, getWeek, peopleForWeek, peopleWorkingWeek, setBox, type Cell } from '../model/ops';
import { formatShift, formatTime } from '../model/time';
import type { AppData, Box } from '../model/types';
import { dayHeader, weekDates, type ISODate } from '../model/week';
import { BoxEditor } from './BoxEditor';
import { MultiEditor } from './MultiEditor';

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

const key = (c: Cell) => `${c.personId}|${c.day}`;

/**
 * The week. Click a box, or drag across days and people, to pick boxes; one editor then fills them all.
 * Ctrl/Cmd-click adds boxes that aren't next to each other. Only people on this week get a row.
 */
export function WeekGrid({ data, monday, update }: {
  data: AppData;
  monday: ISODate;
  update(fn: (d: AppData) => AppData): void;
}) {
  const [picked, setPicked] = useState<Cell[]>([]);
  const [editorAt, setEditorAt] = useState<Cell | null>(null);
  const [lastVenue, setLastVenue] = useState<string | null>(null);
  // People added to this week by hand before they have a box.
  const [added, setAdded] = useState<Record<string, string[]>>({});
  const drag = useRef<{ anchor: { row: number; day: number }; last: Cell } | null>(null);

  const extra = added[monday] ?? [];
  const working = new Set(peopleWorkingWeek(data, monday).map((p) => p.id));
  const people = data.people.filter((p) => working.has(p.id) || extra.includes(p.id));
  const rowIds = people.map((p) => p.id);
  const addable = peopleForWeek(data, monday).filter((p) => !rowIds.includes(p.id));
  const week = getWeek(data, monday);
  const days = weekDates(monday).map(dayHeader);
  const pickedKeys = new Set(picked.map(key));

  // Changing weeks drops any half-made selection.
  useEffect(() => { setPicked([]); setEditorAt(null); }, [monday]);

  // Finish a drag wherever the mouse is released.
  useEffect(() => {
    const up = () => {
      if (!drag.current) return;
      setEditorAt(drag.current.last);
      drag.current = null;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const close = () => { setPicked([]); setEditorAt(null); };

  function down(e: React.MouseEvent, row: number, day: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    const cell = { personId: rowIds[row], day };
    if (e.ctrlKey || e.metaKey) {
      const next = pickedKeys.has(key(cell)) ? picked.filter((c) => key(c) !== key(cell)) : [...picked, cell];
      setPicked(next);
      setEditorAt(next.length ? next[next.length - 1] : null);
      return;
    }
    drag.current = { anchor: { row, day }, last: cell };
    setPicked([cell]);
    setEditorAt(null);
  }

  function enter(row: number, day: number) {
    if (!drag.current) return;
    drag.current.last = { personId: rowIds[row], day };
    setPicked(cellsInRect(rowIds, drag.current.anchor, { row, day }));
  }

  const chips = addable.length > 0 && (
    <div className="people-chips" aria-label="Add people to this week">
      <span className="muted">Add to this week:</span>
      {addable.map((p) => (
        <button key={p.id} type="button" className="chip" onClick={() => setAdded({ ...added, [monday]: [...extra, p.id] })}>
          + {p.name}
        </button>
      ))}
    </div>
  );

  if (data.people.length === 0) return <p className="empty">No people yet. Add them on the People tab, or import the old spreadsheet.</p>;

  const editor = (cell: Cell) => {
    if (!editorAt || key(editorAt) !== key(cell) || picked.length === 0) return null;
    if (picked.length === 1) {
      const p = data.people.find((x) => x.id === picked[0].personId)!;
      const d = days[picked[0].day];
      return (
        <BoxEditor
          person={p}
          dayLabel={`${d.day} ${d.date}`}
          box={week?.boxes[p.id]?.[picked[0].day] ?? null}
          venues={data.venues}
          defaultVenueId={lastVenue ?? data.venues[0]?.id ?? null}
          onCancel={close}
          onDone={(b) => {
            if (b?.kind === 'shift') setLastVenue(b.venueId);
            update((x) => setBox(x, monday, p.id, picked[0].day, b));
            close();
          }}
        />
      );
    }
    return (
      <MultiEditor
        data={data}
        monday={monday}
        cells={picked}
        defaultVenueId={lastVenue ?? data.venues[0]?.id ?? null}
        onCancel={close}
        onClear={() => { update((x) => clearBoxes(x, monday, picked)); close(); }}
        onFill={(fill) => {
          setLastVenue(fill.venueId);
          update((x) => fillBoxes(x, monday, picked, fill));
          close();
        }}
      />
    );
  };

  return (
    <div className="grid-wrap">
      {chips}
      {people.length === 0 ? (
        <p className="empty">No one is on this week yet. Click a name above to add them, then click or drag across their days.</p>
      ) : (
        <>
          <p className="hint grid-hint">Click a box, or drag across days and people, to fill them. Ctrl-click to pick boxes that aren't next to each other.</p>
          <table className="week-grid">
            <thead>
              <tr>
                <th />
                {days.map((d) => <th key={d.day}>{d.day}<span>{d.date}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {people.map((p, row) => (
                <tr key={p.id}>
                  <th scope="row">
                    {p.name}{p.dayRate && <small> day rate</small>}
                    {!working.has(p.id) && (
                      <button type="button" className="icon ghost row-remove" aria-label={`Take ${p.name} off this week`}
                        onClick={() => setAdded({ ...added, [monday]: extra.filter((x) => x !== p.id) })}>×</button>
                    )}
                  </th>
                  {days.map((d, day) => {
                    const cell = { personId: p.id, day };
                    const box = week?.boxes[p.id]?.[day] ?? null;
                    return (
                      <td key={day} className={pickedKeys.has(key(cell)) ? 'picked' : ''}>
                        <button type="button" className="cell" aria-label={`${p.name} ${d.day} ${d.date}`}
                          onMouseDown={(e) => down(e, row, day)}
                          onMouseEnter={() => enter(row, day)}
                          onClick={(e) => { if (e.detail === 0) { setPicked([cell]); setEditorAt(cell); } }}>
                          <BoxView box={box} data={data} />
                        </button>
                        {editor(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

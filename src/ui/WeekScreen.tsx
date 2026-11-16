import { useState } from 'react';
import { peopleForWeek, startNextWeek } from '../model/ops';
import { addDays, mondayOf, weekLabel, type ISODate } from '../model/week';
import { AddCrewPanel } from './AddCrewPanel';
import { HoursPanel } from './HoursPanel';
import type { AppState } from './useAppData';
import { WeekGrid } from './WeekGrid';

const today = (): ISODate => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export function defaultMonday(app: AppState): ISODate {
  const weeks = app.data.weeks;
  return weeks.length ? weeks[weeks.length - 1].monday : mondayOf(today());
}

export function WeekScreen({ app, monday, setMonday, onPayday, onSaveImage, onImport }: {
  app: AppState;
  monday: ISODate;
  setMonday(m: ISODate): void;
  onPayday(): void;
  onSaveImage(): void;
  onImport(): void;
}) {
  const { data, update } = app;
  const [asking, setAsking] = useState(false);
  const people = peopleForWeek(data, monday);
  const nextExists = data.weeks.some((w) => w.monday === addDays(monday, 7));

  function next(copy: boolean) {
    const r = startNextWeek(data, monday, copy);
    app.replaceAll(r.data);
    setMonday(r.monday);
    setAsking(false);
  }

  return (
    <div className="week-screen">
      {data.weeks.length === 0 && (
        <div className="notice row">
          <span>Starting out? Bring in all the old weeks from the spreadsheet.</span>
          <button type="button" className="primary" onClick={onImport}>Import spreadsheet…</button>
        </div>
      )}
      <div className="week-head">
        <div className="week-nav">
          <button type="button" className="icon" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>◀</button>
          <h2>{weekLabel(monday)}</h2>
          <button type="button" className="icon" aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))}>▶</button>
        </div>
        <div className="row">
          {nextExists ? (
            <button type="button" onClick={() => setMonday(addDays(monday, 7))}>Go to next week</button>
          ) : asking ? (
            <span className="row ask">
              Next week:
              <button type="button" className="primary" onClick={() => next(true)}>Copy all boxes</button>
              <button type="button" onClick={() => next(false)}>Just the people</button>
              <button type="button" className="ghost" onClick={() => setAsking(false)}>Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setAsking(true)}>Start next week from this one</button>
          )}
          <button type="button" onClick={onPayday}>Payday totals</button>
          <button type="button" className="primary" onClick={onSaveImage}>Save image</button>
        </div>
      </div>

      <AddCrewPanel data={data} monday={monday} people={people} update={update} />

      <div className="week-body">
        <div className="card grid-card">
          <WeekGrid data={data} monday={monday} update={update} />
        </div>
        <HoursPanel data={data} monday={monday} />
      </div>
    </div>
  );
}

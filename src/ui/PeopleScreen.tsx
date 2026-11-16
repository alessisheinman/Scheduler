import { useState } from 'react';
import { addPerson, movePerson, updatePerson } from '../model/ops';
import type { AppState } from './useAppData';

export function PeopleScreen({ app }: { app: AppState }) {
  const { data, update } = app;
  const [name, setName] = useState('');
  const [dayRate, setDayRate] = useState(false);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    update((d) => addPerson(d, n, dayRate));
    setName('');
    setDayRate(false);
  }

  return (
    <div className="page-narrow">
      <div className="card">
        <h2>People</h2>
        <p className="hint">This order is the order on the schedule and the picture. Hidden people keep their past hours.</p>
        <form className="row add-row" onSubmit={add}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New person's name" />
          <label className="check"><input type="checkbox" checked={dayRate} onChange={(e) => setDayRate(e.target.checked)} /> Paid by the day</label>
          <button type="submit" className="primary" disabled={!name.trim()}>Add person</button>
        </form>
        {data.people.length === 0 && <p className="empty">No one yet — add people here or import the old spreadsheet.</p>}
        <ul className="plain-list">
          {data.people.map((p, i) => (
            <li key={p.id} className={p.hidden ? 'is-hidden' : ''}>
              <span className="order">
                <button type="button" className="icon" aria-label={`Move ${p.name} up`} disabled={i === 0}
                  onClick={() => update((d) => movePerson(d, p.id, i - 1))}>↑</button>
                <button type="button" className="icon" aria-label={`Move ${p.name} down`} disabled={i === data.people.length - 1}
                  onClick={() => update((d) => movePerson(d, p.id, i + 1))}>↓</button>
              </span>
              <input className="grow" value={p.name} aria-label="Name"
                onChange={(e) => update((d) => updatePerson(d, p.id, { name: e.target.value }))} />
              <label className="check"><input type="checkbox" checked={p.dayRate}
                onChange={(e) => update((d) => updatePerson(d, p.id, { dayRate: e.target.checked }))} /> Paid by the day</label>
              <button type="button" onClick={() => update((d) => updatePerson(d, p.id, { hidden: !p.hidden }))}>
                {p.hidden ? 'Show' : 'Hide'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

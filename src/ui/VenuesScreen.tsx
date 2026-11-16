import { useState } from 'react';
import { addVenue, deleteVenue, updateVenue, venueInUse } from '../model/ops';
import { VENUE_PALETTE } from '../model/palette';
import type { AppState } from './useAppData';

export function VenuesScreen({ app }: { app: AppState }) {
  const { data, update } = app;
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim().toUpperCase();
    if (!n) return;
    update((d) => addVenue(d, n));
    setName('');
  }

  return (
    <div className="page-narrow">
      <div className="card">
        <h2>Venues</h2>
        <p className="hint">Each venue keeps its color, so workers learn it. Venues on the schedule can be renamed but not deleted.</p>
        <form className="row add-row" onSubmit={add}>
          <input placeholder="Venue name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New venue name" />
          <button type="submit" className="primary" disabled={!name.trim()}>Add venue</button>
        </form>
        {data.venues.length === 0 && <p className="empty">No venues yet.</p>}
        <ul className="plain-list">
          {data.venues.map((v) => {
            const used = venueInUse(data, v.id);
            return (
              <li key={v.id}>
                <button type="button" className="swatch" style={{ background: v.color }} aria-label={`Change ${v.name}'s color`}
                  onClick={() => setPicking(picking === v.id ? null : v.id)} />
                <input className="grow venue-name" value={v.name} aria-label="Venue name" style={{ background: v.color }}
                  onChange={(e) => update((d) => updateVenue(d, v.id, { name: e.target.value.toUpperCase() }))} />
                <button type="button" className="remove" disabled={used} title={used ? 'Used in the schedule' : undefined}
                  onClick={() => update((d) => deleteVenue(d, v.id))}>Delete</button>
                {picking === v.id && (
                  <div className="palette">
                    {VENUE_PALETTE.map((c) => (
                      <button key={c} type="button" className={`swatch${c === v.color ? ' on' : ''}`} style={{ background: c }}
                        aria-label={`Use color ${c}`} onClick={() => { update((d) => updateVenue(d, v.id, { color: c })); setPicking(null); }} />
                    ))}
                    <label className="check">Other: <input type="color" value={v.color}
                      onChange={(e) => update((d) => updateVenue(d, v.id, { color: e.target.value }))} /></label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

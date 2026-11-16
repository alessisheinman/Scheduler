import { useState } from 'react';
import { defaultPaydayWeek, periodTotals, rangeTotals, type PersonTotal } from '../model/payroll';
import { formatHours } from '../model/time';
import { addDays, mondayOf, todayISO, type ISODate } from '../model/week';
import { downloadPayday } from './exportPayday';
import type { AppState } from './useAppData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 9 – 15, 2026", "Oct 26 – Nov 1, 2026", "Dec 28, 2026 – Jan 3, 2027". */
function datesLabel(first: ISODate, last: ISODate): string {
  const [ay, am, ad] = first.split('-').map(Number);
  const [by, bm, bd] = last.split('-').map(Number);
  if (first === last) return `${MONTHS[am - 1]} ${ad}, ${ay}`;
  const a = `${MONTHS[am - 1]} ${ad}${ay !== by ? `, ${ay}` : ''}`;
  return `${a} – ${am === bm && ay === by ? bd : `${MONTHS[bm - 1]} ${bd}`}, ${by}`;
}

const isMonday = (d: ISODate) => mondayOf(d) === d;

export function PaydayScreen({ app }: { app: AppState }) {
  const { data } = app;
  const mondays = data.weeks.map((w) => w.monday).reverse();
  const start0 = defaultPaydayWeek(mondays, todayISO());
  const [mode, setMode] = useState<'weeks' | 'days'>('weeks');
  const [picked, setPicked] = useState<ISODate[] | null>(null);
  const [from, setFrom] = useState<ISODate | null>(null);
  const [to, setTo] = useState<ISODate | null>(null);

  if (!start0) return <div className="card page-narrow"><h2>Payday</h2><p className="empty">No weeks yet.</p></div>;

  const weeks = (picked ?? [start0]).slice().sort();
  const dayFrom = from ?? start0;
  const dayTo = to ?? addDays(start0, 6);
  const badRange = mode === 'days' && dayTo < dayFrom;

  let rows: PersonTotal[] = [];
  let label = '';
  let first = dayFrom;
  if (mode === 'weeks') {
    rows = weeks.length ? periodTotals(data, weeks) : [];
    first = weeks[0] ?? start0;
    const consecutive = weeks.every((w, i) => i === 0 || w === addDays(weeks[i - 1], 7));
    label = weeks.length === 0 ? 'no weeks picked'
      : datesLabel(weeks[0], addDays(weeks[weeks.length - 1], 6)) + (consecutive ? '' : ` (${weeks.length} weeks)`);
  } else if (!badRange) {
    rows = rangeTotals(data, dayFrom, dayTo);
    label = datesLabel(dayFrom, dayTo);
  }
  const splitsWeek = mode === 'days' && !badRange && (!isMonday(dayFrom) || !isMonday(addDays(dayTo, 1)));
  const person = (id: string) => data.people.find((p) => p.id === id)!;
  const toggle = (m: ISODate) => setPicked(weeks.includes(m) ? weeks.filter((w) => w !== m) : [...weeks, m]);

  return (
    <div className="page-narrow payday">
      <div className="card">
        <div className="no-print">
          <div className="row payday-controls">
            <span className="seg" role="group" aria-label="Pay by">
              <button type="button" className={mode === 'weeks' ? 'on' : ''} aria-pressed={mode === 'weeks'} onClick={() => setMode('weeks')}>Weeks</button>
              <button type="button" className={mode === 'days' ? 'on' : ''} aria-pressed={mode === 'days'} onClick={() => setMode('days')}>Days</button>
            </span>
            <span className="row payday-actions">
              <button type="button" onClick={() => window.print()}>Print</button>
              <button type="button" className="primary" disabled={rows.length === 0}
                onClick={() => void downloadPayday(rows, data.people, `Payday ${label}`, `payday-${first}.xlsx`)}>Download spreadsheet</button>
            </span>
          </div>
          {mode === 'weeks' ? (
            <div className="week-picks" role="group" aria-label="Weeks to pay">
              {mondays.slice(0, 16).map((m) => (
                <button key={m} type="button" className={`chip${weeks.includes(m) ? ' on' : ''}`} aria-pressed={weeks.includes(m)} onClick={() => toggle(m)}>
                  {datesLabel(m, addDays(m, 6))}
                </button>
              ))}
            </div>
          ) : (
            <div className="row">
              <label className="field"><span>From</span>
                <input type="date" value={dayFrom} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
              <label className="field"><span>To</span>
                <input type="date" value={dayTo} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
            </div>
          )}
        </div>

        <h2>Payday · {label}</h2>
        {badRange && <p className="error">The end date is before the start date.</p>}
        <p className="hint">
          Overtime is hours over 40 in each Monday–Sunday week.
          {splitsWeek && ' These dates cut into a week: that whole week counts toward 40, and only the overtime that falls inside these dates is shown.'}
        </p>
        {rows.length === 0 ? <p className="empty">No one worked in this period.</p> : (
          <table className="payday-table">
            <thead>
              <tr><th>Name</th><th>Total hours</th><th>Regular</th><th>Overtime</th><th>Days</th></tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const showHours = t.hours > 0 || t.days === 0;
                return (
                  <tr key={t.personId}>
                    <td>{person(t.personId).name}</td>
                    <td>{showHours ? <b>{formatHours(t.hours)}</b> : '—'}</td>
                    <td>{showHours ? formatHours(t.regular) : '—'}</td>
                    <td className={t.overtime > 0 ? 'ot' : ''}>{showHours ? formatHours(t.overtime) : '—'}</td>
                    <td>{t.days > 0 ? <b>{t.days}</b> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

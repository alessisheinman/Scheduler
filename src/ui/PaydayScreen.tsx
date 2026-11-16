import { useState } from 'react';
import { defaultPaydayWeek, periodTotals } from '../model/payroll';
import { formatHours } from '../model/time';
import { addDays, todayISO, weekLabel, type ISODate } from '../model/week';
import { downloadPayday } from './exportPayday';
import type { AppState } from './useAppData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function periodLabel(first: ISODate, last: ISODate): string {
  if (first === last) return weekLabel(first).replace('Week of ', '');
  const [ay, am, ad] = first.split('-').map(Number);
  const [by, bm, bd] = addDays(last, 6).split('-').map(Number);
  const a = `${MONTHS[am - 1]} ${ad}${ay !== by ? `, ${ay}` : ''}`;
  return `${a} – ${am === bm && ay === by ? bd : `${MONTHS[bm - 1]} ${bd}`}, ${by}`;
}

export function PaydayScreen({ app }: { app: AppState }) {
  const { data } = app;
  const mondays = data.weeks.map((w) => w.monday).reverse();
  const [pick, setPick] = useState<ISODate | null>(null);
  const [twoWeeks, setTwoWeeks] = useState(false);
  const last = pick ?? defaultPaydayWeek(mondays, todayISO());

  if (!last) return <div className="card page-narrow"><h2>Payday</h2><p className="empty">No weeks yet.</p></div>;

  const first = twoWeeks ? addDays(last, -7) : last;
  const period = twoWeeks ? [first, last] : [last];
  const rows = periodTotals(data, period);
  const label = periodLabel(first, last);
  const person = (id: string) => data.people.find((p) => p.id === id)!;

  return (
    <div className="page-narrow payday">
      <div className="card">
        <div className="row no-print payday-controls">
          <label className="field">
            <span>Pay period ends with</span>
            <select value={last} onChange={(e) => setPick(e.target.value)}>
              {mondays.map((m) => <option key={m} value={m}>{weekLabel(m)}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={twoWeeks} onChange={(e) => setTwoWeeks(e.target.checked)} /> Add the week before (2 weeks)</label>
          <span className="row payday-actions">
            <button type="button" onClick={() => window.print()}>Print</button>
            <button type="button" className="primary"
              onClick={() => void downloadPayday(rows, data.people, `Payday ${label}`, `payday-${first}.xlsx`)}>Download spreadsheet</button>
          </span>
        </div>
        <h2>Payday · {label}</h2>
        <p className="hint">Overtime is hours over 40 in each Monday–Sunday week{twoWeeks ? ', worked out week by week and added up' : ''}.</p>
        {rows.length === 0 ? <p className="empty">No one worked in this period.</p> : (
          <table className="payday-table">
            <thead>
              <tr><th>Name</th><th>Total hours</th><th>Regular</th><th>Overtime</th><th>Days</th></tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const p = person(t.personId);
                const showHours = t.hours > 0 || t.days === 0;
                return (
                  <tr key={t.personId}>
                    <td>{p.name}</td>
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

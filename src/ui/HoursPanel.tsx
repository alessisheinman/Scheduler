import { peopleForWeek } from '../model/ops';
import { weekTotals } from '../model/payroll';
import { formatHours } from '../model/time';
import type { AppData } from '../model/types';
import type { ISODate } from '../model/week';

/** Her view only — never part of the picture sent to workers. */
export function HoursPanel({ data, monday }: { data: AppData; monday: ISODate }) {
  const totals = weekTotals(data, monday);
  const rows = peopleForWeek(data, monday).filter((p) => totals.has(p.id));
  return (
    <aside className="hours-panel card">
      <h3>This week's hours</h3>
      {rows.length === 0 && <p className="empty">Nothing scheduled yet.</p>}
      <ul>
        {rows.map((p) => {
          const t = totals.get(p.id)!;
          return (
            <li key={p.id}>
              <span>{p.name}</span>
              {p.dayRate ? (
                <b>{t.days} {t.days === 1 ? 'day' : 'days'}</b>
              ) : (
                <b className={t.overtime > 0 ? 'ot' : ''}>
                  {formatHours(t.hours)}{t.overtime > 0 && ` · ${formatHours(t.overtime)} OT`}
                </b>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

import { useMemo, useState } from 'react';
import { analyze, type ImportDraft, type Issue } from '../import/analyze';
import { buildData, defaultAnswers, type FixBox, type ImportAnswers } from '../import/build';
import { readWorkbook, type RawWorkbook } from '../import/readWorkbook';
import { parseShift, type Minutes } from '../model/time';
import { TimeInput } from './TimeInput';
import type { AppState } from './useAppData';

const DAY = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const STEPS = ['Choose file', 'People', 'Venues', 'Colors', 'Boxes to check', 'Import'] as const;

/** A look-alike group. Only the ticked members merge, and only when two or more are ticked. */
interface Group { members: string[]; picked: string[]; name: string }
const merging = (g: Group) => g.picked.length >= 2;

/** Turns merge groups plus one-off renames into a name → final name map. */
function mergeMap(groups: Group[], renames: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [from, to] of Object.entries(renames)) {
    const t = to.trim().toUpperCase();
    if (t && t !== from) out[from] = t;
  }
  for (const g of groups) {
    if (!merging(g)) continue;
    const t = g.name.trim().toUpperCase();
    for (const m of g.picked) if (m !== t) out[m] = t;
  }
  return out;
}

export function ImportWizard({ app, onDone }: { app: AppState; onDone(): void }) {
  const [step, setStep] = useState(0);
  const [raw, setRaw] = useState<RawWorkbook | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [answers, setAnswers] = useState<ImportAnswers | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameGroups, setNameGroups] = useState<Group[]>([]);
  const [nameRenames, setNameRenames] = useState<Record<string, string>>({});
  const [venueGroups, setVenueGroups] = useState<Group[]>([]);
  const [venueRenames, setVenueRenames] = useState<Record<string, string>>({});

  async function open(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy('Reading the spreadsheet… (it stays on this computer)');
    try {
      const r = await readWorkbook(await file.arrayBuffer());
      const d = analyze(r);
      setRaw(r);
      setDraft(d);
      setAnswers(defaultAnswers(d));
      const count = (n: string) => d.names.find((x) => x.name === n)?.count ?? 0;
      setNameGroups(d.mergeSuggestions.map((m) => ({ members: [...m].sort((a, b) => count(b) - count(a)), picked: [], name: '' })));
      setVenueGroups(d.venueMergeSuggestions.map((m) => ({ members: [...m].sort((a, b) => b.length - a.length), picked: [], name: '' })));
      setStep(1);
    } catch (e) {
      setError(`Couldn't read that file: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const merges = useMemo(() => mergeMap(nameGroups, nameRenames), [nameGroups, nameRenames]);
  const venueNames = useMemo(() => mergeMap(venueGroups, venueRenames), [venueGroups, venueRenames]);
  const finalNames = useMemo(
    () => (draft ? [...new Set(draft.names.map((n) => merges[n.name] ?? n.name))].sort() : []),
    [draft, merges],
  );
  const full = useMemo<ImportAnswers | null>(() => {
    if (!answers || !draft) return null;
    // Day-rate is chosen per final name; a merged person is day-rate if any of their old names was.
    const dayRate: Record<string, boolean> = {};
    for (const n of draft.names) {
      const f = merges[n.name] ?? n.name;
      dayRate[f] = answers.dayRate[f] ?? (dayRate[f] || n.dayRateLikely);
    }
    return { ...answers, merges, venueNames, dayRate };
  }, [answers, draft, merges, venueNames]);
  const preview = useMemo(() => (raw && draft && full && step === 5 ? buildData(raw, draft, full) : null), [raw, draft, full, step]);

  if (busy) return <div className="card page-narrow"><p>{busy}</p></div>;

  const set = (patch: Partial<ImportAnswers>) => setAnswers((a) => (a ? { ...a, ...patch } : a));
  const nav = (
    <div className="row wizard-nav">
      {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Back</button>}
      <span className="grow" />
      {step > 0 && step < 5 && <button type="button" className="primary" onClick={() => setStep(step + 1)}>Next</button>}
    </div>
  );

  return (
    <div className="page-wide wizard">
      <ol className="wizard-steps">
        {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</li>)}
      </ol>

      {step === 0 && (
        <div className="card">
          <h2>Import the old schedule spreadsheet</h2>
          <p>Pick the Excel file with all the weekly tabs. It's read right here in the browser and never uploaded anywhere.</p>
          <input type="file" accept=".xlsx" onChange={(e) => void open(e.target.files?.[0])} />
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {step === 1 && draft && full && (
        <div className="card">
          <h2>People</h2>
          <p className="hint">These names look alike. Tick the ones that are the same person (two or more), then pick the name to keep. Nothing merges unless you tick it.</p>
          <GroupList groups={nameGroups} setGroups={setNameGroups} />
          <h3>Everyone ({finalNames.length})</h3>
          <p className="hint">Type a different name to rename someone — typing another person's name merges them. Tick "Paid by the day" for day-rate workers.</p>
          <ul className="plain-list two-col">
            {draft.names.filter((n) => !nameGroups.some((g) => merging(g) && g.picked.includes(n.name))).map((n) => {
              const final = merges[n.name] ?? n.name;
              return (
                <li key={n.name}>
                  <input value={nameRenames[n.name] ?? n.name} aria-label={`Name for ${n.name}`}
                    onChange={(e) => setNameRenames({ ...nameRenames, [n.name]: e.target.value })} />
                  <small className="muted">{n.count} boxes</small>
                  <label className="check"><input type="checkbox" checked={!!full.dayRate[final]}
                    onChange={(e) => set({ dayRate: { ...answers!.dayRate, [final]: e.target.checked } })} /> Paid by the day</label>
                </li>
              );
            })}
            {nameGroups.filter(merging).map((g) => {
              const final = g.name.trim().toUpperCase();
              return (
                <li key={g.members.join()}>
                  <b>{final}</b><small className="muted">merged from {g.picked.join(', ')}</small>
                  <label className="check"><input type="checkbox" checked={!!full.dayRate[final]}
                    onChange={(e) => set({ dayRate: { ...answers!.dayRate, [final]: e.target.checked } })} /> Paid by the day</label>
                </li>
              );
            })}
          </ul>
          {nav}
        </div>
      )}

      {step === 2 && draft && (
        <div className="card">
          <h2>Venues</h2>
          <p className="hint">These venue names look alike. Tick the ones that are the same place, then pick the name to keep. Each venue gets one color from now on.</p>
          <GroupList groups={venueGroups} setGroups={setVenueGroups} />
          <h3>All venues</h3>
          <p className="hint">Type a different name to rename — typing another venue's name merges them.</p>
          <ul className="plain-list two-col">
            {draft.venues.filter((v) => !venueGroups.some((g) => merging(g) && g.picked.includes(v))).map((v) => (
              <li key={v}>
                <input value={venueRenames[v] ?? v} aria-label={`Name for ${v}`}
                  onChange={(e) => setVenueRenames({ ...venueRenames, [v]: e.target.value })} />
              </li>
            ))}
          </ul>
          {nav}
        </div>
      )}

      {step === 3 && draft && answers && (
        <ColorStep draft={draft} answers={answers} set={set} nav={nav} />
      )}

      {step === 4 && draft && full && (
        <BoxesStep draft={draft} answers={full} set={set} finalName={(n) => merges[n] ?? n} nav={nav} />
      )}

      {step === 5 && preview && (
        <div className="card">
          <h2>Ready to import</h2>
          <ul>
            <li><b>{preview.weeks.length}</b> weeks</li>
            <li><b>{preview.people.length}</b> people ({preview.people.filter((p) => p.hidden).length} hidden because they haven't worked in the last 8 weeks)</li>
            <li><b>{preview.venues.length}</b> venues</li>
            <li><b>{preview.weeks.reduce((s, w) => s + Object.values(w.boxes).flat().filter(Boolean).length, 0)}</b> boxes</li>
          </ul>
          <div className="row wizard-nav">
            <button type="button" onClick={() => setStep(4)}>Back</button>
            <span className="grow" />
            <button type="button" className="primary" onClick={() => { app.replaceAll(preview); onDone(); }}>
              {app.data.weeks.length > 0 ? 'Replace everything and import' : 'Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupList({ groups, setGroups }: { groups: Group[]; setGroups(g: Group[]): void }) {
  if (groups.length === 0) return <p className="empty">No look-alikes found.</p>;
  const patch = (i: number, p: Partial<Group>) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...p } : g)));
  const toggle = (i: number, m: string, on: boolean) => {
    const g = groups[i];
    const picked = g.members.filter((x) => (x === m ? on : g.picked.includes(x)));
    // Keep a typed name; otherwise suggest the first ticked one (members are listed most-used first).
    const name = g.name && picked.includes(g.name) ? g.name : picked[0] ?? '';
    patch(i, { picked, name: g.name && !g.members.includes(g.name) ? g.name : name });
  };
  return (
    <ul className="plain-list">
      {groups.map((g, i) => (
        <li key={g.members.join()}>
          {g.members.map((m) => (
            <label key={m} className="check"><input type="checkbox" checked={g.picked.includes(m)}
              onChange={(e) => toggle(i, m, e.target.checked)} /> {m}</label>
          ))}
          {merging(g) && <>→ same one, keep the name <input value={g.name} aria-label="Name to keep" onChange={(e) => patch(i, { name: e.target.value })} /></>}
        </li>
      ))}
    </ul>
  );
}

function ColorStep({ draft, answers, set, nav }: {
  draft: ImportDraft; answers: ImportAnswers; set(p: Partial<ImportAnswers>): void; nav: React.ReactNode;
}) {
  const ask = draft.colorQuestions.filter((q) => !q.confident);
  const matched = draft.colorQuestions.filter((q) => q.confident);
  const row = (q: ImportDraft['colorQuestions'][number]) => {
    const options = [...new Set([...q.legendVenues, ...draft.venues])];
    const value = answers.colorVenue[q.key];
    return (
      <li key={q.key}>
        <span className="swatch" style={{ background: q.hex }} aria-hidden="true" />
        <span className="grow"><b>{q.tab}</b> · {q.count} {q.count === 1 ? 'box' : 'boxes'}
          <small className="muted"> · that week's key: {q.legendVenues.join(', ') || 'none'}</small></span>
        <select value={value ?? ''} aria-label={`Venue for this color on ${q.tab}`}
          onChange={(e) => set({ colorVenue: { ...answers.colorVenue, [q.key]: e.target.value || null } })}>
          <option value="">No venue</option>
          {options.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        {!q.confident && q.suggestion && value !== q.suggestion && (
          <button type="button" onClick={() => set({ colorVenue: { ...answers.colorVenue, [q.key]: q.suggestion } })}>Use {q.suggestion}?</button>
        )}
      </li>
    );
  };
  return (
    <div className="card">
      <h2>Colors</h2>
      <p className="hint">Some boxes use a color that isn't in that week's color key. Pick the venue for each one, or leave "No venue".</p>
      {ask.length === 0 ? <p className="empty">Nothing to answer.</p> : <ul className="plain-list">{ask.map(row)}</ul>}
      {matched.length > 0 && (
        <details>
          <summary>{matched.length} more were matched to the closest color in that week's key — open to check them</summary>
          <ul className="plain-list">{matched.map(row)}</ul>
        </details>
      )}
      {nav}
    </div>
  );
}

function FixRow({ issue, venues, current, onSet }: {
  issue: Issue; venues: string[]; current: FixBox | 'skip' | undefined; onSet(f: FixBox | 'skip' | undefined): void;
}) {
  // Prefill times only when both sides say AM or PM; "5:30-9PM" could be morning or evening.
  const first = issue.text?.split(' / ')[0].trim() ?? '';
  const sides = first.split('-');
  const guess = sides.length === 2 && sides.every((x) => /[ap]/i.test(x)) ? parseShift(first, { lenient: true }) : null;
  const [venue, setVenue] = useState<string | null>(current && current !== 'skip' && current.kind === 'shift' ? current.venue : issue.venue ?? null);
  const [start, setStart] = useState<Minutes | null>(current && current !== 'skip' ? current.start : guess?.start ?? null);
  const [end, setEnd] = useState<Minutes | null>(current && current !== 'skip' && current.kind === 'shift' ? current.end : guess?.end ?? null);
  const ok = start !== null && end !== null && start !== end;
  return (
    <li className={current ? 'resolved' : ''}>
      <span className="grow"><b>{issue.name}</b> · {DAY[issue.day ?? 0]} · {issue.tab}
        {issue.text && <> · <code>{issue.text}</code></>}</span>
      <select value={venue ?? ''} onChange={(e) => setVenue(e.target.value || null)} aria-label="Venue">
        <option value="">No venue</option>
        {venues.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <TimeInput label="Start" value={start} onChange={setStart} />–<TimeInput label="End" value={end} onChange={setEnd} />
      <button type="button" disabled={!ok} onClick={() => onSet({ kind: 'shift', venue, start: start!, end: end! })}>Use</button>
      <button type="button" className="ghost" onClick={() => onSet('skip')}>Skip</button>
      {current && <span className="muted">{current === 'skip' ? 'skipped' : 'fixed ✓'}</span>}
    </li>
  );
}

function BoxesStep({ draft, answers, set, finalName, nav }: {
  draft: ImportDraft; answers: ImportAnswers; set(p: Partial<ImportAnswers>): void; finalName(n: string): string; nav: React.ReactNode;
}) {
  const fixable = draft.issues.filter((i) => i.kind === 'unreadable' && i.name !== undefined || i.kind === 'two-boxes-one-day');
  const dupes = draft.issues.filter((i) => i.kind === 'duplicate-week');
  const notes = draft.issues.filter((i) => i.kind === 'no-name-row' || (i.kind === 'unreadable' && i.name === undefined));
  const blanks = new Map<string, number>();
  for (const i of draft.issues) if (i.kind === 'colored-empty') blanks.set(finalName(i.name!), (blanks.get(finalName(i.name!)) ?? 0) + 1);
  const left = fixable.filter((i) => !answers.fixes[i.id]).length;
  const setFix = (id: string, f: FixBox | 'skip' | undefined) => {
    const fixes = { ...answers.fixes };
    if (f === undefined) delete fixes[id]; else fixes[id] = f;
    set({ fixes });
  };

  return (
    <div className="card">
      <h2>Boxes to check</h2>
      <p className="hint">Anything not fixed here is left out of the import (it never counts as hours).</p>

      {fixable.length > 0 && (
        <section>
          <h3>Boxes the program couldn't read ({left} left)</h3>
          <ul className="plain-list">
            {fixable.map((i) => <FixRow key={i.id} issue={i} venues={draft.venues} current={answers.fixes[i.id]} onSet={(f) => setFix(i.id, f)} />)}
          </ul>
          {left > 0 && <button type="button" onClick={() => set({ fixes: { ...Object.fromEntries(fixable.map((i) => [i.id, 'skip' as const])), ...answers.fixes } })}>Skip the {left} left</button>}
        </section>
      )}

      {blanks.size > 0 && (
        <section>
          <h3>Colored boxes with no hours</h3>
          <p className="hint">Skipped unless you say otherwise. For someone paid by the day, they can count as days worked.</p>
          <ul className="plain-list">
            {[...blanks].sort((a, b) => b[1] - a[1]).map(([name, n]) => (
              <li key={name}>
                <span className="grow"><b>{name}</b> · {n} {n === 1 ? 'box' : 'boxes'}</span>
                {answers.dayRate[name] ? (
                  <label className="check"><input type="checkbox" checked={answers.coloredEmptyAsDaysFor.includes(name)}
                    onChange={(e) => set({ coloredEmptyAsDaysFor: e.target.checked
                      ? [...answers.coloredEmptyAsDaysFor, name]
                      : answers.coloredEmptyAsDaysFor.filter((x) => x !== name) })} /> Count as days worked</label>
                ) : <span className="muted">skipped</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dupes.map((i) => (
        <section key={i.id}>
          <h3>Two tabs for the same week</h3>
          <p className="hint">Only one can be kept.</p>
          {i.text!.split(' and ').map((t) => (
            <label key={t} className="check"><input type="radio" name={i.id} checked={(answers.duplicateWeekKeep[i.id] ?? i.tab) === t}
              onChange={() => set({ duplicateWeekKeep: { ...answers.duplicateWeekKeep, [i.id]: t } })} /> Keep "{t}"</label>
          ))}
        </section>
      ))}

      {notes.length > 0 && (
        <details>
          <summary>{notes.length} rows were left out (no name, or no dates on the tab)</summary>
          <ul>{notes.map((i) => <li key={i.id}>{i.tab}: {i.text}</li>)}</ul>
        </details>
      )}
      {nav}
    </div>
  );
}

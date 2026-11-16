# Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static GitHub Pages site where the catering owner builds each week's staff schedule (crews per venue, editable hours), gets payday totals with weekly overtime, saves a clean schedule image to text to workers, and imports her old Excel workbook once.

**Architecture:** Vite + React + TypeScript single-page app, no server. All schedule logic (time parsing, hours, overtime, week dates, edits) is pure functions in `src/model/`, unit-tested with Vitest. Data lives in IndexedDB and is mirrored to an automatic backup file through the File System Access API (Chrome). The workbook import reads the `.xlsx` in the browser with ExcelJS, turns it into a draft, lets her answer review questions, then builds the app data.

**Tech Stack:** Vite, React 19, TypeScript (strict), Vitest, `idb-keyval`, `exceljs` (lazy-loaded), `jszip` (theme colors), GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-16-scheduler-design.md`

## Global Constraints

- **Public repo: no worker names, schedules, or her workbook in git.** `*.xlsx` and `.superpowers/` are git-ignored from the first commit. Test fixtures use made-up names (e.g. ANA, BEN, CARLA, DEV). Code must not special-case any real person's name.
- The schedule image never shows totals, overtime, or hour counts — only shifts.
- Shift hours = full span, no break deduction; shifts may cross midnight.
- Overtime = hours over `40` per person per Monday–Sunday week; multi-week pay periods sum per-week overtime.
- Day-rate people: box holds a start time only; payday counts days, not hours.
- One box per person per day (one venue + one shift, or one day-rate start time).
- Venue colors are fixed per venue (stored on the venue, never per week).
- Venue names are shown in full on the image, never abbreviated.
- Target browser: desktop Chrome. Must not crash elsewhere.
- Same build/deploy setup as `D:\Claude projects\Menu Generator` (`base: './'`, Actions workflow running `npm test` then `npm run build`).
- Light app chrome; dog-photo side rails on both sides of the site, copied from Menu Generator (same as Menu Generator and Hillstone Watch).
- The schedule image never contains dog photos (or any app chrome: nav, buttons, hours panel, backup bar). It is drawn on a canvas from `ImageModel` only — never a screenshot of the page.

## Review Focus

1. **Shifts touching midnight or noon** ("4PM-12AM" = 8h, "12PM-12AM" = 12h, "12AM-8AM" = 8h, "8AM-4AM" = 20h) → exact hours, never 0 or negative. Pinned in Task 2.
2. **Two workbook tabs that resolve to the same Monday** → reported as a review issue; the later tab does not silently overwrite the earlier one. Pinned in Task 12.
3. **Backup file permission lapses after Chrome restarts** → edits still save to IndexedDB, a "Reconnect backup" banner appears, nothing throws. Pinned in Task 6.
4. **A person hidden or a venue renamed after weeks exist** → past weeks, payday, and images still show them (hidden people who have boxes in the viewed week still appear in that week's grid and image). Pinned in Tasks 4 and 10.
5. **Quarter-hour shifts** ("7:45AM-9PM" = 13.25h) → totals show `13.25`, not `13.249999`. Pinned in Tasks 2 and 5.

---

## File Structure

```
Scheduler/
  .gitignore                  *.xlsx, .superpowers/, node_modules/, dist/
  .github/workflows/deploy.yml   copied from Menu Generator
  index.html, package.json, tsconfig.json, vite.config.ts   (copied, renamed)
  docs/superpowers/specs/…, docs/superpowers/plans/…
  src/
    main.tsx
    model/
      types.ts        AppData, Person, Venue, Week, Box
      time.ts         parse/format times, shifts, hours
      week.ts         Monday math, ISO dates, week labels
      ops.ts          pure edits: setBox, addCrew, startNextWeek, people/venue edits
      palette.ts      venue color palette + suggestion
      payroll.ts      weekly totals, pay-period totals
      image.ts        image layout model (pure) + text wrapping
    storage/
      db.ts           IndexedDB load/save (idb-keyval)
      backup.ts       serialize/parse backup JSON, backup-file handle logic
    import/
      readWorkbook.ts ExcelJS → RawWorkbook (only file that touches ExcelJS)
      theme.ts        theme XML → RGB, tint, color-key → hex
      analyze.ts      RawWorkbook → ImportDraft (merges, color questions, issues)
      build.ts        RawWorkbook + ImportAnswers → AppData
    ui/
      App.tsx, styles.css, useAppData.ts, DogRails.tsx
      WeekScreen.tsx, WeekGrid.tsx, BoxEditor.tsx, AddCrewPanel.tsx, HoursPanel.tsx
      PaydayScreen.tsx, PeopleScreen.tsx, VenuesScreen.tsx, BackupBar.tsx
      ImportWizard.tsx
      renderImage.ts  canvas drawing of the image model
    assets/dogs/      copied from Menu Generator (incl. large/)
```

---

### Task 1: Scaffold repo, build, and deploy pipeline

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.github/workflows/deploy.yml`, `src/main.tsx`, `src/ui/App.tsx` (placeholder), `src/model/smoke.test.ts`

- [ ] **Step 1:** In `D:\Claude projects\Scheduler`, write `.gitignore` FIRST containing: `*.xlsx`, `*.xls`, `*.csv`, `.superpowers/`, `node_modules/`, `dist/`, `*.zip`. Then `git init -b main` and `git remote add origin https://github.com/alessisheinman/Scheduler.git`.
- [ ] **Step 2:** Copy `tsconfig.json`, `vite.config.ts`, `.github/workflows/deploy.yml` from Menu Generator unchanged. `package.json`: name `scheduler`, same scripts and dev deps as Menu Generator; deps `react`, `react-dom`, `idb-keyval`, `exceljs`, `jszip`. `index.html` title `Scheduler`. `App.tsx` renders `<h1>Scheduler</h1>`.
- [ ] **Step 3:** `src/model/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 4:** Run `npm install && npm test && npm run build`. Expected: 1 test passes, `dist/index.html` exists.
- [ ] **Step 5:** Run `git status --porcelain` and confirm `MAY 2026 WEEK 3.xlsx` and `.superpowers/` are NOT listed.
- [ ] **Step 6:** Commit (scaffold + spec + this plan): `git add -A && git commit -m "chore: scaffold scheduler site, design and plan"`.

---

### Task 2: Times, shifts, hours (`src/model/time.ts`)

**Interfaces — Produces:**
- `type Minutes = number` (0–1439, minutes after midnight)
- `parseTime(text: string, opts?: { lenient?: boolean }): Minutes | null` — accepts `7AM`, `7 am`, `7:30PM`, `12AM`(=0), `12PM`(=720); case/space-insensitive. Strict (default) requires `AM`/`PM`. `lenient: true` (UI typing only) also accepts `7a`, `7p`, `7:30p`, and a bare `7`–`11` meaning AM, `12` meaning PM, `1`–`6` meaning PM.
- `parseShift(text: string, opts?): { start: Minutes; end: Minutes } | null` — `"<time>-<time>"`, optional spaces around `-`; null if either side fails or start === end.
- `shiftHours(start: Minutes, end: Minutes): number` — `end > start ? end - start : end + 1440 - start`, divided by 60.
- `formatTime(m: Minutes): string` — `7AM`, `7:30AM`, `12PM`, `12AM`.
- `formatShift(start, end): string` — `7AM-9PM`.
- `formatHours(h: number): string` — rounds to 2 decimals, drops trailing zeros: `14`, `6.5`, `13.25`.

- [ ] **Step 1: Write failing tests** `src/model/time.test.ts`:
  - `parseShift('7AM-9PM')` → `{start: 420, end: 1260}`; `parseShift('7:30am - 10:30PM')` → `{450, 1350}`; `parseShift('12PM-12AM')` → `{720, 0}`.
  - Rejected (null, strict): `'9PAM-9PM'`, `'10AM-8P'`, `'5:30-9PM'`, `'6:30AM-5:PM'`, `'500AM-9PM'`, `'5AM6PM'`, `'\\'`, `'7AM-9AM 5PM-9PM'`, `'7AM-7AM'`.
  - Lenient: `parseTime('7p', {lenient:true})` → 1140; `parseTime('7', {lenient:true})` → 420; `parseTime('3', {lenient:true})` → 900; `parseTime('7p')` → null.
  - Hours: `shiftHours(420,1260)` = 14; `(960,0)` = 8 (4PM-12AM); `(720,0)` = 12; `(0,480)` = 8; `(480,240)` = 20 (8AM-4AM); `(465,1260)` = 13.25.
  - `formatHours(13.25)` = `'13.25'`, `formatHours(14)` = `'14'`, `formatHours(0.1+0.2)` = `'0.3'`.
  - `formatShift(450, 0)` = `'7:30AM-12AM'`.
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/model/time.ts` with the signatures above (regex-based; no date library).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: shift time parsing and hours`.

---

### Task 3: Week dates (`src/model/week.ts`)

**Interfaces — Produces:**
- `type ISODate = string` (`YYYY-MM-DD`, local calendar date, no time zone math — build with `Date.UTC` and read with `getUTC*`)
- `mondayOf(d: ISODate): ISODate`, `addDays(d: ISODate, n: number): ISODate`
- `weekDates(monday: ISODate): ISODate[]` (7 dates)
- `weekLabel(monday: ISODate): string` — `Week of Nov 9 – 15, 2026`; across months `Week of Oct 26 – Nov 1, 2026`; across years `Week of Dec 28, 2026 – Jan 3, 2027` (en dash `–`).
- `dayHeader(d: ISODate): { day: string; date: string }` → `{ day: 'MON', date: '11/9' }`
- `excelSerialToISO(serial: number): ISODate` (1900 system: day 25569 = 1970-01-01)

- [ ] **Step 1: Failing tests** `src/model/week.test.ts`: `mondayOf('2026-11-15')` = `'2026-11-09'`; `mondayOf('2026-11-09')` = itself; `addDays('2026-12-28', 7)` = `'2027-01-04'`; the three `weekLabel` cases above with Mondays `2026-11-09`, `2026-10-26`, `2026-12-28`; `dayHeader('2026-11-10')` = `{day:'TUE', date:'11/10'}`; `excelSerialToISO(46335)` = `'2026-11-09'`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: week date helpers`.

---

### Task 4: Data model, palette, and edit operations

**Files:** Create `src/model/types.ts`, `src/model/palette.ts`, `src/model/ops.ts`, test `src/model/ops.test.ts`

**Interfaces — Produces (`types.ts`, copy exactly):**

```ts
export type ID = string;
export interface Person { id: ID; name: string; dayRate: boolean; hidden: boolean }
export interface Venue { id: ID; name: string; color: string /* '#rrggbb' */ }
export type Box =
  | { kind: 'shift'; venueId: ID | null; start: Minutes; end: Minutes }
  | { kind: 'day'; start: Minutes | null };
export interface Week { monday: ISODate; boxes: Record<ID, (Box | null)[]> /* personId → 7 slots, Mon..Sun */ }
export interface AppData {
  schemaVersion: 1;
  people: Person[];   // array order = display order (grid and image)
  venues: Venue[];
  weeks: Week[];      // sorted by monday ascending, unique monday
}
export const emptyData = (): AppData => ({ schemaVersion: 1, people: [], venues: [], weeks: [] });
```

**`palette.ts`:** `VENUE_PALETTE: string[]` — 12 soft fills, all readable with black text (contrast ≥ 4.5:1 vs `#1a1a1a`), visibly distinct; start with the mockup's `#a9c8f5 #b7e4a8 #f5a9a9 #e3b3f0 #f7e08a`, add 7 more (teal, orange, lavender, sand, mint, rose, gray-blue). `suggestVenueColor(used: string[]): string` → first palette color not in `used`, else palette[used.length % 12].

**`ops.ts` (all pure, return new `AppData`, never mutate):**
- `newId(): string` (crypto.randomUUID)
- `getWeek(data, monday): Week | undefined`; `ensureWeek(data, monday): AppData` (inserts empty week keeping sort)
- `setBox(data, monday, personId, day: number /*0..6*/, box: Box | null): AppData`
- `addCrew(data, c: { monday: ISODate; venueId: ID; days: number[]; start: Minutes; end: Minutes; personIds: ID[] }): AppData` — writes a `shift` box for every person×day, replacing what's there. Returns data unchanged if `days` or `personIds` is empty.
- `countReplacements(data, c): number` — how many existing non-null boxes `addCrew` would overwrite (UI shows "replaces N").
- `startNextWeek(data, fromMonday, copyBoxes: boolean): { data: AppData; monday: ISODate }` — next Monday; if that week exists, return it unchanged. When `copyBoxes`, deep-copy boxes of non-hidden people.
- `addPerson(data, name, dayRate=false)`, `updatePerson(data, id, patch: Partial<Omit<Person,'id'>>)`, `movePerson(data, id, toIndex)`
- `addVenue(data, name, color?)` (color defaults to `suggestVenueColor`), `updateVenue(data, id, patch)`, `deleteVenue(data, id): AppData` — throws `Error('Venue is used in the schedule')` if any box references it.
- `peopleForWeek(data, monday): Person[]` — non-hidden people, plus hidden people who have any box that week, in `people` order.

- [ ] **Step 1: Failing tests** (`ops.test.ts`, fixture names ANA/BEN/CARLA):
  - `addCrew` Mon+Fri × 3 people → 6 boxes, each `{kind:'shift', venueId, start:420, end:1260}`; input `data` unchanged (deep-equal to a pre-call `structuredClone`).
  - `countReplacements` = 1 when one target box already exists.
  - `startNextWeek(copyBoxes=true)` copies boxes; `false` gives empty boxes; calling twice returns the same Monday without duplicating weeks; hidden person's boxes are not copied.
  - `deleteVenue` on a used venue throws `'Venue is used in the schedule'`; unused one is removed.
  - Review Focus 4: hide BEN who has a box in week W → `peopleForWeek(W)` includes BEN; a week where BEN has no boxes excludes him. `updateVenue` rename → boxes still resolve via `venueId`.
  - `suggestVenueColor([VENUE_PALETTE[0]])` = `VENUE_PALETTE[1]`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: data model and schedule edit operations`.

---

### Task 5: Payroll totals (`src/model/payroll.ts`)

**Interfaces — Produces:**
- `OVERTIME_AFTER = 40`
- `interface PersonTotal { personId: ID; hours: number; regular: number; overtime: number; days: number }` (`days` = count of `day` boxes; for hourly people `days` counts shift boxes too, but UI shows it only for day-rate)
- `weekTotals(data: AppData, monday: ISODate): Map<ID, PersonTotal>` — sum `shiftHours` of shift boxes; `regular = min(hours, 40)`, `overtime = max(0, hours − 40)`.
- `periodTotals(data: AppData, mondays: ISODate[]): PersonTotal[]` — per person, sum each week's `hours/regular/overtime/days`; only people with any box in the period; ordered by `data.people` order. Round each sum to 2 decimals.

- [ ] **Step 1: Failing tests** `payroll.test.ts`:
  - Week with ANA: six shifts `7AM-9PM` (84h) → `{hours:84, regular:40, overtime:44}`.
  - Two-week period: week1 ANA 30h, week2 ANA 50h → `{hours:80, regular:70, overtime:10}` (NOT 40/40).
  - Day-rate DEV with 7 `day` boxes → `{days:7, hours:0}`.
  - Quarter hours: one `7:45AM-9PM` shift → `hours: 13.25`.
  - Person with no boxes in the period is absent from `periodTotals`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat: weekly overtime and pay period totals`.

---

### Task 6: Storage and automatic backup file

**Files:** `src/storage/db.ts`, `src/storage/backup.ts`, test `src/storage/backup.test.ts`

**Interfaces — Produces:**
- `db.ts`: `loadData(): Promise<AppData>` (idb-keyval key `scheduler:v1`; missing → `emptyData()`), `saveData(d: AppData): Promise<void>`, `loadBackupHandle(): Promise<FileSystemFileHandle | null>`, `saveBackupHandle(h): Promise<void>` (key `scheduler:backup-handle`), `requestPersistence(): Promise<boolean>` (wraps `navigator.storage.persist`, false if unavailable).
- `backup.ts`:
  - `serializeBackup(d: AppData, savedAt: string): string` — JSON `{ app: 'scheduler', savedAt, data }`, 2-space indent.
  - `parseBackup(text: string): AppData` — throws `Error('Not a Scheduler backup file')` if `app !== 'scheduler'` or shape invalid (people/venues/weeks arrays, schemaVersion 1).
  - `type BackupStatus = 'none' | 'ok' | 'needs-permission' | 'error'`
  - `interface FileLike { queryPermission(o): Promise<PermissionState>; requestPermission(o): Promise<PermissionState>; createWritable(): Promise<{ write(s: string): Promise<void>; close(): Promise<void> }> }`
  - `writeBackup(h: FileLike | null, d: AppData, now: string): Promise<BackupStatus>` — null → `'none'`; permission not `'granted'` → `'needs-permission'` (no throw, does not call `requestPermission`); write failure → `'error'`; success → `'ok'`.
  - `reconnectBackup(h: FileLike): Promise<boolean>` — calls `requestPermission({mode:'readwrite'})` (must be called from a click).

- [ ] **Step 1: Failing tests** with a fake `FileLike`:
  - round trip `parseBackup(serializeBackup(d, t))` deep-equals `d`.
  - `parseBackup('{"app":"other"}')` throws `'Not a Scheduler backup file'`; `parseBackup('not json')` throws same message.
  - Review Focus 3: fake whose `queryPermission` → `'prompt'` → `writeBackup` resolves `'needs-permission'` and never calls `createWritable`; fake whose `write` rejects → `'error'`.
- [ ] **Step 2–4:** FAIL → implement → PASS (`db.ts` is thin glue; not unit-tested).
- [ ] **Step 5:** Commit `feat: IndexedDB storage and automatic backup file`.

---

### Task 7: App shell, state hook, dog rails, People and Venues screens

**Files:** `src/ui/App.tsx`, `src/ui/useAppData.ts`, `src/ui/DogRails.tsx` (copy from Menu Generator), `src/ui/styles.css`, `src/ui/BackupBar.tsx`, `src/ui/PeopleScreen.tsx`, `src/ui/VenuesScreen.tsx`, `src/assets/dogs/**` (copy all JPGs incl. `large/`)

**Interfaces:**
- Consumes: Tasks 4 and 6.
- Produces: `useAppData(): { data: AppData; update(fn: (d: AppData) => AppData): void; backup: BackupStatus; connectBackup(): Promise<void>; reconnect(): Promise<void>; restore(file: File): Promise<void>; downloadBackup(): void; replaceAll(d: AppData): void }`. `update` sets state, saves to IndexedDB immediately, and writes the backup file debounced 1000 ms.
- App tabs: **Week · Payday · People · Venues**, plus an **Import spreadsheet** button (shown prominently when `data.weeks` is empty).

- [ ] **Step 1:** Implement `useAppData` (calls `requestPersistence()` once on load).
- [ ] **Step 2:** `BackupBar`: status `none` → "Turn on automatic backup" button (`showSaveFilePicker`, suggested name `scheduler-backup.json`, then `saveBackupHandle`); `needs-permission` → amber "Reconnect backup" button; `error` → red message; `ok` → small "Backed up ✓ <time>". Also "Restore from backup…" and "Download backup" links. Restore over non-empty data asks `confirm`-style inline (not `window.confirm`): "Replace everything with this backup?".
- [ ] **Step 3:** People screen: add (name, day-rate checkbox), rename inline, day-rate toggle, hide/show toggle, move up/down buttons. Names are stored and shown exactly as typed.
- [ ] **Step 4:** Venues screen: add, rename, color swatch picker (palette + `<input type=color>`), delete (disabled with tooltip "Used in the schedule" when in use).
- [ ] **Step 5:** Copy dog rails + CSS block (`/* dog photos */` and lightbox sections) from Menu Generator `styles.css`.
- [ ] **Step 6:** `npm run build` passes; `npm run dev`, open in Chrome, add 2 people and 2 venues, reload → still there; turn on backup, confirm the JSON file is written. 
- [ ] **Step 7:** Commit `feat: app shell, people and venues, backup bar`.

---

### Task 8: Week screen — grid, box editor, live hours

**Files:** `src/ui/WeekScreen.tsx`, `src/ui/WeekGrid.tsx`, `src/ui/BoxEditor.tsx`, `src/ui/HoursPanel.tsx`

**Interfaces:** Consumes `peopleForWeek`, `setBox`, `weekTotals`, `weekLabel`, `dayHeader`, `parseTime(…, {lenient:true})`, `formatShift`, `formatHours`, `shiftHours`.

- [ ] **Step 1:** WeekScreen header: ◀ `weekLabel` ▶ (moves ±7 days; current week defaults to the newest week, or this calendar week if none). Buttons: **Start next week from this one** (Task 9), **Payday totals** (switches tab), **Save image** (Task 10).
- [ ] **Step 2:** WeekGrid: rows `peopleForWeek`, columns MON–SUN with `dayHeader`. Shift box = venue color fill, venue full name (small bold) over `formatShift`; no-venue shift = white with dashed border; day box = `#333` fill, white `Day · 5AM` (or `Day` if no start). Empty = blank cell.
- [ ] **Step 3:** BoxEditor popover on click: hourly person → venue select, start/end text inputs (lenient parse, red outline when unparseable), live "= N hrs"; day-rate person → start time only. **Clear box**, **Done** (Enter = Done, Esc = cancel). Done with unparseable input is disabled.
- [ ] **Step 4:** HoursPanel: `weekTotals` for the people shown; hourly → `formatHours(hours)`, with ` · N OT` in red when overtime > 0; day-rate → `N days`. Panel is outside the grid element (so it never appears in the image).
- [ ] **Step 5:** Manual check in Chrome: set "7AM-9PM" ×6 for one person → panel shows `84 · 44 OT`; edit one box to `7am-10p` → `85 · 45 OT`.
- [ ] **Step 6:** Commit `feat: week grid, box editor, live hours`.

---

### Task 9: Add crew and start next week

**Files:** `src/ui/AddCrewPanel.tsx`; modify `src/ui/WeekScreen.tsx`

- [ ] **Step 1:** AddCrewPanel: venue select (colored), MON–SUN toggles, start/end inputs (lenient), checkbox list of non-hidden, non-day-rate people, button label `Fill N boxes` where N = days × people; when `countReplacements > 0` show "(replaces M)". Click → `addCrew`, then clear person checks but keep venue/days/times (fast repeat for the next crew).
- [ ] **Step 2:** "Start next week from this one" → small choice: **Copy all boxes** / **Just the people** → `startNextWeek`, navigate to it. If next week exists, just navigate.
- [ ] **Step 3:** Manual check: Barclays Mon+Fri 7AM–9PM for 5 people → 10 boxes; start next week with copy → identical boxes.
- [ ] **Step 4:** Commit `feat: add crew and start next week`.

---

### Task 10: Schedule image

**Files:** `src/model/image.ts`, `src/model/image.test.ts`, `src/ui/renderImage.ts`; modify `WeekScreen.tsx` (Save image)

**Interfaces — Produces:**
- `type ImageCell = { kind: 'empty' } | { kind: 'shift'; venue: string; color: string; time: string } | { kind: 'day'; time: string }` — shift `time` = `formatShift(start, end)`; day `time` = `'Day · ' + formatTime(start)` (e.g. `Day · 5AM`), or `'Day'` when start is null; no-venue shift → venue `''`, color `'#ffffff'`.
- `interface ImageModel { title: string; days: { day: string; date: string }[]; rows: { name: string; cells: ImageCell[] }[] }`
- `buildImageModel(data: AppData, monday: ISODate): ImageModel` — rows = `peopleForWeek` filtered to people with ≥1 box that week; title = `weekLabel(monday)`.
- `wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[]` — word wrap; a single word longer than maxWidth stays on its own line (never cut).
- `renderScheduleImage(model: ImageModel): HTMLCanvasElement` — 2× pixel ratio, 1100 CSS px wide, height grows with rows and wrapped lines; Calibri/Arial; style per approved Option B.

- [ ] **Step 1: Failing tests** `image.test.ts`:
  - Model for a week where ANA works and BEN doesn't → only ANA row.
  - Anti-goal: `JSON.stringify(model)` contains no `'OT'`, `'hrs'`, `'total'` (case-insensitive) and no number equal to ANA's weekly hours.
  - Venue `'UNITED PALACE'` stays `'UNITED PALACE'` (full name) in the cell.
  - `wrapText('UNITED PALACE', 60, s => s.length * 10)` → `['UNITED', 'PALACE']`; `wrapText('PRUDENTIAL', 60, …)` → `['PRUDENTIAL']`.
  - Review Focus 4: a hidden person with a box that week appears; renamed venue shows the new name.
- [ ] **Step 2–4:** FAIL → implement `image.ts` → PASS.
- [ ] **Step 5:** Implement `renderImage.ts` and **Save image** (canvas → PNG blob → download `schedule-YYYY-MM-DD.png`).
- [ ] **Step 6:** Manual check: saved PNG matches the approved mockup layout; long venue names wrap inside the box; no totals anywhere; no dog photos or app chrome in the PNG (dog rails are still visible on the page itself).
- [ ] **Step 7:** Commit `feat: schedule image export`.

---

### Task 11: Payday screen

**Files:** `src/ui/PaydayScreen.tsx`, `src/ui/exportPayday.ts`

- [ ] **Step 1:** Week picker: dropdown of existing weeks (newest first, default newest), plus checkbox "Add the week before" (two consecutive weeks). Table from `periodTotals`: Name | Total hours | Regular | Overtime (red when > 0) | Days (only filled for day-rate people; hourly show `—`). Heading shows the period ("Nov 2 – 15, 2026").
- [ ] **Step 2:** **Print** button (`window.print`, print CSS hides nav, dog rails, backup bar). **Download spreadsheet** → `exportPayday.ts` lazy-imports ExcelJS, writes the same table to `payday-YYYY-MM-DD.xlsx`.
- [ ] **Step 3:** Manual check against Task 5 numbers with a two-week period.
- [ ] **Step 4:** Commit `feat: payday totals, print and export`.

---

### Task 12: Workbook reader and import analysis

**Files:** `src/import/theme.ts`, `src/import/readWorkbook.ts`, `src/import/analyze.ts`, tests `src/import/theme.test.ts`, `src/import/readWorkbook.test.ts`, `src/import/analyze.test.ts`, test helper `src/import/fixture.ts` (builds an `.xlsx` buffer with ExcelJS in the layout below, made-up names)

**Workbook layout (from the spec's survey):** title C1; row 2 day names (`MONDAY`…`SUNDAY`) and row 3 dates — one tab has these swapped and only some date cells filled; people in column A from row 4; Mon–Sun in columns B–H; color key = cells in columns C–E, at row ≥ 17, in rows whose column A is empty, that have a fill and text that is not a shift. Fills are either ARGB (`FF0000FF`) or theme index + tint. White `FFFFFFFF` = no fill. Day-rate cells: an Excel time value (fraction of a day) usually on black fill.

**Interfaces — Produces:**
- `theme.ts`: `parseThemeColors(themeXml: string): string[]` (Excel index order: 0 lt1, 1 dk1, 2 lt2, 3 dk2, 4–9 accent1–6, 10 hlink, 11 folHlink; hex `#rrggbb`), `colorKeyToHex(key: string, theme: string[]): string` for keys `argb:FF0000FF` / `theme:5:-0.25` (tint < 0: c·(1+t); tint > 0: c + (255−c)·t).
- `readWorkbook.ts`:
  ```ts
  export interface RawCell { text: string | null; time: Minutes | null; color: string | null /* color key */ }
  export interface RawRow { name: string; rowNumber: number; cells: RawCell[] /* 7 */ }
  export interface RawTab { tab: string; monday: ISODate | null; rows: RawRow[]; legend: { color: string; venue: string }[]; namelessRows: number[] }
  export interface RawWorkbook { tabs: RawTab[]; theme: string[] }
  export async function readWorkbook(buf: ArrayBuffer): Promise<RawWorkbook>
  ```
  `monday` = `mondayOf` of any date cell, adjusted by its column (date in column E → that date minus 3 days); null if no dates. Venue names from the key are trimmed, uppercased, inner spaces collapsed. Only this file imports `exceljs` (use dynamic `import('exceljs')`; if Vite can't bundle `exceljs`, import `exceljs/dist/exceljs.min.js` in the browser path only).
- `analyze.ts`:
  ```ts
  export type IssueKind = 'unreadable' | 'colored-empty' | 'no-name-row' | 'duplicate-week' | 'two-boxes-one-day';
  export interface Issue { id: string; kind: IssueKind; tab: string; name?: string; day?: number; text?: string }
  export interface ColorQuestion { key: string /* `${tab}|${color}` */; tab: string; color: string; hex: string; count: number; legendVenues: string[] }
  export interface ImportDraft { names: { name: string; count: number; dayRateLikely: boolean }[]; mergeSuggestions: string[][]; colorQuestions: ColorQuestion[]; venues: string[]; issues: Issue[]; weekCount: number }
  export function analyze(raw: RawWorkbook): ImportDraft
  ```
  - Name normalization: trim, uppercase, collapse spaces, strip a trailing ` 1`/` 2` (so "X 1" and "X 2" become one name; their same-day boxes yield `two-boxes-one-day`).
  - `mergeSuggestions`: groups where one name is the first word(s) of the other (`ROSA` / `ROSA SMITH` style), or Levenshtein ≤ 1 and both ≥ 3 chars (`MILO`/`MYLO`, `TOMA`/`TOMAS`). Suggestions only.
  - `dayRateLikely`: > 50% of that name's non-empty boxes are time values.
  - A box is `unreadable` if it has text that strict `parseShift` rejects. `colored-empty`: fill, no text, no time. Shift with a fill not in that tab's legend → counted into a `ColorQuestion`. Shift with no fill → venue null (no question).
  - Two tabs with the same `monday` → one `duplicate-week` issue naming both tabs (Review Focus 2); tab with null monday → `unreadable` issue for the tab.

- [ ] **Step 1: Failing tests:**
  - `theme.test.ts`: tiny theme XML with accent1 `4472C4` → index 4 = `#4472c4`; `colorKeyToHex('theme:4:-0.25', theme)` = `#335693` (round each channel); `colorKeyToHex('argb:FF0000FF', theme)` = `#0000ff`.
  - `readWorkbook.test.ts` (fixture with names ANA, BEN, DEV, a 3-entry color key, one swapped-header tab): reads `monday`, the legend venues, a shift cell `{text:'7AM-9PM', color:'argb:FF0000FF'}`, a day-rate time cell `time: 300`, `namelessRows` for a row with a shift but empty column A.
  - `analyze.test.ts`: `'9PAM-9PM'` → one `unreadable` issue; colored blank → `colored-empty`; color missing from that tab's key → one `ColorQuestion` with `count` 2 for two such boxes; `ANA 1`/`ANA 2` same day → `two-boxes-one-day`; two tabs on the same Monday → `duplicate-week`; `MILO`/`MYLO` in `mergeSuggestions`; DEV `dayRateLikely: true`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Real-file dry run (local only, never committed):** a throwaway script in the session scratchpad runs `readWorkbook` + `analyze` on `D:\Claude projects\Scheduler\MAY 2026 WEEK 3.xlsx` and prints counts only. Expected ballpark: 73 tabs; ~23 unreadable; ~70 color-question boxes; ~120 colored-empty; ~48 raw names before merging. Investigate any large mismatch before continuing.
- [ ] **Step 6:** Commit `feat: read and analyze the old schedule workbook`.

---

### Task 13: Build app data from answers

**Files:** `src/import/build.ts`, test `src/import/build.test.ts`

**Interfaces — Produces:**
```ts
export interface ImportAnswers {
  merges: Record<string, string>;          // normalized name → final name (identity if absent)
  dayRate: Record<string, boolean>;        // final name → day-rate
  colorVenue: Record<string, string | null>; // ColorQuestion.key → venue name or null (no venue)
  fixes: Record<string, FixBox | 'skip'>;  // Issue.id → replacement or skip
  skipColoredEmptyFor: string[];           // final names whose colored-empty boxes are all skipped
  duplicateWeekKeep: Record<string, string>; // Issue.id → tab name to keep
}
export type FixBox = { kind: 'shift'; venue: string | null; start: Minutes; end: Minutes } | { kind: 'day'; start: Minutes | null };
export function buildData(raw: RawWorkbook, draft: ImportDraft, answers: ImportAnswers): AppData
```
- Venues: every key venue across all tabs + chosen color-question venues; each gets a palette color in first-seen order (newest tab first, so current venues get the first colors).
- People order: order of first appearance in the newest tab, then the rest by most recent appearance. `hidden: true` for people with no box in the newest 8 weeks.
- Boxes: shift → venue from that tab's key (or color answer, or null); day-rate person's time cell → `{kind:'day', start}`; unanswered `colored-empty` boxes are skipped (they never count as hours). Weeks sorted by monday.

- [ ] **Step 1: Failing tests** with fixture from Task 12: merged `MILO`+`MYLO` → one person with both weeks' boxes; color-answered box gets that venue; `fixes` replacement used; `skip` omitted; `skipColoredEmptyFor` drops those; day-rate person gets `day` boxes with `start: 300`; payday on the built data via `periodTotals` gives the hand-computed hours for ANA in the fixture week.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat: build schedule data from the workbook import`.

---

### Task 14: Import wizard UI

**Files:** `src/ui/ImportWizard.tsx`; modify `App.tsx`

Steps on screen (Back/Next between them, all local, nothing uploaded):
1. **Choose file** (`.xlsx`) → `readWorkbook` + `analyze` (show "Reading 73 weeks…").
2. **People:** each merge suggestion as a checked group "These are the same person → name: [editable]"; she can untick. List of all final names with a day-rate checkbox (pre-ticked from `dayRateLikely`).
3. **Colors:** each `ColorQuestion`: tab name, swatch (`hex`), count, select of that tab's key venues + all venues + "No venue".
4. **Boxes to check:** `unreadable` / `two-boxes-one-day`: show tab, name, day, original text; inline editor (venue + start/end, prefilled when parseable leniently) or **Skip**. `colored-empty`: grouped per person with **Skip all N for this person** (default for groups ≥ 10) or fix individually. `duplicate-week`: choose which tab to keep. `no-name-row`: informational, skipped.
5. **Summary:** N weeks, N people, N venues, N shifts → **Import**. If the site already has data, the button reads "Replace everything and import".

- [ ] **Step 1:** Implement the wizard against `ImportDraft` / `ImportAnswers`.
- [ ] **Step 2:** Manual check with the real workbook in Chrome (file never leaves the browser): finish all steps, open the newest week → matches her Nov 9–15 tab (shifts and venues); payday for that week shows plausible totals; save image looks right. Download a backup afterwards.
- [ ] **Step 3:** Commit `feat: workbook import wizard`.

---

### Task 15: Ship

- [ ] **Step 1:** `npm test && npm run build` → all green.
- [ ] **Step 2:** `git log --all --name-only | grep -iE "xlsx|superpowers/brainstorm"` → no output (nothing private ever committed).
- [ ] **Step 3:** `git push -u origin main`.
- [ ] **Step 4:** Repo Settings → Pages → Source: **GitHub Actions** (ask Adam to click this if no CLI access). Wait for the workflow; open `https://alessisheinman.github.io/Scheduler/` and confirm it loads with dog rails.
- [ ] **Step 5:** Commit any README (`README.md`: what it is, how to run locally, "her data stays in her browser + backup file") and push.

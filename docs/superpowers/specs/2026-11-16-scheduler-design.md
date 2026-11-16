# Scheduler — design

Date: 2026-11-16
Repo: github.com/alessisheinman/Scheduler (public, GitHub Pages)
Client: the same catering company as Menu Generator and Proposed Menu Generator (the owner, below "she").

## Why

The owner schedules her staff in one Excel workbook, one tab per week (73 tabs since May 2025). Each week she copies a tab, types each person's shift into each day's box ("7AM-9PM"), fills the box with that venue's color, and keeps a color key at the bottom. Three problems:

1. **Building the week is slow.** Every box is typed and colored by hand, even though most days a whole crew works the same venue with the same hours.
2. **Payday is the real bottleneck.** She pays weekly or every two weeks (whichever suits how busy she is) and has to add up every person's hours by hand, plus work out overtime.
3. **Workers get a screenshot** of the sheet as their schedule, so the output has to be easy to read at a glance.

Scheduler solves all three in one static website she uses on her laptop.

Success: building a normal week takes a few minutes of picking crews and fixing boxes; payday totals for any one or two weeks take one click; the picture she texts out reads clearly without a color key.

## Goals

- Build a week fast: whole crews at once, then tweak single boxes.
- Hours are always editable after the fact (people often work more or less than planned); payday uses whatever the boxes say.
- Payday totals per person: total hours, regular vs overtime. Day-rate workers: days worked.
- A clean schedule image she downloads and texts out.
- Import all her past weeks from the workbook.

## Non-goals

- No dollar amounts, pay rates, or payroll processing — hours and overtime only. She does the pay herself.
- No worker logins, no worker-facing site, no notifications. Workers only ever get the image she sends.
- No multi-user editing or cloud sync. One person, one laptop.
- No phone-optimized editing (she works on a laptop). The site should not break on a phone, but editing is designed for mouse and keyboard.

## Anti-goals (would be a failure even if it works)

- **The schedule image shows anyone's hour totals or overtime.** She explicitly does not want workers comparing each other's hours. The image shows only each person's shifts.
- **Worker names or schedules committed to the public repo.** Names live only in her browser storage and her backup files. The repo contains code only. Her workbook (`*.xlsx`) is git-ignored. Test fixtures use made-up names.
- Making a week take more clicks than the spreadsheet does.
- Guessing silently during import — anything it can't read is shown to her to fix, never invented.

## Users and setting

- **Editor:** only the owner, on a laptop, in one browser.
- **Readers:** her workers, who receive a downloaded image (by text message).

## Rules for hours (decided)

- A shift "7AM-9PM" is paid as the full span: 14 hours. No break deduction.
- Shifts can cross midnight: "8AM-4AM" = 20 hours, "4PM-12AM" = 8 hours.
- Overtime = hours over **40 in a Monday–Sunday week**, per person.
- A pay period is one or two weeks, chosen at payday. In a two-week period, overtime is worked out **per week** and then added up — never against 80.
- **Day-rate workers** (a per-person flag) are paid by the day, not the hour. Their box holds a start time only (e.g. "5:00"); payday shows **days worked** for them, not hours.
- One person works at most one venue per day — one box = one venue + one shift (or one start time for day-rate workers).

## The program

### Week screen (main screen)

Header: week navigation (◀ Week of Nov 9 – 15 ▶), and buttons **Start next week from this one**, **Payday totals**, **Save image**.

1. **Add a crew** panel: pick a venue, tick one or more days, enter start and end times, tick people → one button fills all those boxes. (This matches how her weeks actually look: groups of people on identical venue+hours.)
2. **Grid**: active people down the side in her chosen order, Monday–Sunday across with dates. Each box shows the venue's full name and the hours, filled with the venue color. Clicking a box opens a small editor: venue, start, end, live "= N hrs", **Clear box**, **Done**. Day-rate workers' boxes take a start time instead.
3. **Live hours panel** (her screen only): each person's total for the week, overtime in red; day-rate workers show days.

**Start next week from this one** creates the following week with the same people; she can choose to also copy all the boxes so a repeat week is mostly fixing a few.

### Schedule image (what workers get)

Approved look ("Option B, full names"):

- Title "Week of Nov 9 – 15, 2026"; names down the left; MON–SUN with dates across the top.
- Each box: the venue's **full name, never abbreviated** (long names wrap to two lines), above the hours, on the venue's color. Soft, readable fills.
- Day-rate boxes: dark gray, "Day · 5AM" (start time written like every other time).
- Only people with at least one shift that week appear, in her list order.
- **No totals, overtime, or hour counts anywhere on the image.**
- **Save image** downloads a PNG sized for texting.

Reference mockup: `.superpowers/brainstorm/*/content/worker-image-b2.html` (local, not committed).

### Payday page

Pick one or two weeks (default: the most recent one; two consecutive weeks selectable). For each person: total hours, regular, overtime (per-week OT summed), and days worked for day-rate people. Printable, and downloadable as a spreadsheet file. Never part of the image.

### People

Add, rename, reorder (this order is also the image order), mark as day-rate, and hide people who stopped working without losing their past hours.

### Venues

Add and rename venues. Each venue gets **one color permanently** (she approved fixed colors per venue, replacing her week-by-week colors); the program suggests a color distinct from existing ones, and she can change it.

### One-time import of her workbook

She switches to the site right away, so the import runs **once**, into an empty site (no re-import or merging with later spreadsheet weeks). She opens her `.xlsx` in the site; it is read entirely in the browser (nothing uploaded). It brings in every weekly tab, the people, and the venues, then shows a short review list of anything it couldn't read for her to fix or skip.

What the workbook actually looks like (surveyed 2026-11-16, 73 tabs):

- Layout: title in C1; day names (MONDAY…SUNDAY) in row 2 and dates in row 3 (one early tab has them swapped); people in column A from row 4; days in columns B–H; the color key in column C around rows 19–26 (venue name typed in a cell filled with that venue's color). Tab names have typos and wrong years — **use the dates in the sheet, not the tab name.**
- ~1,900 filled boxes; ~1,460 are clean "7AM-9PM"-style shifts (a few lowercase).
- ~23 boxes have text it can't read safely ("9PAM-9PM", "10AM-8P", "5:30-9PM" with no AM/PM, "6:30AM-5:PM", stray "\" or ","). These go to the review list.
- One box holds two shifts in a day ("7AM-9AM 5PM-9PM") and a couple of tabs split one person into two rows ("NAME 1", "NAME 2") — review list.
- Venue = the box's fill color looked up in **that tab's own key**, because colors meant different venues in different weeks. ~70 boxes use a color that isn't in that tab's key (mostly shades of blue: theme colors and near-matches like 4A86E8 / 4285F4 / 4D93D9). The review step asks her once per (tab, color) which venue it was; ~21 shifts have no fill → "no venue".
- Day-rate pattern: one worker's boxes hold a bare time (Excel time value like 5:00) on a black fill — that's a day worked, with that start time.
- Some boxes are colored with no text at all. One person has ~100 of these: the owner said not to worry about them, so **that person's colored-but-empty boxes are skipped** (not imported, not counted). The handful of colored-but-empty boxes on anyone else (~13) go to the review list.
- The same person appears under different spellings across tabs (a short name vs. full name, a nickname, a misspelling — 48 raw names in total). The import shows a "these look like the same person" merge step before saving.

### Storage and backup

- She uses **Chrome** on her laptop. Target Chrome (and Chromium Edge); other browsers need not be supported beyond not crashing.
- All data in the browser (IndexedDB), on her laptop only; ask for persistent storage (`navigator.storage.persist()`).
- **Automatic backup file:** once, she picks a backup file location (File System Access API); after that, every change is saved to that file automatically, so a wiped browser loses nothing. If permission lapses (Chrome asks again after a restart), show a clear one-click "reconnect backup" prompt.
- **Restore from backup** loads that file into an empty or wiped site. A manual **Download backup** stays available too.

### Look

Light app chrome, same dog-photo side rails as her other two sites (reuse Menu Generator's `DogRails` component and `src/assets/dogs/*.jpg`).

## How it gets made (Claude's calls, overridable)

- Same stack as the sibling sites: Vite + React + TypeScript, Vitest, deployed to GitHub Pages by a GitHub Actions workflow on push to `main`.
- Reading the workbook needs cell **fill colors including theme colors and tints**, which rules out libraries that drop styles; the builder picks the library (e.g. ExcelJS, or unzip + parse the XML directly).
- The image is drawn in the browser (canvas or DOM-to-image — builder's choice) at a fixed width with good text sharpness.
- Hours math lives in plain, unit-tested functions (shift parsing, midnight crossing, weekly OT, multi-week periods, day-rate days).

## Left to the builder

- Exact color palette for venues (must stay readable under black text and be clearly different from each other).
- Time entry control (typed "7am" vs. pickers), as long as the common case is fast with a keyboard.
- Export file format for payday (CSV or .xlsx).
- A shift crossing Sunday midnight counts toward the week it starts in.

## Settled after review (2026-11-16)

- Colored-but-empty boxes for the one frequent person: skip them (owner: "don't worry about" them).
- Browser: Chrome. Backups via an automatic backup file.
- She switches to the site right away; the workbook import is one-time.

# Scheduler

A small website for building a catering crew's weekly schedule.

- **Week:** add whole crews at once (venue, days, hours, people), then click any box to change it. A side panel shows each person's hours for the week, with overtime over 40.
- **Save image:** a clean picture of the week to text to workers. It shows only shifts: no totals, no overtime.
- **Payday:** hours per person for one or two weeks, split into regular and overtime (worked out week by week), plus days worked for people paid by the day. It can be printed or downloaded as a spreadsheet.
- **Import:** a one-time import of the old Excel schedule, with a review step for anything it can't read.

## Where the data lives

Everything stays in the browser on the computer that uses the site (IndexedDB). Turn on **automatic backup** to have every change saved to a backup file on that computer too (Chrome or Edge). **Restore from backup** loads that file back.

Nothing is uploaded anywhere, and no names or schedules are stored in this repository.

## Running it locally

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

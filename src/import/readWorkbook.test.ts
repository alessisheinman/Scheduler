import { beforeAll, expect, test } from 'vitest';
import { buildFixture, standardTabs } from './fixture';
import { readWorkbook, type RawWorkbook } from './readWorkbook';

let raw: RawWorkbook;
beforeAll(async () => { raw = await readWorkbook(await buildFixture(standardTabs())); });

test('reads every tab with its Monday from the dates in the sheet, not the tab name', () => {
  expect(raw.tabs.map((t) => t.monday)).toEqual(['2026-11-02', '2026-11-09', '2026-11-09']);
});

test('reads the color key, cleaning up venue names', () => {
  expect(raw.tabs[0].legend).toEqual([
    { color: 'argb:FF0000FF', venue: 'BARCLAYS' },
    { color: 'argb:FFFF0000', venue: 'MSG' },
    { color: 'theme:5:-0.25', venue: 'HULU' },
  ]);
  expect(raw.tabs[1].legend.map((l) => l.venue)).toEqual(['MSG', 'BARCLAYS']);
});

test('reads shift text, fills, and day-rate times', () => {
  const [ana, ben, dev] = raw.tabs[0].rows;
  expect(ana.name).toBe('ANA');
  expect(ana.cells[0]).toEqual({ text: '7AM-9PM', time: null, color: 'argb:FF0000FF' });
  expect(ben.cells[3]).toEqual({ text: null, time: null, color: 'argb:FFFF0000' });
  expect(dev.cells[0]).toMatchObject({ time: 300, color: 'argb:FF000000' });
  expect(dev.cells[1]).toMatchObject({ time: 270 });
  expect(ana.cells[6]).toEqual({ text: null, time: null, color: null });
});

test('rows with boxes but no name are noted, not read as people', () => {
  expect(raw.tabs[0].rows.map((r) => r.name)).toEqual(['ANA', 'BEN', 'DEV', 'MILO', 'CARLA']);
  expect(raw.tabs[0].namelessRows).toEqual([9]);
});

test('keeps theme colors for swatches', () => {
  expect(raw.theme).toHaveLength(12);
});

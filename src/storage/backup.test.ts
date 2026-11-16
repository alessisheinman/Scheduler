import { describe, expect, test } from 'vitest';
import { addPerson, addVenue, setBox } from '../model/ops';
import { emptyData } from '../model/types';
import { parseBackup, serializeBackup, writeBackup, type FileLike } from './backup';

function sample() {
  let d = addVenue(addPerson(emptyData(), 'ANA'), 'BARCLAYS');
  d = setBox(d, '2026-11-09', d.people[0].id, 0, { kind: 'shift', venueId: d.venues[0].id, start: 420, end: 1260 });
  return d;
}

function fakeFile(permission: PermissionState, failWrite = false) {
  const calls = { writes: [] as string[], requested: 0, opened: 0 };
  const file: FileLike = {
    queryPermission: async () => permission,
    requestPermission: async () => { calls.requested++; return 'granted'; },
    createWritable: async () => {
      calls.opened++;
      return {
        write: async (s: string) => { if (failWrite) throw new Error('disk full'); calls.writes.push(s); },
        close: async () => {},
      };
    },
  };
  return { file, calls };
}

describe('backup file contents', () => {
  test('round trip', () => {
    const d = sample();
    expect(parseBackup(serializeBackup(d, '2026-11-16T12:00:00Z'))).toEqual(d);
  });

  test.each(['{"app":"other"}', 'not json', '{"app":"scheduler","data":{"schemaVersion":1}}'])('rejects %s', (text) => {
    expect(() => parseBackup(text)).toThrow('Not a Scheduler backup file');
  });
});

describe('writeBackup', () => {
  test('no file chosen yet', async () => {
    expect(await writeBackup(null, sample(), 'now')).toBe('none');
  });

  test('writes the backup when permission is granted', async () => {
    const { file, calls } = fakeFile('granted');
    const d = sample();
    expect(await writeBackup(file, d, 'now')).toBe('ok');
    expect(parseBackup(calls.writes[0])).toEqual(d);
  });

  test('permission lapsed after a restart: asks to reconnect, never opens the file or prompts on its own', async () => {
    const { file, calls } = fakeFile('prompt');
    expect(await writeBackup(file, sample(), 'now')).toBe('needs-permission');
    expect(calls.opened).toBe(0);
    expect(calls.requested).toBe(0);
  });

  test('a failed write reports an error instead of throwing', async () => {
    const { file } = fakeFile('granted', true);
    expect(await writeBackup(file, sample(), 'now')).toBe('error');
  });
});

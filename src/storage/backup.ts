import type { AppData } from '../model/types';

export type BackupStatus = 'none' | 'ok' | 'needs-permission' | 'error';

/** The parts of a Chrome FileSystemFileHandle the backup uses (a fake stands in for it in tests). */
export interface FileLike {
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  createWritable(): Promise<{ write(s: string): Promise<void>; close(): Promise<void> }>;
}

export function serializeBackup(d: AppData, savedAt: string): string {
  return JSON.stringify({ app: 'scheduler', savedAt, data: d }, null, 2);
}

export function parseBackup(text: string): AppData {
  const bad = () => new Error('Not a Scheduler backup file');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw bad();
  }
  const p = parsed as { app?: unknown; data?: Partial<AppData> };
  const d = p?.data;
  if (
    p?.app !== 'scheduler' || !d || d.schemaVersion !== 1 ||
    !Array.isArray(d.people) || !Array.isArray(d.venues) || !Array.isArray(d.weeks)
  ) throw bad();
  return d as AppData;
}

/** Saves to the chosen backup file. Never prompts: a lapsed permission is reported so the page can show a button. */
export async function writeBackup(h: FileLike | null, d: AppData, now: string): Promise<BackupStatus> {
  if (!h) return 'none';
  try {
    if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') return 'needs-permission';
    const w = await h.createWritable();
    await w.write(serializeBackup(d, now));
    await w.close();
    return 'ok';
  } catch {
    return 'error';
  }
}

/** Must run from a click: Chrome only shows the permission prompt after a user gesture. */
export async function reconnectBackup(h: FileLike): Promise<boolean> {
  try {
    return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

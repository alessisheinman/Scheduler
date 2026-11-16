import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyData, type AppData } from '../model/types';
import { decideConnect, parseBackup, reconnectBackup, serializeBackup, writeBackup, type BackupStatus } from '../storage/backup';
import { loadBackupHandle, loadData, requestPersistence, saveBackupHandle, saveData } from '../storage/db';

export interface AppState {
  loaded: boolean;
  data: AppData;
  update(fn: (d: AppData) => AppData): void;
  replaceAll(d: AppData): void;
  saveFailed: boolean;
  backup: BackupStatus;
  backupAt: Date | null;
  canAutoBackup: boolean;
  connectBackup(): Promise<void>;
  reconnect(): Promise<void>;
  restore(file: File): Promise<AppData>;
  /** Set when turning on backup found an existing backup and loaded it. */
  restoredFromBackup: boolean;
  downloadBackup(): void;
}

const BACKUP_DELAY_MS = 1000;

export function useAppData(): AppState {
  const [data, setData] = useState<AppData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [backup, setBackup] = useState<BackupStatus>('none');
  const [backupAt, setBackupAt] = useState<Date | null>(null);
  const [restoredFromBackup, setRestoredFromBackup] = useState(false);
  const handle = useRef<FileSystemFileHandle | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<AppData>(data);

  const runBackup = useCallback(async () => {
    const status = await writeBackup(handle.current, latest.current, new Date().toISOString());
    setBackup(status);
    if (status === 'ok') setBackupAt(new Date());
  }, []);

  useEffect(() => {
    void requestPersistence();
    void (async () => {
      const [d, h] = await Promise.all([loadData(), loadBackupHandle()]);
      latest.current = d;
      setData(d);
      handle.current = h;
      if (h) setBackup((await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'ok' : 'needs-permission');
      setLoaded(true);
    })();
  }, []);

  const commit = useCallback((next: AppData) => {
    latest.current = next;
    setData(next);
    saveData(next).then(() => setSaveFailed(false), () => setSaveFailed(true));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void runBackup(), BACKUP_DELAY_MS);
  }, [runBackup]);

  const update = useCallback((fn: (d: AppData) => AppData) => commit(fn(latest.current)), [commit]);

  const connectBackup = useCallback(async () => {
    if (!window.showSaveFilePicker) return;
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: 'scheduler-backup.json',
        types: [{ description: 'Scheduler backup', accept: { 'application/json': ['.json'] } }],
      });
      handle.current = h;
      await saveBackupHandle(h);
      // Never write an empty site over a real backup (e.g. after the browser was wiped): load it instead.
      let existing: string | null = null;
      try { existing = await (await h.getFile()).text(); } catch { /* new file */ }
      if (decideConnect(latest.current, existing) === 'restore') {
        commit(parseBackup(existing!));
        setRestoredFromBackup(true);
      } else {
        await runBackup();
      }
    } catch {
      /* she closed the picker */
    }
  }, [runBackup, commit]);

  const reconnect = useCallback(async () => {
    if (handle.current && (await reconnectBackup(handle.current))) await runBackup();
  }, [runBackup]);

  const restore = useCallback(async (file: File) => parseBackup(await file.text()), []);

  const downloadBackup = useCallback(() => {
    const blob = new Blob([serializeBackup(latest.current, new Date().toISOString())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scheduler-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, []);

  return {
    loaded, data, update, replaceAll: commit, saveFailed, backup, backupAt, restoredFromBackup,
    canAutoBackup: typeof window !== 'undefined' && !!window.showSaveFilePicker,
    connectBackup, reconnect, restore, downloadBackup,
  };
}

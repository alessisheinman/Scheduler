import { useRef, useState } from 'react';
import type { AppData } from '../model/types';
import type { AppState } from './useAppData';

const time = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Backup status and controls, shown under the top bar on every screen. */
export function BackupBar({ app }: { app: AppState }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasData = app.data.weeks.length > 0 || app.data.people.length > 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const d = await app.restore(file);
      if (hasData) setPending(d);
      else app.replaceAll(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="backup-bar">
      {app.backup === 'none' && app.canAutoBackup && (
        <span className="backup-state warn">
          Automatic backup is off.{' '}
          <button type="button" className="primary" onClick={() => void app.connectBackup()}>Turn on automatic backup</button>
        </span>
      )}
      {app.backup === 'none' && !app.canAutoBackup && (
        <span className="backup-state warn">This browser can't save a backup file automatically — use Download backup now and then.</span>
      )}
      {app.backup === 'needs-permission' && (
        <span className="backup-state warn">
          Chrome needs your OK to keep saving the backup file.{' '}
          <button type="button" className="primary" onClick={() => void app.reconnect()}>Reconnect backup</button>
        </span>
      )}
      {app.backup === 'error' && <span className="backup-state bad">Couldn't write the backup file. Try Download backup.</span>}
      {app.backup === 'ok' && <span className="backup-state ok">Backed up ✓ {app.backupAt ? time(app.backupAt) : ''}</span>}
      {app.saveFailed && <span className="backup-state bad">Couldn't save in this browser — download a backup now.</span>}

      <span className="backup-links">
        <button type="button" className="ghost" onClick={app.downloadBackup}>Download backup</button>
        <button type="button" className="ghost" onClick={() => fileInput.current?.click()}>Restore from backup…</button>
      </span>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden
        onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {error && <span className="backup-state bad">{error}</span>}
      {pending && (
        <span className="backup-state warn">
          Replace everything with this backup?{' '}
          <button type="button" className="primary" onClick={() => { app.replaceAll(pending); setPending(null); }}>Replace</button>
          <button type="button" onClick={() => setPending(null)}>Cancel</button>
        </span>
      )}
    </div>
  );
}

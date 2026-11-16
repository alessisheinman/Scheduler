import { createStore, get, set } from 'idb-keyval';
import { emptyData, type AppData } from '../model/types';

const store = createStore('scheduler', 'kv');
const DATA_KEY = 'scheduler:v1';
const HANDLE_KEY = 'scheduler:backup-handle';

export async function loadData(): Promise<AppData> {
  try {
    return (await get<AppData>(DATA_KEY, store)) ?? emptyData();
  } catch {
    return emptyData();
  }
}

export async function saveData(d: AppData): Promise<void> {
  await set(DATA_KEY, d, store);
}

export async function loadBackupHandle(): Promise<FileSystemFileHandle | null> {
  try {
    return (await get<FileSystemFileHandle>(HANDLE_KEY, store)) ?? null;
  } catch {
    return null;
  }
}

export async function saveBackupHandle(h: FileSystemFileHandle): Promise<void> {
  await set(HANDLE_KEY, h, store);
}

/** Asks the browser not to clear this site's data when space runs low. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

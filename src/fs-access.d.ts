// Chrome's File System Access API pieces that TypeScript's DOM types leave out.
interface FileSystemHandle {
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface Window {
  showSaveFilePicker?(o?: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle>;
}

export type LocalStorageSnapshotWriter = Readonly<{ write: (raw: string, savedAt: number, quiet: boolean) => boolean }>;

export function createLocalStorageSnapshotWriter(deps: {
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
  saved: (quiet: boolean) => void;
  failed: (quiet: boolean) => void;
}): LocalStorageSnapshotWriter {
  const write = (raw: string, savedAt: number, quiet: boolean): boolean => {
    try {
      deps.set('qclab', raw);
      deps.set('qclab_saved_at', String(savedAt));
      deps.saved(quiet);
      return true;
    } catch {
      try { deps.remove('qclab'); deps.remove('qclab_saved_at'); } catch {}
      deps.failed(quiet);
      return false;
    }
  };
  return Object.freeze({ write });
}

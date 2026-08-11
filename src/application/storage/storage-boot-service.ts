type BootRecord = { slot?: unknown; shell?: unknown };

export type StorageBootService = Readonly<{
  load: () => boolean;
  loadBootState: () => Promise<boolean>;
}>;

export function createStorageBootService(deps: {
  partitionedSupported: () => boolean;
  readBootRecord: () => string | null;
  discardBootRecord: () => void;
  activatePartitionShell: (shell: unknown, slot: 'a' | 'b') => void;
  loadLegacy: () => boolean;
  localLoadStatus: () => string;
  recoverPendingSigmaDraft: () => boolean;
  restoreFromIndexedDb: () => Promise<boolean>;
}): StorageBootService {
  const load = (): boolean => {
    if (deps.partitionedSupported()) {
      try {
        const raw = deps.readBootRecord();
        if (raw) {
          const record = JSON.parse(raw) as BootRecord;
          if (!record.shell || (record.slot !== 'a' && record.slot !== 'b')) throw new Error('Partition boot record khong hop le.');
          deps.activatePartitionShell(record.shell, record.slot);
          return true;
        }
      } catch {
        try { deps.discardBootRecord(); } catch {}
      }
    }
    return deps.loadLegacy();
  };
  const loadBootState = async (): Promise<boolean> => {
    const localOk = load();
    if (localOk && deps.localLoadStatus() !== 'partition-shell') deps.recoverPendingSigmaDraft();
    const status = deps.localLoadStatus();
    if (status === 'local' || status === 'partition-shell' || !deps.partitionedSupported()) return localOk;
    const restored = await deps.restoreFromIndexedDb();
    if (restored) deps.recoverPendingSigmaDraft();
    return restored || localOk;
  };
  return Object.freeze({ load, loadBootState });
}

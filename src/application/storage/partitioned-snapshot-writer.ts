export type PartitionedSnapshotWriteInput = Readonly<{
  state: unknown;
  slot: string;
  localLoadStatus: string;
  fullDirty: boolean;
  dirtyTestIds: string[];
  streak: number;
  lastFull: number;
  now: number;
  maxIncrementals: number;
  maxMs: number;
  localDraftStamp: number;
  quiet: boolean;
}>;

export type PartitionedSnapshotWriteResult = { slot?: string; savedAt?: number; shell?: unknown };
export type PartitionedSnapshotWriter = Readonly<{ write: (input: PartitionedSnapshotWriteInput) => boolean }>;

export function createPartitionedSnapshotWriter(deps: {
  plan: (input: PartitionedSnapshotWriteInput) => string[] | null;
  defer: () => void;
  writePartitioned: (state: unknown, slot: string, dirtyTestIds: string[] | null) => Promise<PartitionedSnapshotWriteResult | null>;
  setPending: (pending: Promise<boolean>) => void;
  completed: (result: PartitionedSnapshotWriteResult, input: PartitionedSnapshotWriteInput) => void;
  failed: (input: PartitionedSnapshotWriteInput) => void;
}): PartitionedSnapshotWriter {
  const write = (input: PartitionedSnapshotWriteInput): boolean => {
    if (input.localLoadStatus === 'partition-shell') { deps.defer(); return false; }
    const dirtyTestIds = deps.plan(input);
    const pending = deps.writePartitioned(input.state, input.slot, dirtyTestIds).then(result => {
      if (!result) throw new Error('Khong the ghi snapshot phan vung.');
      deps.completed(result, input);
      return true;
    }).catch(() => {
      deps.failed(input);
      return false;
    });
    deps.setPending(pending);
    return true;
  };
  return Object.freeze({ write });
}

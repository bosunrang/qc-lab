export type PartitionHydrationRecord = { state?: unknown; slot?: unknown };

export type PartitionHydrationService = Readonly<{ hydrate: () => Promise<boolean> }>;

export function createPartitionHydrationService(deps: {
  read: () => Promise<PartitionHydrationRecord | null>;
  adopt: (value: unknown) => void;
  recoverPendingSigmaDraft: () => boolean;
  accept: (record: PartitionHydrationRecord) => void;
  reportFailure: (error: unknown) => void;
}): PartitionHydrationService {
  const hydrate = async (): Promise<boolean> => {
    try {
      const record = await deps.read();
      if (!record?.state) throw new Error('Khong tim thay cac phan vung du lieu QC.');
      deps.adopt(record.state);
      deps.recoverPendingSigmaDraft();
      deps.accept(record);
      return true;
    } catch (error) {
      deps.reportFailure(error);
      return false;
    }
  };
  return Object.freeze({ hydrate });
}

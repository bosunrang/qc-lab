export type PartitionedRecoveryRecord = { state?: unknown; slot?: string; savedAt?: unknown };
export type LegacyRecoveryRecord = { state?: unknown; json?: unknown };

export type IndexedDbRecoveryService = Readonly<{ restore: () => Promise<boolean> }>;

export function createIndexedDbRecoveryService(deps: {
  supported: () => boolean;
  readPartitioned: () => Promise<PartitionedRecoveryRecord | null>;
  readLegacy: () => Promise<LegacyRecoveryRecord | null>;
  adopt: (value: unknown) => void;
  acceptPartitioned: (record: PartitionedRecoveryRecord) => void;
  acceptLegacy: () => void;
  reportFailure: (kind: 'partitioned' | 'legacy', error: unknown, raw?: string) => void;
}): IndexedDbRecoveryService {
  const restore = async (): Promise<boolean> => {
    if (!deps.supported()) return false;
    try {
      const partitioned = await deps.readPartitioned();
      if (partitioned?.state) {
        deps.adopt(partitioned.state);
        deps.acceptPartitioned(partitioned);
        return true;
      }
    } catch (error) {
      deps.reportFailure('partitioned', error);
      return false;
    }
    let record: LegacyRecoveryRecord | null;
    try { record = await deps.readLegacy(); } catch { return false; }
    let parsed = record?.state;
    if (!parsed && record?.json) {
      try { parsed = JSON.parse(String(record.json)); }
      catch (error) { deps.reportFailure('legacy', error, String(record.json)); return false; }
    }
    if (!parsed) return false;
    try {
      deps.adopt(parsed);
      deps.acceptLegacy();
      return true;
    } catch (error) {
      deps.reportFailure('legacy', error, JSON.stringify(parsed));
      return false;
    }
  };
  return Object.freeze({ restore });
}

type Value = Record<string, any>;

const ENTRY_KEYS = ['tea', 'teaSource', 'teaLabel', 'teaReference', 'teaSourceId', 'teaSourceVersion', 'teaSourceUrl', 'teaEffectiveDate', 'teaReviewedDate', 'teaReviewedBy'];
const SNAPSHOT_KEYS = ['tea', 'teaSource', 'teaLabel', 'teaReference', 'teaCapturedAt', 'teaSourceId', 'teaSourceVersion', 'teaSourceUrl', 'teaEffectiveDate', 'teaReviewedDate', 'teaReviewedBy'];

export function createSigmaTeaSnapshotService() {
  const syncCurrent = (test: Value, entries: Value[], period: string, snapshot: (test: Value) => Value, setLevelSnapshot: (test: Value, entry: Value, level: string, force: boolean) => Value) => {
    const entry = test && entries.find(item => item.period === period); if (!entry) return null;
    const next = snapshot(test); let changed = ENTRY_KEYS.some(key => String(entry[key] ?? '') !== String(next[key] ?? ''));
    if (changed) { SNAPSHOT_KEYS.forEach(key => delete entry[key]); Object.assign(entry, next); }
    Object.keys(entry.lv || {}).forEach(level => { const before = JSON.stringify(entry.lv[level]); setLevelSnapshot(test, entry, level, true); if (before !== JSON.stringify(entry.lv[level])) changed = true; });
    return changed ? entry : null;
  };
  const reconcile = (tests: Value[], entriesFor: (test: Value) => Value[], period: string, snapshot: (test: Value) => Value, setLevelSnapshot: (test: Value, entry: Value, level: string, force: boolean) => Value) => {
    let changed = false;
    tests.forEach(test => { if (syncCurrent(test, entriesFor(test), period, snapshot, setLevelSnapshot)) changed = true; });
    return changed;
  };
  return Object.freeze({ syncCurrent, reconcile });
}
export type SigmaTeaSnapshotService = ReturnType<typeof createSigmaTeaSnapshotService>;

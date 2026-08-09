type Value = Record<string, any>;

export function createSigmaPeriodRecordService() {
  const add = (records: Value[], period: string, id: string, teaSnapshot: Value) => {
    if (records.some(record => record.period === period)) return { added: false, entry: null };
    const entry = { id, period, ...teaSnapshot, lv: {} };
    records.push(entry);
    return { added: true, entry };
  };
  const changePeriod = (records: Value[], id: string, period: string) => {
    const entry = records.find(record => record.id === id);
    if (!entry) return { changed: false, duplicate: false };
    if (records.some(record => record.id !== id && record.period === period)) return { changed: false, duplicate: true };
    entry.period = period;
    return { changed: true, duplicate: false };
  };
  const remove = (records: Value[], id: string) => {
    const index = records.findIndex(record => record.id === id);
    if (index < 0) return false;
    records.splice(index, 1);
    return true;
  };
  return Object.freeze({ add, changePeriod, remove });
}
export type SigmaPeriodRecordService = ReturnType<typeof createSigmaPeriodRecordService>;

type Row = Record<string, any>;
const finite = (value: unknown) => Number.isFinite(Number(value));
export function qcLotMeanSd(levelConfig: Row | null | undefined, lotNo: unknown, points: Row[] = []) {
  if (levelConfig && (levelConfig.lot || '') === (lotNo || '') && finite(levelConfig.mean) && finite(levelConfig.sd)) return { mean: Number(levelConfig.mean), sd: Number(levelConfig.sd) };
  const history = (levelConfig?.meanSdHistory || []).slice().reverse().find((entry: Row) => (entry.lot || '') === (lotNo || '') && finite(entry.mean) && finite(entry.sd));
  if (history) return { mean: Number(history.mean), sd: Number(history.sd) };
  const point = points.find(item => (item.lot || '') === (lotNo || '') && finite(item.qcMean) && finite(item.qcSd));
  return point ? { mean: Number(point.qcMean), sd: Number(point.qcSd) } : null;
}
export function qcLotTargetSnapshot(levelConfig: Row | null | undefined, lotId: unknown, lotNo: unknown) {
  if (!levelConfig) return null;
  const snapshot = (value: Row) => ({ mean: Number(value.mean), sd: Number(value.sd), low: value.low == null ? null : Number(value.low), high: value.high == null ? null : Number(value.high) });
  if (levelConfig.qcLotId === lotId && finite(levelConfig.mean) && finite(levelConfig.sd)) return snapshot(levelConfig);
  const history = (levelConfig.meanSdHistory || []).slice().reverse().find((entry: Row) => (entry.qcLotId ? entry.qcLotId === lotId : (entry.lot || '') === (lotNo || '')) && finite(entry.mean) && finite(entry.sd));
  return history ? snapshot(history) : null;
}

type History = { qcLotId?: string; lot?: string; planned?: boolean };
type Level = { level?: number | string; qcLotId?: string; lot?: string; exp?: string; applied?: string; meanSdHistory?: History[] };
type Assay = { name?: string; levels?: Level[] };
type Lot = { id?: string; lotNo?: string; level?: number | string };

export function historySearchValues(assay: Assay, lots: Lot[], displayName: (assay: Assay) => string) {
  const values: unknown[] = [assay.name, displayName(assay)];
  (assay.levels || []).forEach(level => {
    const history = level.meanSdHistory?.length ? level.meanSdHistory : [{ qcLotId: level.qcLotId, lot: level.lot }];
    history.forEach(item => {
      if (item.planned) return;
      const lot = lots.find(candidate => candidate.id === (item.qcLotId || level.qcLotId))
        || lots.find(candidate => candidate.lotNo === (item.lot || level.lot) && Number(candidate.level) === Number(level.level));
      values.push(level.level, `M${level.level}`, `Mức ${level.level}`, item.lot, level.lot, lot?.lotNo);
    });
  });
  return values;
}

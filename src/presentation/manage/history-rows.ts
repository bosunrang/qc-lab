type History = { qcLotId?: string; lot?: string; mean?: unknown; sd?: unknown; low?: unknown; high?: unknown; effectiveFrom?: string; effectiveTo?: string; source?: string; planned?: boolean };
type Level = { level?: number | string; qcLotId?: string; lot?: string; mean?: unknown; sd?: unknown; low?: unknown; high?: unknown; exp?: string; applied?: string; meanSdHistory?: History[] };
type Assay = { id: string; levels?: Level[] };
type Lot = { id: string; lotNo?: string; level?: number | string };
type Point = { level?: number | string; lot?: string };

export function historyRows(assay: Assay, lots: Lot[], points: Point[], groupLabel: (lotId: string) => string) {
  const rows: Array<{ t: Assay; l: Level; h: History; lotObj?: Lot; lotNo: string; group: string; pts: Point[] }> = [];
  (assay.levels || []).forEach(level => {
    const history = level.meanSdHistory?.length ? level.meanSdHistory : [{ qcLotId: level.qcLotId, lot: level.lot, mean: level.mean, sd: level.sd, low: level.low, high: level.high, effectiveFrom: '', effectiveTo: level.exp, source: level.applied || 'mfg' }];
    history.forEach(item => {
      if (item.planned) return;
      const lotObj = lots.find(lot => lot.id === (item.qcLotId || level.qcLotId))
        || lots.find(lot => lot.lotNo === (item.lot || level.lot) && Number(lot.level) === Number(level.level));
      const lotNo = item.lot || level.lot || lotObj?.lotNo || '';
      rows.push({
        t: assay,
        l: level,
        h: item,
        lotObj,
        lotNo,
        group: lotObj ? groupLabel(lotObj.id) : 'Chưa thuộc nhóm',
        pts: points.filter(point => Number(point.level) === Number(level.level) && (point.lot || '') === (lotNo || '')),
      });
    });
  });
  return rows;
}

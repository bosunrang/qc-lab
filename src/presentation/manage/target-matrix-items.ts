type Level = { qcLotId?: string; level?: number | string };
type Assay<TLevel extends Level> = { levels?: TLevel[] };
type Lot = { id: string; level: number | string; lotNo?: string; depleted?: boolean };

export function targetMatrixItems<TLevel extends Level, TAssay extends Assay<TLevel>, TLot extends Lot>(
  assays: TAssay[],
  lots: TLot[],
  assigned: (level: TLevel | undefined) => boolean,
  plannedTarget: (assay: TAssay, lot: TLot) => unknown,
  snapshot: (assay: TAssay, level: number | string, lotId: string, lotNo: string | undefined) => unknown,
) {
  return assays.flatMap(assay => lots.map(lot => ({ assay, lot })))
    .filter(({ assay, lot }) => !lot.depleted || (assay.levels || []).some(level => level.qcLotId === lot.id))
    .map(({ assay, lot }) => {
      const linked = (assay.levels || []).find(level => level.qcLotId === lot.id);
      const same = (assay.levels || []).find(level => Number(level.level) === Number(lot.level));
      const assignedElsewhere = assigned(same);
      const planned = !linked && plannedTarget(assay, lot);
      const cfg = linked || snapshot(assay, lot.level, lot.id, lot.lotNo);
      return { t: assay, lot, linked, same, assigned: assignedElsewhere, planned, cfg };
    });
}

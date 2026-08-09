export function actionPointIndex(points: Record<string, any>[] | null | undefined): Map<string, Record<string, any>> {
  return new Map((points || []).map(point => [point.id, point]));
}

export function actionLotPoints(
  points: Record<string, any>[] | null | undefined, level: unknown, lot: unknown,
  runNumber: (point: Record<string, any>) => number,
): Record<string, any>[] {
  return (points || []).filter(point => !point.voided && Number(point.level) === Number(level) && (point.lot || '') === (lot || ''))
    .sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')) || runNumber(left) - runNumber(right));
}

export const nceActionQcIndex = Object.freeze({ actionPointIndex, actionLotPoints });
export type NceActionQcIndex = typeof nceActionQcIndex;

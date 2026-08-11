export function qcPlannedTarget(levelConfig: Record<string, any> | null | undefined, lot: Record<string, any> | null | undefined) {
  if (!levelConfig || !lot || levelConfig.qcLotId === lot.id) return null;
  return (levelConfig.meanSdHistory || []).find((history: Record<string, any>) => history.qcLotId === lot.id && history.planned) || null;
}

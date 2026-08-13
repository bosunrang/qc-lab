export function createManageTargetBackfillWorkflow(deps: { pointsForPick: (pick: any) => any[] }) {
  return Object.freeze({points: (picked: readonly any[]) => picked.filter(pick=>pick.use).flatMap(pick=>deps.pointsForPick(pick))});
}

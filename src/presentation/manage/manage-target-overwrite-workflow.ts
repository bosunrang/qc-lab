export function createManageTargetOverwriteWorkflow() {
  return Object.freeze({find: (picked: readonly any[], tests: readonly any[]) => picked.filter(pick => { if (!pick.use) return false; const test=tests.find(item=>item.id===pick.testId),level=test?.levels?.find((item:any)=>+item.level===+pick.lot.level); return !!(level&&((level.qcLotId&&level.qcLotId!==pick.lot.id)||(!level.qcLotId&&level.lot&&level.lot!==pick.lot.lotNo))); })});
}

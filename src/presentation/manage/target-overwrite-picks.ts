export type TargetOverwriteLot = { id: string; lotNo: string; level: number };
export type TargetOverwritePick = { testId: string; lot: TargetOverwriteLot; use: boolean };
export type TargetOverwriteTest = { id: string; levels: Array<{ level: number; qcLotId?: string; lot?: string }> };

export function targetOverwritePicks(picks: TargetOverwritePick[], tests: TargetOverwriteTest[]) {
  return picks.filter(pick=>{
    if(!pick.use)return false;
    const test=tests.find(item=>item.id===pick.testId),same=test&&test.levels.find(level=>+level.level===+pick.lot.level);
    return !!(same&&((same.qcLotId&&same.qcLotId!==pick.lot.id)||(!same.qcLotId&&same.lot&&same.lot!==pick.lot.lotNo)));
  });
}

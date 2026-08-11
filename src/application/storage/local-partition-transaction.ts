export function createLocalPartitionTransaction(deps:{nextSlot:(value:any)=>string;shell:(value:any)=>any;now:()=>number}) {
  const draft = (state:any, currentSlot:any, dirtyTestIds:any, currentManifest:any) => {
    const data = state && state.data || {}, testIds = Object.keys(data), dirty = Array.isArray(dirtyTestIds) ? [...new Set(dirtyTestIds.map(String))] : null;
    const incremental = !!(currentManifest && dirty);
    return { data, testIds, dirtyTestIds: dirty, incremental, slot: incremental ? currentSlot : deps.nextSlot(currentSlot) };
  };
  const finalize = (state:any, currentManifest:any, slotManifest:any, draftPlan:any) => {
    const partitions = draftPlan.incremental ? draftPlan.dirtyTestIds.filter((id:string) => Object.prototype.hasOwnProperty.call(draftPlan.data, id)) : draftPlan.testIds;
    const removedTestIds = (slotManifest && Array.isArray(slotManifest.testIds) ? slotManifest.testIds : []).filter((id:string) => !draftPlan.testIds.includes(id));
    return { ...draftPlan, savedAt: Math.max(deps.now(), Number(currentManifest && currentManifest.savedAt || 0) + 1), shell: deps.shell(state), partitions, removedTestIds };
  };
  return Object.freeze({ draft, finalize });
}

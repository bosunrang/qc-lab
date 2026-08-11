export function createLocalPartitionRecovery(valid:(manifest:any,shell:any,rows:any[])=>boolean) {
  return (slot:any, manifest:any, shell:any, rows:any[]) => {
    if (slot !== 'a' && slot !== 'b' || !valid(manifest, shell, rows)) return null;
    const testIds = Array.isArray(manifest.testIds) ? manifest.testIds : [], data:any = {};
    testIds.forEach((testId:string, index:number) => { data[testId] = rows[index].points; });
    return { slot, savedAt: manifest.savedAt || 0, state: { ...shell.state, data } };
  };
}

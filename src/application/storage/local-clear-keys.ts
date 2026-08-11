export function createLocalClearKeys(key:(slot:any,type:any,id?:any)=>string, stateKey:string) {
  return (manifests:any[]) => { const keys = [stateKey, 'partition:latest']; ['a','b'].forEach((slot,index) => { keys.push(key(slot,'manifest'), key(slot,'shell')); (manifests[index] && Array.isArray(manifests[index].testIds) ? manifests[index].testIds : []).forEach((testId:any) => keys.push(key(slot,'data',testId))); }); return keys; };
}

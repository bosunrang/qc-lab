export function createFirebaseMergeApplication(deps:{merge:(local:any,remote:any,base:any)=>any;firstMerge:(local:any,remote:any)=>any}) {
  return (base:any, mergeFirstConnect:boolean, local:any, remote:any) => base ? deps.merge(local, remote, base) : mergeFirstConnect ? deps.firstMerge(local, remote) : remote;
}

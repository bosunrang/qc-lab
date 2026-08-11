export function createLocalSnapshotRecord(deps:{clone:(value:any)=>any;now:()=>number;key:string}) {
  const state = (value:any) => ({ key: deps.key, savedAt: deps.now(), state: deps.clone(value) });
  const serialized = (value:any) => ({ key: deps.key, savedAt: deps.now(), json: String(value) });
  return Object.freeze({ state, serialized });
}

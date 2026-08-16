export type StorageLifecycleApi=Readonly<{
  adopt:(value:unknown)=>void;
  load:()=>boolean;
  loadBootState:()=>Promise<boolean>;
  hydratePartitioned:()=>Promise<boolean>;
  restoreFromIndexedDb:()=>Promise<boolean>;
}>;

/* Cổng lifecycle cho toàn bộ ingress state: mọi snapshot phải đi qua validate →
   sanitize → normalize → invariant trước khi được runtime nhận. Boot shell,
   hydration hai pha và recovery IndexedDB cũng được gom tại đây để adapter JS
   không tự ghép các service persistence độc lập. */
export function createStorageLifecycleService(deps:{
  sanitize:(value:unknown)=>any;
  normalize:(value:any)=>any;
  assertInvariants:(value:any)=>unknown;
  boot:{load:()=>boolean;loadBootState:()=>Promise<boolean>};
  hydrate:()=>Promise<boolean>;
  restore:()=>Promise<boolean>;
}):StorageLifecycleApi{
  const adopt=(value:unknown):void=>{const sanitized=deps.sanitize(value),normalized=deps.normalize(sanitized);deps.assertInvariants(normalized);};
  const load=()=>deps.boot.load();
  const loadBootState=()=>deps.boot.loadBootState();
  const hydratePartitioned=()=>deps.hydrate();
  const restoreFromIndexedDb=()=>deps.restore();
  return Object.freeze({adopt,load,loadBootState,hydratePartitioned,restoreFromIndexedDb});
}

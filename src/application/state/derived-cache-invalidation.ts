type KeyedCache={clear:()=>void;keys:()=>Iterable<unknown>;delete:(key:unknown)=>boolean};
type OptionalCache={clear:(testId?:any)=>void};

export type DerivedCacheInvalidationDependencies={
  pointCaches:()=>KeyedCache[];
  westgardMemo:()=>KeyedCache;
  acceptedMemo:()=>KeyedCache;
  cusumMemo:()=>KeyedCache;
  pointCache:()=>OptionalCache|undefined;
  westgardCache:()=>OptionalCache|undefined;
  acceptedCache:()=>OptionalCache|undefined;
  cusumCache:()=>OptionalCache|undefined;
  resetDerivedIndex:()=>void;
  resetStatus:()=>void;
  clearStatus:(testId:unknown)=>void;
  invalidateWestgardWorker:(testId?:unknown)=>void;
  invalidateActionCaches:(testId?:unknown)=>void;
};

const attempt=(work:()=>void)=>{try{work();}catch{}};
const clearPrefixed=(cache:KeyedCache,prefix:string)=>{[...cache.keys()].forEach(key=>{if(String(key).startsWith(prefix))cache.delete(key);});};

export function createDerivedCacheInvalidation(deps:DerivedCacheInvalidationDependencies){
  const clearAll=()=>{
    deps.pointCaches().forEach(cache=>cache.clear());
    attempt(()=>deps.pointCache()?.clear());
    deps.westgardMemo().clear();attempt(()=>deps.westgardCache()?.clear());
    deps.acceptedMemo().clear();attempt(()=>deps.acceptedCache()?.clear());
    deps.cusumMemo().clear();attempt(()=>deps.cusumCache()?.clear());
    deps.resetDerivedIndex();attempt(deps.resetStatus);
    attempt(()=>deps.invalidateWestgardWorker());attempt(()=>deps.invalidateActionCaches());
  };
  const clearForTest=(testId:unknown)=>{
    const prefix=String(testId||'')+'|';
    deps.pointCaches().forEach(cache=>clearPrefixed(cache,prefix));
    attempt(()=>deps.cusumCache()?.clear(testId));attempt(()=>deps.pointCache()?.clear(testId));
    deps.westgardMemo().delete(testId);attempt(()=>deps.westgardCache()?.clear(testId));
    clearPrefixed(deps.acceptedMemo(),prefix);attempt(()=>deps.acceptedCache()?.clear(testId));
    attempt(()=>deps.clearStatus(testId));
    attempt(()=>deps.invalidateWestgardWorker(testId));attempt(()=>deps.invalidateActionCaches(testId));
  };
  return{clearAll,clearForTest};
}

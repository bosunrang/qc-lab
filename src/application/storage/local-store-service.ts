export type LocalStoreApi=Readonly<{
  supported:()=>boolean;
  read:()=>Promise<any>;
  write:(state:any)=>Promise<boolean>;
  writeSerialized:(json:string)=>Promise<boolean>;
  writePartitioned:(state:any,currentSlot:string,options?:{dirtyTestIds?:string[]|null})=>Promise<any>;
  readPartitioned:(slot?:string)=>Promise<any>;
  clear:()=>Promise<boolean>;
}>;

/* Mặt tiền trọn vẹn cho kho IndexedDB cục bộ. Các chi tiết giao dịch, phân vùng
   A/B và khôi phục đã tách thành primitive riêng; service này là điểm vào duy
   nhất của runtime storage để adapter JavaScript không còn tự ghép chúng. */
export function createLocalStoreService(deps:{
  indexedDbAvailable:()=>boolean;
  get:(key:string)=>Promise<any>;
  put:(record:any)=>Promise<boolean>;
  remove:(key:string)=>Promise<boolean>;
  stateRecord:(state:any)=>any;
  serializedRecord:(json:string)=>any;
  writePartitioned:(input:{state:any;currentSlot:string;dirtyTestIds:string[]|null;read:(key:string)=>Promise<any>;put:(record:any)=>Promise<boolean>;remove:(key:string)=>Promise<boolean>})=>Promise<any>;
  readPartitioned:(slot:string|undefined,get:(key:string)=>Promise<any>)=>Promise<any>;
  clear:(get:(key:string)=>Promise<any>,remove:(key:string)=>Promise<boolean>)=>Promise<boolean>;
}):LocalStoreApi{
  const supported=()=>deps.indexedDbAvailable();
  const read=()=>supported()?deps.get('state'):Promise.resolve(null);
  const write=(state:any)=>supported()?deps.put(deps.stateRecord(state)):Promise.resolve(false);
  const writeSerialized=(json:string)=>supported()?deps.put(deps.serializedRecord(json)):Promise.resolve(false);
  const writePartitioned=(state:any,currentSlot:string,options:{dirtyTestIds?:string[]|null}={})=>{
    const ids=Array.isArray(options.dirtyTestIds)?[...new Set(options.dirtyTestIds.map(String))]:null;
    return deps.writePartitioned({state,currentSlot,dirtyTestIds:ids,read:deps.get,put:deps.put,remove:deps.remove});
  };
  const readPartitioned=(slot?:string)=>deps.readPartitioned(slot,deps.get);
  const clear=()=>supported()?deps.clear(deps.get,deps.remove):Promise.resolve(false);
  return Object.freeze({supported,read,write,writeSerialized,writePartitioned,readPartitioned,clear});
}

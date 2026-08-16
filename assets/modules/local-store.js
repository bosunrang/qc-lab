/* ===== INDEXEDDB LOCAL STORE =====
   Adapter classic: implementation thuộc LocalStoreService TypeScript (bundle
   nạp trước boot). Giữ tên global LocalStore vì state-storage.js và các bản
   backup cũ cùng dùng hợp đồng này. */
const LocalStore=Object.freeze({
  supported:()=>!!(globalThis.localStoreService&&globalThis.localStoreService.supported()),
  read:()=>globalThis.localStoreService?globalThis.localStoreService.read():Promise.resolve(null),
  write:value=>globalThis.localStoreService?globalThis.localStoreService.write(value):Promise.resolve(false),
  writeSerialized:value=>globalThis.localStoreService?globalThis.localStoreService.writeSerialized(value):Promise.resolve(false),
  writePartitioned:(value,slot,options)=>globalThis.localStoreService?globalThis.localStoreService.writePartitioned(value,slot,options):Promise.resolve(false),
  readPartitioned:slot=>globalThis.localStoreService?globalThis.localStoreService.readPartitioned(slot):Promise.resolve(null),
  clear:()=>globalThis.localStoreService?globalThis.localStoreService.clear():Promise.resolve(false)
});

/* ===== INDEXEDDB LOCAL STORE =====
   Adapter classic: implementation thuộc LocalStoreService TypeScript (bundle
   nạp trước boot). Giữ tên global LocalStore vì state-storage.js và các bản
   backup cũ cùng dùng hợp đồng này. */
const LocalStore=Object.freeze({
  supported:()=>globalThis.localStoreService.supported(),
  read:()=>globalThis.localStoreService.read(),
  write:value=>globalThis.localStoreService.write(value),
  writeSerialized:value=>globalThis.localStoreService.writeSerialized(value),
  writePartitioned:(value,slot,options)=>globalThis.localStoreService.writePartitioned(value,slot,options),
  readPartitioned:slot=>globalThis.localStoreService.readPartitioned(slot),
  clear:()=>globalThis.localStoreService.clear()
});

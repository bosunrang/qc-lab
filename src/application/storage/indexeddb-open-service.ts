export type IndexedDbOpenService = Readonly<{ open: () => Promise<any> }>;

export function createIndexedDbOpenService(deps: {
  indexedDb: () => any;
  databaseName?: string;
  databaseVersion?: number;
  storeName?: string;
}): IndexedDbOpenService {
  const databaseName = deps.databaseName || 'qclab-local', databaseVersion = deps.databaseVersion || 1, storeName = deps.storeName || 'snapshots';
  let pending: Promise<any> | null = null;
  const open = (): Promise<any> => {
    const indexedDb = deps.indexedDb();
    if (!indexedDb) return Promise.resolve(null);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      let request: any;
      try { request = indexedDb.open(databaseName, databaseVersion); } catch (error) { reject(error); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath:'key' }); };
      request.onsuccess = () => { const database = request.result; database.onversionchange = () => { database.close(); pending = null; }; resolve(database); };
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB is blocked'));
    }).catch(error => { pending = null; throw error; });
    return pending;
  };
  return Object.freeze({ open });
}

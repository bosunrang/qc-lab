export type IndexedDbRecordService = Readonly<{ get: (key: string) => Promise<any>; put: (record: any) => Promise<boolean>; delete: (key: string) => Promise<boolean> }>;

export function createIndexedDbRecordService(deps: { open: () => Promise<any>; storeName?: string }): IndexedDbRecordService {
  const storeName = deps.storeName || 'snapshots';
  const request = <T>(mode: 'readonly' | 'readwrite', run: (store: any) => any, empty: T, message: string): Promise<T> => deps.open().then(database => new Promise((resolve, reject) => {
    if (!database) { resolve(empty); return; }
    const operation = run(database.transaction(storeName, mode).objectStore(storeName));
    operation.onsuccess = () => resolve(operation.result === undefined ? empty : operation.result);
    operation.onerror = () => reject(operation.error || new Error(message));
  }));
  return Object.freeze({
    get: key => request('readonly', store => store.get(key), null, 'IndexedDB read failed'),
    put: record => request('readwrite', store => store.put(record), false, 'IndexedDB write failed').then(() => true),
    delete: key => request('readwrite', store => store.delete(key), false, 'IndexedDB clear failed').then(() => true),
  });
}

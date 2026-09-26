// Lớp CHỈ CHẠY TRONG TRÌNH DUYỆT của bản xem trước: trỏ tới file `.wasm` của
// sql.js và lưu database xuống IndexedDB. Phần bọc sql.js thành hợp đồng
// `SqliteLike` nằm ở `sqlite-shim.ts` (thuần, test được trong Node) — tách
// đôi như vậy để test `app/tests/sqlite-shim.test.mjs` chạy được ở Node,
// nơi không có `?url` của Vite lẫn IndexedDB.
//
// File này CHỈ được nạp bằng `await import()` động từ nhánh "không có
// Electron", nên Vite tách nó (cùng ~1MB WASM) thành chunk riêng và bản
// Electron thật không bao giờ tải tới.
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { applySchema, seedInitialRows } from '../../main/db/schema';
import { createBrowserDatabase, type BrowserDb, type SqlJsStatic } from './sqlite-shim';

const IDB_NAME = 'qclab-preview';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'snapshot';
/** Gộp nhiều lần ghi liên tiếp thành một lần xuất ảnh nhị phân. */
const PERSIST_DEBOUNCE_MS = 250;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readSnapshot(): Promise<Uint8Array | null> {
  try {
    const idb = await openIdb();
    return await new Promise((resolve, reject) => {
      const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        const value = req.result;
        resolve(value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Cửa sổ ẩn danh / trình duyệt chặn lưu trữ: chạy tiếp với database rỗng
    // thay vì chặn cả bản xem trước.
    return null;
  }
}

async function writeSnapshot(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface PreviewDatabase {
  db: BrowserDb;
  /** Hẹn ghi ảnh nhị phân xuống IndexedDB (gộp các lần gọi gần nhau). */
  persist(): void;
  /** Ghi ngay, không chờ debounce — dùng khi trang sắp đóng. */
  flush(): Promise<void>;
}

/** Mở database của bản xem trước: nạp WASM, mở lại ảnh đã lưu (nếu có), áp
 * schema THẬT và seed các dòng khởi tạo THẬT. */
export async function openPreviewDatabase(): Promise<PreviewDatabase> {
  const SQL = (await initSqlJs({ locateFile: () => wasmUrl })) as unknown as SqlJsStatic;
  const saved = await readSnapshot();
  const db = createBrowserDatabase(SQL, applySchema, saved);
  seedInitialRows(db);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<void> = Promise.resolve();

  function flushNow(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    pending = writeSnapshot(db.export()).catch((error) => {
      console.error('[preview] không ghi được database xuống IndexedDB:', error);
    });
    return pending;
  }

  const api: PreviewDatabase = {
    db,
    persist() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void flushNow(); }, PERSIST_DEBOUNCE_MS);
    },
    flush: flushNow,
  };

  // Đóng tab giữa lúc còn hẹn ghi thì mất đúng thao tác cuối — ghi ngay.
  window.addEventListener('pagehide', () => { void flushNow(); });
  return api;
}



// Bọc `sql.js` (SQLite biên dịch sang WASM) thành đúng hợp đồng
// `SqliteLike` mà mọi handler `main/ipc/*` đang dùng — xem
//
// Mục đích (2026-09-09, bước 1 của việc gỡ bản giả lập viết tay): bản xem
// trước qua trình duyệt (`npm run app:dev`) sẽ chạy CHÍNH handler thật
// thay vì `browser-mock/api.ts` — 1.748 dòng dịch lại logic của handler,
// nguồn của 18 lệch hành vi mà hạng mục C7 đã phải đi bắt từng cái.
//
// File này CỐ Ý không biết file `.wasm` nằm ở đâu: nó nhận sẵn một
// `SqlJsStatic` đã khởi tạo. Nhờ vậy nó chạy được cả trong Node (test
// `app/tests/sqlite-shim.test.mjs` áp `applySchema()` THẬT lên nó) lẫn
// trong trình duyệt — phần trỏ tới `.wasm` và lưu xuống IndexedDB nằm riêng
// ở `sqlite-loader.ts`, vốn chỉ chạy được trong trình duyệt.
import type { SqliteLike, SqliteStatementLike, SqliteRunResult } from '../../main/db/sqlite-like';

/** Bề mặt tối thiểu của `sql.js` mà shim này cần — khai tay thay vì import
 * type của `sql.js` để file chạy được ở cả Node và trình duyệt mà không
 * buộc phải có `@types/sql.js` trong mọi lượt `tsc`. */
export interface SqlJsStatement {
  bind(values: unknown[] | Record<string, unknown>): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  run(values?: unknown[] | Record<string, unknown>): void;
  free(): boolean;
}
export interface SqlJsDatabase {
  prepare(sql: string): SqlJsStatement;
  exec(sql: string): unknown;
  export(): Uint8Array;
  getRowsModified(): number;
  close(): void;
}
export interface SqlJsStatic {
  Database: new (bytes?: Uint8Array | null) => SqlJsDatabase;
}

/** Kết nối trình duyệt: `SqliteLike` cộng 2 việc chỉ bản xem trước cần. */
export interface BrowserDb extends SqliteLike {
  /** Ảnh nhị phân của cả database, để ghi xuống IndexedDB. */
  export(): Uint8Array;
  close(): void;
}

function isNamedParamBag(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null &&
    !Array.isArray(value) && !(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)
  );
}

/** `node:sqlite` nhận tham số ĐẶT TÊN dưới dạng object KHÔNG có prefix
 * (`.run({ id, seq })` cho SQL `VALUES (@id,@seq)`), còn sql.js đòi key PHẢI
 * mang đúng prefix (`{'@id': ...}`). Không dịch bước này thì sql.js ném
 * "tried to bind a value of an unknown type ([object Object])" — đã gặp
 * thật, và chỗ duy nhất trong repo dùng kiểu này là `writeAudit()`
 * (`shared.ts`), tức MỌI thao tác ghi đều đi qua nó.
 *
 * Prefix suy từ chính câu SQL thay vì cố định '@', để một câu dùng ':' hay
 * '$' sau này vẫn đúng. */
function toSqlJsParams(sql: string, params: unknown[]): unknown[] | Record<string, unknown> | undefined {
  if (params.length === 0) return undefined;
  if (params.length === 1 && isNamedParamBag(params[0])) {
    const prefix = sql.includes('@') ? '@' : sql.includes('$') ? '$' : ':';
    const bag = params[0] as Record<string, unknown>;
    const named: Record<string, unknown> = {};
    for (const key of Object.keys(bag)) named[key.startsWith(prefix) ? key : prefix + key] = bag[key];
    return named;
  }
  return params;
}

function bindIfAny(stmt: SqlJsStatement, sql: string, params: unknown[]): void {
  // `bind([])` của sql.js với câu lệnh không có tham số là vô nghĩa và có
  // thể ném lỗi, nên chỉ bind khi thật sự có tham số.
  const bound = toSqlJsParams(sql, params);
  if (bound !== undefined) stmt.bind(bound as never);
}

/** Bọc 1 `sql.js` Database thành `SqliteLike`.
 *
 * Ba điểm cố ý KHÔNG "sửa cho dễ chịu", vì mọi khác biệt ở đây là một lệch
 * hành vi giữa bản xem trước và bản Electron thật:
 * - Tham số `undefined`/`boolean` được truyền NGUYÊN cho sql.js để nó tự ném
 *   lỗi, đúng như `node:sqlite` ném — không âm thầm đổi thành `null`/`0|1`.
 * - `.get()` trả `undefined` khi không có dòng nào (không phải `null`).
 * - Mỗi lời gọi tự `free()` statement: handler thật gọi `db.prepare()` mới
 *   mỗi lần (321 chỗ, không cache), nên vòng đời statement khớp tự nhiên và
 *   không rò bộ nhớ WASM.
 */
export function wrapSqlJsDatabase(raw: SqlJsDatabase): BrowserDb {
  function prepare(sql: string): SqliteStatementLike {
    return {
      get(...params: any[]): any {
        const stmt = raw.prepare(sql);
        try {
          bindIfAny(stmt, sql, params);
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally { stmt.free(); }
      },
      all(...params: any[]): any[] {
        const stmt = raw.prepare(sql);
        try {
          bindIfAny(stmt, sql, params);
          const rows: any[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally { stmt.free(); }
      },
      run(...params: any[]): SqliteRunResult {
        const stmt = raw.prepare(sql);
        try {
          stmt.run(toSqlJsParams(sql, params) as never);
        } finally { stmt.free(); }
        // sql.js không trả `changes` theo từng statement; `getRowsModified()`
        // là số dòng bị đổi bởi câu lệnh VỪA chạy trên kết nối này — khớp
        // đúng ngữ nghĩa `changes` của `node:sqlite` cho lời gọi ngay trước.
        return { changes: raw.getRowsModified(), lastInsertRowid: 0 };
      },
    };
  }

  return {
    prepare,
    exec(sql: string): void { raw.exec(sql); },
    export(): Uint8Array { return raw.export(); },
    close(): void { raw.close(); },
  };
}

/** Tạo kết nối mới (hoặc mở lại từ ảnh nhị phân đã lưu) rồi áp schema THẬT.
 *
 * `applySchema` được TIÊM VÀO thay vì import trực tiếp, để file này không
 * kéo theo `main/db/schema.ts` khi chỉ cần lớp bọc — và để test Node truyền
 * đúng bản đã biên dịch sang CommonJS. */
export function createBrowserDatabase(
  SQL: SqlJsStatic,
  applySchema: (db: SqliteLike) => void,
  initialBytes?: Uint8Array | null,
): BrowserDb {
  const db = wrapSqlJsDatabase(new SQL.Database(initialBytes ?? undefined));
  applySchema(db);
  return db;
}



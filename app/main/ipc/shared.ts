// Tiện ích dùng chung cho MỌI IPC handler: Actor/IpcResult, writeAudit (ghi 1
// dòng vào chuỗi hash tamper-evident `activity`), và notifyChanged
// (`store:changed` — thông báo làm mới theo phạm vi cho renderer). Các handler
// nghiệp vụ dùng chung phần này để tránh lặp lại cùng một cách khai báo.
import type { Db } from '../db/sqlite-like';
// `{id: unknown, ...}` nên renderer nhận `unknown` cho mọi trường.
import type { ActivityEntry } from '../../shared/qc-api';
import { uid } from '../domain/text-utils';
import { auditEntryHash } from '../domain/audit-chain';
import { canWriteRole, isAdminRole } from '../domain/page-roles';

export interface Actor { userId: string; username: string; name: string; role: string; clientId: string }

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function nowIso(): string { return new Date().toISOString(); }

let savepointSeq = 0;
/** Chạy `work` nguyên tử: lỗi ở bất kỳ bước nào thì mọi thay đổi bên trong bị
 * huỷ, kể cả dòng nhật ký. Dùng SAVEPOINT thay vì BEGIN để lồng được — gọi
 * bên trong một transaction đang mở (hoặc bên trong `writeAudit`) vẫn đúng.
 * ROLLBACK được bọc riêng để lỗi của nó không đè mất lỗi gốc.
 *
 * `work` phải đồng bộ: SQLite ở đây chạy đồng bộ, một `await` giữa chừng sẽ
 * để transaction mở trong khi lệnh khác chen vào. */
export function withTransaction<T>(db: Db, work: () => T): T {
  const name = `tx_${++savepointSeq}`;
  db.exec(`SAVEPOINT ${name}`);
  try {
    const result = work();
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      throw new Error('withTransaction chỉ nhận hàm đồng bộ.');
    }
    db.exec(`RELEASE ${name}`);
    return result;
  } catch (error) {
    try {
      db.exec(`ROLLBACK TO ${name}`);
      db.exec(`RELEASE ${name}`);
    } catch { /* giữ lỗi gốc */ }
    throw error;
  }
}

/** Đích nhận `store:changed`. Khai dạng CẤU TRÚC (không `import type
 * { BrowserWindow } from 'electron'`) vì bản xem trước qua trình duyệt chạy
 * chính các handler này và cần đăng ký đích riêng của nó — xem
 * `renderer/browser-mock/real-api.ts`. `BrowserWindow` thật khớp sẵn hình
 * dạng này, nên `main/index.ts` không phải đổi gì. */
export interface BroadcastTarget {
  webContents: { send(channel: string, payload: unknown): void };
  /** Chỉ `BrowserWindow` của Electron có; đích của bản xem trước không —
   * thiếu thì coi như còn sống. */
  isDestroyed?(): boolean;
}

// Cửa sổ chính duy nhất của app (app 1-cửa-sổ, không cần theo dõi nhiều
// BrowserWindow) — gán đúng 1 lần từ main/index.ts ngay sau khi tạo `win`.
// notifyChanged() no-op an toàn nếu gọi trước khi cửa sổ tồn tại (không nên
// xảy ra vì mọi handler chỉ chạy sau khi renderer đã load).
let broadcastWindow: BroadcastTarget | null = null;
let cloudChangeNotifier: (() => void) | null = null;
let lanChangeNotifier: ((payload: StoreChangedPayload) => void) | null = null;

/** Cùng giới hạn vận hành hệ thống: không để bảng nhật ký sống phình vô hạn.
 * Người dùng vẫn có đường lưu trữ thủ công có CSV; xoay vòng chỉ là phao an
 * toàn khi thao tác đó bị bỏ quên. */
export const AUDIT_HARD_CAP = 50_000;
export const AUDIT_ROTATE_TO = 40_000;

/** Neo hash của phần nhật ký đã bị lưu trữ/xoay vòng. Cả hai đường cắt đều
 * dùng chung một thao tác upsert để không lệch tên khoá trong `app_meta`. */
export function setActivityAnchor(db: Db, hash: string): void {
  db.prepare("INSERT INTO app_meta(key,value) VALUES('activityAnchor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(hash);
}

export function setBroadcastWindow(win: BroadcastTarget): void {
  broadcastWindow = win;
}

/** Điểm móc duy nhất cho đồng bộ cloud: mọi thao tác ghi hợp lệ đều đi qua
 * writeAudit(), nên Firebase không phụ thuộc việc từng handler nhớ tự đẩy. */
export function setCloudChangeNotifier(notifier: (() => void) | null): void {
  cloudChangeNotifier = notifier;
}
export function setLanChangeNotifier(notifier: ((payload: StoreChangedPayload) => void) | null): void { lanChangeNotifier = notifier; }

export interface StoreChangedPayload { tables: string[]; testIds: string[] }

/** Báo renderer các bảng nào vừa đổi (+ testId liên quan nếu có) để từng
 * store tự quyết định có refetch không — thay "fetch 1 lần khi mount" cũ.
 * Renderer lọc theo `tables`/`testIds` ở `useStoreInvalidation()`, không lọc
 * ở đây — main không cần biết trang nào đang mở. */
export function notifyChanged(tables: string[], testIds: string[] = []): void {
  if (!broadcastWindow || broadcastWindow.isDestroyed?.()) return;
  const payload: StoreChangedPayload = { tables, testIds };
  broadcastWindow.webContents.send('store:changed', payload);
  lanChangeNotifier?.(payload);
}

export type PermissionDenied = { ok: false; error: { code: string; message: string } };

// Không tự so chuỗi vai trò ở đây — dùng chung đúng 1 định nghĩa với
// renderer và với bảng pagePerms (main/domain/page-roles.ts).
export function canWrite(actor: Actor): boolean {
  return canWriteRole(actor.role);
}

/** Chặn vai trò `viewer`. Trả `null` nếu được phép — dùng dạng
 * `const denied = requireWrite(actor); if (denied) return denied;` để giữ
 * đúng khuôn `IpcResult` của mọi handler (không ném exception: renderer đọc
 * `{ok:false,error}` ở khắp nơi, một Promise bị reject sẽ không hiện được
 * thông báo tiếng Việt nào). */
export function requireWrite(actor: Actor): PermissionDenied | null {
  if (canWrite(actor)) return null;
  return { ok: false, error: { code: 'forbidden', message: 'Bạn không có quyền sửa dữ liệu.' } };
}

export function requireAdmin(actor: Actor): PermissionDenied | null {
  if (isAdminRole(actor.role)) return null;
  return { ok: false, error: { code: 'forbidden', message: 'Chỉ quản trị mới được thực hiện thao tác này.' } };
}

/** SQLite trả cột snake_case (`prev_hash`, `user_id`...) — chuyển về camelCase
 * đúng shape `AuditEntry` mà audit-chain.ts (hash/verify/relink) mong đợi.
 * Đây là ranh giới DUY NHẤT cần ánh xạ; mọi nơi khác đọc activity qua hàm
 * này, không tự SELECT * rồi dùng thẳng. */
export function rowToAuditEntry(row: Record<string, unknown>): ActivityEntry {
  return {
    id: String(row.id ?? ''), seq: Number(row.seq ?? 0), ts: String(row.ts ?? ''),
    user: String(row.user ?? ''), username: String(row.username ?? ''),
    userId: String(row.user_id ?? ''), role: String(row.role ?? ''), type: String(row.type ?? ''),
    detail: String(row.detail ?? ''), target: String(row.target ?? ''),
    clientId: String(row.client_id ?? ''), prevHash: String(row.prev_hash ?? ''), hash: String(row.hash ?? ''),
  };
}

function insertAudit(db: Db, actor: Actor, type: string, detail: string, target = ''): { seq: number } {
  const row = db.prepare('SELECT hash FROM activity ORDER BY seq DESC LIMIT 1').get() as { hash: string } | undefined;
  const seqRow = db.prepare('SELECT COALESCE(MAX(seq),0) as maxSeq FROM activity').get() as { maxSeq: number };
  const entry = {
    id: uid(), seq: seqRow.maxSeq + 1, ts: nowIso(), user: actor.name, username: actor.username,
    userId: actor.userId, role: actor.role, type, detail, target, clientId: actor.clientId,
    prevHash: row ? row.hash : '', hash: '',
  };
  entry.hash = auditEntryHash(entry);
  db.prepare(`INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (@id,@seq,@ts,@user,@username,@userId,@role,@type,@detail,@target,@clientId,@prevHash,@hash)`)
    .run({
      id: entry.id, seq: entry.seq, ts: entry.ts, user: entry.user, username: entry.username,
      userId: entry.userId, role: entry.role, type: entry.type, detail: entry.detail, target: entry.target,
      clientId: entry.clientId, prevHash: entry.prevHash, hash: entry.hash,
    });
  return { seq: entry.seq };
}

/** Cắt mềm nhật ký vượt ngưỡng, giữ anchor ở hash cuối của phần bị gỡ. Hàm
 * này không gọi `writeAudit()` để tránh đệ quy; thay vào đó ghi đúng một dòng
 * giải thích sau khi cắt, như hệ thống. */
function rotateAuditOverflow(db: Db, actor: Actor): void {
  const count = Number((db.prepare('SELECT COUNT(*) AS n FROM activity').get() as { n: number }).n);
  if (count <= AUDIT_HARD_CAP) return;
  const dropCount = count - AUDIT_ROTATE_TO;
  const dropped = db.prepare(`SELECT id,hash FROM activity ORDER BY seq ASC LIMIT ${dropCount}`).all() as { id: string; hash: string }[];
  const tipHash = [...dropped].reverse().find((row) => row.hash)?.hash || '';
  if (!dropped.length) return;
  const placeholders = dropped.map(() => '?').join(',');
  db.prepare(`DELETE FROM activity WHERE id IN (${placeholders})`).run(...dropped.map((row) => row.id));
  setActivityAnchor(db, tipHash);
  insertAudit(db, actor, 'Xoay vòng nhật ký hoạt động',
    `Nhật ký vượt ${AUDIT_HARD_CAP} dòng: tự động loại ${dropped.length} dòng cũ nhất, giữ lại ${AUDIT_ROTATE_TO} dòng mới nhất (không xuất CSV). Hash đỉnh phần đã loại: ${tipHash || '—'}. Nên dùng "Lưu trữ nhật ký cũ" để có file CSV trước khi cắt.`, 'Nhật ký');
}

export function writeAudit(db: Db, actor: Actor, type: string, detail: string, target = ''): void {
  // Thêm dòng và (khi vượt ngưỡng) xoay vòng là một đơn vị: xoá dòng cũ mà
  // không cập nhật anchor thì chuỗi hash báo sai ngay dòng đầu.
  withTransaction(db, () => {
    const entry = insertAudit(db, actor, type, detail, target);
    // Trước ngưỡng không truy vấn COUNT(*) ở mỗi thao tác. Sau khi seq đã lớn,
    // chỉ khi bảng thực sự vượt ngưỡng mới cắt; archive có thể làm seq cao mà
    // bảng nhỏ, khi đó phép đếm rẻ này chỉ là kiểm tra phòng thủ.
    if (entry.seq > AUDIT_HARD_CAP) rotateAuditOverflow(db, actor);
  });
  notifyChanged(['activity']);
  cloudChangeNotifier?.();
}


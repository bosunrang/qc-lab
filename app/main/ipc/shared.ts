// Tiện ích dùng chung cho MỌI IPC handler: Actor/IpcResult, writeAudit (ghi 1
// dòng vào chuỗi hash tamper-evident `activity`), và notifyChanged
// (`store:changed` — thông báo làm mới theo phạm vi cho renderer). Các handler
// nghiệp vụ dùng chung phần này để tránh lặp lại cùng một cách khai báo.
import type { Db } from '../db/sqlite-like';
import { uid } from '../domain/text-utils';
import { auditEntryHash } from '../domain/audit-chain';
import { canWriteRole, isAdminRole } from '../domain/page-roles';
import { hasUserCapability, parseUserCapabilities, QC_CONFIG_DENIED_MESSAGE } from '../domain/capabilities';
import { withTransaction } from '../db/transaction';
import { rowToAuditEntry } from '../db/audit-row';

export { rowToAuditEntry };

export interface Actor { userId: string; username: string; name: string; role: string; clientId: string }

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function nowIso(): string { return new Date().toISOString(); }

// Handler dùng `withTransaction` qua đây; định nghĩa nằm ở tầng db để migration
// schema cũng dùng được mà không phụ thuộc ngược lên ipc.
export { withTransaction };

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

/** Neo hash của phần nhật ký đã được lưu trữ. Chỉ "Lưu trữ nhật ký cũ" (có
 * xuất CSV trước) mới cắt bảng `activity`; app không tự xoá dòng nào khi bảng
 * lớn (ISO 15189:2022 8.4.3) — xem `AUDIT_SIZE_WARNING_ROWS`. */
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

/** Lời báo mà bộ nhớ đệm trong main nhận: thêm `lots` — số lô duy nhất bị
 * đổi trong `qc_points` khi người ghi biết chắc (vd nhập một điểm). Không
 * gửi ra renderer/LAN; thiếu `lots` nghĩa là "không biết lô nào". */
export interface MainChangedPayload extends StoreChangedPayload { lots?: string[] }

const changeListeners = new Set<(payload: MainChangedPayload) => void>();
/** Nghe mọi lời báo `notifyChanged` ngay trong main (vd bộ nhớ đệm tóm tắt
 * Westgard). Trả hàm huỷ đăng ký. */
export function addChangeListener(listener: (payload: MainChangedPayload) => void): () => void {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}

/** Báo renderer các bảng nào vừa đổi (+ testId liên quan nếu có) để từng
 * store tự quyết định có refetch không — thay "fetch 1 lần khi mount" cũ.
 * Renderer lọc theo `tables`/`testIds` ở `useStoreInvalidation()`, không lọc
 * ở đây — main không cần biết trang nào đang mở. `lots` chỉ đến bộ nhớ
 * đệm trong main (xem `MainChangedPayload`). */
export function notifyChanged(tables: string[], testIds: string[] = [], lots?: string[]): void {
  // Bộ nhớ đệm trong main nghe TRƯỚC, kể cả khi chưa có cửa sổ (test, lúc
  // khởi động): dữ liệu đã đổi thì kết quả giữ lại phải bỏ, dù ai đang xem.
  for (const listener of changeListeners) listener(lots ? { tables, testIds, lots } : { tables, testIds });
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

/** Cổng `qc.config` cho `writeCommand()`. `Actor` không mang capability nên
 * đọc thẳng `users.capabilities_json` ngay lúc gọi: quyền vừa bị thu hồi có
 * hiệu lực ở lần ghi kế tiếp, không chờ đăng nhập lại. */
export function requireQcConfig(db: Db): (actor: Actor) => PermissionDenied | null {
  return (actor) => {
    if (isAdminRole(actor.role)) return null;
    const row = db.prepare('SELECT capabilities_json FROM users WHERE id=? AND active<>0').get(actor.userId) as { capabilities_json: string } | undefined;
    if (hasUserCapability({ role: actor.role, capabilities: parseUserCapabilities(row?.capabilities_json) }, 'qc.config')) return null;
    return { ok: false, error: { code: 'forbidden-qc-config', message: QC_CONFIG_DENIED_MESSAGE } };
  };
}

function insertAudit(db: Db, actor: Actor, type: string, detail: string, target = ''): void {
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
}

export function writeAudit(db: Db, actor: Actor, type: string, detail: string, target = ''): void {
  // Đọc hash/seq cuối và chèn dòng mới là một đơn vị, để hai lần ghi không
  // cùng nối vào một dòng trước.
  withTransaction(db, () => insertAudit(db, actor, type, detail, target));
  notifyChanged(['activity']);
  cloudChangeNotifier?.();
}


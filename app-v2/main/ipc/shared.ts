// Tiện ích dùng chung cho MỌI IPC handler: Actor/IpcResult, writeAudit (ghi 1
// dòng vào chuỗi hash tamper-evident `activity`), và notifyChanged
// (`store:changed` — invalidation có phạm vi cho renderer, xem
// docs/APP-V2-PLAN.md Giai đoạn A1). Trước khi có file này, config/entry/
// nce/reagent/sigma/westgard-handlers.ts mỗi file tự khai báo lại y hệt —
// gom về đây khi thêm handler thứ 7 (auth-handlers.ts) thay vì nhân bản lần
// nữa.
import type { Db } from '../db/sqlite-like';
// Kiểu dòng nhật ký lấy từ hợp đồng dùng chung — trước đây hàm này trả
// `{id: unknown, ...}` nên renderer nhận `unknown` cho mọi trường.
import type { ActivityEntry } from '../../shared/qc-api';
import { uid } from '../domain/text-utils';
import { auditEntryHash } from '../domain/audit-chain';
import { canWriteRole, isAdminRole } from '../domain/page-roles';

export interface Actor { userId: string; username: string; name: string; role: string; clientId: string }

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function nowIso(): string { return new Date().toISOString(); }

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

export function setBroadcastWindow(win: BroadcastTarget): void {
  broadcastWindow = win;
}

/** Điểm móc duy nhất cho đồng bộ cloud: mọi thao tác ghi hợp lệ đều đi qua
 * writeAudit(), nên Firebase không phụ thuộc việc từng handler nhớ tự đẩy. */
export function setCloudChangeNotifier(notifier: (() => void) | null): void {
  cloudChangeNotifier = notifier;
}

export interface StoreChangedPayload { tables: string[]; testIds: string[] }

/** Báo renderer các bảng nào vừa đổi (+ testId liên quan nếu có) để từng
 * store tự quyết định có refetch không — thay "fetch 1 lần khi mount" cũ.
 * Renderer lọc theo `tables`/`testIds` ở `useStoreInvalidation()`, không lọc
 * ở đây — main không cần biết trang nào đang mở. */
export function notifyChanged(tables: string[], testIds: string[] = []): void {
  if (!broadcastWindow || broadcastWindow.isDestroyed?.()) return;
  const payload: StoreChangedPayload = { tables, testIds };
  broadcastWindow.webContents.send('store:changed', payload);
}

// ── Quyền ghi ──────────────────────────────────────────────────────────────
// Ranh giới quyền THẬT của app-v2 nằm ở ĐÂY, không phải ở renderer: main
// process giữ actor đã đăng nhập (`requireActor()` trong main/index.ts), nên
// nó là chỗ duy nhất không thể bị bỏ qua. Ẩn/disable nút ở renderer chỉ là
// hiển thị — bất kỳ ai gọi thẳng `window.qcApi.*` từ DevTools đều đi qua đây.
// Khác app cũ: app cũ chỉ có `requireWrite()`/`requireAdmin()` phía trình
// duyệt (xem CLAUDE.md "Storage and sync model" — đánh đổi đã chấp nhận của
// app client-only, không có tiến trình nào để chặn thật). app-v2 có main
// process thật nên KHÔNG kế thừa đánh đổi đó.
//
// Ánh xạ vai trò → mức quyền copy đúng theo từng chỗ gọi của app cũ (tra
// từng call site `deps.requireWrite()`/`deps.requireAdmin()`, không suy
// diễn): admin+KTV được ghi dữ liệu QC (nhập/huỷ điểm, kỳ Sigma, hồ sơ NCE,
// so sánh hoá chất); CHỈ admin được đụng cấu hình (máy/xét nghiệm/lô/panel/
// Mean/SD/TEa), khoá-mở kỳ báo cáo, xoá phép so sánh hoá chất, cài đặt,
// lưu trữ nhật ký hoạt động và xuất backup.
//
// Chặn ĐỌC: mặc định các hàm đọc KHÔNG bị chặn (6 trang mở cho mọi vai trò),
// trừ đúng hai chỗ mà bản thân DỮ LIỆU là thứ chỉ admin được xem: xuất backup
// (chứa chuỗi mật khẩu PBKDF2 của mọi người dùng) và 3 hàm đọc nhật ký hoạt
// động `audit:query`/`audit:exportCsv`/`audit:verifyChainNow` (chặn từ
// 2026-09-12). Trang Nhật ký là ADMIN_ONLY trong `page-roles.ts`, nhưng
// route guard của renderer chỉ là hiển thị — trước bản đó, gọi thẳng
// `window.qcApi.queryActivity()` từ DevTools vẫn đọc được toàn bộ nhật ký.
// Vì thế 3 hàm đó trả `IpcResult` thay vì trả thẳng dữ liệu như các hàm đọc
// khác; `role-gating.test.mjs` mục 7 khoá lại.
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

export function writeAudit(db: Db, actor: Actor, type: string, detail: string, target = ''): void {
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
  notifyChanged(['activity']);
  cloudChangeNotifier?.();
}

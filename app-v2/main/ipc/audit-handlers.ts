// IPC handler cho trang Nhật ký hoạt động (Audit log). Đọc bảng `activity`
// (đã ghi sẵn từ module đầu tiên qua shared.ts's writeAudit) qua bộ lọc/phân
// trang THUẦN đã được port sẵn từ bản cũ trong domain/audit-filter.ts nhưng
// chưa từng được nối vào IPC/renderer nào — đây là lần đầu.
//
// CẢ 5 hàm đều là admin-only, kể cả 4 hàm ĐỌC (`query`/`previewArchive`/
// `exportCsv`/`verifyChainNow`): trang Nhật ký là ADMIN_ONLY trong
// `page-roles.ts`, và
// nhật ký chứa tên tài khoản + mọi thao tác của từng người — chặn ở renderer
// thôi thì gọi thẳng `window.qcApi.queryActivity()` từ DevTools vẫn đọc
// được toàn bộ. Đây là lý do 4 hàm đó trả `IpcResult` chứ không trả thẳng
// dữ liệu như các hàm đọc khác của app (điểm QC, báo cáo, Westgard — những
// trang mở cho mọi vai trò).
import type { Db } from '../db/sqlite-like';
// Hình dạng trang nhật ký lấy từ hợp đồng dùng chung (đã có `total`).
import type { ActivityArchivePreview, ActivityPage } from '../../shared/qc-api';
import { rowToAuditEntry, setActivityAnchor, type Actor, type IpcResult, writeAudit, requireAdmin } from './shared';
import { filterActivity, paginateActivity, type ActivityLike } from '../domain/audit-filter';
import { formatAuditDateTimeVN } from '../domain/audit-format';
import { roleLabel } from '../domain/page-roles';

type ActivityRow = ActivityLike & { id: string };
import { verifyAuditChain, type ChainVerifyResult } from '../domain/audit-chain';

export interface AuditQueryInput { query?: unknown; from?: unknown; to?: unknown; page?: unknown; pageSize?: unknown }
export interface AuditArchiveInput { data?: { months?: unknown } }
const INVALID_ARCHIVE_MONTHS = 'Chỉ chấp nhận 12, 24 hoặc 36 tháng.';

function getAnchor(db: Db): string {
  const row = db.prepare("SELECT value FROM app_meta WHERE key='activityAnchor'").get() as { value: string } | undefined;
  return row ? row.value : '';
}

function toCsvValue(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: ActivityLike[]): string {
  const header = ['Seq', 'Thời gian', 'Người dùng', 'Tên đăng nhập', 'Vai trò', 'Hành động', 'Đối tượng', 'Chi tiết', 'PrevHash', 'Hash'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const values = [r.seq, formatAuditDateTimeVN(r.ts), r.user, r.username, roleLabel(r.role), r.type, r.target, r.detail, r.prevHash, r.hash];
    lines.push(values.map(toCsvValue).join(','));
  }
  return lines.join('\n');
}

function archiveWindow(rawMonths: unknown): { months: number; cutoffIso: string } | null {
  const months = Math.round(Number(rawMonths));
  if (![12, 24, 36].includes(months)) return null;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return { months, cutoffIso: cutoff.toISOString() };
}

export function createAuditHandlers(db: Db) {
  function allChronological(): ActivityRow[] {
    const rows = db.prepare('SELECT * FROM activity ORDER BY seq ASC').all() as Record<string, unknown>[];
    return rows.map(rowToAuditEntry) as ActivityRow[];
  }

  function archiveSegment(all: ActivityRow[], cutoffIso: string): ActivityRow[] {
    return all.filter((activity) => activity.ts < cutoffIso);
  }

  /** Đọc TOÀN BỘ activity theo thứ tự tăng dần seq rồi mới lọc/đảo chiều —
   * `filterActivity()` tự đảo về mới-nhất-trước ở bước cuối, truyền nhầm
   * mảng đã DESC sẵn (như `config.listActivity()`) sẽ đảo ngược 2 lần thành
   * cũ-nhất-trước, sai với quy ước hiển thị của bản cũ. */
  function query(input: AuditQueryInput, actor: Actor): IpcResult<ActivityPage> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const all = allChronological();
    const filtered = filterActivity(all, String(input.query || ''), String(input.from || ''), String(input.to || ''));
    // `total` = TOÀN BỘ nhật ký (không phụ thuộc bộ lọc) — trang Nhật ký của
    // app cũ hiện cả "N dòng hoạt động đã ghi nhận" và "khớp/tổng".
    const page = paginateActivity(filtered, Number(input.page) || 1, Number(input.pageSize) || 25);
    // `paginateActivity` là hàm thuần generic trên `ActivityLike`; hợp đồng
    // khai `rows: ActivityEntry[]`. Hai hình dạng khớp nhau ở runtime (cùng
    // do `rowToAuditEntry` dựng), ép một lần ở ranh giới IPC.
    return { ok: true, data: { ...page, rows: page.rows as ActivityPage['rows'], total: all.length } };
  }

  /** App cũ luôn xuất TOÀN BỘ nhật ký theo thứ tự ghi (cũ đến mới), không
   * phụ thuộc bộ lọc đang xem. Đây là bản lưu vết để đối chiếu, không phải
   * chức năng xuất kết quả tìm kiếm. Giữ `input` để không phá tương thích IPC
   * với preview/bản đã cài; cố ý không dùng các giá trị trong đó. */
  function exportCsv(_input: AuditQueryInput, actor: Actor): IpcResult<string> {
    const denied = requireAdmin(actor); if (denied) return denied;
    return { ok: true, data: toCsv(allChronological()) };
  }

  /** Xem trước đúng đoạn sắp được gỡ. Renderer dùng CSV này trước bước xác
   * nhận cuối; main vẫn tính lại đoạn cắt khi thực thi, không tin số đếm từ
   * renderer. */
  function previewArchive(input: AuditArchiveInput, actor: Actor): IpcResult<ActivityArchivePreview> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const window = archiveWindow(input.data?.months);
    if (!window) return { ok: false, error: { code: 'invalid-months', message: INVALID_ARCHIVE_MONTHS } };
    const all = allChronological();
    const segment = archiveSegment(all, window.cutoffIso);
    return { ok: true, data: {
      ...window,
      removedCount: segment.length,
      retainedCount: all.length - segment.length,
      csv: toCsv(segment),
    } };
  }

  /** Đọc lại đúng anchor đã lưu (`app_meta.activityAnchor`, rỗng nếu log
   * chưa từng bị cắt) — không xác minh từ đầu chuỗi (seq=1) như thể log
   * chưa từng lưu trữ, sẽ báo sai "chuỗi bị phá" ngay sau khi lưu trữ hợp lệ. */
  /** Lưu ý hai tầng `ok`: `result.ok` là CỔNG QUYỀN (false = không phải
   * admin), `result.data.ok` mới là kết luận chuỗi hash còn nguyên vẹn hay
   * không. Đọc nhầm tầng sẽ báo "audit bị sửa" cho một lỗi phân quyền. */
  function verifyChainNow(actor: Actor): IpcResult<ChainVerifyResult> {
    const denied = requireAdmin(actor); if (denied) return denied;
    return { ok: true, data: verifyAuditChain(allChronological(), getAnchor(db)) };
  }

  /** Lưu trữ nhật ký cũ hơn `months` tháng: xoá khỏi bảng sống, cập nhật
   * anchor bằng hash CUỐI CÙNG của phần bị cắt để chuỗi vẫn xác minh được
   * từ điểm cắt trở đi. CSV của chính đoạn cần gỡ được tạo ở `previewArchive`
   * trước bước xác nhận cuối; hàm này chỉ làm thay đổi dữ liệu. */
  function archive(input: AuditArchiveInput, actor: Actor): IpcResult<{ removedCount: number; retainedCount: number; cutoffIso: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const window = archiveWindow(input.data?.months);
    if (!window) {
      return { ok: false, error: { code: 'invalid-months', message: INVALID_ARCHIVE_MONTHS } };
    }
    const all = allChronological();
    const toRemove = archiveSegment(all, window.cutoffIso);
    const retainedCount = all.length - toRemove.length;
    if (!toRemove.length) return { ok: true, data: { removedCount: 0, retainedCount, cutoffIso: window.cutoffIso } };
    const lastRemovedHash = [...toRemove].reverse().find((a) => a.hash)?.hash || getAnchor(db);
    const ids = toRemove.map((a) => a.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM activity WHERE id IN (${placeholders})`).run(...ids);
    // Nếu không còn dòng giữ lại, chuỗi mới phải bắt đầu lại rỗng. Giữ anchor
    // trong trường hợp này sẽ khiến dòng audit ngay sau cắt có prevHash rỗng
    // nhưng verifier lại đòi prevHash=anchor — lỗi từng có ở app-v2.
    setActivityAnchor(db, retainedCount ? lastRemovedHash : '');
    writeAudit(db, actor, 'Lưu trữ nhật ký hoạt động',
      `Đã xuất CSV và gỡ ${toRemove.length} dòng cũ hơn ${window.months} tháng (mốc ${window.cutoffIso.slice(0, 10)}), còn lại ${retainedCount} dòng. Hash đỉnh phần lưu trữ: ${lastRemovedHash || '—'}.`, 'Nhật ký');
    return { ok: true, data: { removedCount: toRemove.length, retainedCount, cutoffIso: window.cutoffIso } };
  }

  return { query, exportCsv, previewArchive, verifyChainNow, archive };
}

export type AuditHandlers = ReturnType<typeof createAuditHandlers>;

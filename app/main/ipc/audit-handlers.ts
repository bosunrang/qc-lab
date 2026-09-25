import type { Db } from '../db/sqlite-like';
// Hình dạng trang nhật ký lấy từ hợp đồng dùng chung (đã có `total`).
import type { ActivityArchivePreview, ActivityPage } from '../../shared/qc-api';
import { rowToAuditEntry, setActivityAnchor, type Actor, type IpcResult, writeAudit, requireAdmin, withTransaction } from './shared';
import { activityPageWindow, activitySearchText, type ActivityLike, type ActivityPageWindow, type ActivitySearchFields } from '../domain/audit-filter';
import { textKey } from '../domain/text-utils';
import { formatAuditDateTimeVN, formatAuditDetailVN } from '../domain/audit-format';
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
    const values = [r.seq, formatAuditDateTimeVN(r.ts), r.user, r.username, roleLabel(r.role), r.type, r.target, formatAuditDetailVN(r.detail), r.prevHash, r.hash];
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


  /** Lọc và phân trang bằng SQL, chỉ nạp đủ cột cho các dòng của trang đang
   * xem — trước đây mỗi lần lật trang nạp cả bảng (tới 50.000 dòng) rồi lọc
   * bằng JS. Kết quả phải trùng `filterActivity` + `paginateActivity` (test
   * đối chiếu):
   * - Lọc ngày theo ngày UTC của `ts`. `ts` luôn là ISO UTC do `nowIso()`
   *   ghi trong `insertAudit` (nơi duy nhất ghi bảng này; phục hồi chỉ chép lại
   *   dòng của chính app, và `ts` nằm trong chuỗi hash), nên
   *   `substr(ts,1,10)` đúng bằng ngày mà `filterActivity` tính.
   * - Tìm chữ bỏ dấu và khớp cả giờ hiển thị, SQL không làm được: đọc các cột
   *   cần so khớp của những dòng đã lọc ngày, so bằng `activitySearchText`,
   *   rồi mới nạp đủ cột cho đúng các dòng thuộc trang. */
  function query(input: AuditQueryInput, actor: Actor): IpcResult<ActivityPage> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const text = textKey(String(input.query || ''));
    const from = String(input.from || ''), to = String(input.to || '');
    const conditions: string[] = [];
    const params: string[] = [];
    if (from) { conditions.push('substr(ts, 1, 10) >= ?'); params.push(from); }
    if (to) { conditions.push('substr(ts, 1, 10) <= ?'); params.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = Number(input.page) || 1, pageSize = Number(input.pageSize) || 25;

    let pageWindow: ActivityPageWindow;
    let rows: Record<string, unknown>[];
    if (!text) {
      const count = Number((db.prepare(`SELECT COUNT(*) AS n FROM activity ${where}`).get(...params) as { n: number }).n);
      pageWindow = activityPageWindow(count, page, pageSize);
      rows = db.prepare(`SELECT * FROM activity ${where} ORDER BY seq DESC LIMIT ? OFFSET ?`).all(...params, pageWindow.size, pageWindow.offset) as Record<string, unknown>[];
    } else {
      const candidates = db.prepare(`SELECT id, seq, ts, user, username, role, type, target, detail FROM activity ${where} ORDER BY seq DESC`).all(...params) as (ActivitySearchFields & { id: string })[];
      const matched = candidates.filter((row) => activitySearchText(row).includes(text)).map((row) => row.id);
      pageWindow = activityPageWindow(matched.length, page, pageSize);
      const pageIds = matched.slice(pageWindow.offset, pageWindow.offset + pageWindow.size);
      rows = [];
      // Theo lô 500 id vì SQLite giới hạn số tham số của một câu lệnh.
      for (let start = 0; start < pageIds.length; start += 500) {
        const chunk = pageIds.slice(start, start + 500);
        rows.push(...db.prepare(`SELECT * FROM activity WHERE id IN (${chunk.map(() => '?').join(',')})`).all(...chunk) as Record<string, unknown>[]);
      }
      rows.sort((a, b) => Number(b.seq) - Number(a.seq));
    }
    // `total` = TOÀN BỘ nhật ký (không phụ thuộc bộ lọc) — trang Nhật ký của
    // hệ thống hiện cả "N dòng hoạt động đã ghi nhận" và "khớp/tổng".
    const total = Number((db.prepare('SELECT COUNT(*) AS n FROM activity').get() as { n: number }).n);
    const { page: shownPage, pageCount, offset, resultFrom, resultTo, filteredCount } = pageWindow;
    return { ok: true, data: { page: shownPage, pageCount, offset, resultFrom, resultTo, filteredCount, rows: rows.map(rowToAuditEntry), total } };
  }

  /** hệ thống luôn xuất TOÀN BỘ nhật ký theo thứ tự ghi (cũ đến mới), không
   * phụ thuộc bộ lọc đang xem. Đây là bản lưu vết để đối chiếu, không phải
   * chức năng xuất kết quả tìm kiếm. Giữ `input` để không phá tương thích IPC
   * với preview/bản đã cài; cố ý không dùng các giá trị trong đó. */
  function exportCsv(_input: AuditQueryInput, actor: Actor): IpcResult<string> {
    const denied = requireAdmin(actor); if (denied) return denied;
    return { ok: true, data: toCsv(allChronological()) };
  }

  /** Xem trước đúng đoạn sắp được gỡ. Renderer dùng CSV này trước bước xác
   * nhận cuối; main vẫn tính lại đoạn cắt khi thực thi, không tin số đếm từ giao diện. */
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
    // Xoá dòng, dời anchor và ghi dòng giải thích là MỘT đơn vị: dừng giữa
    // chừng thì chuỗi hash báo sai ngay dòng đầu. Xoá theo từng lô 500 id vì
    // SQLite giới hạn số tham số của một câu lệnh (mặc định 32.766), trong khi
    // phần cần gỡ có thể tới 50.000 dòng.
    withTransaction(db, () => {
      for (let start = 0; start < ids.length; start += 500) {
        const chunk = ids.slice(start, start + 500);
        db.prepare(`DELETE FROM activity WHERE id IN (${chunk.map(() => '?').join(',')})`).run(...chunk);
      }
      // Nếu không còn dòng giữ lại, chuỗi mới phải bắt đầu lại rỗng. Giữ anchor
      // trong trường hợp này sẽ khiến dòng audit ngay sau cắt có prevHash rỗng
      // nhưng verifier lại đòi prevHash=anchor — lỗi từng có ở app.
      setActivityAnchor(db, retainedCount ? lastRemovedHash : '');
      writeAudit(db, actor, 'Lưu trữ nhật ký hoạt động',
        `Đã xuất CSV và gỡ ${toRemove.length} dòng cũ hơn ${window.months} tháng (mốc ${window.cutoffIso.slice(0, 10)}), còn lại ${retainedCount} dòng. Hash đỉnh phần lưu trữ: ${lastRemovedHash || '—'}.`, 'Nhật ký');
    });
    return { ok: true, data: { removedCount: toRemove.length, retainedCount, cutoffIso: window.cutoffIso } };
  }

  return { query, exportCsv, previewArchive, verifyChainNow, archive };
}

export type AuditHandlers = ReturnType<typeof createAuditHandlers>;


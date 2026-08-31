// IPC handler cho trang Nhật ký hoạt động (Audit log). Đọc bảng `activity`
// (đã ghi sẵn từ module đầu tiên qua shared.ts's writeAudit) qua bộ lọc/phân
// trang THUẦN đã được port sẵn từ bản cũ trong domain/audit-filter.ts nhưng
// chưa từng được nối vào IPC/renderer nào — đây là lần đầu.
import type { Db } from '../db/open-database';
import { rowToAuditEntry } from './shared';
import { filterActivity, paginateActivity, type ActivityLike, type ActivityPage } from '../domain/audit-filter';

export interface AuditQueryInput { query?: unknown; from?: unknown; to?: unknown; page?: unknown; pageSize?: unknown }

export function createAuditHandlers(db: Db) {
  /** Đọc TOÀN BỘ activity theo thứ tự tăng dần seq rồi mới lọc/đảo chiều —
   * `filterActivity()` tự đảo về mới-nhất-trước ở bước cuối, truyền nhầm
   * mảng đã DESC sẵn (như `config.listActivity()`) sẽ đảo ngược 2 lần thành
   * cũ-nhất-trước, sai với quy ước hiển thị của bản cũ. */
  function query(input: AuditQueryInput): ActivityPage<ActivityLike> {
    const rows = db.prepare('SELECT * FROM activity ORDER BY seq ASC').all() as Record<string, unknown>[];
    const items = rows.map(rowToAuditEntry) as unknown as ActivityLike[];
    const filtered = filterActivity(items, String(input.query || ''), String(input.from || ''), String(input.to || ''));
    return paginateActivity(filtered, Number(input.page) || 1, Number(input.pageSize) || 25);
  }

  return { query };
}

export type AuditHandlers = ReturnType<typeof createAuditHandlers>;

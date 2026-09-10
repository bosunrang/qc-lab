// IPC handler cho trang Nhật ký hoạt động (Audit log). Đọc bảng `activity`
// (đã ghi sẵn từ module đầu tiên qua shared.ts's writeAudit) qua bộ lọc/phân
// trang THUẦN đã được port sẵn từ bản cũ trong domain/audit-filter.ts nhưng
// chưa từng được nối vào IPC/renderer nào — đây là lần đầu.
import type { Db } from '../db/sqlite-like';
// Hình dạng trang nhật ký lấy từ hợp đồng dùng chung (đã có `total`).
import type { ActivityPage } from '../../shared/qc-api';
import { rowToAuditEntry, type Actor, type IpcResult, writeAudit, requireAdmin } from './shared';
import { filterActivity, paginateActivity, type ActivityLike } from '../domain/audit-filter';

type ActivityRow = ActivityLike & { id: string };
import { verifyAuditChain, type ChainVerifyResult } from '../domain/audit-chain';

export interface AuditQueryInput { query?: unknown; from?: unknown; to?: unknown; page?: unknown; pageSize?: unknown }

function getAnchor(db: Db): string {
  const row = db.prepare("SELECT value FROM app_meta WHERE key='activityAnchor'").get() as { value: string } | undefined;
  return row ? row.value : '';
}

function setAnchor(db: Db, hash: string): void {
  db.prepare("INSERT INTO app_meta(key,value) VALUES('activityAnchor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(hash);
}

function toCsvValue(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: ActivityLike[]): string {
  const header = ['seq', 'ts', 'user', 'username', 'role', 'type', 'detail', 'target'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => toCsvValue((r as unknown as Record<string, unknown>)[h])).join(','));
  return lines.join('\n');
}

export function createAuditHandlers(db: Db) {
  function allChronological(): ActivityLike[] {
    const rows = db.prepare('SELECT * FROM activity ORDER BY seq ASC').all() as Record<string, unknown>[];
    return rows.map(rowToAuditEntry) as unknown as ActivityLike[];
  }

  /** Đọc TOÀN BỘ activity theo thứ tự tăng dần seq rồi mới lọc/đảo chiều —
   * `filterActivity()` tự đảo về mới-nhất-trước ở bước cuối, truyền nhầm
   * mảng đã DESC sẵn (như `config.listActivity()`) sẽ đảo ngược 2 lần thành
   * cũ-nhất-trước, sai với quy ước hiển thị của bản cũ. */
  function query(input: AuditQueryInput): ActivityPage {
    const all = allChronological();
    const filtered = filterActivity(all, String(input.query || ''), String(input.from || ''), String(input.to || ''));
    // `total` = TOÀN BỘ nhật ký (không phụ thuộc bộ lọc) — trang Nhật ký của
    // app cũ hiện cả "N dòng hoạt động đã ghi nhận" và "khớp/tổng".
    const page = paginateActivity(filtered, Number(input.page) || 1, Number(input.pageSize) || 25);
    // `paginateActivity` là hàm thuần generic trên `ActivityLike`; hợp đồng
    // khai `rows: ActivityEntry[]`. Hai hình dạng khớp nhau ở runtime (cùng
    // do `rowToAuditEntry` dựng), ép một lần ở ranh giới IPC.
    return { ...page, rows: page.rows as ActivityPage['rows'], total: all.length };
  }

  function exportCsv(input: AuditQueryInput): string {
    const filtered = filterActivity(allChronological(), String(input.query || ''), String(input.from || ''), String(input.to || ''));
    return toCsv(filtered);
  }

  /** Đọc lại đúng anchor đã lưu (`app_meta.activityAnchor`, rỗng nếu log
   * chưa từng bị cắt) — không xác minh từ đầu chuỗi (seq=1) như thể log
   * chưa từng lưu trữ, sẽ báo sai "chuỗi bị phá" ngay sau khi lưu trữ hợp lệ. */
  function verifyChainNow(): ChainVerifyResult {
    return verifyAuditChain(allChronological(), getAnchor(db));
  }

  /** Lưu trữ nhật ký cũ hơn `months` tháng: xoá khỏi bảng sống, cập nhật
   * anchor bằng hash CUỐI CÙNG của phần bị cắt để chuỗi vẫn xác minh được
   * từ điểm cắt trở đi — tham khảo `auditRotateOverflow()`/`activityAnchor`
   * bản cũ (xem CLAUDE.md mục `audit.js`). Trả kèm CSV của phần đã xoá để
   * renderer cho tải về TRƯỚC KHI xoá vĩnh viễn (gọi `exportCsv` phạm vi
   * tương ứng ở phía renderer trước khi xác nhận — hàm này chỉ thực thi
   * việc cắt, không tự động xuất, tránh 1 hàm vừa đọc vừa ghi). */
  function archive(input: { data: { months: number } }, actor: Actor): IpcResult<{ removedCount: number }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const months = Math.round(Number(input.data?.months));
    if (![12, 24, 36].includes(months)) {
      return { ok: false, error: { code: 'invalid-months', message: 'Chỉ chấp nhận 12, 24 hoặc 36 tháng.' } };
    }
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffIso = cutoff.toISOString();
    const all = allChronological() as ActivityRow[];
    const toRemove = all.filter((a) => a.ts < cutoffIso);
    if (!toRemove.length) return { ok: true, data: { removedCount: 0 } };
    const lastRemovedHash = [...toRemove].reverse().find((a) => a.hash)?.hash || getAnchor(db);
    const ids = toRemove.map((a) => a.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM activity WHERE id IN (${placeholders})`).run(...ids);
    setAnchor(db, lastRemovedHash);
    writeAudit(db, actor, 'Lưu trữ nhật ký cũ', `Xoá ${toRemove.length} dòng cũ hơn ${months} tháng`, '');
    return { ok: true, data: { removedCount: toRemove.length } };
  }

  return { query, exportCsv, verifyChainNow, archive };
}

export type AuditHandlers = ReturnType<typeof createAuditHandlers>;

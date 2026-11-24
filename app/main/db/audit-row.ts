import type { ActivityEntry } from '../../shared/qc-api';

/** Ánh xạ duy nhất từ cột SQLite sang dữ liệu chuỗi nhật ký; dùng chung cho
 * đọc nhật ký và kiểm tra bản sao lưu để không bỏ sót trường khi phục hồi. */
export function rowToAuditEntry(row: Record<string, unknown>): ActivityEntry {
  return {
    id: String(row.id ?? ''), seq: Number(row.seq ?? 0), ts: String(row.ts ?? ''),
    user: String(row.user ?? ''), username: String(row.username ?? ''),
    userId: String(row.user_id ?? ''), role: String(row.role ?? ''), type: String(row.type ?? ''),
    detail: String(row.detail ?? ''), target: String(row.target ?? ''),
    clientId: String(row.client_id ?? ''), prevHash: String(row.prev_hash ?? ''), hash: String(row.hash ?? ''),
  };
}

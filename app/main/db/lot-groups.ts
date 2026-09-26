// Truy vấn dùng chung về nhóm lô QC cho các handler cấu hình (mức QC đổi lô,
// Mean/SD dự kiến, danh sách và dừng/kích hoạt nhóm lô).
import type { Db } from './sqlite-like';

/** Nhóm lô "đang dùng" khi ít nhất một lô của nó đang gán cho một mức QC. */
export function isLotGroupInUse(db: Db, lotIds: string[]): boolean {
  if (!lotIds.length) return false;
  const placeholders = lotIds.map(() => '?').join(',');
  return !!db.prepare(`SELECT 1 FROM test_levels WHERE qc_lot_id IN (${placeholders}) LIMIT 1`).get(...lotIds);
}

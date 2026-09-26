// Định nghĩa DUY NHẤT "mức QC đang vận hành" của một xét nghiệm — dùng chung
// cho trang Nhập QC (`ipc/entry-handlers.ts`) và trang Phân tích Westgard
//
import type { Db } from './sqlite-like';

/** Điều kiện nhóm lô còn vận hành. Bảng `lot_groups` phải dùng bí danh `lg`
 * tại chỗ gọi để các truy vấn đọc và ghi dùng cùng một điều kiện. */
export const OPERATIONAL_LOT_GROUP_SQL = "lg.active<>0 AND lg.status<>'stopped' AND lg.status<>'planned'";

export interface OperationalLevel {
  level: number;
  mean: number | null;
  sd: number | null;
  qc_lot_id: string | null;
  lot_no: string;
  exp: string;
}

export function listOperationalLevels(db: Db, testId: string): OperationalLevel[] {
  return db.prepare(`SELECT tl.level,tl.mean,tl.sd,tl.qc_lot_id,COALESCE(ql.lot_no,'') lot_no,COALESCE(ql.exp,'') exp
    FROM test_levels tl
    JOIN qc_lots ql ON ql.id=tl.qc_lot_id
    JOIN lot_groups lg ON lg.id=ql.group_id
    WHERE tl.test_id=? AND ${OPERATIONAL_LOT_GROUP_SQL}
    ORDER BY tl.level`).all(testId) as OperationalLevel[];
}

/** Xét nghiệm có nằm trong ít nhất một Panel QC đang hoạt động không.
 * Panel tắt KHÔNG loại mức khỏi danh sách — chỉ làm danh sách điểm trả VỀ
 * RỖNG, nên giữ riêng hai cổng thay vì gộp làm một: danh sách mức vẫn hiện,
 * chỉ không điểm nào được đánh giá. */
export function isTestInActivePanel(db: Db, testId: string): boolean {
  return !!db.prepare(`SELECT 1 FROM qc_panel_tests pt JOIN qc_panels p ON p.id=pt.panel_id
    WHERE pt.test_id=? AND p.active<>0 LIMIT 1`).get(testId);
}

/** SỐ mức đang vận hành — đầu vào của `makeScopeOf()`. Phạm vi within/across
 * của một luật là thuộc tính của thiết kế QC đang vận hành, nên phải giống
 * nhau ở MỌI endpoint (chuỗi chính, cột lô song song, chuỗi lô cũ), bất kể
 * endpoint đó chọn hiển thị chuỗi điểm nào. */
export function countOperationalLevels(db: Db, testId: string): number {
  return listOperationalLevels(db, testId).length;
}



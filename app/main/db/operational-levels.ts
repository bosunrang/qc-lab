// Định nghĩa DUY NHẤT "mức QC đang vận hành" của một xét nghiệm — dùng chung
// cho trang Nhập QC (`ipc/entry-handlers.ts`) và trang Phân tích Westgard
// (`ipc/westgard-handlers.ts`).
//
// Vì sao phải là module dùng chung, thay vì "mỗi handler tự SQL" như phần còn
// lại của `main/ipc/*`: tập mức này KHÔNG phải một bộ lọc danh sách cho gọn.
// Nó là đầu vào của `combinedWestgardByPoint()` (đánh giá LIÊN MỨC theo cùng
// `run_id`), và SỐ mức là đầu vào của `makeScopeOf()` (một luật đổi
// within↔across theo số mức) — hai bản sao lệch nhau thì hai trang cho hai
// KẾT LUẬN LÂM SÀNG khác nhau trên cùng một điểm QC.
//
// Đúng chuyện đó đã xảy ra: bản sửa 2026-09-10 chỉ sửa phía Westgard, phía
// Entry giữ nguyên `SELECT ... FROM test_levels` không cổng nào, nên một mức
// thuộc nhóm lô ĐÃ DỪNG vẫn bị kéo vào chuỗi liên mức của Entry — điểm bị
// Entry kết luận "Loại bỏ" (1-2s + 2-2s) trong khi Westgard chỉ "Cảnh báo"
// (1-2s), và ngay TRONG trang Nhập QC thì cây điều hướng (đọc
// `listTestSummaries()`, đã có cổng) nói "0 điểm / Đạt" còn bảng worksheet
// (đọc `queryPoints()`, chưa có cổng) nói "Loại bỏ". Cùng lý do
// `db/table-io.ts` được tách ra khi sao lưu và di trú cần chung một
// transaction phục hồi.
import type { Db } from './sqlite-like';

/** Điều kiện "nhóm lô còn vận hành", port `qcLotGroupOperational()` app cũ.
 * Để ở đây để cổng ĐỌC (bên dưới) và cổng GHI (`canEnterQcForLevel()` trong
 * entry-handlers) không thể định nghĩa "còn vận hành" khác nhau. Bảng
 * `lot_groups` phải được đặt bí danh `lg` tại chỗ gọi. */
export const OPERATIONAL_LOT_GROUP_SQL = "lg.active<>0 AND lg.status<>'stopped' AND lg.status<>'planned'";

export interface OperationalLevel {
  level: number;
  mean: number | null;
  sd: number | null;
  qc_lot_id: string | null;
  lot_no: string;
  exp: string;
}

/** Mức QC đang vận hành — port `operationalLevels()` app cũ: mức phải gắn lô
 * thuộc nhóm lô còn vận hành. Mức không thoả bị loại HẲN (khác cổng Panel
 * bên dưới). */
export function listOperationalLevels(db: Db, testId: string): OperationalLevel[] {
  return db.prepare(`SELECT tl.level,tl.mean,tl.sd,tl.qc_lot_id,COALESCE(ql.lot_no,'') lot_no,COALESCE(ql.exp,'') exp
    FROM test_levels tl
    JOIN qc_lots ql ON ql.id=tl.qc_lot_id
    JOIN lot_groups lg ON lg.id=ql.group_id
    WHERE tl.test_id=? AND ${OPERATIONAL_LOT_GROUP_SQL}
    ORDER BY tl.level`).all(testId) as OperationalLevel[];
}

/** Xét nghiệm có nằm trong ít nhất một Panel QC đang hoạt động không.
 * App cũ KHÔNG loại mức khỏi danh sách khi Panel tắt — nó trả VỀ RỖNG điểm
 * (`qcOperationalAccess.lotPoints()` thoát sớm), nên giữ đúng sự phân biệt đó
 * thay vì gộp hai cổng làm một: danh sách mức vẫn hiện, chỉ không điểm nào
 * được đánh giá. */
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

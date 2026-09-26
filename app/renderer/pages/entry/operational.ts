// Điều kiện "xét nghiệm sẵn sàng nhập" và nhóm lô hiển thị trên cây — dùng
// chung cho cây điều hướng, trạng thái rỗng và việc tự chọn xét nghiệm đầu
// tiên của trang Nhập QC. Đây là lớp hiển thị; cổng thật nằm ở main process
// qua hai hàm `canEnterQcForLevel` và `listOperationalLevels`.
import type { LotGroup, QcLot, QcPanel, Test, TestSummary } from '../../../shared/qc-api';

export type TreeVerdict = 'ok' | 'warn' | 'rej' | 'none';

export interface OperationalCatalog {
  isOperationalTest: (summary: TestSummary) => boolean;
  lotGroupOf: (summary: TestSummary) => { key: string; name: string };
}

export function createOperationalCatalog(tests: Test[], panels: QcPanel[], lots: QcLot[], lotGroups: LotGroup[]): OperationalCatalog {
  /** Nhóm lô có đang hoạt động không: `active!==false && status!=='stopped' &&
   * status!=='planned'`. Nhóm
   * đã dừng/dự kiến, và nhóm "Đã lưu trữ" (`active=0`, do CHẤP NHẬN chuyển
   * tiếp lô tạo ra) đều KHÔNG được tính — lô của các nhóm đó không còn xuất
   * hiện trong cây điều hướng Nhập QC, dù cột `qc_lots.group_id` cũ trong DB
   * vẫn còn trỏ tới chúng. */
  const isOperationalGroup = (group: LotGroup | undefined): boolean =>
    !!group && group.active !== 0 && group.status !== 'stopped' && group.status !== 'planned';

  /** Nhóm lô đang hoạt động mà một lô thuộc về: lô
   * thuộc nhóm đã dừng/dự kiến/lưu trữ trả về `null`, coi như KHÔNG có nhóm,
   * không phải "để tên số lô" như trước — số lô trần chỉ tự sinh khi CHÍNH
   * nhóm đó chưa được đặt tên, không phải khi nhóm không operational. */
  const operationalGroupOfLot = (lotId: string | null | undefined) => {
    if (!lotId) return null;
    const lot = lots.find((l) => l.id === lotId);
    if (!lot?.group_id) return null;
    const group = lotGroups.find((g) => g.id === lot.group_id);
    return isOperationalGroup(group) ? group! : null;
  };

  /** Xét nghiệm có sẵn sàng nhập không: còn hoạt động, nằm trong một Panel QC
   * đang hoạt động và có ít nhất một mức
   * gán lô thuộc nhóm đang hoạt động. Chỉ những xét nghiệm này mới xuất hiện
   * trong cây điều hướng. Xét nghiệm chưa đủ điều kiện không hiển thị trong
   * cây để tránh trộn với xét nghiệm hợp lệ. */
  const isOperationalTest = (summary: TestSummary): boolean => {
    const test = tests.find((t) => t.id === summary.testId);
    if (!test || test.active === 0) return false;
    if (!panels.some((p) => p.active !== 0 && p.testIds.includes(summary.testId))) return false;
    return summary.levels.some((l) => !!operationalGroupOfLot(l.qcLotId));
  };

  /** Nhãn nhóm lô của một xét nghiệm: lấy nhóm lô đang hoạt động của mức QC
   * đầu tiên có gán. Chỉ gọi cho
   * xét nghiệm đã qua `isOperationalTest()` nên luôn tìm được 1 nhóm. */
  const lotGroupOf = (summary: TestSummary): { key: string; name: string } => {
    for (const level of summary.levels) {
      const group = operationalGroupOfLot(level.qcLotId);
      if (group) {
        const nos = group.lotIds.map((id) => lots.find((l) => l.id === id)?.lot_no).filter(Boolean);
        return { key: 'grp:' + group.id, name: group.name || `Nhóm lô ${nos.join('/')}` };
      }
    }
    return { key: 'none', name: 'Chưa gán nhóm lô' };
  };

  return { isOperationalTest, lotGroupOf };
}

/** Verdict của điểm cuối trên mọi mức, không phải điểm xấu nhất từng có. */
export function latestOf(summary: TestSummary): TreeVerdict {
  let worst: TreeVerdict = 'none';
  const rank = { none: -1, ok: 0, warn: 1, rej: 2 } as const;
  for (const level of summary.levels) {
    if (!level.latest) continue;
    if (rank[level.latestVerdict] > rank[worst]) worst = level.latestVerdict;
  }
  return worst;
}

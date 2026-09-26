// Cascade khi CHẤP NHẬN lô mới của hồ sơ chuyển tiếp lô (kế hoạch kiến trúc
// C.1, tách khỏi `ipc/config-lot-handlers.ts`): chuyển các mức QC sang lô
// mới với Mean/SD của hồ sơ, đánh dấu lô cũ hết dùng, tách lô cũ ra một nhóm
// lưu trữ. Gọi BÊN TRONG transaction của handler.
import type { Db } from './sqlite-like';
import { appendMeanSdHistory } from '../domain/manage-validation';
import { cleanId, uid } from '../domain/text-utils';

export interface TransitionLot { id: string; lot_no: string; opened: string }
export interface TransitionCriterion { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }

export function applyLotTransitionCascade(db: Db, input: {
  fromLot: TransitionLot & { group_id: string | null }; toLot: TransitionLot;
  startDate: string; criteria: readonly TransitionCriterion[]; at: string;
}): void {
  const { fromLot, toLot, startDate, criteria, at } = input;
  const fromLotId = fromLot.id, toLotId = toLot.id;
  for (const item of criteria) {
    const level = db.prepare('SELECT * FROM test_levels WHERE test_id=? AND level=?').get(item.testId, item.level) as
      { id: string; qc_lot_id: string | null; mean: number | null; sd: number | null; low: number | null; high: number | null; applied: 'mfg' | 'lab'; mean_sd_history_json: string | null; mean_sd_effective_from: string } | undefined;
    if (!level || level.qc_lot_id !== fromLotId) continue;
    // Nguồn 'mfg' (NSX) — KHÔNG phải 'lab' (PXN). Mean/SD ứng viên nhập
    // trong modal chuyển lô là số của NHÀ SẢN XUẤT cho lô mới, không đi
    // qua luồng "Xây dựng dải PXN" riêng (`rangeCandidate()`/
    // `applyLabRange()` ở trang Nhập QC & Biểu đồ), nên app luôn ghi
    // `source:'mfg'` cho Mean/SD nhập trong modal chuyển lô. Ghi 'lab' ở
    // đây là bug thật (người dùng phát hiện qua cột "Nguồn" của tab Lịch
    // sử dữ liệu hiện PXN cho lô vừa chuyển tiếp, dù chưa hề qua trang
    // Nhập QC).
    db.prepare('UPDATE test_levels SET qc_lot_id=?, mean=?, sd=?, low=?, high=?, applied=?, mean_sd_history_json=?, mean_sd_effective_from=? WHERE id=?')
      .run(toLotId, item.mean, item.sd, item.low ?? null, item.high ?? null, 'mfg',
        appendMeanSdHistory(level.mean_sd_history_json, {
          mean: level.mean, sd: level.sd, low: level.low, high: level.high,
          qcLotId: level.qc_lot_id || '', lot: fromLot.lot_no,
          effectiveFrom: level.mean_sd_effective_from || fromLot.opened || '',
          effectiveTo: startDate || toLot.opened || at.slice(0, 10), source: level.applied,
        }, at),
        toLot.opened || startDate || at.slice(0, 10), level.id);
  }
  db.prepare('UPDATE qc_lots SET depleted=1 WHERE id=?').run(fromLotId);
  if (!fromLot.group_id) return;
  const group = db.prepare('SELECT * FROM lot_groups WHERE id=?').get(fromLot.group_id) as
    { id: string; name: string; manufacturer: string; material: string; catalog: string } | undefined;
  if (!group) return;
  const members = db.prepare('SELECT id, lot_no FROM qc_lots WHERE group_id=?').all(group.id) as { id: string; lot_no: string }[];
  const oldName = members.map((m) => m.lot_no).join('/');
  const autoNamed = !group.name || group.name === oldName;
  const archivedId = cleanId(uid());
  const archivedLotIdsJson = JSON.stringify(members.map((m) => m.id));
  db.prepare(`INSERT INTO lot_groups(id,name,manufacturer,material,catalog,note,active,status,stopped_at,archived_lot_ids_json)
    VALUES (?,?,?,?,?,?,0,'stopped',?,?)`)
    .run(archivedId, group.name, group.manufacturer, group.material, group.catalog,
      `Đã dùng khi chuyển tiếp lô ${fromLot.lot_no} sang ${toLot.lot_no}`, startDate || at, archivedLotIdsJson);
  db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(archivedId, fromLotId);
  db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(group.id, toLotId);
  if (autoNamed) {
    const newName = members.map((m) => (m.id === fromLotId ? toLot.lot_no : m.lot_no)).join('/');
    if (newName !== group.name) db.prepare('UPDATE lot_groups SET name=? WHERE id=?').run(newName, group.id);
  }
}

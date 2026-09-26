// Kích hoạt một nhóm lô QC: tìm các mức cần chuyển sang lô của nhóm và áp
// Mean/SD (kế hoạch kiến trúc C.1, tách khỏi `ipc/config-lot-handlers.ts`).
// Handler lo kiểm dữ liệu, transaction, nhật ký; module này lo truy vấn.
import type { Db } from './sqlite-like';
import { appendMeanSdHistory } from '../domain/manage-validation';
import { lotTargetSnapshot } from '../domain/lot-target';
import { isLotGroupInUse } from './lot-groups';

export interface GroupLot { id: string; lot_no: string; level: number; opened: string }

export interface ActivationCandidate {
  levelId: string; testId: string; lotId: string; lotNo: string; level: number;
  mean: number; sd: number; low: number | null; high: number | null; prevLotId: string | null;
  prevMean: number | null; prevSd: number | null; prevLow: number | null; prevHigh: number | null;
  prevApplied: 'mfg' | 'lab'; prevEffectiveFrom: string; historyJson: string | null;
}

/** Mọi mức QC (của mọi xét nghiệm) cùng mức với một lô của nhóm, chưa dùng lô
 * đó, và có Mean/SD cho lô đó — từ Mean/SD dự kiến hoặc lịch sử. */
export function activationCandidates(db: Db, lots: readonly GroupLot[]): ActivationCandidate[] {
  const candidates: ActivationCandidate[] = [];
  for (const lot of lots) {
    const levels = db.prepare(`SELECT tl.id, tl.test_id, tl.qc_lot_id, tl.mean, tl.sd, tl.low, tl.high, tl.applied, tl.mean_sd_effective_from, tl.mean_sd_history_json
      FROM test_levels tl WHERE tl.level=?`).all(lot.level) as {
        id: string; test_id: string; qc_lot_id: string | null; mean: number | null; sd: number | null;
        low: number | null; high: number | null; applied: 'mfg' | 'lab'; mean_sd_effective_from: string; mean_sd_history_json: string | null }[];
    for (const level of levels) {
      if (level.qc_lot_id === lot.id) continue; // đã dùng đúng lô này
      // Ưu tiên số ĐÃ NHẬP DỰ KIẾN cho đúng (xét nghiệm, mức, lô) này; chỉ
      // khi không có mới tìm ngược trong lịch sử (nhóm từng dùng rồi quay
      // lại). Ngược thứ tự sẽ áp số CŨ đè lên số người dùng vừa chuẩn bị.
      const plannedRow = db.prepare('SELECT mean, sd, low, high FROM planned_targets WHERE test_id=? AND level=? AND qc_lot_id=?')
        .get(level.test_id, lot.level, lot.id) as { mean: number | null; sd: number | null; low: number | null; high: number | null } | undefined;
      const snapshot = plannedRow && plannedRow.mean != null && plannedRow.sd != null && plannedRow.sd > 0
        ? { mean: plannedRow.mean, sd: plannedRow.sd, low: plannedRow.low, high: plannedRow.high }
        : lotTargetSnapshot(level, lot.id);
      if (!snapshot || !(snapshot.sd > 0)) continue;
      candidates.push({
        levelId: level.id, testId: level.test_id, lotId: lot.id, lotNo: lot.lot_no, level: lot.level,
        mean: snapshot.mean, sd: snapshot.sd, low: snapshot.low, high: snapshot.high,
        prevLotId: level.qc_lot_id, prevMean: level.mean, prevSd: level.sd, prevLow: level.low, prevHigh: level.high,
        prevApplied: level.applied, prevEffectiveFrom: level.mean_sd_effective_from, historyJson: level.mean_sd_history_json,
      });
    }
  }
  return candidates;
}

/** Nhóm lô đang giữ các mức sắp bị thay thế (trừ chính nhóm được kích hoạt). */
export function replacedGroupsOf(db: Db, candidates: readonly ActivationCandidate[], groupId: string): Set<string> {
  const replaced = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.prevLotId) continue;
    const owner = db.prepare('SELECT group_id FROM qc_lots WHERE id=?').get(candidate.prevLotId) as { group_id: string | null } | undefined;
    if (owner && owner.group_id && owner.group_id !== groupId) replaced.add(owner.group_id);
  }
  return replaced;
}

/** Áp Mean/SD cho từng mức, dừng nhóm cũ không còn dùng, gỡ nhãn "đã dừng"
 * của nhóm được kích hoạt. Gọi BÊN TRONG transaction của handler. Trả về các
 * nhóm lô vừa bị dừng. */
export function applyLotGroupActivation(db: Db, input: {
  groupId: string; lots: readonly GroupLot[]; candidates: readonly ActivationCandidate[]; replacedGroupIds: ReadonlySet<string>; at: string;
}): Set<string> {
  const { groupId, lots, candidates, replacedGroupIds, at } = input;
  const stoppedIds = new Set<string>();
  for (const candidate of candidates) {
    const oldLot = candidate.prevLotId ? db.prepare('SELECT lot_no, opened FROM qc_lots WHERE id=?').get(candidate.prevLotId) as
      { lot_no: string; opened: string } | undefined : undefined;
    const nextFrom = lots.find((lot) => lot.id === candidate.lotId)?.opened || at.slice(0, 10);
    // `test_levels` KHÔNG có cột `lot` — số lô lấy qua `qc_lot_id`
    // (khác hệ thống, nơi mức QC giữ cả nhãn lô dạng chuỗi).
    // Nguồn 'mfg' (NSX), KHÔNG phải 'lab' — cùng bug/lý do đã sửa ở cascade
    // chuyển lô: `applyTargetPick()` hệ thống (dùng chung bởi Mean/SD tab VÀ
    // kích hoạt nhóm lô) LUÔN ghi `source:'mfg'`; 'lab' (PXN) chỉ dành riêng
    // cho luồng "Xây dựng dải PXN" ở trang Nhập QC & Biểu đồ.
    db.prepare('UPDATE test_levels SET qc_lot_id=?, mean=?, sd=?, low=?, high=?, applied=?, mean_sd_history_json=?, mean_sd_effective_from=? WHERE id=?')
      .run(candidate.lotId, candidate.mean, candidate.sd, candidate.low, candidate.high, 'mfg',
        appendMeanSdHistory(candidate.historyJson,
          { mean: candidate.prevMean, sd: candidate.prevSd, low: candidate.prevLow, high: candidate.prevHigh,
            qcLotId: candidate.prevLotId || '', lot: oldLot?.lot_no || '',
            effectiveFrom: candidate.prevEffectiveFrom || oldLot?.opened || '', effectiveTo: nextFrom,
            source: candidate.prevApplied }, at),
        nextFrom, candidate.levelId);
    // Đã áp rồi thì hàng dự kiến hết vai trò; giữ lại sẽ áp lại đúng số
    // đó ở lần kích hoạt sau, đè lên mọi thay đổi Mean/SD ở giữa.
    db.prepare('DELETE FROM planned_targets WHERE test_id=? AND level=? AND qc_lot_id=?')
      .run(candidate.testId, candidate.level, candidate.lotId);
  }
  for (const replacedId of replacedGroupIds) {
    const lotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(replacedId) as { id: string }[]).map((r) => r.id);
    if (isLotGroupInUse(db, lotIds)) continue; // còn xét nghiệm khác dùng → vẫn đang chạy
    db.prepare("UPDATE lot_groups SET status='stopped', stopped_at=? WHERE id=?").run(at, replacedId);
    stoppedIds.add(replacedId);
  }
  db.prepare("UPDATE lot_groups SET status='', stopped_at='' WHERE id=?").run(groupId);
  return stoppedIds;
}

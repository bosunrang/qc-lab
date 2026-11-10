// Cổng giữ hàng chờ NCE cho các thao tác đổi cấu hình (R03 rà soát
// 10/11/2026): đưa xét nghiệm hay lô ra khỏi vận hành không được làm lần
// chạy bị loại CHƯA lập hồ sơ NCE biến khỏi hàng chờ mà chưa ai tiếp nhận.
import type { Db } from '../db/sqlite-like';
import { LostRejectedRunsError, assertNoLostRejectedRuns, unrecordedRejectedRuns } from '../db/nce-evaluation';
import type { IpcResult } from './shared';
import type { WriteSteps, WriteTx } from './write-command';

/** `w.commit(work)` kèm kiểm hàng chờ: chụp lần chạy chưa lập hồ sơ trước khi
 * ghi, kiểm lại sau khi ghi trong cùng giao dịch; mất lần chạy nào thì huỷ cả
 * lần ghi và trả lỗi `pending-rejected-runs`. `action` là chủ ngữ của câu báo,
 * vd "Dừng nhóm lô này". */
export function commitKeepingRejectedRuns<R>(db: Db, w: WriteSteps, action: string, work: (tx: WriteTx) => R): IpcResult<R> {
  const before = unrecordedRejectedRuns(db);
  try {
    return { ok: true, data: w.commit((tx) => {
      const value = work(tx);
      assertNoLostRejectedRuns(db, before, action);
      return value;
    }) };
  } catch (error) {
    if (error instanceof LostRejectedRunsError) return { ok: false, error: { code: error.code, message: error.message } };
    throw error;
  }
}

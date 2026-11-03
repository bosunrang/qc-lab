// Dữ liệu chạy song song tối thiểu để cổng chấp nhận lô mới (N12) cho qua:
// hồ sơ chuyển tiếp ở trạng thái "Đang chạy song song" và lô mới có đủ số kết
// quả trên đủ số ngày, mỗi kết quả đúng bằng Mean ứng viên (z = 0).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PARALLEL_MIN_DAYS } = require('../../../app-dist/main/domain/parallel-acceptance.js');

export function seedParallelRun(db, { transitionId, testId, level, lotNo, mean, sd, start = '2026-01-01', days = PARALLEL_MIN_DAYS }) {
  db.prepare("UPDATE lot_transitions SET status='active' WHERE id=?").run(transitionId);
  const insert = db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided)
    VALUES (?,?,?,?,?,?,?,?,?,0)`);
  const first = new Date(`${start}T00:00:00Z`);
  for (let day = 0; day < days; day++) {
    const date = new Date(first.getTime() + day * 86400000).toISOString().slice(0, 10);
    insert.run(`par-${transitionId}-${testId}-${level}-${day}`, testId, level, date, `${date}-par`, mean, lotNo, mean, sd);
  }
}

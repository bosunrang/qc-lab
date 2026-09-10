// Oracle cho luồng "Nạp CV lô": chỉ gom IQC theo cùng mức/cùng lô, loại
// điểm huỷ, chặn nhóm đổi Mean/SD và áp ngưỡng 20/30 điểm như app cũ.
import assert from 'node:assert/strict';
import { buildSigmaCohorts, periodCutoff } from '../main/domain/sigma-cohort.ts';

assert.equal(periodCutoff('2026-02', '2026-09-07'), '2026-02-28');
assert.equal(periodCutoff('2026-09', '2026-09-07'), '2026-09-07');

const points = [];
for (let i = 0; i < 30; i++) points.push({ level: 1, lot: 'Lô-A', date: `2026-08-${String(i % 28 + 1).padStart(2, '0')}`, val: 100 + (i % 2), qc_mean: 100, qc_sd: 2 });
for (let i = 0; i < 20; i++) points.push({ level: 2, lot: 'Lô-B', date: `2026-08-${String(i % 28 + 1).padStart(2, '0')}`, val: 150 + (i % 2), qc_mean: i === 19 ? 151 : 150, qc_sd: 2 });
points.push({ level: 1, lot: 'Lô-A', date: '2026-08-20', val: 999, qc_mean: 100, qc_sd: 2, voided: 1 });
points.push({ level: 1, lot: 'Lô-Cũ', date: '2026-07-20', val: 99, qc_mean: 100, qc_sd: 2 });

const cohorts = buildSigmaCohorts(points, '2026-08', [1, 2], '2026-09-07');
const first = cohorts.find((cohort) => cohort.level === 1 && cohort.lot === 'Lô-A');
assert.equal(first.n, 30);
assert.equal(first.status, 'eligible');
assert.equal(first.excluded.voided, 1);
assert.ok(first.cv > 0);
assert.equal(cohorts.some((cohort) => cohort.lot === 'Lô-Cũ'), false, 'lô không có điểm trong kỳ không được nạp');
const unstable = cohorts.find((cohort) => cohort.level === 2);
assert.equal(unstable.status, 'unstable');
assert.ok(unstable.issues.includes('Mean mục tiêu thay đổi'));

console.log('app-v2 sigma-cohort oracle tests passed');

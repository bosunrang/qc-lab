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


// --- Ba tính chất chỉ lộ ra khi đối chiếu trực tiếp với app cũ
// (`cross-app-westgard-sigma.test.mjs`). Giữ ở đây để chúng vẫn bị canh sau
// khi app cũ bị cắt bỏ cùng file đối chiếu đó.

// (1) SNAPSHOT CHƯA GHI KHÔNG PHẢI LÀ 0. `qc_points.qc_mean` là cột nullable;
//     `Number(null)` là 0 và 0 hữu hạn, nên một điểm thiếu snapshot từng tự
//     đẻ ra Mean mục tiêu thứ hai → cả nhóm bị dán "Mean mục tiêu thay đổi" →
//     `unstable` → Sigma không dùng được nhóm đó.
{
  const rows = [
    { level: 1, lot: 'L', date: '2026-08-01', val: 200, qc_mean: null, qc_sd: null },
    { level: 1, lot: 'L', date: '2026-08-02', val: 204, qc_mean: 200, qc_sd: 4 },
  ];
  const [cohort] = buildSigmaCohorts(rows, '2026-08', [1], '2026-09-07');
  assert.deepEqual(cohort.issues, [], 'diem thieu snapshot khong duoc coi la Mean muc tieu thu hai');
  assert.equal(cohort.targetMean, 200);
  assert.equal(cohort.targetSd, 4);
  // Ngược lại: Mean mục tiêu 0 là giá trị THẬT (base excess), phải phân biệt
  // được với "chưa ghi" — hai điểm cùng 0 vẫn chỉ là MỘT giá trị mục tiêu.
  const zero = buildSigmaCohorts([
    { level: 1, lot: 'L', date: '2026-08-01', val: 0.2, qc_mean: 0, qc_sd: 0.5 },
    { level: 1, lot: 'L', date: '2026-08-02', val: -0.3, qc_mean: 0, qc_sd: 0.5 },
  ], '2026-08', [1], '2026-09-07');
  assert.deepEqual(zero[0].issues, [], 'Mean muc tieu 0 that khong duoc bao lech');
  assert.equal(zero[0].targetMean, 0);
}

// (2) GIÁ TRỊ RỖNG KHÔNG PHẢI LÀ ĐIỂM 0. Cùng bẫy `Number('')===0`, nhưng ở
//     phía giá trị đo: một hàng rỗng lọt vào sẽ kéo CV xuống như thể có một
//     lần chạy bằng 0.
{
  const rows = [
    { level: 1, lot: 'L', date: '2026-08-01', val: 10, qc_mean: 10, qc_sd: 1 },
    { level: 1, lot: 'L', date: '2026-08-02', val: null, qc_mean: 10, qc_sd: 1 },
    { level: 1, lot: 'L', date: '2026-08-03', val: '', qc_mean: 10, qc_sd: 1 },
    { level: 1, lot: 'L', date: '2026-08-04', val: 11, qc_mean: 10, qc_sd: 1 },
  ];
  const [cohort] = buildSigmaCohorts(rows, '2026-08', [1], '2026-09-07');
  assert.equal(cohort.n, 2, 'chi 2 diem co gia tri that');
  assert.equal(cohort.excluded.invalidValue, 2);
}

// (3) NGÀY PHẢI TỒN TẠI TRÊN LỊCH. Cổng nhập chỉ kiểm định dạng cho tới
//     2026-09-10, nên `qc_points` có thể còn hàng `2026-02-31` (dữ liệu di
//     trú hoặc nhập trước khi siết cổng); một ngày như vậy làm `start`/`end`
//     của nhóm vô nghĩa và kéo điểm vào kỳ nó không thuộc về.
{
  const rows = [
    { level: 1, lot: 'L', date: '2026-08-01', val: 10, qc_mean: 10, qc_sd: 1 },
    { level: 1, lot: 'L', date: '2026-02-31', val: 99, qc_mean: 10, qc_sd: 1 },
  ];
  const [cohort] = buildSigmaCohorts(rows, '2026-08', [1], '2026-09-07');
  assert.equal(cohort.n, 1, 'ngay khong ton tai bi loai');
  assert.equal(cohort.start, '2026-08-01');
  assert.equal(cohort.end, '2026-08-01');
}

// (4) Mean = 0 thì KHÔNG có CV (chia cho 0), và phải là `null` chứ không phải
//     0 — `0` sẽ bị ghi vào kỳ Sigma như "CV = 0%".
{
  const [cohort] = buildSigmaCohorts([
    { level: 1, lot: 'L', date: '2026-08-01', val: 1, qc_mean: 0, qc_sd: 1 },
    { level: 1, lot: 'L', date: '2026-08-02', val: -1, qc_mean: 0, qc_sd: 1 },
  ], '2026-08', [1], '2026-09-07');
  assert.equal(cohort.cv, null, 'Mean 0 thi CV la null');
}

console.log('app-v2 sigma-cohort oracle tests passed');

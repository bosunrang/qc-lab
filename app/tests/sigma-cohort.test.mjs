// Kiểm thử luồng "Nạp CV lô": chỉ gom IQC theo cùng mức/cùng lô, loại
// điểm huỷ, chặn nhóm đổi Mean/SD và áp ngưỡng 20/30 điểm.
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


// Các tính chất biên của cohort cần được duy trì bằng regression test.

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
  assert.ok(!cohort.issues.includes('Mean mục tiêu thay đổi'), 'snapshot trống không phải Mean thứ hai');
  assert.ok(cohort.issues.some(issue => issue.includes('Thiếu snapshot')), 'thiếu căn cứ kiểm soát phải được cảnh báo');
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

// (3) Ngày phải tồn tại trên lịch; một ngày không hợp lệ làm `start`/`end`
//     của nhóm vô nghĩa và có thể kéo điểm vào sai kỳ.
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

// (5) TRONG TẦM KIỂM SOÁT — ISO/TS 20914 lấy u(Rw) từ dữ liệu IQC "đại diện
//     cho hoạt động thường quy ĐÃ được thẩm định sau khi quản lý QC". Một
//     nhóm 30 điểm có 1 điểm +40 SD chưa ai đụng tới không thoả điều kiện đó.
{
  const base = [];
  for (let i = 0; i < 30; i++) base.push({ id: `p${i}`, level: 1, lot: 'L', date: `2026-08-${String(i % 28 + 1).padStart(2, '0')}`, val: 100 + (i % 2), qc_mean: 100, qc_sd: 2 });

  // Không có điểm lệch: vẫn `eligible` như trước.
  {
    const [c] = buildSigmaCohorts(base, '2026-08', [1], '2026-09-07');
    assert.equal(c.status, 'eligible');
    assert.deepEqual(c.outOfControl, { rejected: 0, unresolved: 0 });
  }

  // 1 điểm +40 SD chưa xử lý: KHÔNG được `eligible` nữa.
  const withOutlier = [...base, { id: 'bad', level: 1, lot: 'L', date: '2026-08-15', val: 180, qc_mean: 100, qc_sd: 2 }];
  {
    const [c] = buildSigmaCohorts(withOutlier, '2026-08', [1], '2026-09-07');
    assert.equal(c.status, 'out-of-control', 'nhóm có điểm mất kiểm soát chưa xử lý không được eligible');
    assert.deepEqual(c.outOfControl, { rejected: 1, unresolved: 1 });
    assert.ok(c.issues.some((item) => item.includes('±3SD')), `mong doi issue ve ±3SD, nhan duoc ${c.issues}`);
    // KHÔNG được tự loại điểm đó ra khỏi CV — loại theo kết quả là selection
    // bias, CV sẽ đẹp giả. Điểm vẫn nằm trong n và vẫn kéo CV lên.
    assert.equal(c.n, 31, 'điểm mất kiểm soát vẫn nằm trong nhóm');
    const clean = buildSigmaCohorts(base, '2026-08', [1], '2026-09-07')[0];
    assert.ok(c.cv > clean.cv, 'CV phải phản ánh cả điểm lệch, không được làm đẹp');
  }

  // Điểm đó đã có hồ sơ khắc phục duyệt xong + kết luận hiệu quả: hết chặn.
  {
    const [c] = buildSigmaCohorts(withOutlier, '2026-08', [1], '2026-09-07', new Set(['bad']));
    assert.equal(c.status, 'eligible', 'đã xử lý trọn vẹn thì nhóm dùng lại được');
    assert.deepEqual(c.outOfControl, { rejected: 1, unresolved: 0 }, 'vẫn ghi nhận là đã từng mất kiểm soát');
    assert.equal(c.n, 31, 'xử lý xong cũng KHÔNG loại điểm khỏi CV');
  }

  // Đúng 3,0 SD là "vượt" theo 1-3s? Không — Westgard nói "exceeds", nên đúng
  // biên chưa tính. Dùng cùng quy ước với engine luật.
  {
    const edge = [...base, { id: 'e', level: 1, lot: 'L', date: '2026-08-16', val: 106, qc_mean: 100, qc_sd: 2 }];
    const [c] = buildSigmaCohorts(edge, '2026-08', [1], '2026-09-07');
    assert.equal(c.outOfControl.rejected, 0, '|z| = 3 đúng bằng CHƯA vượt — cùng ngưỡng `a > 3` của 1-3s');
    assert.equal(c.status, 'eligible', 'không được chặn nhóm vì một điểm mà Westgard không hề loại');
    const over = [...base, { id: 'e', level: 1, lot: 'L', date: '2026-08-16', val: 106.01, qc_mean: 100, qc_sd: 2 }];
    assert.equal(buildSigmaCohorts(over, '2026-08', [1], '2026-09-07')[0].outOfControl.rejected, 1, 'vượt 3 SD thì vẫn phải bắt');
  }

  // Điểm thiếu snapshot Mean/SD thì không kết luận được gì — bỏ qua, không
  // đoán bằng Mean/SD hiện hành (đó là cách sửa lịch sử).
  {
    const noSnap = [...base, { id: 'n', level: 1, lot: 'L', date: '2026-08-17', val: 180, qc_mean: null, qc_sd: null }];
    const [c] = buildSigmaCohorts(noSnap, '2026-08', [1], '2026-09-07');
    assert.equal(c.outOfControl.rejected, 0, 'thiếu snapshot thì không dán nhãn mất kiểm soát');
    assert.equal(c.status, 'unstable', 'không kết luận đủ điều kiện khi không đánh giá được kiểm soát');
  }
}
console.log('app sigma-cohort oracle tests passed');



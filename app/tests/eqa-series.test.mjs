// Theo dõi ngoại kiểm qua nhiều đợt (docs/EQA-REVIEW-2026-10-28.md, N-05..N-07):
// tín hiệu chuỗi, điểm J, "không thành công" và độ tin cậy của giá trị ấn định.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { eqaSeries, eqaJPoint, eqaAssignedUncertainty } = require('../../app-dist/main/domain/eqa/series.js');

const chain = (zs, year = 2026) => zs.map((z, i) => ({ id: `r${i + 1}`, year, roundNo: i + 1, round: `ĐỢT ${String(i + 1).padStart(2, '0')}`, sample: '', z }));
const signalsAt = (result, i) => result.points[i].signals;

test('điểm J: 0/2/4/8 theo |z| < 1 / < 2 / < 3 / ≥ 3, mang dấu', () => {
  assert.deepEqual([0.99, 1, -1.99, 2.5, -3, 3.004].map(eqaJPoint), [0, 2, -2, 4, -8, 8]);
});

test('N-07: |z| ≥ 3, 2/3 đợt vượt ±2 cùng phía, 6 đợt cùng phía, J cộng dồn', () => {
  const r = eqaSeries(chain([0.5, 2.2, 0.1, 2.4, -2.3, 3.1]));
  assert.deepEqual(signalsAt(r, 1), [], 'một lần vượt 2 chưa đủ 2/3');
  // 2,2 và 2,4 trong 3 đợt gần nhất; J: 4 + 0 + 4 = 8 cũng đạt ngưỡng.
  assert.deepEqual(signalsAt(r, 3), ['two_of_three', 'j_score']);
  assert.deepEqual(signalsAt(r, 4), [], 'khác phía');
  assert.deepEqual(signalsAt(r, 5), ['reject', 'two_of_three', 'j_score']);

  const six = eqaSeries(chain([0.3, 0.4, 0.2, 0.6, 0.1, 0.5, -0.2]));
  assert.deepEqual(six.points.map((p) => p.signals.includes('six_same_side')), [false, false, false, false, false, true, false]);

  // J: 1,5 + 1,8 + 2,1 → 2 + 2 + 4 = 8 thì báo rồi đặt lại; đổi dấu cũng đặt lại.
  const j = eqaSeries(chain([1.5, 1.8, 2.1, 1.2, -1.5, -1.1]));
  assert.deepEqual(j.points.map((p) => p.j), [2, 4, 8, 2, -2, -4]);
  assert.deepEqual(j.points.map((p) => p.signals.includes('j_score')), [false, false, true, false, false, false]);
  assert.equal(j.enough, true);
  assert.equal(eqaSeries(chain([1, 2])).enough, false, 'dưới 6 đợt chưa kết luận xu hướng');
});

test('N-06: không thành công khi không chấp nhận 2 đợt liên tiếp hoặc 2 trong 3 đợt; tính theo đợt', () => {
  const consecutive = eqaSeries(chain([3.2, -3.1]));
  assert.deepEqual(consecutive.points.map((p) => p.unsuccessful), [false, true]);
  const twoOfThree = eqaSeries(chain([3.5, 0.2, 3.3, 0.1, 0.4, 3.2]));
  assert.deepEqual(twoOfThree.points.map((p) => p.unsuccessful), [false, false, true, false, false, false]);
  // Hai mẫu trong cùng một đợt chỉ tính là một đợt không chấp nhận.
  const samples = eqaSeries([{ id: 'a', year: 2026, roundNo: 1, round: 'ĐỢT 01', sample: '01-01', z: 3.4 }, { id: 'b', year: 2026, roundNo: 1, round: 'ĐỢT 01', sample: '01-02', z: 3.1 }]);
  assert.deepEqual(samples.points.map((p) => p.unsuccessful), [false, false]);
  // Thứ tự theo năm rồi số đợt, không theo thứ tự nhập.
  const unordered = eqaSeries([...chain([0.1], 2027), ...chain([3.3, 3.1], 2026)]);
  assert.deepEqual(unordered.points.map((p) => [p.year, p.roundNo, p.unsuccessful]), [[2026, 1, false], [2026, 2, true], [2027, 1, false]]);
});

test('N-05: u(x_pt) ≈ 1,25·SD/√N của nhóm làm giá trị ấn định; > 0,3·σp là kém chắc chắn, có z′', () => {
  // Báo cáo thật: ALT nhóm Beckman DxC 700 AU (N 1108, SD 11,58), σp 9,405.
  const alt = eqaAssignedUncertainty(141, 141.069, 9.405, { all: { mean: 140.876, sd: 11.56, cv: 8, n: 8611 }, instrument: { mean: 141.069, sd: 11.58, cv: 3.4, n: 1108 } });
  assert.equal(alt.level, 'instrument');
  assert.equal(alt.u.toFixed(3), '0.435');
  assert.equal(alt.uncertain, false);
  // Nhóm nhỏ: N = 6, SD = 4, σp = 2 → u = 2,04 > 0,6.
  const small = eqaAssignedUncertainty(12, 10, 2, { instrument: { mean: 10, sd: 4, cv: 40, n: 6 } });
  assert.equal(small.uncertain, true);
  assert.equal(small.zPrime.toFixed(2), '0.70', 'z = 1,00 nhưng z′ = 2 / √(4 + 4,17)');
  assert.equal(eqaAssignedUncertainty(12, 11, 2, { instrument: { mean: 10, sd: 4, cv: 40, n: 6 } }), null, 'không nhóm nào trùng giá trị ấn định');
});

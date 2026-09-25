// Phép tính nghiệp vụ dùng chung giữa main và renderer. Trước 2026-09-25
// Mean/SD/CV có 5 bản viết tay đã lệch nhau, Z-score có hai quy tắc, còn gợi ý
// cải thiện Sigma chỉ nằm ở renderer và không có test.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { observedStats } = require('../../app-dist/main/domain/observed-stats.js');
const { sigmaImprovement, eqaRoundBias, eqaRoundsStats } = require('../../app-dist/main/domain/sigma-metrics.js');

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} ≠ ${expected}`);

test('thống kê quan sát: SD mẫu n−1, CV theo |Mean|, null khi chưa đủ điểm', () => {
  assert.deepEqual(observedStats([]), { n: 0, days: 0, mean: null, sd: null, cv: null, provisional: true });
  const one = observedStats([{ val: 5, date: '2026-09-01' }]);
  assert.equal(one.mean, 5);
  assert.equal(one.sd, null, '1 điểm không có SD — không hiện "SD 0"');
  assert.equal(one.cv, null, '1 điểm không có CV — không hiện "CV 0.00%"');
  const two = observedStats([{ val: 4 }, { val: 6 }]);
  close(two.sd, Math.SQRT2, 'SD mẫu của 4 và 6');
  close(two.cv, Math.SQRT2 / 5 * 100, 'CV');
  const negative = observedStats([{ val: -4 }, { val: -6 }]);
  assert.ok(negative.cv > 0, 'Mean âm vẫn cho CV dương (SD/|Mean|)');
  assert.equal(observedStats([{ val: -1 }, { val: 1 }]).cv, null, 'Mean bằng 0 thì không có CV');
  assert.equal(observedStats([{ val: NaN }, { val: 3 }]).n, 1, 'bỏ giá trị không hữu hạn');
});

test('thống kê quan sát: "tạm thời" khi chưa đủ 20 phép đo trong 10 ngày (WG-14)', () => {
  const series = (count, dayCount) => Array.from({ length: count }, (_, i) => ({ val: 100 + (i % 3), date: `2026-09-${String((i % dayCount) + 1).padStart(2, '0')}` }));
  assert.equal(observedStats(series(19, 10)).provisional, true, '19 phép đo');
  assert.equal(observedStats(series(20, 9)).provisional, true, '9 ngày');
  assert.equal(observedStats(series(20, 10)).provisional, false, '20 phép đo trong 10 ngày');
});

test('gợi ý cải thiện Sigma: mục tiêu CV/Bias và QGI theo ngưỡng Parry', () => {
  // Ví dụ: TEa 10%, Bias 2%, CV 3% cho Sigma bằng 2,67.
  const plan = sigmaImprovement(10, 2, 3);
  close(plan.cvTarget, 2, 'CV cần đạt = (10 − 2) / 4');
  close(plan.biasTarget, -2, '|Bias| cần đạt = 10 − 4 · 3 (âm: giảm Bias không đủ)');
  close(plan.qgi, 2 / 4.5, 'QGI = |Bias| / (1,5 · CV)');
  assert.equal(plan.driver, 'imprecision');
  assert.equal(sigmaImprovement(10, -2, 3).qgi, plan.qgi, 'dấu Bias không đổi QGI');
  // Ngưỡng: < 0,8 độ chụm; 0,8–1,2 cả hai; > 1,2 độ chệch (CV = 1 nên QGI = Bias / 1,5).
  assert.equal(sigmaImprovement(10, 1.19, 1).driver, 'imprecision');
  assert.equal(sigmaImprovement(10, 1.2, 1).driver, 'both', 'QGI đúng 0,8');
  assert.equal(sigmaImprovement(10, 1.8, 1).driver, 'both', 'QGI đúng 1,2');
  assert.equal(sigmaImprovement(10, 1.81, 1).driver, 'inaccuracy');
  // Bản cũ ở renderer (|Bias|/(|Bias|+1,65·CV), ngưỡng 0,6) xếp ca này vào "cả hai".
  assert.equal(sigmaImprovement(10, 2, 1).driver, 'inaccuracy', 'QGI 1,33 là do độ chệch');
  assert.equal(sigmaImprovement(10, 2, 0).qgi, null);
});

test('Bias% vòng EQA và RMS: xem trước dùng đúng công thức lúc lưu', () => {
  close(eqaRoundBias(102, 100), 2, 'Bias% = (KQ − đích) / |đích| × 100');
  close(eqaRoundBias(-98, -100), 2, 'đích âm');
  assert.equal(eqaRoundsStats([-2]).rms, -2, 'một vòng giữ dấu');
  close(eqaRoundsStats([2, -2]).rms, 2, 'nhiều vòng dùng RMS');
});

test('renderer không tự viết lại công thức SD/CV', () => {
  const root = new URL('../renderer/', import.meta.url);
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
  const offenders = files(fileURLToPath(root))
    .filter((file) => /\*\*\s*2[\s\S]{0,80}\/\s*\(\s*\w+\s*-\s*1\s*\)/.test(readFileSync(file, 'utf8')))
    .map((file) => file.split(/renderer[\\/]/)[1]);
  assert.deepEqual(offenders, [], 'dùng observedStats() của main/domain/observed-stats.ts');
});

/**
 * Tests for actionBiasInfo() (assets/modules/action-form.js).
 *
 * Đây là lần đầu action-form.js được nạp vào sandbox `vm` (mọi test khác của nó chỉ
 * scan chuỗi qua ui-route-structure.test.js). actionBiasInfo() là hàm THUẦN duy nhất
 * trong file — không đụng DOM/state — cố tình tách ra để có thể unit-test công thức
 * ngưỡng Bias (mục 4-6) và ΔSEcrit/ΔREcrit tham khảo (mục 7) của hồ sơ NCE.
 *
 * Hợp đồng quan trọng nhất, lặp lại đúng bài học từ lỗi biasTarget/alpha đã sửa ở
 * ReagentComparisonService trong cùng đợt này: Bias rỗng hoặc không phải số KHÔNG
 * được ngầm trở thành 0 — 0% bias là một kết quả HỢP LỆ (đạt ngưỡng), khác hẳn
 * "chưa đo". Test dưới đây chốt rõ: biasBefore/biasAfter rỗng hoặc không hợp lệ thì
 * các trường phụ thuộc (`crit`, `degObs`, `withinThreshold`) phải là `null`, không
 * phải một giá trị "trông như đạt" giả.
 *
 * Bias trước/sau khắc phục cố ý KHÔNG dùng chung một biến: `withinThreshold` (mục
 * 4-6, "đã sửa xong chưa") đọc biasAfter; `crit`/`degObs` (mục 7, "sự cố nặng cỡ
 * nào") đọc biasBefore. Dùng nhầm biasAfter cho mục 7 sẽ luôn ra "nguy cơ thấp" giả
 * vì Bias sau khắc phục theo định nghĩa đã gần 0.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox([
  'core.js',
  'modules/state.js',
  'modules/qc-domain.js',
  'modules/sigma-tea.js',
  'modules/action-workflow-service.js',
  'modules/action-form.js',
]);
run(ctx, 'function __setState(s){state=s;clearDerived();}');

function baseState() {
  return {
    lab: {}, machines: [], instruments: [], assayGroups: [], qcPanels: [], lotTransitions: [],
    lotGroups: [], qcLots: [], tests: [], data: {}, actions: [], activity: [], users: [],
    reagentTests: [], reagentOperators: [], reagentSampleTypes: [], sigmaData: {}, periodLocks: [],
    westgardRules: {}, configMigrationVersion: 1, teaRefs: [],
  };
}
run(ctx, '__setState(' + JSON.stringify(baseState()) + ')');

// Glucose là measurand mặc định trong TEA_ANALYTE_CATALOG (ricos TEa = 6.96%) —
// dùng thẳng nguồn TEa có sẵn thay vì dựng bảng riêng cho test.
const glucose = { id: 'T1', name: 'Glucose', unit: 'mmol/L', teaSource: 'ricos' };
const level1 = { level: 1, mean: 5, sd: 0.2 };
const info = (t, l, before, after) =>
  JSON.parse(JSON.stringify(run(ctx, `actionBiasInfo(${JSON.stringify(t)},${JSON.stringify(l)},${JSON.stringify(before)},${JSON.stringify(after)})`)));

/* --- TEa hợp lệ, Bias trong ngưỡng --- */
{
  const r = info(glucose, level1, '1.0', '0.2');
  assert.ok(Math.abs(r.tea - 6.96) < 1e-9, 'TEa phải lấy từ TEA_ANALYTE_CATALOG (ricos) của Glucose');
  assert.ok(Math.abs(r.threshold - 1.74) < 1e-9, 'ngưỡng = TEa/4');
  assert.equal(r.withinThreshold, true, '|0.2| <= 1.74 -> đạt ngưỡng');
  assert.ok(r.crit, 'có bias trước khắc phục hợp lệ thì phải tính được crit');
  assert.ok(Math.abs(r.degObs - (1.0 / 0.2)) < 1e-9, 'degObs = |biasBefore|/SD, không phải |biasAfter|/SD');
}

/* --- Bias sau khắc phục vượt ngưỡng --- */
{
  const r = info(glucose, level1, '1.0', '5');
  assert.equal(r.withinThreshold, false, '|5| > 1.74 -> vượt ngưỡng');
}

/* --- Bias rỗng/không hợp lệ: KHÔNG được rơi về 0 --- */
{
  const empty = info(glucose, level1, '', '');
  assert.equal(empty.biasBefore, null, 'biasBefore rỗng phải là null, không phải 0');
  assert.equal(empty.biasAfter, null, 'biasAfter rỗng phải là null, không phải 0');
  assert.equal(empty.withinThreshold, null, 'chưa nhập biasAfter thì chưa có kết luận đạt/vượt (không phải false)');
  assert.equal(empty.crit, null, 'chưa nhập biasBefore thì chưa tính được ΔSEcrit/ΔREcrit');
  assert.equal(empty.degObs, null);

  const invalid = info(glucose, level1, 'abc', 'xyz');
  assert.equal(invalid.biasBefore, null, 'biasBefore không phải số phải là null');
  assert.equal(invalid.biasAfter, null, 'biasAfter không phải số phải là null');
  assert.equal(invalid.crit, null);
}

/* --- Không có TEa (xét nghiệm lạ, không khớp catalog) --- */
{
  const r = info({ id: 'T2', name: 'Xét nghiệm không tồn tại trong catalog', unit: '' }, level1, '1.0', '0.2');
  assert.equal(r.tea, null);
  assert.equal(r.threshold, null);
  assert.equal(r.withinThreshold, null, 'không có TEa thì không kết luận đạt/vượt được, dù có bias');
  assert.equal(r.crit, null, 'không có TEa thì không tính được ΔSEcrit/ΔREcrit');
}

/* --- Không có t/l (hồ sơ chưa gắn xét nghiệm/mức) --- */
{
  const r = info(null, null, '1.0', '0.2');
  assert.equal(r.tea, null);
  assert.equal(r.crit, null);
}

/* --- actionLatestSigmaBias(): gợi ý Bias EQA gần nhất từ trang Sigma (chip chèn
   được, không auto-fill) — phải lấy đúng KỲ MỚI NHẤT và ưu tiên biasEqa hơn bias,
   đúng logic sgBiasVal() của sigma.js (không tính lại RMS ở đây). */
{
  const withSigma = { ...baseState(), sigmaData: { T1: [
    { period: '2025-Q4', lv: { 1: { biasEqa: 1.5 } } },
    { period: '2026-Q1', lv: { 1: { biasEqa: 2.3, bias: 9.9 }, 2: { bias: -0.8 } } },
  ] } };
  run(ctx, '__setState(' + JSON.stringify(withSigma) + ')');
  const r1 = JSON.parse(JSON.stringify(run(ctx, `actionLatestSigmaBias(${JSON.stringify(glucose)},1)`)));
  assert.ok(r1, 'phải tìm được Bias EQA khi có dữ liệu Sigma cho đúng mức');
  assert.equal(r1.period, '2026-Q1', 'phải lấy kỳ mới nhất (so chuỗi period)');
  assert.equal(r1.value, 2.3, 'phải ưu tiên biasEqa hơn bias, giống sgBiasVal()');

  const r2 = JSON.parse(JSON.stringify(run(ctx, `actionLatestSigmaBias(${JSON.stringify(glucose)},2)`)));
  assert.equal(r2.value, -0.8, 'mức 2 không có biasEqa thì rơi về bias, vẫn đúng số');

  const r3 = run(ctx, `actionLatestSigmaBias(${JSON.stringify(glucose)},3)`);
  assert.equal(r3, null, 'mức không có dữ liệu Sigma thì phải trả null, không phải bịa số');

  run(ctx, '__setState(' + JSON.stringify(baseState()) + ')');
  const r4 = run(ctx, `actionLatestSigmaBias(${JSON.stringify(glucose)},1)`);
  assert.equal(r4, null, 'chưa có kỳ Sigma nào thì phải trả null');
}

console.log('action-form bias info tests passed');

// Đánh giá kỹ thuật IQC theo SOP bổ sung ngày 2026-10-27: công thức chỉ
// tạo tín hiệu kỹ thuật; quyết định ảnh hưởng bệnh nhân vẫn là bước riêng.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dossier, point, run } from './helpers/nce-fixture.mjs';

const require = createRequire(import.meta.url);
const { validateNceTechnicalAssessment, nceRequiresMeanResetReview, nceTechnicalAssessmentMissing } = require('../../app-dist/main/domain/nce/technical-assessment.js');

const calculated = (over = {}) => ({
  errorNature: 'systematic', verificationMethod: 'Đối chiếu biểu đồ QC và nhật ký hiệu chuẩn',
  correctiveEvidence: 'Đã hiệu chuẩn lại và xác minh bằng tập dữ liệu độc lập',
  technicalConclusion: 'Sai số hệ thống đã được kiểm soát sau hiệu chuẩn',
  metricMode: 'calculated', metricReason: '', unit: '%', tea: 10, teaSource: 'CLIA 2024',
  stableBias: 1, incidentBias: 5, postCorrectionBias: 1, sd: 2, sdSource: '20 lần QC ổn định',
  observedDispersion: 2, sampleCount: 10,
  meanResetDecision: 'not_applicable', meanResetReason: '', meanResetEvidence: '',
  ...over,
});

test('tính đúng ΔSEcrit, ΔREcrit, SEobs và REobs', () => {
  const checked = validateNceTechnicalAssessment(calculated(), dossier());
  assert.equal(checked.ok, true, checked.message);
  assert.equal(checked.data.deltaSeCrit, 2.85);
  assert.equal(checked.data.deltaReCrit, 2.7273);
  assert.equal(checked.data.seObs, 2);
  assert.equal(checked.data.reObs, 1);
  assert.equal(checked.data.technicalSignal, 'below_threshold');
});

test('SEobs đo dịch chuyển so với Bias ổn định; Bias sau khắc phục không chặn release', () => {
  // Khắc phục chưa đưa Bias về đúng mốc cũ (sau sửa = 3, ổn định = 1): SEobs
  // vẫn đo |5 − 1| / 2 = 2, cùng mốc với ΔSEcrit.
  assert.equal(validateNceTechnicalAssessment(calculated({ postCorrectionBias: 3 }), dossier()).data.seObs, 2);
  // Lúc sự cố |Bias| + 1,65·SD = 9 + 3,3 > TEa 10 ⇔ SEobs 4 ≥ ΔSEcrit 2,85.
  assert.equal(validateNceTechnicalAssessment(calculated({ incidentBias: 9 }), dossier()).data.technicalSignal, 'exceeds_threshold');
  const noPost = validateNceTechnicalAssessment(calculated({ postCorrectionBias: null }), dossier());
  assert.equal(noPost.ok, true, noPost.message);
  assert.equal(validateNceTechnicalAssessment(calculated({ stableBias: null }), dossier()).code, 'technical-bias');
});

test('sai số hệ thống không được bỏ qua đánh giá định lượng', () => {
  const checked = validateNceTechnicalAssessment({ ...calculated(), metricMode: 'not_applicable', metricReason: 'Không có đủ dữ liệu để tính trong ca trực' }, dossier());
  assert.equal(checked.code, 'technical-systematic-metrics');
});

test('luật dịch chuyển dài bắt buộc kết luận riêng về Mean/SD', () => {
  const shiftRun = run('2026-10-01', '1', [point(1, { verdict: 'rej', rules: ['8x'] })]);
  const shifted = dossier({ runs: [{ role: 'trigger', snapshot: shiftRun }] });
  assert.equal(nceRequiresMeanResetReview(shifted), true);
  assert.equal(validateNceTechnicalAssessment(calculated(), shifted).code, 'technical-mean-reset');
  assert.equal(validateNceTechnicalAssessment(calculated({ meanResetDecision: 'eligible', meanResetReason: 'Đổi lô thuốc thử đã được thẩm định', meanResetEvidence: '20 điểm độc lập sau đổi lô, hồ sơ LT-01' }), shifted).ok, true);
  assert.equal(validateNceTechnicalAssessment(calculated({ postCorrectionBias: null, meanResetDecision: 'eligible', meanResetReason: 'Đổi lô thuốc thử đã được thẩm định', meanResetEvidence: '20 điểm độc lập sau đổi lô, hồ sơ LT-01' }), shifted).code, 'technical-mean-reset-metrics', 'xét Mean/SD mới vẫn cần Bias sau khắc phục');
  assert.equal(validateNceTechnicalAssessment(calculated({ postCorrectionBias: 3, meanResetDecision: 'eligible', meanResetReason: 'Đổi lô thuốc thử đã được thẩm định', meanResetEvidence: '20 điểm độc lập sau đổi lô, hồ sơ LT-01' }), shifted).code, 'technical-mean-reset-bias');
});

test('cổng IQC yêu cầu đánh giá gần nhất hợp lệ; nguồn khác không yêu cầu', () => {
  assert.deepEqual(nceTechnicalAssessmentMissing(dossier({ technicalAssessments: [] })).map((item) => item.code), ['technical-assessment']);
  assert.deepEqual(nceTechnicalAssessmentMissing(dossier({ source: 'instrument', technicalAssessments: [] })), []);
});

// Cổng từng bước của hồ sơ NCE mới (docs/NCE-REDESIGN-2026-10-12.md mục 5),
// phân tầng (D-06), hành động và đánh giá hiệu lực (D-02, D-08).
// Ca nghiệm thu 2, 5, 8, 11, 15.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dossier, goodRerun, point, run, triggerRun } from './helpers/nce-fixture.mjs';
const require = createRequire(import.meta.url);

const {
  validateNceCreate, validateNceReleaseInput, nceReleaseMissing, nceSubmitMissing, nceApproveMissing, nceNextStep,
} = require('../../app-dist/main/domain/nce/gates.js');
const { nceCapaTriggers, nceTierMissing, nceErrorClass, nceRiskScore } = require('../../app-dist/main/domain/nce/tier.js');
const { checkNceRerun } = require('../../app-dist/main/domain/nce/rerun.js');
const {
  validateNceActionDraft, validateNceActionCompletion, validateNceActionCancel, validateNceEffectivenessReview,
  nceEffectivenessBasis,
} = require('../../app-dist/main/domain/nce/actions.js');
const { checklistMissing, prepareChecklist, checklistKeys, checklistLabel } = require('../../app-dist/main/domain/nce/checklist.js');

const codes = (missing) => missing.map((m) => m.code);
const createInput = (over = {}) => ({
  source: 'iqc', testId: 'T1', trigger: { date: '2026-10-01', runId: '1' },
  description: 'QC mức 2 vượt +3SD', correction: 'Dừng trả kết quả', holdResults: true,
  detectedAt: '2026-10-01', ownerUserId: 'u-owner', ...over,
});

test('tạo hồ sơ IQC chỉ nhận khoá lần chạy; main tự đọc phần còn lại', () => {
  const result = validateNceCreate(createInput(), '2026-10-01');
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(result.data.trigger, { date: '2026-10-01', runId: '1' });
  assert.equal(result.data.phase, 'exam');
  assert.equal(result.data.dueDate, '', 'hạn rỗng để handler đặt theo cấu hình');
  assert.equal(validateNceCreate(createInput({ trigger: null }), '2026-10-01').code, 'missing-trigger');
  assert.equal(validateNceCreate(createInput({ holdResults: undefined }), '2026-10-01').code, 'missing-hold');
  assert.equal(validateNceCreate(createInput({ ownerUserId: '' }), '2026-10-01').code, 'missing-owner');
  assert.equal(validateNceCreate(createInput({ detectedAt: '2026-09-30' }), '2026-10-01').code, 'detected-before-run');
  assert.equal(validateNceCreate(createInput({ dueDate: '2026-02-30' }), '2026-10-01').code, 'invalid-due-date', 'ngày không có thật');
});

test('ca 15: "hôm nay" là tham số ngày địa phương, không phải ngày UTC', () => {
  // Handler truyền isoLocalDate(): 01:00 sáng 12/10 giờ Việt Nam vẫn là 12/10.
  assert.equal(validateNceCreate(createInput({ trigger: { date: '2026-10-12', runId: '1' }, detectedAt: '2026-10-12' }), '2026-10-12').ok, true);
  assert.equal(validateNceCreate(createInput({ detectedAt: '2026-10-13' }), '2026-10-12').code, 'invalid-detected');
});

test('hồ sơ nguồn khác không cần xét nghiệm hay lần chạy', () => {
  const result = validateNceCreate(createInput({ source: 'other', testId: '', trigger: undefined, phase: 'pre' }), '2026-10-01');
  assert.equal(result.ok, true, result.message);
  assert.equal(result.data.testId, null);
  assert.equal(result.data.trigger, null);
  assert.equal(result.data.phase, 'pre');
});

test('đầu vào cho chạy lại', () => {
  assert.equal(validateNceReleaseInput({ reason: 'Rerun đạt' }, 'iqc').code, 'missing-rerun');
  assert.equal(validateNceReleaseInput({ rerun: { date: '2026-10-01', runId: '2' }, reason: 'ok' }, 'iqc').code, 'missing-reason');
  assert.equal(validateNceReleaseInput({ rerun: { date: '2026-10-01', runId: '2' }, reason: 'Rerun đạt' }, 'iqc').ok, true);
  const other = validateNceReleaseInput({ notApplicable: true, reason: 'Không phải dừng dịch vụ, lỗi hồ sơ' }, 'other');
  assert.equal(other.ok, true);
  assert.equal(other.data.rerun, null);
});

test('ca 5: rerun đạt nhưng chưa có quyết định ảnh hưởng bệnh nhân thì chưa cho chạy lại', () => {
  const open = dossier({ status: 'open', release: null, patientImpacts: [], runs: [{ role: 'trigger', snapshot: triggerRun() }] });
  const rerun = checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate: goodRerun(), lotChangeNote: '' });
  assert.deepEqual(codes(nceReleaseMissing(open, rerun)), ['patient-impact']);
  assert.deepEqual(codes(nceReleaseMissing(open, null)), ['missing-rerun', 'patient-impact']);
});

test('chỉ cho chạy lại hồ sơ đang xử lý', () => {
  const rerun = checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate: goodRerun(), lotChangeNote: '' });
  for (const status of ['released', 'pending_approval', 'closed', 'cancelled']) {
    assert.deepEqual(codes(nceReleaseMissing(dossier({ status }), rerun)), ['status'], status);
  }
});

test('hồ sơ IQC chưa gắn lần chạy bị loại thì chưa cho chạy lại', () => {
  const rerun = checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate: goodRerun(), lotChangeNote: '' });
  assert.deepEqual(codes(nceReleaseMissing(dossier({ status: 'open', runs: [] }), rerun)), ['no-trigger']);
  // Nguồn khác IQC không cần lần chạy, chỉ cần quyết định ảnh hưởng bệnh nhân.
  assert.deepEqual(nceReleaseMissing(dossier({ status: 'open', source: 'instrument', runs: [], checklist: Object.fromEntries(checklistKeys('instrument').map((key) => [key, { status: 'ok', note: '' }])) }), null), []);
});

test('chưa ghi có giữ kết quả hay không thì chưa cho chạy lại', () => {
  const rerun = checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate: goodRerun(), lotChangeNote: '' });
  assert.deepEqual(codes(nceReleaseMissing(dossier({ status: 'open', holdResults: null }), rerun)), ['hold']);
});

test('hồ sơ không phải IQC có thể kèm lần chạy QC xác minh', () => {
  const withRun = validateNceReleaseInput({ reason: 'Đã hiệu chuẩn lại, QC xác minh đạt', rerun: { date: '2026-10-02', runId: '1' }, notApplicable: true }, 'calibration');
  assert.equal(withRun.ok, true);
  assert.deepEqual(withRun.data.rerun, { date: '2026-10-02', runId: '1' });
  assert.equal(withRun.data.notApplicable, false, 'đã có lần chạy xác minh thì không phải "không cần dừng dịch vụ"');
  assert.equal(validateNceReleaseInput({ reason: 'Đã hiệu chuẩn lại, QC xác minh đạt', rerun: { date: 'x' } }, 'calibration').code, 'invalid-rerun');
  const bad = checkNceRerun({ testId: 'T1', trigger: null, repeatRejects: [], candidate: run('2026-10-02', '1', [point(1)]), lotChangeNote: '', requiredLevels: [1, 2] });
  assert.deepEqual(codes(nceReleaseMissing(dossier({ status: 'open', source: 'calibration', runs: [], checklist: Object.fromEntries(checklistKeys('calibration').map((key) => [key, { status: 'ok', note: '' }])) }), bad)), ['rerun-missing-level']);
});

test('ca 8: cho chạy lại được khi hành động khắc phục chưa xong (sửa R-01)', () => {
  const open = dossier({
    status: 'open', release: null, effectivenessReviews: [],
    actions: [{ ...dossier().actions[0], status: 'open', doneAt: '', doneByUserId: '', evidence: '' }],
  });
  const rerun = checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate: goodRerun(), lotChangeNote: '' });
  assert.deepEqual(nceReleaseMissing(open, rerun), []);
});

test('ca 2: QC hỏng tiếp sau xử lý tức thời ép tầng CAPA', () => {
  const repeat = run('2026-10-01', '2', [point(1), point(2, { verdict: 'rej', rules: ['1-3s'] })]);
  const base = dossier({ tier: 'low', tierReason: 'Lỗi đơn lẻ, không tái diễn', riskLevel: 'low' });
  assert.deepEqual(nceTierMissing(base), []);
  const withRepeat = { ...base, runs: [...base.runs, { role: 'repeat_reject', snapshot: repeat }] };
  assert.deepEqual(codes(nceCapaTriggers(withRepeat)), ['repeat']);
  assert.deepEqual(codes(nceTierMissing(withRepeat)), ['tier-capa-required']);
});

test('các tiêu chí khác ép tầng CAPA; tầng low phải có lý do', () => {
  const low = dossier({ tier: 'low', tierReason: '', riskLevel: 'low' });
  assert.deepEqual(codes(nceTierMissing(low)), ['tier-reason']);
  assert.deepEqual(codes(nceCapaTriggers({ ...low, riskLevel: 'high' })), ['risk']);
  assert.deepEqual(codes(nceCapaTriggers({ ...low, source: 'eqa' })), ['eqa']);
  assert.deepEqual(codes(nceCapaTriggers({ ...low, recurrence: true })), ['recurrence']);
  assert.deepEqual(codes(nceCapaTriggers({ ...low, causeStatus: 'undetermined' })), ['cause']);
  assert.deepEqual(codes(nceCapaTriggers({ ...low, patientImpacts: [{ ...low.patientImpacts[0], outcome: 'reported_corrected' }] })), ['patient']);
  assert.deepEqual(codes(nceTierMissing({ ...low, tier: '' })), ['tier']);
});

test('nguy cơ = mức độ × khả năng, mỗi trục 1–5', () => {
  assert.equal(nceRiskScore(3, 4), 12);
  assert.equal(nceRiskScore(0, 4), 0);
  assert.equal(nceRiskScore(6, 1), 0);
  assert.equal(nceRiskScore(2.5, 2), 0);
});

test('loại sai số đọc từ luật của điểm bị loại trong lần chạy khởi đầu', () => {
  assert.equal(nceErrorClass([{ role: 'trigger', snapshot: triggerRun() }]), 'RE');
  const se = run('2026-10-01', '1', [point(1, { verdict: 'warn', rules: ['1-2s'] }), point(2, { verdict: 'rej', rules: ['2-2s', '4-1s'] })]);
  assert.equal(nceErrorClass([{ role: 'trigger', snapshot: se }]), 'SE');
  assert.equal(nceErrorClass([]), '');
});

test('N-10: rà soát nguyên nhân ngoại kiểm theo trình tự Eurachem, giữ mục cũ và thêm hoá chất/calibrator', () => {
  assert.deepEqual(checklistKeys('eqa', true), ['providerReport', 'eqaAdministrative', 'eqaMeasurement', 'operator', 'method', 'instrument', 'reagent',
    'sampleHandling', 'environment', 'eqaProgram', 'fiveWhys']);
  assert.match(checklistLabel('sampleHandling', 'eqa', true), /chạy lại mẫu lưu/);
  assert.match(checklistLabel('eqaMeasurement', 'eqa', true), /hiệu năng chung của nhóm/);
  assert.match(checklistLabel('reagent', 'eqa', true), /calibrator/);
  assert.doesNotMatch(checklistLabel('method', 'eqa', true), /nhóm so sánh/, 'nhóm so sánh thuộc lỗi hành chính và chương trình');
  assert.equal(checklistLabel('reagent', 'iqc'), 'Hoá chất (lô, hạn dùng, bảo quản)', 'checklist nội kiểm giữ nhãn cũ');
  // Hồ sơ lập trước khi đổi danh mục: mục đã đánh giá giữ nguyên, mục mới chờ đánh giá.
  const old = { operator: { status: 'ok', note: 'Đã kiểm sổ thao tác.' }, method: { status: 'abnormal', note: 'Nghi nhiễu do huyết thanh đục.' } };
  const prepared = prepareChecklist('eqa', old, true);
  assert.deepEqual([prepared.operator, prepared.method], [old.operator, old.method]);
  assert.deepEqual(prepared.reagent, { status: '', note: '' });
  assert.ok(checklistMissing('eqa', prepared, true).some((m) => m.code === 'check-reagent' && /Hoá chất và calibrator/.test(m.message)));
});

test('N-11/N-12: hồ sơ ngoại kiểm phải phân loại nguyên nhân trước khi cho hoạt động trở lại', () => {
  const checklist = Object.fromEntries(checklistKeys('eqa', true).map((key) => [key, { status: 'ok', note: 'Đã đối chiếu bằng chứng.' }]));
  const impact = { outcome: 'reported_no_impact', description: 'Rà soát kết quả từ đợt đạt gần nhất.', resultCount: 12, reference: '', notified: '' };
  const eqa = (extra) => dossier({ status: 'open', source: 'eqa', eqaLinked: true, holdResults: false, runs: [], checklist, patientImpacts: [impact], ...extra });
  assert.deepEqual(codes(nceReleaseMissing(eqa({ causeStatus: '', causeCategory: '' }), null)), ['cause-eqa-status']);
  assert.deepEqual(codes(nceReleaseMissing(eqa({ causeStatus: 'suspected', causeCategory: '' }), null)), ['cause-eqa-category']);
  assert.deepEqual(codes(nceReleaseMissing(eqa({ causeStatus: 'identified', causeCategory: 'eqa_technical' }), null)), []);
  assert.deepEqual(codes(nceReleaseMissing(eqa({ causeStatus: 'undetermined', causeCategory: '' }), null)), [], 'chưa xác định vẫn cho tiếp tục khi đã rà soát bệnh nhân');
});

test('checklist theo nguồn; bất thường/không áp dụng phải ghi chú', () => {
  assert.deepEqual(checklistKeys('other'), []);
  assert.ok(checklistKeys('eqa').includes('transcription'));
  const prepared = prepareChecklist('iqc', { qcMaterial: { status: 'abnormal', note: '' }, bogus: { status: 'ok' }, reagent: { status: 'xyz' } });
  assert.equal(prepared.bogus, undefined);
  assert.equal(prepared.reagent.status, '');
  const missing = codes(checklistMissing('iqc', prepared));
  assert.ok(missing.includes('check-note-qcMaterial'));
  assert.ok(missing.includes('check-reagent'));
});

test('hồ sơ mẫu đủ điều kiện nộp duyệt', () => {
  assert.deepEqual(nceSubmitMissing(dossier()), []);
  assert.deepEqual(codes(nceSubmitMissing(dossier({ status: 'open' }))), ['status']);
});

test('ca 11: lần đánh giá cuối không hiệu quả thì không nộp được; bổ sung và đánh giá lại thì nộp được', () => {
  const base = dossier();
  const ineffective = { ...base.effectivenessReviews[0], result: 'ineffective', reviewedAt: '2026-10-20' };
  const blocked = dossier({ effectivenessReviews: [ineffective] });
  assert.deepEqual(codes(nceSubmitMissing(blocked)), ['effectiveness-not-effective']);
  const extend = dossier({ effectivenessReviews: [{ ...ineffective, result: 'extend' }] });
  assert.deepEqual(codes(nceSubmitMissing(extend)), ['effectiveness-not-effective']);

  const extraAction = { ...base.actions[0], id: 'a2', description: 'Đào tạo lại KTV về lịch hiệu chuẩn', doneAt: '2026-10-22' };
  const reviewedAgain = dossier({ actions: [...base.actions, extraAction], effectivenessReviews: [ineffective, { ...base.effectivenessReviews[0], reviewedAt: '2026-10-28' }] });
  reviewedAgain.effectivenessReviews.at(-1).basis = nceEffectivenessBasis(reviewedAgain);
  assert.deepEqual(nceSubmitMissing(reviewedAgain), []);
  // Hành động hoàn thành SAU lần đánh giá hiệu quả → phải đánh giá lại.
  const stale = dossier({ actions: [...base.actions, { ...extraAction, doneAt: '2026-10-29' }] });
  assert.deepEqual(codes(nceSubmitMissing(stale)), ['effectiveness-stale']);
});

test('tầng CAPA đòi nguyên nhân, hành động khắc phục đã xong và tiêu chí hiệu lực', () => {
  const missing = codes(nceSubmitMissing(dossier({ causeStatus: '', actions: [], effectivenessCriteria: '', effectivenessReviews: [] })));
  for (const code of ['cause', 'corrective', 'criteria', 'effectiveness']) assert.ok(missing.includes(code), code);
  const undetermined = dossier({ causeStatus: 'undetermined', causeCategory: '', causeText: '', causeCheckPlan: '' });
  assert.deepEqual(codes(nceSubmitMissing(undetermined)), ['cause-plan']);
  const openAction = { ...dossier().actions[0], id: 'a2', status: 'open', doneAt: '' };
  assert.deepEqual(codes(nceSubmitMissing(dossier({ actions: [...dossier().actions, openAction] }))), ['actions-open']);
});

test('tầng xử lý nhanh không đòi nguyên nhân, hành động hay đánh giá hiệu lực', () => {
  const low = dossier({ tier: 'low', tierReason: 'Lỗi đơn lẻ, đã khôi phục ngay', riskLevel: 'low', causeStatus: '', actions: [], effectivenessCriteria: '', effectivenessReviews: [] });
  assert.deepEqual(nceSubmitMissing(low), []);
});

test('duyệt kiểm lại bằng chứng rerun trên dữ liệu hiện tại', () => {
  const pending = dossier({ status: 'pending_approval' });
  const okRecheck = checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate: goodRerun(), lotChangeNote: '' });
  assert.deepEqual(nceApproveMissing(pending, okRecheck), []);
  const voided = goodRerun();
  const recheck = checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate: { ...voided, points: [voided.points[0], { ...voided.points[1], voided: true }] }, lotChangeNote: '' });
  assert.deepEqual(codes(nceApproveMissing(pending, recheck)), ['recheck-rerun-missing-level']);
  assert.deepEqual(codes(nceApproveMissing(dossier(), okRecheck)), ['status']);
});

test('bước tiếp theo theo trạng thái', () => {
  assert.equal(nceNextStep(dossier({ status: 'open', release: null })).step, 'release');
  assert.equal(nceNextStep(dossier()).step, 'submit');
  assert.equal(nceNextStep(dossier({ status: 'pending_approval' })).step, 'approve');
  assert.deepEqual(nceNextStep(dossier({ status: 'closed' })), { step: null, missing: [] });
});

test('hành động: người chịu trách nhiệm, hạn, bằng chứng hoàn thành, lý do huỷ', () => {
  assert.equal(validateNceActionDraft({ kind: 'corrective', description: 'ngắn', ownerUserId: 'u', dueDate: '2026-10-05' }, '2026-10-01').code, 'missing-description');
  assert.equal(validateNceActionDraft({ kind: 'corrective', description: 'Đào tạo lại về hiệu chuẩn', ownerUserId: '', dueDate: '2026-10-05' }, '2026-10-01').code, 'missing-owner');
  assert.equal(validateNceActionDraft({ kind: 'corrective', description: 'Đào tạo lại về hiệu chuẩn', ownerUserId: 'u', dueDate: '2026-09-30' }, '2026-10-01').code, 'due-before-detected');
  assert.equal(validateNceActionDraft({ kind: 'preventive', description: 'Rà các máy cùng dòng', ownerUserId: 'u', dueDate: '2026-10-05' }, '2026-10-01').ok, true);

  const open = { status: 'open' };
  assert.equal(validateNceActionCompletion(open, { doneAt: '2026-10-05', evidence: '' }, '2026-10-01', '2026-10-06').code, 'missing-evidence');
  assert.equal(validateNceActionCompletion(open, { doneAt: '2026-10-07', evidence: 'Phiếu HC-12' }, '2026-10-01', '2026-10-06').code, 'invalid-done-order');
  assert.equal(validateNceActionCompletion(open, { doneAt: '2026-10-05', evidence: 'Phiếu HC-12' }, '2026-10-01', '2026-10-06').ok, true);
  assert.equal(validateNceActionCompletion({ status: 'done' }, { doneAt: '2026-10-05', evidence: 'Phiếu HC-12' }, '2026-10-01', '2026-10-06').code, 'action-not-open');
  assert.equal(validateNceActionCancel(open, 'trùng').code, 'missing-reason');
  assert.equal(validateNceActionCancel(open, 'Trùng với hành động a1').ok, true);
});

test('đánh giá hiệu lực: tiêu chí đặt trước, sau hành động cuối, nguy cơ còn lại không tăng', () => {
  const d = dossier();
  const review = { result: 'effective', reviewedAt: '2026-10-25', evidence: '20 lần chạy liên tiếp đạt', residualSeverity: 3, residualProbability: 1, residualLevel: 'low', residualBasis: 'SOP-QC-07' };
  assert.equal(validateNceEffectivenessReview(review, d, '2026-10-26').ok, true);
  assert.equal(validateNceEffectivenessReview(review, { ...d, effectivenessCriteria: '' }, '2026-10-26').code, 'missing-criteria');
  assert.equal(validateNceEffectivenessReview(review, { ...d, actions: [] }, '2026-10-26').code, 'no-done-action');
  assert.equal(validateNceEffectivenessReview({ ...review, reviewedAt: '2026-10-04' }, d, '2026-10-26').code, 'review-before-action');
  assert.equal(validateNceEffectivenessReview({ ...review, reviewedAt: '2026-10-27' }, d, '2026-10-26').code, 'invalid-review-date');
  assert.equal(validateNceEffectivenessReview({ ...review, residualLevel: '' }, d, '2026-10-26').code, 'missing-residual');
  assert.equal(validateNceEffectivenessReview({ ...review, residualSeverity: 4, residualProbability: 2 }, d, '2026-10-26').code, 'residual-above-initial');
  // "Không hiệu quả" không cần nguy cơ còn lại: hồ sơ chưa đóng được.
  assert.equal(validateNceEffectivenessReview({ result: 'ineffective', reviewedAt: '2026-10-25', evidence: 'Vẫn hỏng 2 lần trong tuần' }, d, '2026-10-26').ok, true);
});

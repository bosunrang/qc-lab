// Kiểm lần chạy rerun (D-04), lần chạy khởi đầu (D-14) và khoảng nghi ngờ ảnh
// hưởng bệnh nhân (D-05). Ca nghiệm thu 3, 4.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { goodRerun, point, run, triggerRun } from './helpers/nce-fixture.mjs';
const require = createRequire(import.meta.url);

const { checkNceRerun, nceTriggerMissing } = require('../../app-dist/main/domain/nce/rerun.js');
const { nceSuspectWindow, validateNcePatientImpact, ncePatientImpactMissing, ncePatientImpactCoverage, ncePatientImpactCoverageMissing } = require('../../app-dist/main/domain/nce/patient-impact.js');

const check = (candidate, extra = {}) => checkNceRerun({ testId: 'T1', trigger: triggerRun(), repeatRejects: [], candidate, lotChangeNote: '', ...extra });
const codes = (result) => result.problems.map((p) => p.code);

test('rerun đạt đủ mức, sau sự cố, cùng lô được chấp nhận', () => {
  const result = check(goodRerun());
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.deepEqual(result.lotChangedLevels, []);
});

test('rerun có cảnh báo nhưng không bị loại vẫn được chấp nhận', () => {
  const candidate = run('2026-10-02', '1', [point(1), point(2, { verdict: 'warn', rules: ['1-2s'] })]);
  assert.equal(check(candidate).ok, true);
});

test('ca 3: chính lần chạy khởi đầu không làm rerun được', () => {
  const result = check(triggerRun());
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('rerun-too-early'));
  assert.ok(codes(result).includes('rerun-is-failure'));
});

test('ca 3: rerun cùng ngày nhưng trước lần hỏng cuối bị từ chối theo mã run', () => {
  const repeat = run('2026-10-01', '3', [point(1), point(2, { verdict: 'rej', rules: ['1-3s'] })]);
  const result = check(goodRerun('2026-10-01', '2'), { repeatRejects: [repeat] });
  assert.deepEqual(codes(result), ['rerun-too-early']);
  assert.match(result.problems[0].message, /01\/10\/2026 · lần 3/);
  // Mã run so theo thứ tự tự nhiên: lần 10 đứng sau lần 3.
  assert.equal(check(goodRerun('2026-10-01', '10'), { repeatRejects: [repeat] }).ok, true);
});

test('ca 3: thiếu mức, có mức bị loại, có điểm đã huỷ hoặc mức chưa có Mean/SD đều bị từ chối', () => {
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1)]))), ['rerun-missing-level']);
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1), point(2, { verdict: 'rej', rules: ['1-3s'] })]))), ['rerun-rejected']);
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1), point(2, { voided: true })]))), ['rerun-missing-level']);
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1), point(2, { verdict: 'none' })]))), ['rerun-unassessed']);
});

test('ca 3: mức của lần khởi đầu bị huỷ sau đó vẫn phải được chạy lại', () => {
  const trigger = triggerRun();
  const voidedTrigger = { ...trigger, points: [trigger.points[0], { ...trigger.points[1], voided: true }] };
  const result = checkNceRerun({ testId: 'T1', trigger: voidedTrigger, repeatRejects: [], candidate: run('2026-10-02', '1', [point(1)]), lotChangeNote: '' });
  assert.deepEqual(codes(result), ['rerun-missing-level']);
});

test('rerun khác xét nghiệm bị từ chối', () => {
  assert.ok(codes(check(run('2026-10-02', '1', [point(1), point(2)], 'T2'))).includes('rerun-wrong-test'));
});

test('ca 4: rerun khác lô phải có giải thích', () => {
  const candidate = run('2026-10-02', '1', [point(1), point(2, { lot: 'L2-new' })]);
  const without = check(candidate);
  assert.deepEqual(codes(without), ['rerun-lot-change']);
  assert.deepEqual(without.lotChangedLevels, [2]);
  const withNote = check(candidate, { lotChangeNote: 'Lọ QC cũ hỏng, mở lô mới đã thiết lập dải' });
  assert.equal(withNote.ok, true);
  assert.deepEqual(withNote.lotChangedLevels, [2]);
});

test('hồ sơ không phải IQC: lần chạy xác minh từ ngày phát hiện, đủ mức đang vận hành', () => {
  const verify = (candidate, over = {}) => checkNceRerun({ testId: 'T1', trigger: null, repeatRejects: [], candidate, lotChangeNote: '', requiredLevels: [1, 2], notBeforeDate: '2026-10-02', ...over });
  assert.equal(verify(run('2026-10-02', '1', [point(1), point(2)])).ok, true);
  assert.deepEqual(codes(verify(run('2026-10-01', '9', [point(1), point(2)]))), ['rerun-too-early']);
  assert.deepEqual(codes(verify(run('2026-10-02', '1', [point(1)]))), ['rerun-missing-level']);
  assert.deepEqual(verify(run('2026-10-02', '1', [point(1), point(2, { lot: 'khác' })])).lotChangedLevels, [], 'không có lần khởi đầu để so lô');
  assert.deepEqual(codes(verify(run('2026-10-02', '1', [point(1)]), { requiredLevels: [] })), ['rerun-no-levels']);
});

test('D-14: lần chạy chỉ có cảnh báo không mở được NCE', () => {
  assert.deepEqual(nceTriggerMissing(triggerRun()), []);
  assert.equal(nceTriggerMissing(run('2026-10-01', '1', [point(1, { verdict: 'warn', rules: ['1-2s'] })]))[0].code, 'trigger-not-rejected');
  assert.equal(nceTriggerMissing(run('2026-10-01', '1', []))[0].code, 'trigger-empty');
});

test('khoảng nghi ngờ: từ sau lần đạt cuối trước sự cố tới trước lần rerun', () => {
  const runs = [
    { date: '2026-09-29', runId: '1', rejected: false },
    { date: '2026-09-30', runId: '1', rejected: false },
    { date: '2026-09-30', runId: '2', rejected: true },
    { date: '2026-10-01', runId: '1', rejected: true },
    { date: '2026-10-01', runId: '2', rejected: true },
    { date: '2026-10-01', runId: '3', rejected: false },
    { date: '2026-10-02', runId: '1', rejected: false },
  ];
  for (const item of runs) item.complete = true;
  const window = nceSuspectWindow(runs, { date: '2026-10-01', runId: '1' }, { date: '2026-10-01', runId: '3' });
  assert.deepEqual(window.lastAccepted, { date: '2026-09-30', runId: '1' });
  assert.deepEqual(window.runs, [
    { date: '2026-09-30', runId: '2' }, { date: '2026-10-01', runId: '1' }, { date: '2026-10-01', runId: '2' },
  ]);
  const open = nceSuspectWindow(runs, { date: '2026-10-01', runId: '1' }, null);
  assert.equal(open.runs.length, 5, 'chưa cho chạy lại thì khoảng còn mở tới lần chạy mới nhất');
  assert.equal(nceSuspectWindow([], { date: '2026-10-01', runId: '1' }, null).lastAccepted, null);
});

test('khoảng nghi ngờ lùi về lần chạy đầu tiên của chuỗi vi phạm nhiều lần chạy', () => {
  const r = (date, rejected, marks) => ({ date, runId: '1', rejected, complete: true, marks });
  const runs = [
    r('2026-09-01', false, [{ level: 1, rules: [] }, { level: 2, rules: [] }]),
    r('2026-09-02', false, [{ level: 1, rules: ['10x'] }, { level: 2, rules: [] }]),
    // Lần chạy không đo mức 1: chuỗi đếm theo mức 1 bỏ qua, không dừng.
    r('2026-09-03', false, [{ level: 2, rules: [] }]),
    r('2026-09-04', false, [{ level: 1, rules: ['1-2s', '10x'] }, { level: 2, rules: [] }]),
    r('2026-09-05', true, [{ level: 1, rules: ['10x'] }, { level: 2, rules: [] }]),
  ];
  const trigger = { date: '2026-09-05', runId: '1' };
  const chained = nceSuspectWindow(runs, trigger, null, { rules: ['10x'], levels: [1] });
  assert.deepEqual(chained.onset, { date: '2026-09-02', runId: '1' });
  assert.deepEqual(chained.onsetRules, ['10x']);
  assert.deepEqual(chained.lastAccepted, { date: '2026-09-01', runId: '1' }, 'các lần từng đạt trong chuỗi thuộc khoảng nghi ngờ');
  assert.equal(chained.runs.length, 4);
  const single = nceSuspectWindow(runs, trigger, null, { rules: ['1-3s'], levels: [1] });
  assert.deepEqual(single.lastAccepted, { date: '2026-09-04', runId: '1' }, 'luật một lần chạy giữ mốc lần đạt cuối');
  assert.deepEqual(single.onsetRules, []);
});

test('quyết định ảnh hưởng bệnh nhân phải bao phủ khoảng nghi ngờ hiện hành', () => {
  const r = (date, rejected) => ({ date, runId: '1', rejected, complete: true });
  const runs = [r('2026-09-01', false), r('2026-09-02', true), r('2026-09-03', false), r('2026-09-04', false)];
  const trigger = { date: '2026-09-02', runId: '1' };
  const open = nceSuspectWindow(runs, trigger, null);
  const coverage = ncePatientImpactCoverage(open, { date: '2026-09-03', runId: '1' });
  assert.deepEqual(coverage.through, { date: '2026-09-03', runId: '1' });
  const impact = { outcome: 'not_reported', description: 'Đã giữ kết quả', resultCount: 3, coverage };
  const codes = (missing) => missing.map((item) => item.code);
  assert.deepEqual(ncePatientImpactCoverageMissing(impact, nceSuspectWindow(runs, trigger, { date: '2026-09-03', runId: '1' })), []);
  assert.deepEqual(codes(ncePatientImpactCoverageMissing(impact, nceSuspectWindow(runs, trigger, { date: '2026-09-04', runId: '1' }))), ['patient-impact-end'], 'rerun muộn hơn phạm vi đã rà');
  const earlier = { ...open, lastAccepted: null };
  assert.deepEqual(codes(ncePatientImpactCoverageMissing(impact, earlier)), ['patient-impact-start'], 'khoảng lùi về trước');
  assert.deepEqual(codes(ncePatientImpactCoverageMissing({ ...impact, coverage: undefined }, open)), ['patient-impact-scope'], 'quyết định cũ chưa có phạm vi');
  assert.deepEqual(ncePatientImpactCoverageMissing(impact, null), [], 'không phải IQC');
});

test('quyết định ảnh hưởng bệnh nhân', () => {
  assert.equal(validateNcePatientImpact({ outcome: 'not_applicable', description: 'Không liên quan' }, 'iqc').ok, false, 'sự cố IQC luôn có thể chạm kết quả bệnh nhân');
  assert.equal(validateNcePatientImpact({ outcome: 'not_applicable', description: 'Lỗi hồ sơ đào tạo' }, 'other').ok, true);
  // N-12: ngoại kiểm chỉ được "Không liên quan" khi nguyên nhân là hành chính hoặc chương trình/mẫu.
  const na = { outcome: 'not_applicable', description: 'Lỗi chỉ ở khâu gửi kết quả ngoại kiểm' };
  assert.equal(validateNcePatientImpact(na, 'eqa', { eqaLinked: true, causeStatus: 'identified', causeCategory: 'eqa_administrative' }).ok, true);
  assert.equal(validateNcePatientImpact(na, 'eqa', { eqaLinked: true, causeStatus: 'identified', causeCategory: 'eqa_program' }).ok, true);
  assert.equal(validateNcePatientImpact(na, 'eqa', { eqaLinked: true, causeStatus: '', causeCategory: '' }).code, 'outcome-not-applicable', 'chưa phân loại nguyên nhân');
  assert.equal(validateNcePatientImpact(na, 'eqa', { eqaLinked: true, causeStatus: 'undetermined', causeCategory: '' }).code, 'outcome-not-applicable', 'chưa xác định được nguyên nhân');
  const corrected = { outcome: 'reported_corrected', description: 'Đã rà 12 kết quả', resultCount: 12 };
  assert.equal(validateNcePatientImpact(corrected, 'iqc').code, 'missing-reference');
  assert.equal(validateNcePatientImpact({ ...corrected, reference: 'PSBC-07' }, 'iqc').code, 'missing-notified');
  assert.equal(validateNcePatientImpact({ ...corrected, reference: 'PSBC-07', notified: 'BS Lan khoa Nội, 10:30 qua điện thoại' }, 'iqc').ok, true);
  assert.equal(validateNcePatientImpact({ outcome: 'not_reported', description: 'Đã giữ', resultCount: -1 }, 'iqc').code, 'invalid-count');
  assert.equal(ncePatientImpactMissing([], 'iqc')[0].code, 'patient-impact');
});

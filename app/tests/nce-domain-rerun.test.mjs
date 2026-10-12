// Kiểm lần chạy rerun (D-04), lần chạy khởi đầu (D-14) và khoảng nghi ngờ ảnh
// hưởng bệnh nhân (D-05). Ca nghiệm thu 3, 4.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { goodRerun, point, run, triggerRun } from './helpers/nce-fixture.mjs';
const require = createRequire(import.meta.url);

const { checkNceRerun, nceTriggerMissing } = require('../../app-dist/main/domain/nce/rerun.js');
const { nceSuspectWindow, validateNcePatientImpact, ncePatientImpactMissing } = require('../../app-dist/main/domain/nce/patient-impact.js');

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

test('ca 3: thiếu mức, có mức bị loại, có điểm đã hủy hoặc mức chưa có Mean/SD đều bị từ chối', () => {
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1)]))), ['rerun-missing-level']);
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1), point(2, { verdict: 'rej', rules: ['1-3s'] })]))), ['rerun-rejected']);
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1), point(2, { voided: true })]))), ['rerun-missing-level']);
  assert.deepEqual(codes(check(run('2026-10-02', '1', [point(1), point(2, { verdict: 'none' })]))), ['rerun-unassessed']);
});

test('ca 3: mức của lần khởi đầu bị hủy sau đó vẫn phải được chạy lại', () => {
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
  const window = nceSuspectWindow(runs, { date: '2026-10-01', runId: '1' }, { date: '2026-10-01', runId: '3' });
  assert.deepEqual(window.lastAccepted, { date: '2026-09-30', runId: '1' });
  assert.deepEqual(window.runs, [
    { date: '2026-09-30', runId: '2' }, { date: '2026-10-01', runId: '1' }, { date: '2026-10-01', runId: '2' },
  ]);
  const open = nceSuspectWindow(runs, { date: '2026-10-01', runId: '1' }, null);
  assert.equal(open.runs.length, 5, 'chưa cho chạy lại thì khoảng còn mở tới lần chạy mới nhất');
  assert.equal(nceSuspectWindow([], { date: '2026-10-01', runId: '1' }, null).lastAccepted, null);
});

test('quyết định ảnh hưởng bệnh nhân', () => {
  assert.equal(validateNcePatientImpact({ outcome: 'not_applicable', description: 'Không liên quan' }, 'iqc').ok, false, 'sự cố IQC luôn có thể chạm kết quả bệnh nhân');
  assert.equal(validateNcePatientImpact({ outcome: 'not_applicable', description: 'Lỗi hồ sơ đào tạo' }, 'other').ok, true);
  const corrected = { outcome: 'reported_corrected', description: 'Đã rà 12 kết quả', resultCount: 12 };
  assert.equal(validateNcePatientImpact(corrected, 'iqc').code, 'missing-reference');
  assert.equal(validateNcePatientImpact({ ...corrected, reference: 'PSBC-07' }, 'iqc').code, 'missing-notified');
  assert.equal(validateNcePatientImpact({ ...corrected, reference: 'PSBC-07', notified: 'BS Lan khoa Nội, 10:30 qua điện thoại' }, 'iqc').ok, true);
  assert.equal(validateNcePatientImpact({ outcome: 'not_reported', description: 'Đã giữ', resultCount: -1 }, 'iqc').code, 'invalid-count');
  assert.equal(ncePatientImpactMissing([], 'iqc')[0].code, 'patient-impact');
});

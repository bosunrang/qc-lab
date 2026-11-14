// Hồi quy các lỗ hổng phát hiện khi đối chiếu biểu mẫu IQC sáu bước.
// Mọi dữ liệu là giả lập trên SQLite bộ nhớ, không dùng hồ sơ người dùng.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser, must, recordTechnicalAssessment, releaseWith } from './helpers/nce-flow.mjs';
import { dossier } from './helpers/nce-fixture.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { applySchema, SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { checkNceRerun } = require('../../app-dist/main/domain/nce/rerun.js');
const { nceContentMissing } = require('../../app-dist/main/domain/nce/gates.js');
const { nceRunOutcomes } = require('../../app-dist/main/db/nce-evaluation.js');
const { nceSuspectWindow } = require('../../app-dist/main/domain/nce/patient-impact.js');
const { checklistKeys } = require('../../app-dist/main/domain/nce/checklist.js');
const { nceRerunChoices, nceHistory } = require('../../app-dist/main/domain/nce/presentation.js');
const { prepareNceDetectedAtCorrection } = require('../../app-dist/main/domain/nce/update.js');

const admin = { userId: 'a', username: 'a', name: 'Quản trị thử', role: 'admin', clientId: 'test' };
const approver = { ...admin, userId: 'b', username: 'b', name: 'Người duyệt thử' };
const trigger = { date: '2026-09-02', runId: '1' };
const rerun = { date: '2026-09-03', runId: '1' };
const ref = (view) => ({ id: view.record.id, expectedVersion: view.record.row_version });

function fixture() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), entry = createEntryHandlers(db), nce = createNceHandlers(db);
  ensureUser(db, admin); ensureUser(db, approver);
  const instrument = must(config.saveInstrument({ data: { name: 'Máy thử' } }, admin), 'máy');
  const assay = must(config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin), 'xét nghiệm');
  for (const level of [1, 2]) must(config.saveTestLevel({ testId: assay.id, data: { level, mean: 100, sd: 2 } }, admin), 'mức');
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1 }, { level: 2 }] });
  const addRun = (date, z1, z2) => {
    for (const [level, z] of [[1, z1], [2, z2]]) if (z !== null) {
      must(entry.addPoint({ data: { testId: assay.id, level, date, runId: '1', val: 100 + 2 * z } }, admin), 'điểm');
    }
  };
  addRun('2026-09-01', 0, 0); addRun(trigger.date, 3.5, 0); addRun(rerun.date, 0, 0);
  const create = (detectedAt = trigger.date) => must(nce.createNce({ data: {
    source: 'iqc', testId: assay.id, trigger, detectedAt, description: 'QC bị loại cần xử lý', correction: 'Giữ kết quả và kiểm tra vật liệu', holdResults: true, ownerUserId: admin.userId,
  } }, admin), 'tạo hồ sơ');
  const readyLow = () => {
    const released = releaseWith(nce, admin, create(), rerun);
    return must(nce.updateNce({ data: { ...ref(released), patch: {
      tier: 'low', tierReason: 'Lỗi đơn lẻ đã kiểm soát ngay', riskSeverity: 1, riskProbability: 1, riskLevel: 'low', riskBasis: 'Ma trận thử nghiệm',
      checklist: Object.fromEntries(checklistKeys('iqc').map((key) => [key, { status: 'ok', note: '' }])),
    } } }, admin), 'hoàn thiện hồ sơ');
  };
  return { db, config, entry, nce, testId: assay.id, addRun, create, readyLow };
}

test('NCE-R01: hồ sơ hồi cứu chỉ nhận QC cũ sau đính chính có lý do, giữ nguyên ngày lập và QC', () => {
  const { db, nce, create, testId } = fixture();
  const original = create('2026-10-14');
  const points = db.prepare('SELECT date,run_id,level,voided FROM qc_points WHERE test_id=?').all(testId);
  let choices = nceRerunChoices(points, [trigger], original.record.detected_at);
  assert.ok(choices.find((r) => r.date === rerun.date).exclusionReasons.some((r) => r.includes('14/10/2026')));
  const corrected = must(nce.updateNce({ data: { ...ref(original), patch: {}, detectedAtCorrection: { detectedAt: trigger.date, reason: 'Nhập nhầm ngày lập hồ sơ; đối chiếu nhật ký QC tháng 9' } } }, admin), 'đính chính');
  assert.equal(corrected.record.detected_at, trigger.date);
  assert.equal(corrected.record.created_at, original.record.created_at);
  assert.equal(corrected.record.nce_id, original.record.nce_id);
  assert.equal(corrected.record.status, 'open');
  assert.deepEqual(db.prepare('SELECT date,run_id,level,voided FROM qc_points WHERE test_id=?').all(testId), points);
  const revision = corrected.revisions.at(-1);
  assert.equal(revision.actor_user_id, admin.userId);
  assert.deepEqual(JSON.parse(revision.changes_json).detectedAt, ['2026-10-14', trigger.date]);
  assert.match(nceHistory(corrected)[0].detail, /14\/10\/2026 → 02\/09\/2026.*nhật ký QC/);
  assert.equal(must(nce.previewNceRelease({ data: { id: corrected.record.id, rerun } }), 'xem trước').ok, true);
  choices = nceRerunChoices(points, [trigger], corrected.record.detected_at);
  assert.deepEqual(choices.find((r) => r.date === rerun.date).exclusionReasons, []);
  const released = releaseWith(nce, admin, corrected, rerun);
  assert.equal(released.record.status, 'released');
});

test('NCE-R02: đính chính chặn sai quyền, sai ngày, thiếu lý do, trộn patch, lách patch và phiên bản cũ', () => {
  const { db, nce, create } = fixture();
  const view = create('2026-10-14');
  const tech = { ...admin, userId: 'tech-no-release', role: 'technician' };
  ensureUser(db, tech);
  const data = { ...ref(view), patch: {}, detectedAtCorrection: { detectedAt: trigger.date, reason: 'Đối chiếu lại nhật ký ngày phát hiện thực tế' } };
  assert.equal(nce.updateNce({ data }, tech).error.code, 'forbidden-release');
  const auditCount = db.prepare('SELECT COUNT(*) n FROM activity').get().n;
  for (const [detectedAt, reason, expected] of [
    ['2026-02-30', 'Ngày không có thật trong lịch', 'invalid-detected'],
    ['2099-01-01', 'Ngày ở tương lai không hợp lệ', 'invalid-detected'],
    ['2026-09-01', 'Ngày trước lần chạy gây sự cố', 'detected-before-run'],
    [trigger.date, 'ngắn', 'missing-date-correction-reason'],
  ]) assert.equal(nce.updateNce({ data: { ...data, detectedAtCorrection: { detectedAt, reason } } }, admin).error.code, expected);
  assert.equal(nce.updateNce({ data: { ...data, patch: { description: 'Sửa gộp không được phép' } } }, admin).error.code, 'mixed-date-correction');
  assert.equal(nce.updateNce({ data: { ...ref(view), patch: { detectedAt: trigger.date } } }, admin).error.code, 'field-not-editable');
  assert.equal(nce.getNce(view.record.id, admin).record.row_version, view.record.row_version);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activity').get().n, auditCount);
  const corrected = must(nce.updateNce({ data }, admin), 'đính chính');
  assert.equal(nce.updateNce({ data }, admin).error.code, 'stale');
  assert.equal(nce.getNce(view.record.id, admin).record.detected_at, corrected.record.detected_at);
});

test('NCE-R03: đính chính không áp dụng sau release, chờ duyệt, đóng hoặc huỷ', () => {
  for (const status of ['released', 'pending_approval', 'closed', 'cancelled']) {
    const { db, nce, create } = fixture();
    const view = create('2026-10-14');
    db.prepare('UPDATE nce_records SET status=? WHERE id=?').run(status, view.record.id);
    const result = nce.updateNce({ data: { ...ref(view), patch: {}, detectedAtCorrection: { detectedAt: trigger.date, reason: 'Đối chiếu nhật ký để đính chính' } } }, admin);
    assert.equal(result.error.code, 'status', status);
    assert.equal(nce.getNce(view.record.id, admin).record.detected_at, '2026-10-14');
  }
});

test('NCE-R04: lỗi ghi lịch sử huỷ toàn bộ đính chính, không tăng phiên bản hay ghi audit', () => {
  const { db, nce, create } = fixture();
  const view = create('2026-10-14');
  const before = db.prepare('SELECT COUNT(*) n FROM activity').get().n;
  db.exec("CREATE TRIGGER fail_date_revision BEFORE INSERT ON nce_revisions BEGIN SELECT RAISE(ABORT, 'test-date-revision'); END");
  assert.throws(() => nce.updateNce({ data: { ...ref(view), patch: {}, detectedAtCorrection: { detectedAt: trigger.date, reason: 'Đối chiếu nhật ký để đính chính' } } }, admin), /test-date-revision/);
  const after = nce.getNce(view.record.id, admin);
  assert.equal(after.record.detected_at, view.record.detected_at);
  assert.equal(after.record.row_version, view.record.row_version);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activity').get().n, before);
});

test('NCE-R05: rerun đạt và ảnh hưởng đã ghi nhưng checklist chưa đủ vẫn chặn release tại main', () => {
  const { nce, create } = fixture();
  let view = create();
  view = must(nce.updateNce({ data: { ...ref(view), patch: {
    containmentNote: 'Đã giữ kết quả trong khoảng nghi ngờ và báo phụ trách ca',
    occurredNote: '08:00 phát hiện, 08:15 dừng trả kết quả, 09:00 xử lý xong',
  } } }, admin), 'ghi kiểm soát ban đầu');
  view = recordTechnicalAssessment(nce, admin, view);
  view = must(nce.recordNcePatientImpact({ data: { ...ref(view), impact: { outcome: 'not_reported', description: 'Đã giữ toàn bộ kết quả', resultCount: 12 } } }, admin), 'ảnh hưởng');
  const release = () => nce.releaseNce({ data: { ...ref(view), release: { rerun, reason: 'QC xác minh sau xử lý đạt' } } }, admin);
  assert.equal(release().error.code, 'gate');
  assert.match(release().error.message, /checklist/);
  const checklist = Object.fromEntries(checklistKeys('iqc').map((key) => [key, { status: 'ok', note: '' }]));
  checklist.qcMaterial = { status: 'abnormal', note: '' };
  view = must(nce.updateNce({ data: { ...ref(view), patch: { checklist } } }, admin), 'checklist thiếu bằng chứng');
  assert.match(release().error.message, /bằng chứng\/lý do/);
  checklist.qcMaterial.note = 'Phát hiện lọ hết hạn; thay lọ mới theo nhật ký';
  view = must(nce.updateNce({ data: { ...ref(view), patch: { checklist } } }, admin), 'checklist đủ');
  assert.equal(must(release(), 'release sau checklist').record.status, 'released');
});

test('NCE-R06: ngày đính chính không vượt ngày lập, hạn và ngày hoàn thành liên quan', () => {
  const input = { detectedAt: '2026-10-06', reason: 'Đính chính theo nhật ký tiếp nhận sự cố' };
  const value = dossier({ status: 'open', release: null });
  assert.equal(prepareNceDetectedAtCorrection(input, value, '2026-10-05T10:00:00Z', '2026-10-15').code, 'invalid-detected');
  assert.equal(prepareNceDetectedAtCorrection(input, value, '2026-10-14T10:00:00Z', '2026-10-15').code, 'detected-after-related-date');
  value.actions = []; value.dueDate = '2026-10-04';
  assert.equal(prepareNceDetectedAtCorrection(input, value, '2026-10-14T10:00:00Z', '2026-10-15').code, 'detected-after-related-date');
  value.dueDate = '2026-10-31';
  assert.equal(prepareNceDetectedAtCorrection(input, value, '2026-10-14T10:00:00Z', '2026-10-15').ok, true);
});

test('NCE-H01: rerun sau lần hỏng nhưng trước ngày phát hiện vẫn bị chặn ở main', () => {
  const { nce, create } = fixture();
  const view = create('2026-10-14');
  const preview = must(nce.previewNceRelease({ data: { id: view.record.id, rerun } }), 'xem trước');
  assert.equal(preview.ok, false);
  assert.ok(preview.problems.some((p) => p.code === 'rerun-too-early'));
});

test('NCE-H02: lần hỏng mới chưa gắn hồ sơ vẫn chặn mốc khôi phục cũ', () => {
  const { nce, create, addRun } = fixture();
  const view = create();
  addRun('2026-09-04', 3.5, 0);
  const preview = must(nce.previewNceRelease({ data: { id: view.record.id, rerun } }), 'xem trước');
  assert.equal(preview.ok, false);
  assert.ok(preview.problems.some((p) => p.code === 'rerun-too-early'));
});

test('NCE-H03: lần chạy thiếu mức không được làm mốc QC đạt cuối cùng', () => {
  const { db, testId } = fixture();
  db.prepare("DELETE FROM qc_points WHERE test_id=? AND date='2026-09-01' AND level=2").run(testId);
  const outcomes = nceRunOutcomes(db, testId);
  assert.equal(outcomes.find((r) => r.date === '2026-09-01').complete, false);
  assert.equal(nceSuspectWindow(outcomes, trigger, null).lastAccepted, null);
});

test('NCE-H04: kỳ khoá tại hoặc sau rerun chặn ghi mốc cắt, không ghi dở', () => {
  for (const month of ['2026-09', '2026-10']) {
    const { db, nce, create, addRun } = fixture();
    if (month === '2026-10') addRun('2026-10-01', 0, 0);
    let view = create();
    view = must(nce.updateNce({ data: { ...ref(view), patch: {
      checklist: Object.fromEntries(checklistKeys('iqc').map((key) => [key, { status: 'ok', note: '' }])),
      containmentNote: 'Đã giữ kết quả trong khoảng nghi ngờ và báo phụ trách ca',
      occurredNote: '08:00 phát hiện, 08:15 dừng trả kết quả, 09:00 xử lý xong',
    } } }, admin), 'kiểm tra nhanh');
    view = recordTechnicalAssessment(nce, admin, view);
    view = must(nce.recordNcePatientImpact({ data: { ...ref(view), impact: { outcome: 'not_reported', description: 'Đã giữ toàn bộ kết quả', resultCount: 12 } } }, admin), 'ảnh hưởng');
    db.prepare('INSERT INTO period_locks(id,ym) VALUES (?,?)').run(month, month);
    const auditBefore = db.prepare('SELECT COUNT(*) n FROM activity').get().n;
    const result = nce.releaseNce({ data: { ...ref(view), release: { rerun, reason: 'QC xác minh sau xử lý đạt' } } }, admin);
    assert.equal(result.error.code, 'period-locked');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM nce_cuts').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM activity').get().n, auditBefore);
    assert.equal(nce.getNce(view.record.id, admin).record.row_version, view.record.row_version);
  }
});

test('NCE-H05: thay lô sau release không làm mất bằng chứng rerun hay hàng chờ', () => {
  const { db, nce, readyLow, testId } = fixture();
  let view = readyLow();
  db.prepare('UPDATE test_levels SET qc_lot_id=NULL WHERE test_id=?').run(testId);
  assert.ok(nce.listNceQueue().some((row) => row.record?.id === view.record.id));
  view = must(nce.submitNce({ data: ref(view) }, admin), 'nộp');
  view = must(nce.approveNce({ data: ref(view) }, approver), 'duyệt với lô đã đổi');
  assert.equal(view.record.status, 'closed');
});

test('NCE-H06: điểm rerun của lô cũ bị huỷ vẫn chặn duyệt', () => {
  const { db, nce, readyLow, testId } = fixture();
  let view = readyLow();
  db.prepare('UPDATE test_levels SET qc_lot_id=NULL WHERE test_id=?').run(testId);
  db.prepare('UPDATE qc_points SET voided=1 WHERE test_id=? AND date=? AND level=2').run(testId, rerun.date);
  view = must(nce.submitNce({ data: ref(view) }, admin), 'nộp');
  const result = nce.approveNce({ data: ref(view) }, approver);
  assert.equal(result.error.code, 'gate');
  assert.match(result.error.message, /thiếu mức M2/);
});

test('NCE-H07: sửa tiêu chí, nguyên nhân, nguy cơ hoặc hành động làm bằng chứng hiệu lực hết hiện hành', () => {
  for (const key of ['effectivenessCriteria', 'causeText', 'riskBasis']) {
    const value = dossier();
    value[key] = 'Nội dung thay đổi sau đánh giá hiệu lực';
    assert.ok(nceContentMissing(value).some((p) => p.code === 'effectiveness-basis-changed'), key);
  }
  const value = dossier();
  value.actions[0].description = 'Hành động đã thay đổi sau đánh giá';
  assert.ok(nceContentMissing(value).some((p) => p.code === 'effectiveness-basis-changed'));
  value.riskSeverity = 1; value.riskProbability = 1;
  assert.ok(nceContentMissing(value).some((p) => p.code === 'residual-above-initial'));
});

test('NCE-H08: hồ sơ cũ chưa có snapshot hiệu lực không được tự gắn căn cứ mới', () => {
  const value = dossier();
  delete value.effectivenessReviews[0].basis;
  assert.ok(nceContentMissing(value).some((p) => p.code === 'effectiveness-basis-changed'));
});

test('NCE-H09: lưu phạm vi và diễn biến có lịch sử, migration schema 3 không mất dữ liệu', () => {
  const { db, nce, create } = fixture();
  let view = create();
  view = must(nce.updateNce({ data: { ...ref(view), patch: { containmentNote: 'Máy A, ca sáng; báo phụ trách lúc 08:15', occurredNote: '08:00 phát hiện, 08:30 hoàn tất xử lý' } } }, admin), 'ghi mốc');
  assert.match(view.record.containment_note, /08:15/);
  assert.ok(view.revisions.some((r) => JSON.parse(r.changes_json).occurredNote));
  db.exec('ALTER TABLE nce_records DROP COLUMN containment_note');
  db.exec('ALTER TABLE nce_records DROP COLUMN occurred_note');
  db.prepare("UPDATE app_meta SET value='3' WHERE key='schemaVersion'").run();
  applySchema(db); applySchema(db);
  const stored = nce.getNce(view.record.id, admin);
  assert.equal(stored.record.description, view.record.description);
  assert.equal(stored.record.containment_note, '');
  assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get().value, String(SCHEMA_VERSION));
});

test('NCE-H10: cảnh báo mức vận hành thiếu không bị trình bày như đã đủ mức theo SOP', () => {
  const { db, nce, create } = fixture();
  db.prepare('DELETE FROM qc_points WHERE date IN (?,?) AND level=2').run(trigger.date, rerun.date);
  const view = create();
  const preview = must(nce.previewNceRelease({ data: { id: view.record.id, rerun } }), 'xem trước');
  assert.equal(preview.ok, true, 'giữ chính sách hiện hành trong khi chưa có SOP thay thế');
  assert.ok(preview.warnings.some((w) => w.code === 'rerun-operational-levels'));
  assert.equal(checkNceRerun({ testId: 'T1', trigger: null, repeatRejects: [], candidate: { testId: 'T1', ...rerun, points: [] }, lotChangeNote: '', requiredLevels: [1, 2] }).ok, false);
});

test('NCE-H11: quyết định ảnh hưởng ghi trước lần rerun muộn hơn thì chặn release', () => {
  const { nce, create, addRun } = fixture();
  let view = create();
  view = must(nce.updateNce({ data: { ...ref(view), patch: {
    checklist: Object.fromEntries(checklistKeys('iqc').map((key) => [key, { status: 'ok', note: '' }])),
    containmentNote: 'Đã giữ kết quả trong khoảng nghi ngờ và báo phụ trách ca',
    occurredNote: '08:00 phát hiện, 08:15 dừng trả kết quả, 09:00 xử lý xong',
  } } }, admin), 'kiểm tra nhanh');
  view = recordTechnicalAssessment(nce, admin, view);
  const impact = { outcome: 'not_reported', description: 'Đã giữ toàn bộ kết quả', resultCount: 12 };
  view = must(nce.recordNcePatientImpact({ data: { ...ref(view), impact } }, admin), 'ảnh hưởng tới lần 09-03');
  addRun('2026-09-04', 0, 0);
  const later = { date: '2026-09-04', runId: '1' };
  const preview = must(nce.previewNceRelease({ data: { id: view.record.id, rerun: later } }), 'xem trước');
  assert.equal(preview.ok, true, 'QC của lần chạy vẫn đạt');
  assert.deepEqual(preview.impact_problems.map((p) => p.code), ['patient-impact-end']);
  const release = () => nce.releaseNce({ data: { ...ref(view), release: { rerun: later, reason: 'QC xác minh sau xử lý đạt' } } }, admin);
  assert.match(release().error.message, /chưa tới lần rerun/);
  view = must(nce.recordNcePatientImpact({ data: { ...ref(view), impact } }, admin), 'ghi lại tới lần 09-04');
  assert.equal(must(release(), 'cho chạy lại').record.status, 'released');
});

test('NCE-H12: luật 6x kéo khoảng nghi ngờ về đầu chuỗi, không dừng ở lần đạt ngay trước', () => {
  const { nce, addRun, testId } = fixture();
  // Mức 1 lệch dương sáu lần liên tiếp; mức 2 lệch âm để không thành chuỗi gộp mức.
  for (const date of ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15']) addRun(date, 0.5, -0.5);
  const shift = { date: '2026-09-15', runId: '1' };
  const view = must(nce.createNce({ data: {
    source: 'iqc', testId, trigger: shift, detectedAt: shift.date, description: 'Luật 6x loại lần chạy', correction: 'Giữ kết quả và kiểm tra hiệu chuẩn', holdResults: true, ownerUserId: admin.userId,
  } }, admin), 'tạo hồ sơ 6x');
  assert.deepEqual(view.suspect_window.onset, { date: '2026-09-10', runId: '1' });
  assert.deepEqual(view.suspect_window.onset_rules, ['6x']);
  assert.deepEqual(view.suspect_window.last_accepted, { date: '2026-09-03', runId: '1' }, 'năm lần chạy từng đạt trong chuỗi cũng phải rà soát');
  assert.equal(view.suspect_window.runs.length, 6);
});

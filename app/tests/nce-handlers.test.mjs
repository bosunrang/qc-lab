// Handler NCE protocol 4 trên SQLite thật (docs/NCE-REDESIGN-2026-10-12.md).
// Ca nghiệm thu cần CSDL: 1, 2, 3, 5, 8, 9, 10, 11, 12, 13, 14, 15, 19.
// Logic thuần của từng cổng có test riêng ở `nce-domain-*.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser, must, recordTechnicalAssessment } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { nceResolvedPointIds } = require('../../app-dist/main/db/nce-repository.js');
const { isoLocalDate } = require('../../app-dist/main/domain/local-date.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };
const owner = { userId: 'u-owner', username: 'owner', name: 'Người phụ trách', role: 'technician', clientId: 't' };
const tech = { userId: 'u-tech', username: 'tech', name: 'KTV làm hành động', role: 'technician', clientId: 't' };
const releaser = { userId: 'u-rel', username: 'rel', name: 'Trưởng ca', role: 'technician', clientId: 't' };
const reviewer = { userId: 'u-rev', username: 'rev', name: 'Người đánh giá hiệu lực', role: 'technician', clientId: 't' };
const approver = { userId: 'u-app', username: 'app', name: 'Quản lý chất lượng', role: 'technician', clientId: 't' };
const viewer = { userId: 'u-view', username: 'view', name: 'Người xem', role: 'viewer', clientId: 't' };

const CHECKLIST_OK = Object.fromEntries(['qcMaterial', 'reagent', 'calibration', 'instrument', 'environment', 'operator', 'lotChange'].map((key) => [key, { status: 'ok', note: '' }]));

/** Glucose hai mức, Mean 100 SD 2. Các lần chạy:
 * A 09-01 lần 1: đạt · B 09-02 lần 1: R4s loại cả hai mức · W 09-02 lần 2:
 * chỉ cảnh báo 1-2s · C 09-02 lần 3: 1-3s loại mức 1 · D 09-03 lần 1: đạt. */
function fixture() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), entry = createEntryHandlers(db), nce = createNceHandlers(db);
  ensureUser(db, admin); ensureUser(db, owner); ensureUser(db, tech); ensureUser(db, viewer);
  ensureUser(db, releaser, ['nce.release']); ensureUser(db, reviewer); ensureUser(db, approver, ['nce.approve']);
  const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin).data;
  for (const level of [1, 2]) config.saveTestLevel({ testId: assay.id, data: { level, mean: 100, sd: 2 } }, admin);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1 }, { level: 2 }] });
  const ids = {};
  const run = (date, runId, z1, z2) => {
    for (const [level, z] of [[1, z1], [2, z2]]) {
      const added = must(entry.addPoint({ data: { testId: assay.id, level, date, runId, val: 100 + z * 2 } }, admin), `điểm ${date}/${runId}/M${level}`);
      ids[`${runId}:${level}`] = added.id;
    }
  };
  run('2026-09-01', '2026-09-01-1', 0, 0);
  run('2026-09-02', '2026-09-02-1', 2.5, -2.5);
  run('2026-09-02', '2026-09-02-2', -2.2, 0);
  run('2026-09-02', '2026-09-02-3', 3.5, 0);
  run('2026-09-03', '2026-09-03-1', 0, 0);
  return { db, entry, nce, testId: assay.id, ids };
}

const B = { date: '2026-09-02', runId: '2026-09-02-1' };
const W = { date: '2026-09-02', runId: '2026-09-02-2' };
const C = { date: '2026-09-02', runId: '2026-09-02-3' };
const D = { date: '2026-09-03', runId: '2026-09-03-1' };
const ref = (dossier) => ({ id: dossier.record.id, expectedVersion: dossier.record.row_version });

function createFromB(nce, testId) {
  const created = must(nce.createNce({ data: {
    source: 'iqc', testId, trigger: B, description: 'R4s loại cả hai mức', correction: 'Dừng trả kết quả, kiểm tra máy',
    holdResults: true, detectedAt: '2026-09-02', ownerUserId: owner.userId,
  } }, admin), 'tạo hồ sơ');
  const checked = must(nce.updateNce({ data: { ...ref(created), patch: {
    checklist: CHECKLIST_OK,
    containmentNote: 'Đã giữ kết quả trong khoảng nghi ngờ và báo phụ trách ca',
    occurredNote: '08:00 phát hiện, 08:15 dừng trả kết quả, 09:00 xử lý xong',
  } } }, admin), 'kiểm tra nhanh');
  return recordTechnicalAssessment(nce, admin, checked);
}

test('ca 1, 20: hàng chờ một dòng cho một lần chạy hỏng hai mức, bỏ cảnh báo; gợi ý gắn lần hỏng sau', () => {
  const { nce, testId } = fixture();
  const queue = nce.listNceQueue();
  assert.deepEqual(queue.map((row) => row.run_id), ['2026-09-02-3', '2026-09-02-1'], 'chỉ hai lần chạy bị loại, mới nhất trước; W chỉ cảnh báo');
  assert.deepEqual(queue[1].rejected_levels.map((l) => l.level), [1, 2]);
  const created = createFromB(nce, testId);
  const after = nce.listNceQueue();
  assert.deepEqual(after.find((row) => row.run_id === B.runId).record, { id: created.record.id, nce_id: created.record.nce_id });
  assert.deepEqual(after.find((row) => row.run_id === C.runId).attach_to, { id: created.record.id, nce_id: created.record.nce_id });
});

test('tạo hồ sơ: main tự chụp lần chạy, loại sai số; chặn cảnh báo và lần chạy đã có hồ sơ; ca 15 mã theo ngày địa phương', () => {
  const { nce, testId } = fixture();
  const created = createFromB(nce, testId);
  assert.equal(created.record.status, 'open');
  assert.equal(created.record.error_class, 'RE', 'R4s là sai số ngẫu nhiên');
  assert.ok(created.record.nce_id.startsWith(`NCE-${isoLocalDate().replace(/-/g, '')}-`));
  const snapshot = JSON.parse(created.runs[0].snapshot_json);
  assert.deepEqual(snapshot.points.map((p) => [p.level, p.verdict]), [[1, 'rej'], [2, 'rej']]);
  const base = { source: 'iqc', testId, description: 'Thử lập hồ sơ', correction: 'Kiểm tra lại', holdResults: true, detectedAt: '2026-09-02', ownerUserId: owner.userId };
  assert.equal(nce.createNce({ data: { ...base, trigger: W } }, admin).error.code, 'trigger-not-rejected');
  assert.equal(nce.createNce({ data: { ...base, trigger: B } }, admin).error.code, 'run-has-record');
  assert.equal(nce.createNce({ data: { ...base, trigger: C, ownerUserId: viewer.userId } }, admin).error.code, 'invalid-owner', 'người chỉ xem không làm người phụ trách');
  assert.equal(nce.createNce({ data: { ...base, trigger: C } }, viewer).error.code, 'forbidden');
});

test('ca 2: gắn lần chạy bị loại tiếp theo ép tầng CAPA; không gắn cảnh báo hay lần chạy trước', () => {
  const { nce, testId } = fixture();
  let dossier = createFromB(nce, testId);
  assert.equal(nce.attachNceRun({ data: { ...ref(dossier), run: W } }, admin).error.code, 'trigger-not-rejected');
  assert.equal(nce.attachNceRun({ data: { ...ref(dossier), run: { date: '2026-09-01', runId: '2026-09-01-1' } } }, admin).error.code, 'run-before-trigger');
  dossier = must(nce.attachNceRun({ data: { ...ref(dossier), run: C } }, admin), 'gắn C');
  assert.deepEqual(dossier.runs.map((r) => r.role).sort(), ['repeat_reject', 'trigger']);
  assert.deepEqual(dossier.capa_triggers.map((t) => t.code), ['repeat']);
  dossier = must(nce.updateNce({ data: { ...ref(dossier), patch: { tier: 'low', tierReason: 'Lỗi đơn lẻ đã khắc phục' } } }, admin), 'chọn tầng');
  assert.ok(dossier.missing.length, 'chưa cho chạy lại nên còn thiếu');
});

test('ca 13, 14: khoá lạc quan và lịch sử sửa đổi', () => {
  const { nce, testId } = fixture();
  const created = createFromB(nce, testId);
  const updated = must(nce.updateNce({ data: { ...ref(created), patch: { riskSeverity: 3, riskLevel: 'medium' } } }, admin), 'sửa');
  assert.equal(updated.record.row_version, created.record.row_version + 1);
  // Phiên thứ hai còn giữ phiên bản cũ: bị từ chối, không ghi đè.
  const stale = nce.updateNce({ data: { ...ref(created), patch: { riskSeverity: 1 } } }, admin);
  assert.equal(stale.error.code, 'stale');
  assert.equal(nce.getNce(created.record.id, admin).record.risk_severity, 3);
  assert.deepEqual(JSON.parse(updated.revisions.at(-1).changes_json), { riskSeverity: [0, 3], riskLevel: ['', 'medium'] });
  assert.equal(updated.revisions.at(-1).actor_name, admin.name);
  // Lưu lại đúng giá trị cũ: không tăng phiên bản, không thêm lịch sử.
  const same = must(nce.updateNce({ data: { ...ref(updated), patch: { riskSeverity: 3 } } }, admin), 'không đổi');
  assert.equal(same.record.row_version, updated.record.row_version);
  assert.equal(same.revisions.length, updated.revisions.length);
  assert.equal(nce.updateNce({ data: { ...ref(updated), patch: { source: 'eqa' } } }, admin).error.code, 'field-not-editable');
});

test('ca 3, 5, 8, 9: cho chạy lại cần quyền, quyết định ảnh hưởng bệnh nhân và lần rerun hợp lệ; không cần CAPA xong', () => {
  const { db, nce, testId } = fixture();
  let dossier = must(nce.attachNceRun({ data: { ...ref(createFromB(nce, testId)), run: C } }, admin), 'gắn C');
  const release = (actor, rerun) => nce.releaseNce({ data: { ...ref(dossier), release: { reason: 'QC chạy lại đạt', rerun } } }, actor);
  assert.equal(release(tech, D).error.code, 'forbidden-release', 'KTV chưa được cấp nce.release');
  assert.match(release(releaser, D).error.message, /ảnh hưởng kết quả bệnh nhân/);
  const impact = { outcome: 'not_reported', description: 'Đã giữ toàn bộ kết quả từ lần đạt trước', resultCount: 12 };
  assert.equal(nce.recordNcePatientImpact({ data: { ...ref(dossier), impact } }, owner).error.code, 'forbidden-patient-impact', 'quyết định lâm sàng cần thẩm quyền nce.release');
  dossier = must(nce.recordNcePatientImpact({ data: { ...ref(dossier), impact } }, releaser), 'ảnh hưởng');
  // Main chụp phạm vi đã rà soát: sau lần đạt A tới lần QC mới nhất lúc ghi (D).
  assert.deepEqual(JSON.parse(dossier.decisions.at(-1).payload_json).coverage, {
    lastAccepted: { date: '2026-09-01', runId: '2026-09-01-1' }, onset: B, through: D, runCount: 4,
  });
  assert.match(release(releaser, B).error.message, /không dùng điểm QC gây sự cố/i);
  assert.match(release(releaser, W).error.message, /sau lần chạy bị loại gần nhất/, 'cùng ngày nhưng trước lần hỏng cuối');
  const preview = must(nce.previewNceRelease({ data: { id: dossier.record.id, rerun: D } }), 'xem trước');
  assert.equal(preview.ok, true);
  dossier = must(release(releaser, D), 'cho chạy lại');
  assert.equal(dossier.record.status, 'released');
  assert.deepEqual(db.prepare('SELECT date, run_id FROM nce_cuts WHERE nce_record_id=?').all(dossier.record.id).map((r) => ({ ...r })), [{ date: D.date, run_id: D.runId }]);
  assert.equal(dossier.runs.find((r) => r.role === 'rerun').run_id, D.runId);
  assert.equal(dossier.can.cancel, false);
  // Khoảng nghi ngờ: từ sau lần đạt A tới trước lần rerun D.
  assert.deepEqual(dossier.suspect_window.last_accepted, { date: '2026-09-01', runId: '2026-09-01-1' });
  assert.deepEqual(dossier.suspect_window.runs.map((r) => r.runId), [B.runId, W.runId, C.runId]);
});

test('ca 10, 11, 19: nộp duyệt, phân tách nhiệm vụ, đóng hồ sơ và Sigma coi điểm đã xử lý', () => {
  const { db, nce, testId, ids } = fixture();
  let dossier = must(nce.attachNceRun({ data: { ...ref(createFromB(nce, testId)), run: C } }, admin), 'gắn C');
  dossier = must(nce.recordNcePatientImpact({ data: { ...ref(dossier), impact: { outcome: 'not_reported', description: 'Đã giữ kết quả', resultCount: 12 } } }, releaser), 'ảnh hưởng');
  dossier = must(nce.releaseNce({ data: { ...ref(dossier), release: { reason: 'QC chạy lại đạt', rerun: D } } }, releaser), 'cho chạy lại');
  assert.match(nce.submitNce({ data: ref(dossier) }, owner).error.message, /chưa đủ điều kiện nộp duyệt/);
  assert.equal(nce.submitNce({ data: ref(dossier) }, tech).error.code, 'forbidden-submit');

  dossier = must(nce.updateNce({ data: { ...ref(dossier), patch: {
    tier: 'capa', riskSeverity: 3, riskProbability: 2, riskLevel: 'medium', riskBasis: 'SOP-QC-07 bảng 3', checklist: CHECKLIST_OK,
    causeStatus: 'identified', causeCategory: 'calibration', causeText: 'Hiệu chuẩn quá hạn làm lệch kết quả',
    effectivenessCriteria: 'Không có lần chạy bị loại trong 20 lần chạy tiếp theo',
  } } }, owner), 'điền hồ sơ');
  dossier = must(nce.addNceAction({ data: { ...ref(dossier), action: { kind: 'corrective', description: 'Đưa lịch hiệu chuẩn vào nhắc việc', ownerUserId: tech.userId, dueDate: '2026-09-20' } } }, owner), 'thêm hành động');
  const actionId = dossier.actions[0].id;
  assert.equal(nce.completeNceAction({ data: { ...ref(dossier), actionId, doneAt: '2026-09-05', evidence: '' } }, tech).error.code, 'missing-evidence');
  dossier = must(nce.completeNceAction({ data: { ...ref(dossier), actionId, doneAt: '2026-09-05', evidence: 'Phiếu HC-12' } }, tech), 'hoàn thành');
  const review = { result: 'effective', reviewedAt: '2026-09-25', evidence: '20 lần chạy liên tiếp đạt', residualSeverity: 3, residualProbability: 1, residualLevel: 'low', residualBasis: 'SOP-QC-07' };
  dossier = must(nce.reviewNceEffectiveness({ data: { ...ref(dossier), review } }, reviewer), 'hiệu lực');
  assert.deepEqual(nceResolvedPointIds(db, testId), [], 'chưa đóng thì chưa xử lý xong');
  dossier = must(nce.submitNce({ data: ref(dossier) }, owner), 'nộp duyệt');
  assert.equal(dossier.record.status, 'pending_approval');
  assert.equal(nce.updateNce({ data: { ...ref(dossier), patch: { riskSeverity: 2 } } }, owner).error.code, 'status', 'chờ duyệt thì khoá sửa');

  // Mọi người đã tham gia đều không được duyệt, kể cả quản trị viên (người báo
  // cáo) — cấp quyền duyệt cho họ để chắc chặn ở bước độc lập, không phải bước quyền.
  db.prepare(`UPDATE users SET capabilities_json='["nce.approve"]' WHERE id IN (?,?,?)`).run(owner.userId, tech.userId, reviewer.userId);
  for (const actor of [admin, owner, tech, reviewer]) assert.equal(nce.approveNce({ data: ref(dossier) }, actor).error.code, 'not-independent', actor.userId);
  assert.equal(nce.approveNce({ data: ref(dossier) }, releaser).error.code, 'forbidden-approve', 'người cho chạy lại chưa có quyền duyệt');
  assert.match(nce.getNce(dossier.record.id, admin).approve_block, /người báo cáo/);
  assert.equal(nce.getNce(dossier.record.id, approver).can.approve, true);
  dossier = must(nce.approveNce({ data: { ...ref(dossier), note: 'Đủ bằng chứng' } }, approver), 'duyệt');
  assert.equal(dossier.record.status, 'closed');
  assert.equal(dossier.record.qc_resolved, 1);
  assert.deepEqual(nceResolvedPointIds(db, testId).sort(), [ids['2026-09-02-1:1'], ids['2026-09-02-1:2'], ids['2026-09-02-3:1'], ids['2026-09-02-3:2']].sort());
  assert.deepEqual(nce.listNceQueue().map((r) => r.run_id), [], 'lần chạy của hồ sơ đã đóng rời hàng chờ');
});

test('duyệt kiểm lại bằng chứng rerun: điểm rerun bị hủy sau khi cho chạy lại thì chặn', () => {
  const { nce, entry, testId, ids } = fixture();
  let dossier = createFromB(nce, testId);
  dossier = must(nce.updateNce({ data: { ...ref(dossier), patch: {
    tier: 'low', tierReason: 'Lỗi đơn lẻ, khôi phục ngay sau hiệu chuẩn', riskSeverity: 2, riskProbability: 1, riskLevel: 'low', riskBasis: 'SOP-QC-07', checklist: CHECKLIST_OK,
  } } }, owner), 'điền hồ sơ');
  dossier = must(nce.recordNcePatientImpact({ data: { ...ref(dossier), impact: { outcome: 'not_reported', description: 'Đã giữ kết quả', resultCount: 12 } } }, releaser), 'ảnh hưởng');
  dossier = must(nce.releaseNce({ data: { ...ref(dossier), release: { reason: 'QC chạy lại đạt', rerun: D } } }, releaser), 'cho chạy lại');
  dossier = must(nce.submitNce({ data: ref(dossier) }, owner), 'nộp duyệt');
  must(entry.voidPoint({ data: { pointId: ids['2026-09-03-1:2'], kind: 'data-entry', reason: 'Nhập nhầm' } }, admin), 'hủy điểm rerun');
  assert.match(nce.approveNce({ data: ref(dossier) }, approver).error.message, /Bằng chứng rerun không còn hợp lệ/);
});

test('ca 12: chỉ hủy hồ sơ chưa cho chạy lại, có lý do; trả lại về bước đã cho chạy lại', () => {
  const { nce, testId } = fixture();
  const open = createFromB(nce, testId);
  assert.equal(nce.cancelNce({ data: { ...ref(open), reason: 'trùng' } }, owner).error.code, 'missing-reason');
  assert.equal(nce.cancelNce({ data: { ...ref(open), reason: 'Hồ sơ lập trùng với NCE khác' } }, tech).error.code, 'forbidden-cancel');
  const cancelled = must(nce.cancelNce({ data: { ...ref(open), reason: 'Hồ sơ lập trùng với NCE khác' } }, owner), 'hủy');
  assert.equal(cancelled.record.status, 'cancelled');
  assert.equal(JSON.parse(cancelled.decisions.at(-1).payload_json).reason, 'Hồ sơ lập trùng với NCE khác');
  assert.ok(nce.listNce().some((r) => r.id === open.record.id), 'hồ sơ hủy vẫn tìm thấy');
  // Lần chạy B được giải phóng: lập hồ sơ mới cho nó được.
  let again = createFromB(nce, testId);
  again = must(nce.recordNcePatientImpact({ data: { ...ref(again), impact: { outcome: 'not_reported', description: 'Đã giữ kết quả', resultCount: 12 } } }, releaser), 'ảnh hưởng');
  // W đứng trước lần hỏng C nên không còn là bằng chứng khôi phục hiện hành.
  again = must(nce.releaseNce({ data: { ...ref(again), release: { reason: 'QC chạy lại đạt', rerun: D } } }, releaser), 'cho chạy lại bằng D sau lần hỏng cuối');
  assert.equal(nce.cancelNce({ data: { ...ref(again), reason: 'Muốn hủy sau khi đã cho chạy lại' } }, owner).error.code, 'status');
});

test('cấu hình NCE và phân quyền NCE chỉ quản trị viên', () => {
  const { db, nce } = fixture();
  const auth = createAuthHandlers(db);
  assert.equal(nce.saveNceConfig({ data: { dueDays: { low: 5, capa: 20 } } }, owner).error.code, 'forbidden');
  assert.equal(nce.saveNceConfig({ data: { separationException: { enabled: true, sopRef: '' } } }, admin).error.code, 'missing-sop');
  assert.deepEqual(must(nce.saveNceConfig({ data: { dueDays: { low: 5, capa: 20 }, recurrenceWindowDays: 60 } }, admin), 'lưu cấu hình').dueDays, { low: 5, capa: 20 });
  assert.equal(nce.getNceConfig().recurrenceWindowDays, 60);
  assert.equal(auth.setNceCapabilities({ id: viewer.userId, capabilities: ['nce.approve'] }, admin).error.code, 'viewer-capabilities');
  assert.equal(auth.setNceCapabilities({ id: tech.userId, capabilities: ['nce.godmode'] }, admin).error.code, 'invalid-capabilities');
  assert.equal(auth.setNceCapabilities({ id: tech.userId, capabilities: ['nce.release'] }, owner).error.code, 'forbidden');
  assert.deepEqual(must(auth.setNceCapabilities({ id: tech.userId, capabilities: ['nce.release'] }, admin), 'cấp quyền').capabilities, ['nce.release']);
  assert.deepEqual(nce.listNceUsers().find((u) => u.id === tech.userId).capabilities, ['nce.release']);
  assert.equal(nce.listNceUsers().some((u) => u.id === viewer.userId), false, 'người chỉ xem không vào danh sách người phụ trách');
});

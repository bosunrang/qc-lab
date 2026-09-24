import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const nce = createNceHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

const tooShort = nce.create({ data: { testId: test.id, date: '2026-08-01', correction: 'ngan' } }, actor);
assert.equal(tooShort.ok, false);
assert.equal(tooShort.error.code, 'missing-correction');

const created = nce.create({ data: { testId: test.id, level: 1, lot: 'L1', date: '2026-08-01', rule: '1-3s', errorType: 'RE', correction: 'Giu ket qua, kiem tra lai may va lam lai QC', dueDate: '2026-08-10' } }, actor);
assert.equal(created.ok, true);
assert.equal(created.data.approval_status, 'pending');
const todayPrefix = 'NCE-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
assert.ok(created.data.nce_id.startsWith(todayPrefix), `nce_id=${created.data.nce_id} phai bat dau bang ${todayPrefix}`);

const tooEarly = nce.markEffectiveness({ data: { id: created.data.id, status: 'effective' } }, actor);
assert.equal(tooEarly.ok, false);
assert.equal(tooEarly.error.code, 'missing-completed-date');

const completed = nce.setActionCompletedDate({ data: { id: created.data.id, actionCompletedDate: '2026-08-05' } }, actor);
assert.equal(completed.ok, true);

// 4.1) Protocol-v3 có thể lưu dần khi điều tra, nhưng phải đủ checklist,
// FMEA, hành động và tác động bệnh nhân mới được khép vòng/duyệt.
const protocolSaved = nce.saveProtocol({ data: { id: created.data.id, dueDate: '2026-08-10', protocol: {
  eventSource: 'iqc', processPhase: 'exam', owner: 'KTV A', containmentStatus: 'none', correction: 'Giu ket qua, kiem tra lai may va lam lai QC',
  riskSeverity: 2, riskOccurrence: 2, riskDetectability: 2, riskLevel: 'low', riskBasis: 'SOP-QC-07',
  qcMaterialStatus: 'ok', instrumentStatus: 'ok', reagentStatus: 'ok', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
  causeCategory: 'instrument', cause: 'Canh bao he thong khi may bat dau lech', action: 'Bao tri may va xac nhan lai hieu chuan',
  patientImpact: 'none', effectivenessStatus: 'pending',
  residualSeverity: 1, residualOccurrence: 1, residualDetectability: 1, residualRiskLevel: 'low', residualRiskBasis: 'Theo doi sau bao tri',
} } }, actor);
assert.equal(protocolSaved.ok, true);

const noResidualRisk = nce.markEffectiveness({ data: { id: created.data.id, status: 'effective', note: 'Khong tai dien sau 2 tuan' } }, actor);
assert.equal(noResidualRisk.ok, false);
assert.equal(noResidualRisk.error.code, 'missing-residual-risk');

const effective = nce.markEffectiveness({
  data: { id: created.data.id, status: 'effective', residualRisk: 'Rui ro con lai thap, da kiem soat', note: 'Khong tai dien sau 2 tuan' },
}, actor);
assert.equal(effective.ok, true);
assert.equal(effective.data.effectiveness_status, 'effective');

// 6) Người lập không được tự duyệt; người duyệt độc lập mới được phê duyệt.
const selfApproved = nce.approve({ data: { id: created.data.id } }, actor);
assert.equal(selfApproved.ok, false);
assert.equal(selfApproved.error.code, 'self-approval');
const reviewer = { ...actor, userId: 'u2', username: 'reviewer', name: 'Nguoi duyet' };
const approved = nce.approve({ data: { id: created.data.id } }, reviewer);
assert.equal(approved.ok, true, approved.ok ? '' : approved.error.message);
assert.equal(approved.data.approval_status, 'approved');

const cancelApproved = nce.cancel({ data: { id: created.data.id, note: 'Muon huy nham' } }, actor);
assert.equal(cancelApproved.ok, false);
assert.equal(cancelApproved.error.code, 'already-approved');

const second = nce.create({ data: { testId: test.id, date: '2026-08-02', correction: 'Giu ket qua cho toi khi kiem tra xong may' } }, actor);
const returnShort = nce.returnForRevision({ data: { id: second.data.id, note: 'x' } }, actor);
assert.equal(returnShort.ok, false);
assert.equal(returnShort.error.code, 'missing-note');
const returned = nce.returnForRevision({ data: { id: second.data.id, note: 'Thieu can cu SOP, bo sung lai' } }, actor);
assert.equal(returned.ok, true);
assert.equal(returned.data.approval_status, 'returned');

const cancelled = nce.cancel({ data: { id: second.data.id, note: 'Nhap trung ho so voi cai khac' } }, actor);
assert.equal(cancelled.ok, true);
assert.equal(cancelled.data.record_status, 'cancelled');
const cancelAgain = nce.cancel({ data: { id: second.data.id, note: 'Huy lan nua' } }, actor);
assert.equal(cancelAgain.ok, false);
assert.equal(cancelAgain.error.code, 'already-cancelled');

assert.equal(nce.listRecords().length, 2);

const releaseNoNote = nce.setReleaseDecision({ data: { id: created.data.id, decision: 'held', note: '' } }, actor);
assert.equal(releaseNoNote.ok, false);
assert.equal(releaseNoNote.error.code, 'missing-note');
const released = nce.setReleaseDecision({ data: { id: created.data.id, decision: 'released', note: 'Da co ket qua rerun xac nhan dat' } }, actor);
assert.equal(released.ok, true);
const releaseDetail = JSON.parse(released.data.detail_json);
assert.equal(releaseDetail.releaseDecision, 'released');

const rerunMissing = nce.setRerunEvidence({ data: { id: created.data.id, rerunPointId: 'khong-ton-tai' } }, actor);
assert.equal(rerunMissing.ok, false);
assert.equal(rerunMissing.error.code, 'point-not-found');

const otherTest = config.saveTest({ data: { name: 'Ure', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
makeOperationalQc(db, { testId: otherTest.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
const pointOtherTest = entry.addPoint({ data: { testId: otherTest.id, level: 1, date: '2026-08-06', val: 5 } }, actor).data;
const rerunWrongTest = nce.setRerunEvidence({ data: { id: created.data.id, rerunPointId: pointOtherTest.id } }, actor);
assert.equal(rerunWrongTest.ok, false);
assert.equal(rerunWrongTest.error.code, 'point-wrong-test', 'ho so gan xet nghiem Glucose khong duoc nhan bang chung tu xet nghiem Ure');

const pointSameTest = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-06', val: 5 } }, actor).data;
const rerunOk = nce.setRerunEvidence({ data: { id: created.data.id, rerunPointId: pointSameTest.id, note: 'Da lam lai, ket qua binh thuong' } }, actor);
assert.equal(rerunOk.ok, true);
assert.equal(JSON.parse(rerunOk.data.detail_json).rerunPointId, pointSameTest.id);

const reopenNotIneffective = nce.reopenNce({ data: { id: created.data.id, note: 'thu mo lai' } }, actor);
assert.equal(reopenNotIneffective.ok, false);
assert.equal(reopenNotIneffective.error.code, 'not-ineffective', 'ho so dang "effective" (buoc 5) khong duoc mo vong tiep theo');

const thirdCreated = nce.create({ data: { testId: test.id, level: 1, date: '2026-08-03', correction: 'Giu ket qua cho toi khi kiem tra xong may moc' } }, actor);
nce.setActionCompletedDate({ data: { id: thirdCreated.data.id, actionCompletedDate: '2026-08-04' } }, actor);
const ineffective = nce.markEffectiveness({ data: { id: thirdCreated.data.id, status: 'ineffective' } }, actor);
assert.equal(ineffective.ok, true, 'ket luan "khong hieu qua" KHONG can du lieu rui ro con lai (chi bat buoc cho "hieu qua")');
const reopened = nce.reopenNce({ data: { id: thirdCreated.data.id, note: 'Van con tai dien, mo vong 2' } }, actor);
assert.equal(reopened.ok, true);
assert.equal(reopened.data.parent_nce_id, thirdCreated.data.nce_id);
const parentAfterReopen = nce.listRecords().find(r => r.id === thirdCreated.data.id);
assert.equal(parentAfterReopen.follow_up_nce_id, reopened.data.id, 'ho so goc phai duoc gan lai follow_up_nce_id');

const reopenAgain = nce.reopenNce({ data: { id: thirdCreated.data.id } }, actor);
assert.equal(reopenAgain.ok, false);
assert.equal(reopenAgain.error.code, 'already-reopened');

console.log('app nce-handlers end-to-end tests passed');



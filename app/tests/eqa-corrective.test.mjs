import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { applySchema, SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { checklistKeys } = require('../../app-dist/main/domain/nce/checklist.js');
const { eqaNceSourceKey } = require('../../app-dist/main/domain/eqa/source-key.js');
const { dumpAllTables, restoreAllTables } = require('../../app-dist/main/db/table-io.js');
const admin = { userId: 'admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const viewer = { ...admin, userId: 'viewer', role: 'viewer' };
const must = r => { assert.equal(r.ok, true, JSON.stringify(r)); return r.data; };
const ref = d => ({ id: d.record.id, expectedVersion: d.record.row_version });
function setup(z = 3.5) {
  const db = openDatabase(':memory:'); ensureUser(db, admin); ensureUser(db, viewer);
  const c = createConfigHandlers(db), eqa = createEqaHandlers(db), nce = createNceHandlers(db), entry = createEntryHandlers(db);
  const machine = must(c.saveInstrument({ data: { name: 'Máy A' } }, admin));
  const assay = must(c.saveTest({ data: { name: 'Glucose', instrumentId: machine.id } }, admin));
  const input = { round: { program: 'VEQAS', provider: 'Trung tâm', programCode: 'BC', unitCode: '100', year: 2026, round: 'ĐỢT 01', reportDate: '2026-09-01' },
    rows: [{ code: 'GLUC', instrument: 'Máy A', sample: 'M1', unit: 'mmol/L', result: 5 + z, assigned: 5, sigmaP: 1, zProvider: z, peer: {} }],
    source: 'pdf', mappings: [{ code: 'GLUC', instrument: 'Máy A', testId: assay.id }] };
  const imported = must(eqa.importEqaRound({ data: input }, admin));
  const scope = { programId: imported.round.program_id, year: 2026 };
  const result = imported.results[0];
  const create = (extra = {}, actor = admin) => nce.createNce({ data: { source: 'eqa', eqaResultId: result.id,
    expectedEqaFingerprint: eqa.getEqaCorrectiveEvidence({ resultId: extra.eqaResultId || result.id }).fingerprint,
    eqaRunDate: '2026-09-01', description: 'Kết quả ngoại kiểm không đáp ứng tiêu chí.', correction: 'Đã đối chiếu báo cáo và dữ liệu gốc.', holdResults: false,
    detectedAt: '2026-09-01', ownerUserId: admin.userId, ...extra } }, actor);
  return { db, c, eqa, nce, entry, machine, assay, input, imported, scope, result, create };
}

test('khắc phục EQA: bắt buộc và cảnh báo đơn lẻ, lọc đúng máy/đợt; không tự lập hồ sơ', () => {
  const f = setup();
  try {
    let rows = f.eqa.listEqaCorrective(f.scope);
    assert.equal(rows.length, 1); assert.equal(rows[0].required, true); assert.equal(rows[0].record, null);
    const b = must(f.c.saveInstrument({ data: { name: 'Máy B' } }, admin));
    const assay = must(f.c.saveTest({ data: { name: 'Glucose', instrumentId: b.id } }, admin));
    must(f.eqa.importEqaRound({ data: { ...f.input, rows: [{ ...f.input.rows[0], instrument: b.name, result: 7.5, zProvider: 2.5 }], mappings: [{ code: 'GLUC', instrument: b.name, testId: assay.id }] } }, admin));
    rows = f.eqa.listEqaCorrective({ ...f.scope, instrumentId: b.id });
    assert.equal(rows.length, 1); assert.equal(rows[0].required, false); assert.match(rows[0].reasons[0], /Cảnh báo đơn lẻ/);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM nce_records').get().n, 0);
    assert.equal(f.eqa.listEqaCorrective({ ...f.scope, roundId: 'missing' }).length, 0);
    assert.throws(() => f.eqa.listEqaCorrective({ ...f.scope, instrumentId: 123 }), /không hợp lệ/);
  } finally { f.db.close(); }
});

test('lập hồ sơ EQA: quyền trước dữ liệu, chụp đúng nguồn, không tin testId client và chống tạo trùng', () => {
  const f = setup();
  try {
    assert.equal(f.nce.createNce({}, viewer).error.code, 'forbidden');
    assert.equal(f.create({ expectedEqaFingerprint: 'old' }).error.code, 'eqa-stale');
    assert.equal(f.create({ eqaRunDate: '' }).error.code, 'eqa-run-date');
    const d = must(f.create({ testId: 'forged' }));
    assert.equal(d.record.test_id, f.assay.id); assert.equal(d.record.eqa_result_id, f.result.id); assert.equal(d.record.tier, 'capa');
    assert.equal(JSON.parse(d.record.eqa_snapshot_json).result.result, 8.5);
    assert.equal(d.record.eqa_source_key.length, 64);
    assert.equal(Object.keys(JSON.parse(d.record.checklist_json)).length, 11);
    assert.equal(f.create().error.code, 'eqa-has-record');
    const row = f.eqa.listEqaCorrective(f.scope)[0];
    assert.equal(row.record.id, d.record.id);
    assert.equal(Object.hasOwn(row.record, 'cause_text'), false, 'danh sách EQA không lộ hồ sơ NCE chi tiết');
    assert.equal(Object.hasOwn(row.record, 'eqa_snapshot_json'), false);
  } finally { f.db.close(); }
});

test('nhập lại EQA: giữ snapshot và hồ sơ cũ; kết quả đổi được điều tra riêng, kết quả giống không bị tạo trùng', () => {
  const f = setup();
  try {
    const d = must(f.create());
    must(f.eqa.importEqaRound({ data: { ...f.input, replaceReason: 'Nhà cung cấp phát hành lại báo cáo.' } }, admin));
    let rows = f.eqa.listEqaCorrective(f.scope);
    assert.equal(rows.length, 1); assert.equal(rows[0].record.id, d.record.id); assert.equal(rows[0].current, true);
    const current = f.eqa.getEqaRound(f.imported.round.id).results[0];
    const ev = f.eqa.getEqaCorrectiveEvidence({ resultId: current.id });
    assert.equal(f.create({ eqaResultId: current.id, expectedEqaFingerprint: ev.fingerprint }).error.code, 'eqa-has-record');
    must(f.eqa.importEqaRound({ data: { ...f.input, replaceReason: 'Sửa giá trị kết quả trên báo cáo.', rows: [{ ...f.input.rows[0], result: 9, zProvider: 4 }] } }, admin));
    rows = f.eqa.listEqaCorrective(f.scope);
    assert.equal(rows.length, 2); assert(rows.some(r => !r.current && r.record.id === d.record.id)); assert(rows.some(r => r.current && !r.record));
    assert.equal(JSON.parse(f.nce.getNce(d.record.id, admin).record.eqa_snapshot_json).result.result, 8.5);
    assert.throws(() => f.eqa.getEqaCorrectiveEvidence({ resultId: f.result.id }), /thay thế/);
  } finally { f.db.close(); }
});

test('lập hồ sơ EQA giữ đầy đủ căn cứ, nhóm so sánh, đợt đạt và nội kiểm đúng ngày khi đọc lại', () => {
  const f = setup(0);
  try {
    const otherMachine = must(f.c.saveInstrument({ data: { name: 'Máy B' } }, admin));
    const otherAssay = must(f.c.saveTest({ data: { name: 'Sodium', instrumentId: otherMachine.id } }, admin));
    const peer = { all: { n: 120, mean: 5.1, sd: 1, cv: 19.6078 },
      method: { n: 90, mean: 5.05, sd: 0.9, cv: 17.8218 }, instrument: { n: 80, mean: 5, sd: 0.8, cv: 16 } };
    const input = { ...f.input, sourceName: 'VEQAS-DOT02.pdf',
      round: { ...f.input.round, round: 'ĐỢT 02', reportDate: '2026-09-10', reportCode: 'BC-2026-02', assignedLevel: 'instrument' },
      rows: [{ ...f.input.rows[0], result: 8.5, zProvider: 3.5, method: 'Hexokinase', peerGroup: 'Nhóm Máy A', peer },
        { ...f.input.rows[0], sample: 'M2', result: 5, zProvider: 0 },
        { ...f.input.rows[0], code: 'NA', instrument: otherMachine.name, result: 7.5, zProvider: 2.5 },
        { ...f.input.rows[0], code: 'NA', instrument: otherMachine.name, sample: 'M9', result: 5, zProvider: 0 }],
      mappings: [...f.input.mappings, { code: 'NA', instrument: otherMachine.name, testId: otherAssay.id }] };
    const imported = must(f.eqa.importEqaRound({ data: input }, admin));
    for (const level of [1, 2]) must(f.c.saveTestLevel({ testId: f.assay.id, data: { level, mean: 100 * level, sd: 2 } }, admin));
    makeOperationalQc(f.db, { testId: f.assay.id, instrumentId: f.machine.id, assignments: [{ level: 1, lotNo: 'QC-L1' }, { level: 2, lotNo: 'QC-L2' }] });
    for (const [date, runId, level, val] of [['2026-09-01', 'WRONG-DAY', 1, 100], ['2026-09-02', 'A', 1, 100],
      ['2026-09-02', 'A', 2, 207], ['2026-09-02', 'B', 1, 101]]) {
      must(f.entry.addPoint({ data: { testId: f.assay.id, level, date, runId, val } }, admin));
    }
    const result = imported.results.find(r => r.test_id === f.assay.id && r.sample === 'M1');
    const before = f.eqa.getEqaCorrectiveEvidence({ resultId: result.id, runDate: '2026-09-02' });
    assert.equal(before.related_results.length, 2, 'giữ kết quả cùng máy hoặc cùng mẫu, loại kết quả không liên quan');
    assert.equal(before.result.peer.length, 3);
    assert.equal(before.result.method, 'Hexokinase');
    assert.equal(before.result.peer_group, 'Nhóm Máy A');
    assert.equal(before.last_accepted.round_id, f.imported.round.id);
    assert.equal(before.iqc_runs.length, 2);
    assert(before.iqc_runs.every(r => r.date === '2026-09-02'));
    assert(before.iqc_runs.some(r => r.run_id === 'A' && r.complete && r.points.some(p => p.lot === 'QC-L2' && p.value === 207 && p.verdict === 'rej' && p.rules.length)));
    assert(before.iqc_runs.some(r => r.run_id === 'B' && !r.complete));
    const dossier = must(f.create({ eqaResultId: result.id, expectedEqaFingerprint: before.fingerprint, eqaRunDate: before.run_date, detectedAt: '2026-09-10' }));
    const saved = JSON.parse(dossier.record.eqa_snapshot_json);
    const withoutCaptureTime = ({ captured_at, ...rest }) => rest;
    assert.deepEqual(withoutCaptureTime(saved), withoutCaptureTime(before), 'đối chiếu toàn bộ căn cứ, không chỉ vài trường kết quả');
    assert(Number.isFinite(Date.parse(saved.captured_at)));
    assert.equal(saved.round.report_code, 'BC-2026-02');
    assert.equal(saved.round.report_date, '2026-09-10');
    assert.equal(saved.run_date, '2026-09-02', 'ngày chạy thực tế khác ngày báo cáo');
    assert.deepEqual(JSON.parse(f.nce.getNce(dossier.record.id, admin).record.eqa_snapshot_json), saved);
    must(f.eqa.importEqaRound({ data: { ...input, replaceReason: 'Sửa báo cáo để kiểm tra tính bất biến của căn cứ.',
      rows: input.rows.map((r, i) => i ? r : { ...r, result: 9, zProvider: 4 }) } }, admin));
    assert.deepEqual(JSON.parse(f.nce.getNce(dossier.record.id, admin).record.eqa_snapshot_json), saved, 'báo cáo thay đổi không ghi đè căn cứ hồ sơ');
  } finally { f.db.close(); }
});

test('hiệu lực EQA phải có đợt chạy sau hành động và nội kiểm đủ mức; dữ liệu đổi phải đánh giá lại', () => {
  const f = setup();
  try {
    let d = must(f.create());
    const checklist = Object.fromEntries(checklistKeys('eqa', true).map(k => [k, { status: 'ok', note: 'Đã đối chiếu nhật ký và bằng chứng.' }]));
    d = must(f.nce.updateNce({ data: { ...ref(d), patch: { checklist, riskSeverity: 1, riskProbability: 1, riskLevel: 'low', riskBasis: 'Theo ma trận SOP của đơn vị.',
      causeStatus: 'identified', causeCategory: 'eqa_administrative', causeText: 'Đã xác định lỗi trong khâu gửi kết quả.', effectivenessCriteria: 'Đợt ngoại kiểm tiếp theo chấp nhận và nội kiểm cùng ngày đạt.' } } }, admin));
    d = must(f.nce.recordNcePatientImpact({ data: { ...ref(d), impact: { outcome: 'not_applicable', description: 'Lỗi chỉ trong khâu gửi kết quả ngoại kiểm.', resultCount: null } } }, admin));
    d = must(f.nce.releaseNce({ data: { ...ref(d), release: { notApplicable: true, reason: 'Lỗi hành chính chỉ ở khâu gửi ngoại kiểm.' } } }, admin));
    d = must(f.nce.addNceAction({ data: { ...ref(d), action: { kind: 'corrective', description: 'Đối chiếu hai người trước khi gửi kết quả.', ownerUserId: admin.userId, dueDate: '2026-09-02' } } }, admin));
    d = must(f.nce.completeNceAction({ data: { ...ref(d), actionId: d.actions[0].id, doneAt: '2026-09-02', evidence: 'Đã triển khai quy trình đối chiếu hai người.' } }, admin));
    const review = { result: 'effective', reviewedAt: '2026-09-03', evidence: 'Đối chiếu đủ ngoại kiểm và nội kiểm sau khắc phục.', residualSeverity: 1, residualProbability: 1, residualLevel: 'low', residualBasis: 'Nguy cơ còn lại thấp theo SOP.' };
    assert.equal(f.nce.reviewNceEffectiveness({ data: { ...ref(d), review } }, admin).error.code, 'effectiveness-eqa');
    must(f.eqa.importEqaRound({ data: { ...f.input, round: { ...f.input.round, round: 'ĐỢT 02', reportDate: '2026-09-02' }, rows: [{ ...f.input.rows[0], result: 5, zProvider: 0 }] } }, admin));
    must(f.eqa.saveEqaSchedule({ data: { programId: f.scope.programId, year: 2026, round: 'ĐỢT 02', runDate: '2026-09-02', dueDate: '2026-09-04', instrumentIds: [f.machine.id] } }, admin));
    assert.match(f.nce.reviewNceEffectiveness({ data: { ...ref(d), review } }, admin).error.message, /sau ngày hoàn thành/);
    must(f.eqa.importEqaRound({ data: { ...f.input, round: { ...f.input.round, round: 'ĐỢT 03', reportDate: '2026-09-03' }, rows: [{ ...f.input.rows[0], result: 5, zProvider: 0 }] } }, admin));
    must(f.eqa.saveEqaSchedule({ data: { programId: f.scope.programId, year: 2026, round: 'ĐỢT 03', runDate: '2026-09-03', dueDate: '2026-09-04', instrumentIds: [f.machine.id] } }, admin));
    assert.equal(f.nce.reviewNceEffectiveness({ data: { ...ref(d), review } }, admin).error.code, 'effectiveness-eqa');
    must(f.c.saveTestLevel({ testId: f.assay.id, data: { level: 1, mean: 100, sd: 2 } }, admin));
    makeOperationalQc(f.db, { testId: f.assay.id, instrumentId: f.machine.id, assignments: [{ level: 1 }] });
    must(f.entry.addPoint({ data: { testId: f.assay.id, level: 1, date: '2026-09-03', runId: 'A', val: 100 } }, admin));
    d = must(f.nce.reviewNceEffectiveness({ data: { ...ref(d), review } }, admin));
    assert(d.decisions.filter(x => x.type === 'effectiveness').at(-1).payload_json.includes('eqa_basis'));
    assert.equal(JSON.parse(d.decisions.filter(x => x.type === 'effectiveness').at(-1).payload_json).eqa_evidence.round.round, 'ĐỢT 03');
    // Bổ sung máy khác vào đợt kế tiếp sinh lại mã dòng và tăng phiên bản đợt,
    // nhưng không đổi bằng chứng hiệu lực của xét nghiệm này (N-13).
    const basis = f.nce.getNce(d.record.id, admin).eqa_followup.fingerprint;
    const other = must(f.c.saveInstrument({ data: { name: 'Máy B' } }, admin));
    const otherTest = must(f.c.saveTest({ data: { name: 'Glucose', instrumentId: other.id } }, admin));
    must(f.eqa.importEqaRound({ data: { ...f.input, round: { ...f.input.round, round: 'ĐỢT 03', reportDate: '2026-09-03' },
      rows: [{ ...f.input.rows[0], instrument: 'Máy B', result: 5, zProvider: 0 }], mappings: [{ code: 'GLUC', instrument: 'Máy B', testId: otherTest.id }] } }, admin));
    assert.equal(f.nce.getNce(d.record.id, admin).eqa_followup.fingerprint, basis);
    must(f.entry.addPoint({ data: { testId: f.assay.id, level: 1, date: '2026-09-03', runId: 'B', val: 110 } }, admin));
    const failed = f.nce.submitNce({ data: ref(d) }, admin);
    assert.equal(failed.ok, false); assert.match(failed.error.message, /nội kiểm|Nội kiểm|đánh giá lại/);
  } finally { f.db.close(); }
});

test('EQA kỹ thuật phải rà soát bệnh nhân; đổi nguyên nhân phải kiểm lại quyết định trước khi cho chạy lại', () => {
  const f = setup();
  try {
    let d = must(f.create());
    const checklist = Object.fromEntries(checklistKeys('eqa', true).map(k => [k, { status: 'ok', note: 'Đã đối chiếu nhật ký và bằng chứng.' }]));
    d = must(f.nce.updateNce({ data: { ...ref(d), patch: { checklist, causeStatus: 'identified', causeCategory: 'eqa_administrative', causeText: 'Đã xác định lỗi trong khâu gửi kết quả.' } } }, admin));
    const impact = { outcome: 'not_applicable', description: 'Lỗi chỉ trong khâu gửi kết quả ngoại kiểm.', resultCount: null };
    d = must(f.nce.recordNcePatientImpact({ data: { ...ref(d), impact } }, admin));
    d = must(f.nce.updateNce({ data: { ...ref(d), patch: { causeCategory: 'eqa_technical', causeText: 'Đối chiếu phát hiện lỗi trong quá trình phân tích.' } } }, admin));
    const release = { notApplicable: true, reason: 'Đã rà soát và đối chiếu trước khi tiếp tục hoạt động.' };
    assert.match(f.nce.releaseNce({ data: { ...ref(d), release } }, admin).error.message, /Lỗi kỹ thuật/);
    assert.equal(f.nce.recordNcePatientImpact({ data: { ...ref(d), impact } }, admin).error.code, 'outcome-not-applicable');
    assert.equal(f.nce.recordNcePatientImpact({ data: { ...ref(d), impact: { ...impact, outcome: 'not_reported' } } }, admin).error.code, 'missing-count');
    d = must(f.nce.recordNcePatientImpact({ data: { ...ref(d), impact: { ...impact, outcome: 'not_reported', resultCount: 0 } } }, admin));
    d = must(f.nce.releaseNce({ data: { ...ref(d), release } }, admin));
    assert.equal(d.record.status, 'released');
  } finally { f.db.close(); }
});

test('schema 15 nâng từ 14 giữ hồ sơ cũ và tạo cột liên kết đúng mặc định', () => {
  const db = openDatabase(':memory:');
  try {
    db.exec("DROP INDEX idx_nce_eqa_source; ALTER TABLE nce_records DROP COLUMN eqa_result_id; ALTER TABLE nce_records DROP COLUMN eqa_source_key; ALTER TABLE nce_records DROP COLUMN eqa_snapshot_json;");
    db.prepare("INSERT INTO nce_records(id,nce_id,source,description) VALUES ('old','NCE-OLD','other','Hồ sơ cũ cần giữ nguyên')").run();
    db.prepare("UPDATE app_meta SET value='14' WHERE key='schemaVersion'").run();
    applySchema(db);
    assert.ok(SCHEMA_VERSION >= 15);
    const old = db.prepare("SELECT * FROM nce_records WHERE id='old'").get();
    assert.equal(old.nce_id, 'NCE-OLD'); assert.equal(old.eqa_result_id, null); assert.equal(old.eqa_snapshot_json, '');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { db.close(); }
});

test('sao lưu/khôi phục giữ khoá ngoại và ảnh chụp của hồ sơ EQA', () => {
  const f = setup(), target = openDatabase(':memory:');
  try {
    const d = must(f.create());
    restoreAllTables(target, dumpAllTables(f.db));
    const saved = createNceHandlers(target).getNce(d.record.id, admin);
    assert.equal(saved.record.eqa_result_id, f.result.id);
    assert.equal(saved.record.eqa_snapshot_json, d.record.eqa_snapshot_json);
    assert.equal(target.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { target.close(); f.db.close(); }
});

test('S4: lịch cũ chưa khai máy vẫn cho ngày chạy của mọi máy trong đợt', () => {
  const f = setup();
  try {
    must(f.eqa.saveEqaSchedule({ data: { programId: f.scope.programId, year: 2026, round: 'ĐỢT 01', runDate: '2026-08-28', dueDate: '2026-09-05' } }, admin));
    assert.equal(f.eqa.getEqaCorrectiveEvidence({ resultId: f.result.id }).run_date, '2026-08-28');
  } finally { f.db.close(); }
});

test('S5: nhập bù đợt cũ làm đổi tín hiệu chuỗi không tách hồ sơ NCE đã lập', () => {
  const f = setup(3.5);
  try {
    const d = must(f.create());
    const keyBefore = f.db.prepare('SELECT eqa_source_key k FROM nce_records WHERE id=?').get(d.record.id).k;
    // Đợt 00 nhập muộn, cũng không chấp nhận: đợt 01 thành "không thành công" (tín hiệu mới).
    must(f.eqa.importEqaRound({ data: { ...f.input, round: { ...f.input.round, round: 'ĐỢT 00', reportDate: '2026-08-01' }, rows: [{ ...f.input.rows[0], result: 8.4, zProvider: 3.4 }] } }, admin));
    const rows = f.eqa.listEqaCorrective(f.scope).filter((r) => r.round.round === 'ĐỢT 01');
    assert.equal(rows.length, 1, 'không sinh dòng trùng');
    assert.ok(rows[0].result.trend.unsuccessful);
    assert.deepEqual([rows[0].current, rows[0].record?.id], [true, d.record.id]);
    assert.equal(eqaNceSourceKey(rows[0]), keyBefore);
  } finally { f.db.close(); }
});

test('tín hiệu chuỗi ở kết quả đang chấp nhận vẫn vào hàng chờ bắt buộc điều tra', () => {
  const f = setup(1.2);
  try {
    for (let i = 2; i <= 6; i++) must(f.eqa.importEqaRound({ data: { ...f.input, round: { ...f.input.round, round: `ĐỢT 0${i}` } } }, admin));
    const rows = f.eqa.listEqaCorrective(f.scope);
    assert(rows.some(r => r.result.class === 'ok' && r.required && r.reasons.some(s => s.includes('6 đợt') || s.includes('Điểm J'))));
  } finally { f.db.close(); }
});

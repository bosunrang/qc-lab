// Hồi quy xem xét ngoại kiểm: quyền, dữ liệu hiện hành và hồ sơ bất biến.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { eqaReportDraftKey, initialEqaReportDraft, sameEqaReportDraft } from '../renderer/lib/eqa-report-draft.ts';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');
const { isoLocalDate } = require('../../app-dist/main/domain/local-date.js');
const { setBroadcastWindow } = require('../../app-dist/main/ipc/shared.js');
const { eqaPaperModel, assertCompactEqaPaper } = require('../../app-dist/main/domain/eqa/report-form.js');
const admin = { userId: 'admin', username: 'admin', name: 'Người ký thật', role: 'admin', clientId: 'test' };
const tech = { ...admin, userId: 'tech', role: 'technician' };
const must = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.data; };
function setup(z = 0.5) {
  const db = openDatabase(':memory:');
  const c = createConfigHandlers(db), eqa = createEqaHandlers(db);
  const machine = must(c.saveInstrument({ data: { name: 'Máy A' } }, admin));
  const assay = must(c.saveTest({ data: { name: 'Glucose', instrumentId: machine.id } }, admin));
  const today = isoLocalDate();
  const input = { round: { program: 'VEQAS', provider: 'Trung tâm', programCode: 'BC', unitCode: '100', year: Number(today.slice(0, 4)), round: 'ĐỢT 01', reportDate: today },
    rows: [{ ref: 'GLUC', code: 'GLUC', instrument: 'Máy A', sample: 'M1', unit: 'mmol/L', result: 5 + z, assigned: 5, sigmaP: 1, zProvider: z, peer: {} }],
    source: 'pdf', sourceName: 'veqas.pdf', mappings: [{ code: 'GLUC', instrument: 'Máy A', testId: assay.id }] };
  const round = must(eqa.importEqaRound({ data: input }, admin)).round;
  const scope = { programId: round.program_id, year: round.year, roundId: round.id };
  const draft = (report, kind = 'preliminary_review', extra = {}) => ({ scope: report.scope, expectedFingerprint: report.fingerprint, kind,
    conclusion: 'Đã đối chiếu toàn bộ kết quả với báo cáo.', communication: 'Đã truyền đạt cho các nhân viên liên quan.', warningNote: '', receivedDate: today, nextReviewDate: '', alternatives: [], ...extra });
  return { db, c, eqa, round, assay, machine, scope, input, draft };
}

test('xem xét: kiểm quyền trước dữ liệu, xác thực ô nhập, người ký lấy từ phiên', () => {
  const { db, eqa, scope, draft } = setup();
  try {
    assert.equal(eqa.reviewEqaReport({}, tech).error.code, 'forbidden');
    db.prepare('INSERT INTO users(id,username,role,capabilities_json) VALUES (?,?,?,?)').run('tech', 'tech', 'technician', '["nce.approve"]');
    const report = eqa.getEqaReport(scope);
    assert.equal(eqa.reviewEqaReport({ data: draft(report, 'preliminary_review', { conclusion: '' }) }, admin).error.code, 'conclusion');
    assert.equal(eqa.reviewEqaReport({ data: draft(report, 'preliminary_review', { receivedDate: '2026-02-31' }) }, admin).error.code, 'receivedDate');
    assert.equal(eqa.reviewEqaReport({ data: draft(report, 'analysis_review') }, admin).error.code, 'preliminary');
    const signed = must(eqa.reviewEqaReport({ data: { ...draft(report), actor_name: 'Tên giả' } }, admin));
    assert.equal(signed.reviews[0].actor_name, admin.name);
    assert.equal(signed.reviews[0].current, true);
    must(eqa.reviewEqaReport({ data: draft(signed) }, tech));
    db.prepare("UPDATE users SET capabilities_json='[]' WHERE id='tech'").run();
    assert.equal(eqa.reviewEqaReport({ data: draft(signed) }, tech).error.code, 'forbidden');
    const analysis = must(eqa.reviewEqaReport({ data: draft(signed, 'analysis_review') }, admin));
    assert.equal(analysis.reviews.length, 3);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM activity WHERE type='Xem xét báo cáo ngoại kiểm'").get().n, 3);
    const stored = JSON.parse(db.prepare("SELECT payload_json FROM eqa_decisions WHERE type='preliminary_review'").get().payload_json);
    assert.equal(stored.snapshot.rounds[0].results[0].result, 5.5);
  } finally { db.close(); }
});

test('cảnh báo phải được ghi nhận; tín hiệu điều tra không bị tỷ lệ chấp nhận che mất', () => {
  const { db, eqa, scope, draft } = setup(2.5);
  try {
    const report = eqa.getEqaReport(scope);
    assert.equal(report.totals.warn, 1);
    assert.equal(eqa.reviewEqaReport({ data: draft(report) }, admin).error.code, 'warningNote');
    assert.equal(must(eqa.reviewEqaReport({ data: draft(report, 'preliminary_review', { warningNote: 'Đã ghi nhận và lên kế hoạch theo dõi.' }) }, admin)).reviews.length, 1);
  } finally { db.close(); }
  const other = setup(3.2);
  try { assert.equal(other.eqa.getEqaReport(other.scope).requires_investigation, true); } finally { other.db.close(); }
});

test('nhập lại sau xem xét cần lý do; snapshot cũ giữ nguyên, chữ ký cũ không còn hiện hành', () => {
  const { db, eqa, scope, input, draft } = setup();
  try {
    const first = eqa.getEqaReport(scope);
    must(eqa.reviewEqaReport({ data: draft(first) }, admin));
    assert.equal(eqa.importEqaRound({ data: { ...input, rows: [{ ...input.rows[0], result: 6, zProvider: 1 }] } }, admin).error.code, 'replace-reason');
    must(eqa.importEqaRound({ data: { ...input, replaceReason: 'Trung tâm phát hành báo cáo thay thế.', rows: [{ ...input.rows[0], result: 6, zProvider: 1 }] } }, admin));
    const current = eqa.getEqaReport(scope);
    assert.equal(current.reviews[0].current, false);
    assert.equal(eqa.reviewEqaReport({ data: draft(first) }, admin).error.code, 'stale');
    const stored = JSON.parse(db.prepare("SELECT payload_json FROM eqa_decisions WHERE type='preliminary_review'").get().payload_json);
    assert.equal(stored.snapshot.rounds[0].results[0].result, 5.5);
    assert.equal(current.rounds[0].results[0].result, 6);
    must(eqa.cancelEqaRound({ data: { id: current.rounds[0].round.id, expectedVersion: current.rounds[0].round.row_version, reason: 'Huỷ báo cáo theo yêu cầu của khoa.' } }, admin));
    assert.equal(eqa.getEqaReport({ ...scope, roundId: undefined }).totals.total, 0);
    assert.throws(() => eqa.getEqaReport(scope), /huỷ/);
  } finally { db.close(); }
});

test('dấu vết tệp: main chặn metadata sai, giữ SHA-256 cùng quyết định nhập', () => {
  const { db, eqa, input, scope } = setup();
  try {
    const data = { ...input, rows: [{ ...input.rows[0], result: 5.6, zProvider: 0.6 }], replaceReason: 'Bổ sung dấu vết tệp báo cáo của trung tâm.', sourceFiles: [{ fileName: 'veqas.pdf', sha256: 'không phải hash', creationDate: '' }] };
    assert.equal(eqa.importEqaRound({ data }, admin).error.code, 'source-files');
    data.sourceFiles[0].sha256 = 'ab'.repeat(32);
    const saved = must(eqa.importEqaRound({ data }, admin));
    const source = JSON.parse(saved.decisions.find((d) => d.type === 'reimport').payload_json).sourceFiles[0];
    assert.deepEqual(source, data.sourceFiles[0]);
    const report = eqa.getEqaReport(scope);
    assert.equal(report.rounds[0].round.version, 2);
  } finally { db.close(); }
});

test('bao phủ xét mọi chương trình; xem xét hệ thống bắt buộc phương pháp thay thế và ngày hẹn', () => {
  const { db, c, eqa, scope, machine, draft } = setup();
  try {
    const missing = must(c.saveTest({ data: { name: 'Cholesterol', instrumentId: machine.id } }, admin));
    const report = eqa.getEqaReport({ ...scope, roundId: undefined });
    assert.deepEqual(report.coverage.missing.map((r) => r.test_id), [missing.id]);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const next = isoLocalDate(tomorrow);
    assert.equal(eqa.reviewEqaReport({ data: draft(report, 'system_review') }, admin).error.code, 'nextReviewDate');
    assert.equal(eqa.reviewEqaReport({ data: draft(report, 'system_review', { nextReviewDate: next }) }, admin).error.code, `alternative-${missing.id}`);
    const saved = must(eqa.reviewEqaReport({ data: draft(report, 'system_review', { nextReviewDate: next, alternatives: [{ testId: missing.id, method: 'So sánh liên phòng', reason: 'Chưa có chương trình phù hợp', result: 'Kết quả so sánh đạt tiêu chí đã đặt' }] }) }, admin));
    assert.equal(saved.reviews[0].alternatives[0].testId, missing.id);
    assert.equal(saved.reviews[0].current, true);
    assert.equal(saved.totals.total, 1);
  } finally { db.close(); }
});

test('ghi xem xét nguyên tử: lỗi audit hoàn nguyên quyết định và không phát thông báo', () => {
  const { db, eqa, scope, draft } = setup();
  try {
    const report = eqa.getEqaReport(scope), changed = [];
    setBroadcastWindow({ webContents: { send: (...args) => changed.push(args) } });
    db.exec("CREATE TRIGGER fail_review_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
    assert.throws(() => eqa.reviewEqaReport({ data: draft(report) }, admin), /audit unavailable/);
    assert.equal(eqa.getEqaReport(scope).reviews.length, 0);
    assert.equal(changed.length, 0);
  } finally { db.close(); }
});

test('chuyển ngày không làm chữ ký mất hiệu lực; danh mục chưa bao phủ không làm đổi xem xét đợt', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-15T05:00:00Z') });
  const { db, c, eqa, scope, machine, draft } = setup();
  try {
    const first = eqa.getEqaReport(scope);
    must(eqa.reviewEqaReport({ data: draft(first) }, admin));
    t.mock.timers.tick(24 * 60 * 60 * 1000);
    assert.equal(eqa.getEqaReport(scope).reviews[0].current, true);
    must(c.saveTest({ data: { name: 'Xét nghiệm mới chưa tham gia ngoại kiểm', instrumentId: machine.id } }, admin));
    assert.equal(eqa.getEqaReport(scope).reviews[0].current, true);
    const all = eqa.getEqaReport({ ...scope, roundId: undefined });
    t.mock.timers.tick(24 * 60 * 60 * 1000);
    assert.equal(eqa.getEqaReport(all.scope).fingerprint, all.fingerprint);
  } finally { db.close(); }
});

test('đủ số đợt tối thiểu hoặc sửa TEa không làm chữ ký đợt cũ mất hiệu lực', () => {
  const { db, eqa, scope, input, assay, draft } = setup();
  try {
    must(eqa.reviewEqaReport({ data: draft(eqa.getEqaReport(scope)) }, admin));
    for (let n = 2; n <= 6; n++) must(eqa.importEqaRound({ data: { ...input, round: { ...input.round, round: `ĐỢT 0${n}` } } }, admin));
    const report = eqa.getEqaReport(scope);
    assert.equal(report.rounds[0].results[0].trend.enough, true, 'đợt thứ 6 làm chuỗi đủ để kết luận xu hướng');
    assert.equal(report.reviews[0].current, true);
    const teaBefore = report.rounds[0].results[0].tea_pct;
    db.prepare("UPDATE tests SET tea=7.5, tea_source='ricos' WHERE id=?").run(assay.id);
    const edited = eqa.getEqaReport(scope);
    assert.notEqual(edited.rounds[0].results[0].tea_pct, teaBefore, 'TEa vận hành đã đổi');
    assert.equal(edited.reviews[0].current, true);
  } finally { db.close(); }
});

test('S1: bổ sung máy vào đợt đã ký không cần lý do; bản ký riêng máy cũ giữ hiệu lực và mã báo cáo của chính máy đó', () => {
  const { db, c, eqa, input, round, machine, draft } = setup();
  try {
    const other = must(c.saveInstrument({ data: { name: 'Máy B' } }, admin));
    const otherTest = must(c.saveTest({ data: { name: 'Glucose', instrumentId: other.id } }, admin));
    // Ký lại lần nhập đầu với mã báo cáo riêng của máy A.
    must(eqa.importEqaRound({ data: { ...input, round: { ...input.round, reportCode: 'BC-A' }, rows: [{ ...input.rows[0], result: 5.6, zProvider: 0.6 }], replaceReason: 'Ghi mã báo cáo của máy A.' } }, admin));
    const scopeA = { programId: round.program_id, year: round.year, roundId: round.id, instrumentId: machine.id };
    const scopeAll = { programId: round.program_id, year: round.year, roundId: round.id };
    must(eqa.reviewEqaReport({ data: draft(eqa.getEqaReport(scopeA)) }, admin));
    must(eqa.reviewEqaReport({ data: draft(eqa.getEqaReport(scopeAll)) }, admin));

    const bInput = { ...input, round: { ...input.round, reportCode: 'BC-B' }, rows: input.rows.map((r) => ({ ...r, instrument: 'Máy B' })), mappings: [{ code: 'GLUC', instrument: 'Máy B', testId: otherTest.id }] };
    const preview = must(eqa.previewEqaImport({ data: bInput }));
    assert.deepEqual([preview.existing.needs_reason, preview.existing.reviewed_all], [false, true]);
    const appended = must(eqa.importEqaRound({ data: bInput }, admin));
    assert.equal(appended.decisions[0].type, 'append');

    const a = eqa.getEqaReport(scopeA);
    assert.equal(a.reviews[0].current, true, 'bản ký riêng máy A giữ hiệu lực');
    assert.equal(a.rounds[0].round.report_code, 'BC-A', 'phiếu máy A giữ mã báo cáo của máy A');
    assert.equal(eqa.getEqaReport(scopeAll).reviews[0].current, false, 'phiếu tất cả máy cần ký lại để gồm máy B');

    // Thay số liệu máy A thì bản ký máy A hết hiệu lực, cần lý do.
    const changedA = { ...input, round: { ...input.round, reportCode: 'BC-A2' }, rows: [{ ...input.rows[0], result: 5.8, zProvider: 0.8 }] };
    assert.equal(eqa.importEqaRound({ data: changedA }, admin).error.code, 'replace-reason');
    must(eqa.importEqaRound({ data: { ...changedA, replaceReason: 'Trung tâm phát hành lại báo cáo máy A.' } }, admin));
    assert.equal(eqa.getEqaReport(scopeA).reviews[0].current, false);
  } finally { db.close(); }
});

test('S7: nhập lại đúng PDF cũ không tạo phiên bản mới, không cần lý do, giữ chữ ký', () => {
  const { db, eqa, scope, input, draft } = setup();
  try {
    must(eqa.reviewEqaReport({ data: draft(eqa.getEqaReport(scope)) }, admin));
    const preview = must(eqa.previewEqaImport({ data: input }));
    assert.deepEqual([preview.existing.unchanged, preview.existing.needs_reason], [true, false]);
    const decisions = () => db.prepare("SELECT COUNT(*) n FROM eqa_decisions WHERE type IN ('import','append','reimport')").get().n;
    const before = decisions();
    const same = must(eqa.importEqaRound({ data: input }, admin));
    assert.equal(same.round.version, 1);
    assert.equal(decisions(), before, 'không ghi lần nhập mới');
    assert.equal(eqa.getEqaReport(scope).reviews[0].current, true);
    const changed = { ...input, rows: input.rows.map((r) => ({ ...r, result: 5.6, zProvider: 0.6 })) };
    assert.equal(eqa.importEqaRound({ data: changed }, admin).error.code, 'replace-reason', 'số liệu đổi vẫn cần lý do');
  } finally { db.close(); }
});

test('S6: mở lại đợt đã huỷ bằng PDF một máy giữ kết quả của máy khác', () => {
  const { db, c, eqa, input } = setup();
  try {
    const other = must(c.saveInstrument({ data: { name: 'Máy B' } }, admin));
    const otherTest = must(c.saveTest({ data: { name: 'Glucose', instrumentId: other.id } }, admin));
    const round = must(eqa.importEqaRound({ data: { ...input, rows: input.rows.map((r) => ({ ...r, instrument: 'Máy B' })), mappings: [{ code: 'GLUC', instrument: 'Máy B', testId: otherTest.id }] } }, admin)).round;
    must(eqa.cancelEqaRound({ data: { id: round.id, expectedVersion: round.row_version, reason: 'Huỷ thử để kiểm tra mở lại.' } }, admin));
    const preview = must(eqa.previewEqaImport({ data: input }));
    assert.equal(preview.existing.needs_reason, true);
    assert.deepEqual(preview.existing.instruments, ['Máy A', 'Máy B']);
    const reopened = must(eqa.importEqaRound({ data: { ...input, replaceReason: 'Mở lại đợt sau khi đối chiếu báo cáo.' } }, admin));
    assert.equal(reopened.round.status, 'open');
    assert.deepEqual(reopened.results.map((r) => r.instrument_name).sort(), ['Máy A', 'Máy B']);
  } finally { db.close(); }
});

test('phiếu gọn: không tự kết luận phù hợp từ 100%; tách hai lần xem xét và giữ đề xuất CAR', () => {
  const { db, eqa, scope, draft } = setup();
  try {
    const first = eqa.getEqaReport(scope);
    assert.equal(eqaPaperModel(first).preliminary.assessment, 'pending');
    const preliminary = must(eqa.reviewEqaReport({ data: draft(first, 'preliminary_review', { assessment: 'appropriate' }) }, admin));
    const reviewed = must(eqa.reviewEqaReport({ data: draft(preliminary, 'analysis_review', { assessment: 'not_appropriate', carDecision: 'recorded', carReference: 'CAR-2026-01', communicationDate: isoLocalDate() }) }, admin));
    const form = eqaPaperModel(reviewed);
    assert.equal(form.preliminary.assessment, 'appropriate');
    assert.equal(form.analysis.assessment, 'not_appropriate');
    assert.equal(form.carReference, 'CAR-2026-01');
    assert.equal(form.canExport, true);
    assert.doesNotThrow(() => assertCompactEqaPaper(reviewed));
    assert.equal(reviewed.reviews[0].communication_date, isoLocalDate());
  } finally { db.close(); }
});

test('phiếu gọn: kiểm dữ liệu CAR, ngày truyền đạt và giới hạn nhận xét tại main', () => {
  const { db, eqa, scope, draft } = setup(3.2);
  try {
    const r = eqa.getEqaReport(scope);
    assert.match(eqaPaperModel(r).attention, /Glucose.*z=3.2/);
    for (const [patch, code] of [
      [{ conclusion: 'a'.repeat(501) }, 'conclusion'], [{ communication: 'a'.repeat(251) }, 'communication'],
      [{ carDecision: 'not_required' }, 'carDecision'], [{ carDecision: 'recorded', carReference: '' }, 'carReference'],
      [{ communicationDate: '2099-01-01' }, 'communicationDate'], [{ assessment: 'tự động đạt' }, 'assessment'],
    ]) assert.equal(eqa.reviewEqaReport({ data: draft(r, 'preliminary_review', patch) }, admin).error.code, code);
  } finally { db.close(); }
});

test('phiếu gọn: không cắt kết luận cũ quá dài và không in chữ ký cũ lên dữ liệu mới', () => {
  const { db, eqa, scope, draft, input } = setup();
  try {
    const r = eqa.getEqaReport(scope);
    must(eqa.reviewEqaReport({ data: draft(r) }, admin));
    const d = db.prepare("SELECT id,payload_json FROM eqa_decisions WHERE type='preliminary_review'").get();
    const stored = JSON.parse(d.payload_json);
    stored.draft.conclusion = 'Kết luận lưu trước đây '.repeat(40);
    db.prepare('UPDATE eqa_decisions SET payload_json=? WHERE id=?').run(JSON.stringify(stored), d.id);
    const long = eqa.getEqaReport(scope);
    assert.equal(eqaPaperModel(long).preliminary.conclusion, stored.draft.conclusion.trim());
    assert.throws(() => assertCompactEqaPaper(long), /quá dài/);
    must(eqa.importEqaRound({ data: { ...input, rows: [{ ...input.rows[0], result: 5.6, zProvider: 0.6 }], replaceReason: 'Nhập lại theo báo cáo mới từ nhà cung cấp.' } }, admin));
    const current = eqa.getEqaReport(scope), model = eqaPaperModel(current);
    assert.equal(current.reviews[0].conclusion, stored.draft.conclusion);
    assert.equal(model.preliminary.signed, false);
    assert.equal(model.analysis.signed, false);
    assert.equal(model.canExport, true);
  } finally { db.close(); }
});

test('xem trước trực tiếp: hai bản nháp không ghi hồ sơ hoặc giả chữ ký', () => {
  const { db, eqa, scope } = setup();
  try {
    const report = eqa.getEqaReport(scope);
    const preliminary = initialEqaReportDraft(report, 'preliminary_review');
    const analysis = initialEqaReportDraft(report, 'analysis_review');
    preliminary.conclusion = 'Nhận xét sơ khởi đang được chỉnh sửa.';
    preliminary.assessment = 'appropriate';
    analysis.conclusion = 'Nhận định phân tích chưa ký xác nhận.';
    analysis.communication = 'Nội dung dự kiến truyền đạt cho nhân viên.';
    const model = eqaPaperModel(report, [preliminary, analysis]);
    assert.equal(model.isDraft, true);
    assert.equal(model.preliminary.conclusion, preliminary.conclusion);
    assert.equal(model.analysis.conclusion, analysis.conclusion);
    assert.equal(model.communication, analysis.communication);
    assert.equal(model.preliminary.signed, false);
    assert.equal(model.analysis.signed, false);
    assert.match(model.analysis.reviewer, /chưa ký/);
    assert.equal(eqa.getEqaReport(scope).reviews.length, 0);
    assert.doesNotThrow(() => assertCompactEqaPaper(report, [preliminary, analysis]));
  } finally { db.close(); }
});

test('bản nháp tách theo người, đợt và bước; khởi tạo từ dữ liệu đã ký hiện hành', () => {
  const { db, eqa, scope, draft } = setup();
  try {
    const report = eqa.getEqaReport(scope);
    const signed = must(eqa.reviewEqaReport({ data: draft(report, 'preliminary_review', { assessment: 'appropriate' }) }, admin));
    const initial = initialEqaReportDraft(signed, 'preliminary_review');
    assert.equal(initial.conclusion, signed.reviews[0].conclusion);
    assert.equal(initial.expectedFingerprint, signed.fingerprint);
    assert.equal(sameEqaReportDraft(initial, structuredClone(initial)), true);
    assert.equal(sameEqaReportDraft(initial, { ...initial, conclusion: 'Đang sửa nhận xét.' }), false);
    const keys = [eqaReportDraftKey('a', scope, 'preliminary_review'), eqaReportDraftKey('a', scope, 'analysis_review'), eqaReportDraftKey('b', scope, 'preliminary_review'), eqaReportDraftKey('a', { ...scope, roundId: 'đợt-khác' }, 'preliminary_review'),
      eqaReportDraftKey('a', { ...scope, instrumentId: 'máy-a' }, 'preliminary_review'), eqaReportDraftKey('a', { ...scope, instrumentId: 'máy-b' }, 'preliminary_review')];
    assert.equal(new Set(keys).size, 6);
    const edited = { ...initial, conclusion: 'Nội dung mới chưa được ký.' };
    const preview = eqaPaperModel(signed, [edited]);
    assert.equal(preview.preliminary.signed, false);
    assert.equal(signed.reviews[0].conclusion, initial.conclusion);
    assert.equal(eqaPaperModel(signed).preliminary.signed, true);
  } finally { db.close(); }
});

test('phạm vi máy: số liệu, điều tra, bản ký và ảnh chụp độc lập với tất cả máy', () => {
  const { db, c, eqa, scope, input, machine, draft } = setup();
  try {
    const other = must(c.saveInstrument({ data: { name: 'Máy B' } }, admin));
    const assay = must(c.saveTest({ data: { name: 'Creatinine', instrumentId: other.id } }, admin));
    must(eqa.importEqaRound({ data: { ...input,
      rows: [{ ...input.rows[0], code: 'CREA', instrument: other.name, result: 8.5, zProvider: 3.5 }],
      mappings: [{ code: 'CREA', instrument: other.name, testId: assay.id }] } }, admin));
    const aScope = { ...scope, instrumentId: machine.id }, bScope = { ...scope, instrumentId: other.id };
    const all = eqa.getEqaReport(scope), a = eqa.getEqaReport(aScope), b = eqa.getEqaReport(bScope);
    assert.equal(all.totals.total, 2);
    assert.equal(all.requires_investigation, true);
    assert.equal(a.totals.total, 1);
    assert.equal(a.totals.ok, 1);
    assert.equal(a.requires_investigation, false);
    assert.equal(b.totals.rej, 1);
    assert.equal(b.requires_investigation, true);
    assert.equal(a.rounds[0].round.total, 1);
    assert.deepEqual(a.rounds[0].round.instruments, [machine.name]);
    assert.equal(a.rounds[0].instruments.length, 1);
    assert.equal(a.tests.length, 1);
    assert.equal(eqaPaperModel(a).instruments, machine.name);
    assert.match(eqaPaperModel(all).instruments, /Tất cả máy \(2\)/);
    assert.equal(new Set([all.fingerprint, a.fingerprint, b.fingerprint]).size, 3);
    must(eqa.reviewEqaReport({ data: draft(a, 'preliminary_review', { carDecision: 'not_required' }) }, admin));
    assert.equal(eqa.getEqaReport(scope).reviews.length, 0);
    assert.equal(eqa.getEqaReport(bScope).reviews.length, 0);
    assert.equal(eqa.reviewEqaReport({ data: draft(all, 'analysis_review') }, admin).error.code, 'preliminary');
    assert.equal(eqa.reviewEqaReport({ data: draft(b, 'analysis_review') }, admin).error.code, 'preliminary');
    assert.equal(eqa.reviewEqaReport({ data: { ...draft(a), scope } }, admin).error.code, 'stale');
    must(eqa.reviewEqaReport({ data: draft(all) }, admin));
    assert.equal(eqa.getEqaReport(scope).reviews.length, 1);
    assert.equal(eqa.getEqaReport(aScope).reviews.length, 1);
    const saved = db.prepare("SELECT payload_json FROM eqa_decisions WHERE type='preliminary_review' ORDER BY rowid").all().map(d => JSON.parse(d.payload_json));
    assert.equal(saved[0].snapshot.scope.instrumentId, machine.id);
    assert.equal(saved[0].snapshot.rounds[0].results.length, 1);
    assert.equal(saved[1].snapshot.rounds[0].results.length, 2);
    // Hồ sơ cũ không có instrumentId vẫn là hồ sơ của tất cả máy.
    assert.equal(saved[1].scope.instrumentId, undefined);
  } finally { db.close(); }
});

test('phạm vi máy: bao phủ, số đợt trong năm và máy chưa có dữ liệu không rơi về tất cả', () => {
  const { db, c, eqa, scope, input, machine, draft } = setup();
  try {
    const other = must(c.saveInstrument({ data: { name: 'Máy B' } }, admin));
    const assay = must(c.saveTest({ data: { name: 'Creatinine', instrumentId: other.id } }, admin));
    must(c.saveTest({ data: { name: 'Chưa tham gia', instrumentId: machine.id } }, admin));
    const annual = { ...scope, roundId: undefined, instrumentId: machine.id };
    assert.deepEqual(eqa.getEqaReport(annual).coverage.missing.map(r => r.instrument_name), [machine.name]);
    assert.deepEqual(eqa.getEqaReport({ ...annual, instrumentId: other.id }).coverage.missing.map(r => r.test_id), [assay.id]);
    const empty = eqa.getEqaReport({ ...scope, instrumentId: other.id });
    assert.equal(empty.totals.total, 0);
    assert.equal(eqa.reviewEqaReport({ data: draft(empty) }, admin).error.code, 'empty');
    assert.equal(eqa.getEqaReport({ ...annual, instrumentId: other.id }).rounds.length, 0);
    must(eqa.importEqaRound({ data: { ...input, round: { ...input.round, round: 'ĐỢT 02' },
      rows: [{ ...input.rows[0], code: 'CREA', instrument: other.name }],
      mappings: [{ code: 'CREA', instrument: other.name, testId: assay.id }] } }, admin));
    assert.equal(eqa.getEqaReport({ ...scope, roundId: undefined }).rounds.length, 2);
    assert.equal(eqa.getEqaReport(annual).rounds.length, 1);
    assert.equal(eqa.getEqaReport({ ...annual, instrumentId: other.id }).rounds.length, 1);
    assert.throws(() => eqa.getEqaReport({ ...scope, instrumentId: 'missing-machine' }), /Không tìm thấy máy/);
    assert.throws(() => eqa.getEqaReport({ ...scope, instrumentId: '   ' }), /không hợp lệ/);
    assert.throws(() => eqa.getEqaReport({ ...scope, instrumentId: 123 }), /không hợp lệ/);
  } finally { db.close(); }
});

test('mở phiếu đã ký dùng ảnh chụp và chữ ký đúng thời điểm, không lẫn nhận xét hoặc số liệu mới', () => {
  const { db, eqa, scope, input, draft } = setup();
  try {
    const original = eqa.getEqaReport(scope);
    const first = must(eqa.reviewEqaReport({ data: draft(original) }, admin)).reviews[0];
    const analysis = must(eqa.reviewEqaReport({ data: draft(original, 'analysis_review', { conclusion: 'Nhận định phân tích lần đầu đã ký.' }) }, admin)).reviews[0];
    must(eqa.reviewEqaReport({ data: draft(original, 'analysis_review', { conclusion: 'Nhận định phân tích lần sau đã thay đổi.' }) }, admin));
    const before = db.prepare('SELECT payload_json FROM eqa_decisions WHERE id=?').get(analysis.id).payload_json;
    const preliminary = eqa.getEqaReport(scope, first.id);
    assert.equal(eqaPaperModel(preliminary).preliminary.signed, true);
    assert.equal(eqaPaperModel(preliminary).analysis.signed, false);
    const saved = eqa.getEqaReport(scope, analysis.id);
    assert.equal(saved.reviews[0].id, analysis.id);
    assert.equal(eqaPaperModel(saved).analysis.conclusion, analysis.conclusion);
    assert.equal(eqaPaperModel(saved).preliminary.conclusion, first.conclusion);
    assert.equal(saved.reviews.length, 2);
    must(eqa.importEqaRound({ data: { ...input, replaceReason: 'Trung tâm sửa kết quả trong báo cáo.',
      rows: [{ ...input.rows[0], result: 8.5, zProvider: 3.5 }] } }, admin));
    assert.equal(eqa.getEqaReport(scope).totals.rej, 1);
    const old = eqa.getEqaReport(scope, analysis.id);
    assert.equal(old.totals.rej, 0);
    assert.equal(old.rounds[0].round.version, 1);
    assert.equal(old.rounds[0].results[0].result, 5.5);
    assert.equal(old.fingerprint, original.fingerprint);
    assert.equal(eqaPaperModel(old).analysis.signed, true);
    assert.equal(eqaPaperModel(old).analysis.reviewer, admin.name);
    assert.equal(db.prepare('SELECT payload_json FROM eqa_decisions WHERE id=?').get(analysis.id).payload_json, before);
  } finally { db.close(); }
});

test('mở phiếu lịch sử kiểm tra đúng chương trình, năm, đợt, máy và báo rõ hồ sơ thiếu ảnh chụp', () => {
  const { db, eqa, scope, machine, draft } = setup();
  try {
    const ownScope = { ...scope, instrumentId: machine.id };
    const own = eqa.getEqaReport(ownScope);
    const signed = must(eqa.reviewEqaReport({ data: draft(own) }, admin)).reviews[0];
    assert.equal(eqa.getEqaReport(ownScope, signed.id).reviews[0].id, signed.id);
    for (const wrong of [scope, { ...ownScope, roundId: undefined }, { ...ownScope, year: scope.year - 1 }, { ...ownScope, programId: 'other-program' }]) {
      assert.throws(() => eqa.getEqaReport(wrong, signed.id), /phạm vi/);
    }
    assert.throws(() => eqa.getEqaReport(ownScope, ''), /không hợp lệ/);
    const imported = db.prepare("SELECT id FROM eqa_decisions WHERE type='import'").get().id;
    assert.throws(() => eqa.getEqaReport(ownScope, imported), /Không tìm thấy phiếu/);
    const payload = JSON.parse(db.prepare('SELECT payload_json FROM eqa_decisions WHERE id=?').get(signed.id).payload_json);
    delete payload.snapshot;
    db.prepare('UPDATE eqa_decisions SET payload_json=? WHERE id=?').run(JSON.stringify(payload), signed.id);
    assert.throws(() => eqa.getEqaReport(ownScope, signed.id), /chưa lưu đầy đủ/);
    assert.equal(eqa.getEqaReport(ownScope).reviews.length, 1);
  } finally { db.close(); }
});

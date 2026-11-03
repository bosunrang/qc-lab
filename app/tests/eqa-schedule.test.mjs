// Lịch đợt ngoại kiểm và hạn nộp (2026-11-03): nộp trễ hạn thì đợt bị tính
// không đạt, nên app nhắc trước hạn. Trạng thái suy ra: đã có báo cáo > đã nộp
// > quá hạn > chưa nộp.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';

const require = createRequire(import.meta.url);
const { validateEqaSchedule, eqaScheduleStatus, daysBetween, needsAction, EQA_DUE_SOON_DAYS } = require('../../app-dist/main/domain/eqa/schedule.js');
const { isoLocalDate, isoLocalDateAfter } = require('../../app-dist/main/domain/local-date.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');

const tech = { userId: 'u-tech', username: 'tech', name: 'KTV', role: 'technician', clientId: 't' };
const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };
const viewer = { ...tech, role: 'viewer' };

test('kiểm tra dữ liệu một đợt trong lịch', () => {
  const base = { programName: 'Sinh hoá', year: 2026, round: 'ĐỢT 11', dueDate: '2026-11-20' };
  assert.equal(validateEqaSchedule(base).ok, true);
  assert.equal(validateEqaSchedule({ ...base, programName: '' }).code, 'missing-program');
  assert.equal(validateEqaSchedule({ ...base, round: 'Đợt' }).code, 'invalid-round', 'đợt phải có số thứ tự để khớp báo cáo');
  assert.equal(validateEqaSchedule({ ...base, dueDate: '2026-02-30' }).code, 'invalid-due-date');
  assert.equal(validateEqaSchedule({ ...base, runDate: '2026-11-21' }).code, 'run-after-due');
  assert.equal(validateEqaSchedule({ ...base, receiveDate: '2026-11-15', runDate: '2026-11-14' }).code, 'receive-after-run');
  assert.equal(validateEqaSchedule(base).data.roundNo, 11);
});

test('trạng thái và số ngày còn lại', () => {
  assert.equal(daysBetween('2026-11-03', '2026-11-10'), 7);
  assert.equal(daysBetween('2026-11-03', '2026-10-31'), -3);
  const at = (due, submitted_at = '', reported = false) => eqaScheduleStatus({ due_date: due, submitted_at, reported }, '2026-11-03');
  assert.deepEqual([at('2026-11-10'), at('2026-11-02'), at('2026-11-02', 'x'), at('2026-11-02', '', true)], ['planned', 'overdue', 'submitted', 'reported']);
  assert.equal(needsAction({ status: 'planned', days_left: EQA_DUE_SOON_DAYS }), true);
  assert.equal(needsAction({ status: 'planned', days_left: EQA_DUE_SOON_DAYS + 1 }), false);
  assert.equal(needsAction({ status: 'overdue', days_left: -2 }), true);
  assert.equal(needsAction({ status: 'submitted', days_left: -2 }), false);
});

function fixture() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), eqa = createEqaHandlers(db);
  const instrument = must(config.saveInstrument({ data: { name: 'AU5800' } }, admin), 'máy');
  const alt = must(config.saveTest({ data: { name: 'ALT', instrumentId: instrument.id } }, admin), 'xét nghiệm');
  db.prepare('UPDATE tests SET abbreviation=? WHERE id=?').run('ALT', alt.id);
  return { db, eqa, config, testId: alt.id };
}
const plan = (over = {}) => ({ data: { programName: 'CHƯƠNG TRÌNH SINH HÓA', provider: 'TTKCXN TP. HCM', year: 2026, round: 'ĐỢT 01', dueDate: isoLocalDateAfter(3), ...over } });

test('lập lịch, đánh dấu đã nộp, rồi nhận ra đợt đã có báo cáo', () => {
  const { db, eqa, testId } = fixture();
  assert.equal(eqa.saveEqaSchedule(plan(), viewer).error?.code, 'forbidden');
  const first = must(eqa.saveEqaSchedule(plan({ assignee: 'KTV A' }), tech), 'lập lịch');
  assert.deepEqual([first.status, first.days_left, first.program_name, first.round_no], ['planned', 3, 'CHƯƠNG TRÌNH SINH HÓA', 1]);
  assert.equal(eqa.listEqaPrograms().length, 1, 'tạo chương trình mới theo tên + đơn vị tổ chức');
  assert.equal(eqa.saveEqaSchedule(plan({ round: 'Đợt 1' }), tech).error?.code, 'duplicate-round', 'cùng số đợt trong năm');
  const second = must(eqa.saveEqaSchedule({ data: { programId: first.program_id, year: 2026, round: 'ĐỢT 02', dueDate: isoLocalDateAfter(-2) } }, tech), 'đợt quá hạn');
  assert.equal(second.status, 'overdue');
  assert.deepEqual(eqa.listEqaSchedule().filter((r) => needsAction(r)).map((r) => r.round), ['ĐỢT 02', 'ĐỢT 01']);

  const submitted = must(eqa.markEqaSubmitted({ data: { id: second.id, submitted: true } }, tech), 'đã nộp');
  assert.deepEqual([submitted.status, submitted.submitted_by], ['submitted', 'KTV']);
  assert.match(db.prepare("SELECT detail FROM activity WHERE type='Đã nộp kết quả ngoại kiểm'").get().detail, /nộp trễ 2 ngày/);
  assert.equal(eqa.removeEqaSchedule({ data: { id: second.id } }, tech).error?.code, 'locked', 'đã nộp là hồ sơ, không xoá');

  // Nhập báo cáo PDF của đúng đợt 01: chương trình khớp theo tên + đơn vị tổ
  // chức nên đợt trong lịch thành "đã có báo cáo".
  const round = { program: 'CHƯƠNG TRÌNH SINH HÓA', provider: 'TTKCXN TP. HCM', programCode: '', unitCode: '', year: 2026, round: 'ĐỢT 01', reportCode: '', reportDate: isoLocalDate(), assignedLevel: '' };
  const rows = [{ ref: 'ALT@AU5800', code: 'ALT(GPT)', instrument: 'AU5800', sample: 'M1', unit: 'U/L', result: 55, assigned: 54.278, sigmaP: 4.917, zProvider: 0.15, method: '', peerGroup: '', peer: {} }];
  must(eqa.importEqaRound({ data: { round, rows, source: 'pdf', sourceName: 'x.pdf', mappings: [{ code: 'ALT(GPT)', instrument: 'AU5800', testId }] } }, tech), 'nhập báo cáo');
  assert.equal(eqa.listEqaPrograms().length, 1, 'không sinh chương trình thứ hai');
  const reported = eqa.listEqaSchedule().find((r) => r.id === first.id);
  assert.equal(reported.status, 'reported');
  assert.ok(reported.round_id);
  assert.equal(needsAction(reported), false);
});

test('xoá đợt lập nhầm khi chưa nộp; sửa giữ nguyên thì không ghi nhật ký', () => {
  const { db, eqa } = fixture();
  const row = must(eqa.saveEqaSchedule(plan(), tech), 'lập lịch');
  const audits = () => db.prepare("SELECT COUNT(*) n FROM activity WHERE type LIKE '%lịch ngoại kiểm'").get().n;
  const before = audits();
  must(eqa.saveEqaSchedule({ id: row.id, data: plan().data }, tech), 'lưu lại y nguyên');
  assert.equal(audits(), before);
  must(eqa.removeEqaSchedule({ data: { id: row.id } }, tech), 'xoá');
  assert.equal(eqa.listEqaSchedule().length, 0);
});

test('đợt có khai máy: loại mẫu ở chương trình, nộp theo từng máy, máy thiếu báo cáo theo lịch', () => {
  const { db, eqa, config, testId } = fixture();
  const c501 = must(config.saveInstrument({ data: { name: 'Cobas c501' } }, admin), 'máy 2');
  const au = db.prepare("SELECT id FROM instruments WHERE name='AU5800'").get().id;
  assert.equal(eqa.saveEqaSchedule(plan({ sampleType: 'Sinh hoá lỏng' }), tech).error?.code, 'invalid-sample-type');
  assert.equal(eqa.saveEqaSchedule(plan({ instrumentIds: ['khong-co'] }), tech).error?.code, 'invalid-instrument');
  const row = must(eqa.saveEqaSchedule(plan({ sampleType: 'Sinh hóa', instrumentIds: [au, c501.id] }), tech), 'lập lịch có máy');
  assert.deepEqual([row.sample_type, row.instruments.map((m) => m.instrument_name)], ['Sinh hóa', ['AU5800', 'Cobas c501']]);
  const program = eqa.listEqaPrograms()[0];
  assert.deepEqual([program.sample_type, [...program.instrument_ids].sort()], ['Sinh hóa', [au, c501.id].sort()], 'đợt sau gợi sẵn máy của đợt này');

  // Nộp một máy: đợt chưa tính đã nộp.
  const half = must(eqa.markEqaSubmitted({ data: { id: row.id, instrumentIds: [au] } }, tech), 'nộp AU5800');
  assert.deepEqual([half.status, half.submitted_at, half.instruments.filter((m) => m.submitted_at).length], ['planned', '', 1]);
  assert.match(db.prepare("SELECT detail FROM activity WHERE type='Đã nộp kết quả ngoại kiểm'").get().detail, /máy: AU5800/);
  assert.equal(eqa.saveEqaSchedule({ id: row.id, data: plan({ sampleType: 'Sinh hóa', instrumentIds: [c501.id] }).data }, tech).error?.code, 'locked', 'không gỡ máy đã nộp');
  assert.equal(eqa.removeEqaSchedule({ data: { id: row.id } }, tech).error?.code, 'locked', 'đợt đã có máy nộp là hồ sơ');
  assert.equal(must(eqa.markEqaSubmitted({ data: { id: row.id, instrumentIds: [au, c501.id] } }, tech), 'nộp đủ').status, 'submitted');

  // Báo cáo PDF chỉ có AU5800 (đợt đầu năm): đợt chưa đủ báo cáo, và máy
  // c501 bị báo thiếu nhờ lịch dù chưa có đợt nào khác để suy ra.
  const round = { program: 'CHƯƠNG TRÌNH SINH HÓA', provider: 'TTKCXN TP. HCM', programCode: '', unitCode: '', year: 2026, round: 'ĐỢT 01', reportCode: '', reportDate: isoLocalDate(), assignedLevel: '' };
  const rows = [{ ref: 'ALT@AU5800', code: 'ALT(GPT)', instrument: 'AU5800', sample: 'M1', unit: 'U/L', result: 55, assigned: 54.278, sigmaP: 4.917, zProvider: 0.15, method: '', peerGroup: '', peer: {} }];
  must(eqa.importEqaRound({ data: { round, rows, source: 'pdf', sourceName: 'x.pdf', mappings: [{ code: 'ALT(GPT)', instrument: 'AU5800', testId }] } }, tech), 'nhập báo cáo');
  const after = eqa.listEqaSchedule()[0];
  assert.deepEqual([after.status, after.instruments.map((m) => m.reported)], ['submitted', [true, false]]);
  assert.deepEqual(eqa.listEqaRounds()[0].missing_instruments.map((m) => m.instrument_name), ['Cobas c501']);

  // Đổi loại mẫu ở một đợt là đổi của chương trình.
  must(eqa.saveEqaSchedule({ id: row.id, data: plan({ sampleType: 'Khí máu', instrumentIds: [au, c501.id] }).data }, tech), 'đổi loại mẫu');
  assert.equal(eqa.listEqaPrograms()[0].sample_type, 'Khí máu');
});

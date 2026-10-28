// Handler phân hệ Ngoại kiểm trên SQLite thật (docs/EQA-PLAN-2026-10-28.md,
// ca nghiệm thu 1, 3, 7, 9). Logic thuần có test riêng ở `eqa-domain.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };
const tech = { userId: 'u-tech', username: 'tech', name: 'KTV', role: 'technician', clientId: 't' };
const viewer = { userId: 'u-view', username: 'view', name: 'Người xem', role: 'viewer', clientId: 't' };

function fixture() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), eqa = createEqaHandlers(db);
  const ids = {};
  for (const device of ['AU5800', 'DxC700']) {
    const instrument = must(config.saveInstrument({ data: { name: device } }, admin), `máy ${device}`);
    for (const name of ['ALT', 'AST']) {
      const saved = must(config.saveTest({ data: { name, instrumentId: instrument.id } }, admin), `xét nghiệm ${name}`);
      db.prepare('UPDATE tests SET abbreviation=? WHERE id=?').run(name, saved.id);
      ids[`${name}@${device}`] = saved.id;
    }
  }
  return { db, eqa, ids };
}

const ROUND = { program: 'CHƯƠNG TRÌNH SINH HÓA', provider: 'TTKCXN TP. HCM', programCode: 'BC20C', unitCode: '10026', year: 2026, round: 'ĐỢT 01', reportCode: '', receivedDate: '2026-02-01', reportDate: '2026-02-20', assignedLevel: '', enteredBy: '' };
const row = (code, instrument, result, assigned, sigmaP, zProvider, over = {}) => ({
  ref: `${code}@${instrument}`, code, instrument, level: '', sample: 'M1', unit: 'U/L', result, assigned, sigmaP, zProvider, tolerancePct: null,
  runDate: '', reagentLot: '', method: '', operator: '', iqcNote: '', peerGroup: '', peer: {}, ...over,
});
const ROWS = [
  row('ALT(GPT)', 'AU5800', 55, 54.278, 4.917, 0.15),
  row('AST(GOT)', 'AU5800', 40, 30, 3, 3.33),
  // DxC700 đảo cột như dữ liệu thật của công cụ cũ.
  row('ALT(GPT)', 'DxC 700', 54.1, 52, 4, -0.53),
  row('AST(GOT)', 'DxC 700', 30.6, 31.5, 2, 0.45),
];
const draft = (over = {}) => ({ data: { round: ROUND, rows: ROWS, source: 'excel', sourceName: 'dot01.xlsx', ...over } });

test('ca 1, 3: xem trước gợi ý ánh xạ và chặn máy đảo cột; ghi khi đã ánh xạ và xác nhận đảo có lý do', () => {
  const { db, eqa, ids } = fixture();
  const preview = must(eqa.previewEqaImport(draft()), 'xem trước');
  assert.equal(preview.existing, null);
  assert.deepEqual(preview.pairs.map((p) => [p.code, p.instrument, p.test_id, p.suggestions]), [
    ['ALT(GPT)', 'AU5800', null, [ids['ALT@AU5800']]], ['AST(GOT)', 'AU5800', null, [ids['AST@AU5800']]],
    ['ALT(GPT)', 'DxC 700', null, [ids['ALT@DxC700']]], ['AST(GOT)', 'DxC 700', null, [ids['AST@DxC700']]],
  ], 'gợi ý theo mã viết tắt và tên máy, không tự ánh xạ');
  assert.deepEqual(preview.swaps.map((s) => [s.instrument, s.flagged]), [['AU5800', false], ['DxC 700', true]]);
  assert.equal(preview.blocking, 4);
  assert.equal(eqa.importEqaRound(draft(), admin).error.code, 'blocking');

  const mappings = preview.pairs.map((p) => ({ code: p.code, instrument: p.instrument, testId: p.suggestions[0] }));
  assert.equal(eqa.importEqaRound(draft({ mappings, swaps: [{ instrument: 'DxC 700', reason: 'ngắn' }] }), tech).error.code, 'swap-reason');
  assert.equal(eqa.importEqaRound(draft({ mappings, swaps: [{ instrument: 'DxC 700', reason: 'Đối chiếu báo cáo gốc, file đổi chỗ hai cột' }] }), viewer).error.code, 'forbidden', 'người chỉ xem không nhập được');
  const view = must(eqa.importEqaRound(draft({ mappings, swaps: [{ instrument: 'DxC 700', reason: 'Đối chiếu báo cáo gốc, file đổi chỗ hai cột' }] }), tech), 'nhập');
  assert.deepEqual([view.round.total, view.round.ok, view.round.warn, view.round.rej, view.round.version, view.round.swapped_rows], [4, 3, 0, 1, 1, 2]);
  const dxc = view.results.filter((r) => r.instrument_name === 'DxC700');
  assert.deepEqual(dxc.map((r) => [r.result, r.assigned, r.provider_check]), [[52, 54.1, 'match'], [31.5, 30.6, 'match']], 'đảo lại rồi mới tính z');
  assert.deepEqual(view.decisions.map((d) => d.type), ['import', 'column_swap']);
  assert.deepEqual(view.instruments.map((i) => [i.instrument_name, i.total, i.rej]), [['AU5800', 2, 1], ['DxC700', 2, 0]]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM eqa_test_map').get().n, 4, 'ánh xạ được lưu');
  assert.ok(db.prepare("SELECT COUNT(*) n FROM activity WHERE type='Đảo cột dữ liệu ngoại kiểm'").get().n === 1);
  assert.equal(eqa.listEqaRounds().length, 1);

  // Kỳ sau của cùng chương trình tự dùng ánh xạ đã lưu.
  const next = must(eqa.previewEqaImport(draft({ round: { ...ROUND, round: 'ĐỢT 02' }, rows: ROWS.slice(0, 2) })), 'xem trước kỳ sau');
  assert.equal(next.blocking, 0);
  assert.ok(next.pairs.every((p) => p.test_id));
});

test('ca 7: nhập lại cần lý do và tạo phiên bản mới, giữ phiên bản cũ; huỷ có lý do; khoá lạc quan', () => {
  const { db, eqa } = fixture();
  const preview = must(eqa.previewEqaImport(draft({ rows: ROWS.slice(0, 2) })), 'xem trước');
  const mappings = preview.pairs.map((p) => ({ code: p.code, instrument: p.instrument, testId: p.suggestions[0] }));
  const first = must(eqa.importEqaRound(draft({ rows: ROWS.slice(0, 2), mappings }), admin), 'nhập');
  const again = must(eqa.previewEqaImport(draft({ rows: ROWS.slice(0, 1) })), 'xem trước lần 2');
  assert.equal(again.existing.version, 1);
  assert.equal(eqa.importEqaRound(draft({ rows: ROWS.slice(0, 1) }), admin).error.code, 'replace-reason');
  assert.equal(eqa.importEqaRound(draft({ rows: ROWS.slice(0, 1), replaceReason: 'Bỏ dòng AST nhập nhầm', expectedVersion: 99 }), admin).error.code, 'stale');
  const second = must(eqa.importEqaRound(draft({ rows: ROWS.slice(0, 1), replaceReason: 'Bỏ dòng AST nhập nhầm', expectedVersion: first.round.row_version }), admin), 'nhập lại');
  assert.deepEqual([second.round.version, second.round.total], [2, 1]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM eqa_results WHERE round_id=?').get(second.round.id).n, 3, 'kết quả phiên bản 1 vẫn còn');
  assert.deepEqual(second.decisions.map((d) => d.type), ['import', 'reimport']);

  assert.equal(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: second.round.row_version, reason: 'ngắn' } }, admin).error.code, 'missing-reason');
  assert.equal(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: 1, reason: 'Nhập nhầm chương trình' } }, admin).error.code, 'stale');
  const cancelled = must(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: second.round.row_version, reason: 'Nhập nhầm chương trình' } }, admin), 'huỷ');
  assert.equal(cancelled.round.status, 'cancelled');
  assert.equal(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: cancelled.round.row_version, reason: 'Nhập nhầm chương trình' } }, admin).error.code, 'status');
  assert.equal(eqa.getEqaRound('khong-co'), null);
});

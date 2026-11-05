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

const ROUND = { program: 'CHƯƠNG TRÌNH SINH HÓA', provider: 'TTKCXN TP. HCM', programCode: 'BC20C', unitCode: '10026', year: 2026, round: 'ĐỢT 01', reportCode: '', reportDate: '2026-02-20', assignedLevel: '' };
const row = (code, instrument, result, assigned, sigmaP, zProvider, over = {}) => ({
  ref: `${code}@${instrument}`, code, instrument, sample: 'M1', unit: 'U/L', result, assigned, sigmaP, zProvider,
  method: '', peerGroup: '', peer: {}, ...over,
});
const ROWS = [
  row('ALT(GPT)', 'AU5800', 55, 54.278, 4.917, 0.15),
  row('AST(GOT)', 'AU5800', 40, 30, 3, 3.33),
  row('ALT(GPT)', 'DxC 700', 52, 54.1, 4, -0.53),
  row('AST(GOT)', 'DxC 700', 31.5, 30.6, 2, 0.45),
];
const draft = (over = {}) => ({ data: { round: ROUND, rows: ROWS, source: 'pdf', sourceName: 'VEQAS_BC20C_01.pdf', ...over } });

test('tín hiệu theo phạm vi: chương trình có mẫu nặng hơn không che tín hiệu chương trình đang xem', () => {
  const { db, eqa, ids } = fixture();
  const mappings = [{ code: 'AST(GOT)', instrument: 'AU5800', testId: ids['AST@AU5800'] }];
  let programId = '';
  for (const [program, year, z] of [['Chương trình A', 2025, -0.3], ['Chương trình A', 2026, 3.1], ['Chương trình B', 2026, -4.2]]) {
    const view = must(eqa.importEqaRound(draft({ round: { ...ROUND, program, programCode: program, year },
      rows: [row('AST(GOT)', 'AU5800', 30 + z * 3, 30, 3, z)], mappings }), admin), 'nhập phạm vi');
    if (program === 'Chương trình A') programId = view.round.program_id;
  }
  const instrumentId = db.prepare('SELECT instrument_id FROM tests WHERE id=?').get(ids['AST@AU5800']).instrument_id;
  // Toàn cục: một dòng cho mỗi chương trình, nặng hơn đứng trước. Gộp lại thì
  // z = -4,2 ở B che mất tín hiệu của A (N-09).
  const all = eqa.listEqaAttention();
  assert.deepEqual(all.map((a) => [a.test_id, a.latest.z, a.latest.program_name, a.latest.program_id === programId]),
    [[ids['AST@AU5800'], -4.2, 'Chương trình B', false], [ids['AST@AU5800'], 3.1, 'Chương trình A', true]]);
  assert.deepEqual(eqa.listEqaAttention({ year: null }).length, 2, 'năm null nghĩa là không lọc năm');
  const series = eqa.getEqaSeries(ids['AST@AU5800']);
  assert.deepEqual(series.programs.map((p) => [p.program_name, p.rounds, p.enough]).sort(), [['Chương trình A', 2, false], ['Chương trình B', 1, false]]);
  assert.ok(series.points.every((p) => series.programs.some((g) => g.program_id === p.program_id)), 'điểm mang chương trình của nó');
  const [current] = eqa.listEqaAttention({ programId, year: 2026, instrumentId });
  assert.equal(current.latest.z, 3.1);
  assert.equal(current.latest.year, 2026);
  assert.equal(current.points, 1);
  assert.deepEqual(eqa.listEqaAttention({ programId, year: 2025 }), [], 'không mang tín hiệu năm sau về năm cũ');
  assert.deepEqual(eqa.listEqaAttention({ programId, year: 2024 }), []);
  const otherInstrument = db.prepare('SELECT instrument_id FROM tests WHERE id=?').get(ids['AST@DxC700']).instrument_id;
  assert.deepEqual(eqa.listEqaAttention({ programId, instrumentId: otherInstrument }), []);
  assert.deepEqual(eqa.listEqaAttention({ programId, instrumentId: 'máy-khác' }), []);
});

test('ca 1, 3: xem trước gợi ý ánh xạ; dòng z ngược dấu báo cáo bị chặn; ghi khi đã ánh xạ', () => {
  const { db, eqa, ids } = fixture();
  const preview = must(eqa.previewEqaImport(draft()), 'xem trước');
  assert.equal(preview.existing, null);
  assert.deepEqual(preview.pairs.map((p) => [p.code, p.instrument, p.test_id, p.suggestions]), [
    ['ALT(GPT)', 'AU5800', null, [ids['ALT@AU5800']]], ['AST(GOT)', 'AU5800', null, [ids['AST@AU5800']]],
    ['ALT(GPT)', 'DxC 700', null, [ids['ALT@DxC700']]], ['AST(GOT)', 'DxC 700', null, [ids['AST@DxC700']]],
  ], 'gợi ý theo mã viết tắt và tên máy, không tự ánh xạ');
  assert.equal(preview.blocking, 4, 'chưa ánh xạ');
  assert.equal(eqa.importEqaRound(draft(), admin).error.code, 'blocking');

  const mappings = preview.pairs.map((p) => ({ code: p.code, instrument: p.instrument, testId: p.suggestions[0] }));
  // Kết quả và giá trị ấn định bị đọc đổi chỗ: z ngược dấu z báo cáo, chặn ghi.
  const flipped = [...ROWS.slice(0, 2), row('ALT(GPT)', 'DxC 700', 54.1, 52, 4, -0.53)];
  const bad = must(eqa.previewEqaImport(draft({ rows: flipped, mappings })), 'xem trước dòng đảo');
  assert.match(bad.rows[2].errors.join(';'), /ngược dấu z trên báo cáo/);
  assert.equal(eqa.importEqaRound(draft({ rows: flipped, mappings }), admin).error.code, 'blocking');

  assert.equal(eqa.importEqaRound(draft({ mappings }), viewer).error.code, 'forbidden', 'người chỉ xem không nhập được');
  const view = must(eqa.importEqaRound(draft({ mappings }), tech), 'nhập');
  assert.deepEqual([view.round.total, view.round.ok, view.round.warn, view.round.rej, view.round.version, view.round.source], [4, 3, 0, 1, 1, 'pdf']);
  assert.ok(view.results.every((r) => r.provider_check === 'match'));
  assert.deepEqual(view.decisions.map((d) => d.type), ['import']);
  assert.deepEqual(view.instruments.map((i) => [i.instrument_name, i.total, i.rej]), [['AU5800', 2, 1], ['DxC700', 2, 0]]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM eqa_test_map').get().n, 4, 'ánh xạ được lưu');
  assert.equal(eqa.listEqaRounds().length, 1);

  // Kỳ sau của cùng chương trình tự dùng ánh xạ đã lưu.
  const next = must(eqa.previewEqaImport(draft({ round: { ...ROUND, round: 'ĐỢT 02' }, rows: ROWS.slice(0, 2) })), 'xem trước kỳ sau');
  assert.equal(next.blocking, 0);
  assert.ok(next.pairs.every((p) => p.test_id));
});

test('N-06, N-07: chuỗi xét nghiệm qua các đợt, xét nghiệm cần chú ý, tỷ lệ chấp nhận', () => {
  const { eqa, ids } = fixture();
  const preview = must(eqa.previewEqaImport(draft({ rows: ROWS.slice(0, 2) })), 'xem trước');
  const mappings = preview.pairs.map((p) => ({ code: p.code, instrument: p.instrument, testId: p.suggestions[0] }));
  for (const [round, astZ] of [['ĐỢT 01', 3.33], ['ĐỢT 02', 3.1]]) {
    const rows = [row('ALT(GPT)', 'AU5800', 55, 54.278, 4.917, 0.15), row('AST(GOT)', 'AU5800', 30 + astZ * 3, 30, 3, astZ)];
    must(eqa.importEqaRound(draft({ round: { ...ROUND, round }, rows, mappings }), admin), `nhập ${round}`);
  }
  const series = eqa.getEqaSeries(ids['AST@AU5800']);
  assert.deepEqual(series.config, { z_warn: 2, z_reject: 3 }, 'biểu đồ nhận đúng ngưỡng dùng để tính chuỗi');
  assert.deepEqual(series.points.map((p) => [p.round, p.class, p.unsuccessful]), [['ĐỢT 01', 'rej', false], ['ĐỢT 02', 'rej', true]]);
  assert.equal(series.enough, false);
  const attention = eqa.listEqaAttention();
  assert.deepEqual(attention.map((a) => [a.test_name, a.latest.round, a.latest.unsuccessful, a.latest.signals]), [['AST', 'ĐỢT 02', true, ['reject', 'two_of_three', 'j_score']]]);
  const latest = eqa.listEqaRounds().find((r) => r.round === 'ĐỢT 02');
  assert.equal(latest.accept_pct, 50);
  const view = eqa.getEqaRound(latest.id);
  const ast = view.results.find((r) => r.code === 'AST(GOT)');
  assert.deepEqual([ast.trend.unsuccessful, ast.trend.signals], [true, ['reject', 'two_of_three', 'j_score']]);
  assert.equal(view.results.find((r) => r.code === 'ALT(GPT)').trend.signals.length, 0);
  const astLast = series.points.at(-1);
  assert.deepEqual([astLast.program_name, astLast.assigned, typeof astLast.result], [ROUND.program, 30, 'number'], 'bảng chuỗi hiện kết quả, giá trị ấn định, chương trình');
  assert.equal(astLast.tea_pct, null, 'chưa khai TEa thì không suy ra trong/vượt TEa');
  assert.equal(astLast.within_tea, null);
  assert.equal(eqa.getEqaSeries('khong-co'), null);
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
  assert.deepEqual(second.decisions.map((d) => d.type), ['reimport', 'import'], 'lịch sử mới nhất nằm trên cùng');

  assert.equal(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: second.round.row_version, reason: 'ngắn' } }, admin).error.code, 'missing-reason');
  assert.equal(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: 1, reason: 'Nhập nhầm chương trình' } }, admin).error.code, 'stale');
  const cancelled = must(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: second.round.row_version, reason: 'Nhập nhầm chương trình' } }, admin), 'huỷ');
  assert.equal(cancelled.round.status, 'cancelled');
  assert.deepEqual(cancelled.decisions.map((d) => d.type), ['cancel', 'reimport', 'import'], 'thao tác huỷ mới nhất đứng đầu lịch sử');
  assert.equal(eqa.cancelEqaRound({ data: { id: second.round.id, expectedVersion: cancelled.round.row_version, reason: 'Nhập nhầm chương trình' } }, admin).error.code, 'status');
  assert.equal(eqa.getEqaRound('khong-co'), null);
});

test('báo cáo PDF từng máy: nhận chương trình theo mã, bổ sung máy không cần lý do, thay máy đã có thì cần lý do và giữ máy khác', () => {
  const { eqa } = fixture();
  const au = [row('ALT(GPT)', 'AU5800', 55, 54.278, 4.917, 0.15), row('AST(GOT)', 'AU5800', 31, 30, 2, 0.5)];
  const auPreview = must(eqa.previewEqaImport(draft({ rows: au })), 'xem trước AU5800');
  const map = (p) => p.pairs.map((pair) => ({ code: pair.code, instrument: pair.instrument, testId: pair.suggestions[0] }));
  must(eqa.importEqaRound(draft({ rows: au, mappings: map(auPreview) }), admin), 'nhập báo cáo AU5800');

  // Báo cáo sau ghi tên đơn vị tổ chức khác nhưng cùng mã chương trình + mã đơn vị.
  const pdfRound = { ...ROUND, provider: 'TRUNG TÂM KIỂM CHUẨN XÉT NGHIỆM TP.HCM' };
  const dxc = [row('ALT (GPT)', 'DxC700', 141, 141.069, 9.405, -0.01), row('AST (GOT)', 'DxC700', 138, 139.222, 9.281, -0.13)];
  const pdf = (over = {}) => ({ data: { round: pdfRound, rows: dxc, source: 'pdf', sourceName: 'VEQAS_BC20C_09.pdf', ...over } });
  const dxcPreview = must(eqa.previewEqaImport(pdf()), 'xem trước PDF DxC700');
  assert.deepEqual(dxcPreview.existing && [dxcPreview.existing.instruments, dxcPreview.existing.replaces, dxcPreview.existing.needs_reason], [['AU5800'], [], false]);
  const appended = must(eqa.importEqaRound(pdf({ mappings: map(dxcPreview) }), admin), 'bổ sung DxC700');
  assert.deepEqual([appended.round.version, appended.round.total, appended.round.source, appended.round.instruments], [2, 4, 'pdf', ['AU5800', 'DxC700']]);
  assert.deepEqual(appended.decisions.map((d) => d.type), ['append', 'import']);
  assert.equal(eqa.listEqaRounds().length, 1, 'không tạo chương trình/kỳ thứ hai');

  // Nhập lại báo cáo DxC700: chỉ thay máy đó, giữ kết quả AU5800.
  const again = must(eqa.previewEqaImport(pdf()), 'xem trước lần 2');
  assert.deepEqual([again.existing.replaces, again.existing.needs_reason], [['DxC700'], true]);
  assert.equal(eqa.importEqaRound(pdf(), admin).error.code, 'replace-reason');
  const replaced = must(eqa.importEqaRound(pdf({ replaceReason: 'Trung tâm gửi lại báo cáo đã sửa', expectedVersion: appended.round.row_version }), admin), 'nhập lại DxC700');
  assert.deepEqual([replaced.round.version, replaced.round.total], [3, 4]);
  assert.deepEqual(replaced.results.filter((r) => r.instrument_name === 'AU5800').map((r) => r.result), [55, 31]);
  assert.equal(replaced.decisions[0].type, 'reimport');
});

test('tổng quan: đếm theo máy, máy chưa có báo cáo và lưới z của một máy qua các đợt', () => {
  const { eqa, ids } = fixture();
  const preview = must(eqa.previewEqaImport(draft()), 'xem trước');
  const mappings = preview.pairs.map((p) => ({ code: p.code, instrument: p.instrument, testId: p.suggestions[0] }));
  must(eqa.importEqaRound(draft({ mappings }), admin), 'đợt 01 đủ hai máy');
  must(eqa.importEqaRound(draft({ round: { ...ROUND, round: 'ĐỢT 02' }, rows: ROWS.slice(0, 2), mappings }), admin), 'đợt 02 chỉ AU5800');

  const [d02, d01] = eqa.listEqaRounds();
  assert.deepEqual(d01.by_instrument.map((i) => [i.instrument_name, i.total, i.rej]), [['AU5800', 2, 1], ['DxC700', 2, 0]]);
  assert.deepEqual(d01.missing_instruments, []);
  assert.deepEqual(d02.missing_instruments.map((m) => m.instrument_name), ['DxC700'], 'đợt 02 thiếu báo cáo DxC700');
  assert.deepEqual(eqa.getEqaRound(d02.id).round.missing_instruments.map((m) => m.instrument_name), ['DxC700']);

  const au = eqa.getEqaRound(d01.id).instruments.find((i) => i.instrument_name === 'AU5800').instrument_id;
  const grid = eqa.getEqaInstrumentGrid({ programId: d01.program_id, year: 2026, instrumentId: au });
  assert.deepEqual(grid.map((t) => [t.test_id, t.cells.map((c) => [c.round_id, c.class])]), [
    [ids['ALT@AU5800'], [[d01.id, 'ok'], [d02.id, 'ok']]],
    [ids['AST@AU5800'], [[d01.id, 'rej'], [d02.id, 'rej']]],
  ]);
  assert.deepEqual(eqa.getEqaInstrumentGrid({ programId: d01.program_id, year: 'x', instrumentId: au }), [], 'đầu vào sai trả rỗng');
  assert.ok(eqa.listEqaAttention().every((a) => a.instrument_id === au));
});

test('N-06/N-07: "Cần chú ý" xét mọi mẫu của đợt mới nhất, không chỉ mẫu cuối', () => {
  const { eqa, ids } = fixture();
  const mappings = [{ code: 'AST(GOT)', instrument: 'AU5800', testId: ids['AST@AU5800'] }];
  // Mẫu M1 không chấp nhận (z = 3,33), mẫu M2 — đứng sau — đạt.
  const rows = [
    row('AST(GOT)', 'AU5800', 40, 30, 3, 3.33),
    row('AST(GOT)', 'AU5800', 31, 30, 3, 0.33, { ref: 'AST(GOT)@AU5800#M2', sample: 'M2' }),
  ];
  must(eqa.importEqaRound(draft({ rows, mappings }), admin), 'nhập đợt hai mẫu');
  assert.equal(eqa.getEqaSeries(ids['AST@AU5800']).points.at(-1).class, 'ok', 'mẫu cuối của đợt đạt');
  const [ast] = eqa.listEqaAttention();
  assert.ok(ast, 'mẫu không đạt đứng trước vẫn phải lên danh sách');
  // |z| = 3,33 cho điểm J = 8, đạt ngưỡng J ngay ở kết quả này.
  assert.deepEqual([ast.flagged, ast.latest.sample, ast.latest.class, ast.latest.signals], [1, 'M1', 'rej', ['reject', 'j_score']]);
});

test('N-16: RIQAS mỗi sample là một đợt — sample sau không ghi đè sample trước của cùng máy', () => {
  const { eqa, ids } = fixture();
  const RIQAS = { program: 'MONTHLY CLINICAL CHEMISTRY', provider: 'RIQAS - Randox Laboratories', programCode: 'MC', unitCode: '231210.11', assignedLevel: 'Nhóm thiết bị' };
  const mappings = [{ code: 'AST', instrument: 'AU5800', testId: ids['AST@AU5800'] }];
  const imports = [['2026', 'CYCLE 23 SAMPLE 11', '2026-11-20', 0.5], ['2027', 'CYCLE 23 SAMPLE 12', '2027-01-15', 1.2], ['2027', 'CYCLE 24 SAMPLE 1', '2027-02-14', -0.4]];
  for (const [year, round, reportDate, z] of imports) {
    const result = eqa.importEqaRound({ data: { round: { ...RIQAS, year: Number(year), round, reportDate, reportCode: round },
      rows: [row('AST', 'AU5800', 30 + z * 3, 30, 3, z, { sample: '' })], mappings, source: 'pdf', sourceName: `${round}.pdf` } }, admin);
    assert.equal(result.ok, true, `${round}: ${result.error?.message ?? ''}`);
  }
  const rounds = eqa.listEqaRounds();
  assert.equal(rounds.length, 3, 'ba sample là ba đợt, không bắt nhập lại');
  assert.deepEqual(rounds.map((r) => [r.round, r.round_no]).sort((a, b) => a[1] - b[1]), [['CYCLE 23 SAMPLE 11', 2311], ['CYCLE 23 SAMPLE 12', 2312], ['CYCLE 24 SAMPLE 1', 2401]]);
  const series = eqa.getEqaSeries(ids['AST@AU5800']);
  assert.deepEqual(series.points.map((p) => p.round), ['CYCLE 23 SAMPLE 11', 'CYCLE 23 SAMPLE 12', 'CYCLE 24 SAMPLE 1'], 'sample cuối cycle sang năm sau vẫn đứng trước cycle kế tiếp');
  assert.equal(series.programs[0].rounds, 3, 'xu hướng đếm từng sample là một đợt');
});


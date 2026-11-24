// TEa vận hành (2026-11-03): cổng Bias khi lập dải, cột "Trong TEa" của ngoại
// kiểm và mục TEa ở danh mục xét nghiệm dùng chung một thứ tự nguồn — hồ sơ
// TEa của PXN (theo mức, rồi TEa chung), rồi nguồn PXN đã chọn ở trang Six
// Sigma, rồi báo thiếu. Không bao giờ lấy `tests.tea`: ô đó từng được chép
// một lần từ gợi ý danh mục (Natri 0,73% Ricos) nên lệch với TEa PXN dùng.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';
import { hasLabTea, MISSING_LAB_TEA_NOTE, operationalTeaSource, operationalTeaSummary, resolveOperationalTea } from '../main/domain/sigma-tea-core.ts';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');

const catalog = [{ id: 'qclab-sodium', name: 'Sodium', abbr: 'Na', unit: 'mmol/L', clia: null, ricos: 0.73, cliaAbsolute: 4, cliaAbsoluteUnit: 'mmol/L' }];
const sodium = (over = {}) => ({ name: 'Sodium (Na)', tea_ref_key: 'qclab-sodium', unit: 'mmol/L', tea: 0.73, tea_source: 'ricos', ...over });
const labRef = (over = {}) => ({ name: 'Sodium', analyte_id: 'qclab-sodium', lab: 2.9, lab_source: 'Hồ sơ TEa PXN 2026', lab_level_defaults: [{ level: 2, tea: 2.5 }], ...over });

test('thứ tự nguồn: TEa PXN theo mức → TEa PXN chung → nguồn đã chọn → thiếu', () => {
  const level1 = resolveOperationalTea(sodium(), [labRef()], catalog, 140, 1);
  assert.deepEqual([level1.value, level1.source], [2.9, 'lab'], 'mức chưa khai riêng dùng TEa chung của PXN, không dùng Ricos đã chép');
  assert.equal(level1.criterion, 'Hồ sơ TEa PXN 2026');
  assert.equal(resolveOperationalTea(sodium(), [labRef()], catalog, 140, 2).value, 2.5, 'TEa riêng của mức thắng TEa chung');
  assert.equal(resolveOperationalTea(sodium(), [labRef({ lab: null })], catalog, 140, 1).source, 'ricos', 'chỉ khai mức 2: mức 1 rơi về nguồn đã chọn');

  const clia = resolveOperationalTea(sodium({ tea_source: 'clia' }), [], catalog, 200, 1);
  assert.deepEqual([clia.value, clia.source], [2, 'clia'], 'CLIA ±4 mmol/L quy đổi tại nồng độ truyền vào');

  for (const teaSource of ['', 'lab', 'khong-ro']) {
    const missing = resolveOperationalTea(sodium({ tea_source: teaSource }), [], catalog, 140, 1);
    assert.deepEqual([missing.value, missing.source, missing.note], [null, null, MISSING_LAB_TEA_NOTE], `tea_source="${teaSource}": không lấy tests.tea`);
  }
});

test('có hồ sơ TEa PXN (chung hoặc chỉ theo mức) thì PXN là nguồn mặc định', () => {
  assert.equal(hasLabTea(sodium(), [labRef()], catalog), true);
  assert.equal(hasLabTea(sodium(), [labRef({ lab: null })], catalog), true, 'chỉ khai theo mức vẫn là có hồ sơ');
  assert.equal(hasLabTea(sodium(), [labRef({ lab: null, lab_level_defaults: [] })], catalog), false, 'hồ sơ chỉ ghi đè CLIA/Ricos không phải TEa PXN');
  assert.equal(hasLabTea(sodium(), [], catalog), false);
});

test('dòng hiển thị ở danh mục xét nghiệm', () => {
  assert.deepEqual(operationalTeaSummary(sodium(), [labRef()], catalog), { text: 'Chung 2.9% · M2 2.5%', source: 'lab', sourceLabel: 'PXN' });
  assert.equal(operationalTeaSummary(sodium(), [labRef({ lab_level_defaults: [] })], catalog).text, '2.9%');
  assert.equal(operationalTeaSummary(sodium(), [labRef({ lab: null })], catalog).text, 'M2 2.5%');
  assert.deepEqual(operationalTeaSummary(sodium({ tea_source: 'clia' }), [], catalog), { text: '±4.0000 mmol/L', source: 'clia', sourceLabel: 'CLIA' }, 'chưa có nồng độ: in nguyên giới hạn tuyệt đối');
  assert.deepEqual(operationalTeaSummary(sodium({ tea_source: '' }), [], catalog), { text: '', source: null, sourceLabel: '' });
});

test('nguồn vận hành chọn rõ thắng nguồn tự động; CLIA vẫn quy đổi theo từng nồng độ', () => {
  const refs = [labRef()];
  const cliaTest = sodium({ operational_tea_source: 'clia' });
  assert.equal(operationalTeaSource(cliaTest, refs, catalog), 'clia');
  assert.equal(resolveOperationalTea(cliaTest, refs, catalog, 200, 1).value, 2);
  assert.ok(Math.abs(resolveOperationalTea(cliaTest, refs, catalog, 140, 2).value - 4 / 140 * 100) < 1e-10);
  assert.deepEqual(operationalTeaSummary(cliaTest, refs, catalog), { text: '±4.0000 mmol/L', source: 'clia', sourceLabel: 'CLIA' });
  const ricosTest = sodium({ operational_tea_source: 'ricos' });
  assert.equal(resolveOperationalTea(ricosTest, refs, catalog, 140, 2).value, 0.73);
  assert.equal(operationalTeaSummary(ricosTest, refs, catalog).source, 'ricos');
  const labTest = sodium({ operational_tea_source: 'lab' });
  assert.equal(resolveOperationalTea(labTest, refs, catalog, 140, 2).value, 2.5);
  assert.equal(resolveOperationalTea(labTest, [], catalog, 140, 1).value, null, 'chọn PXN mà thiếu hồ sơ không được rơi về Ricos');
  assert.equal(operationalTeaSummary(labTest, [], catalog).text, 'Chưa có TEa của PXN');
  const mismatch = resolveOperationalTea({ ...cliaTest, unit: 'mg/dL' }, refs, catalog, 140, 1);
  assert.equal(mismatch.value, null); assert.equal(mismatch.criterionDetail.unitMismatch, true);
  assert.match(operationalTeaSummary({ ...cliaTest, unit: 'mg/dL' }, refs, catalog).text, /không áp dụng giới hạn tuyệt đối/);
});

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

function insertLabRef(db, { lab, levels = [] }) {
  db.prepare("INSERT INTO tea_refs(id,analyte_id,name,lab,lab_source) VALUES ('ref-na','qclab-sodium','Sodium',?,'Hồ sơ PXN')").run(lab);
  for (const [level, tea] of levels) db.prepare("INSERT INTO tea_ref_level_defaults(tea_ref_id,level,tea) VALUES ('ref-na',?,?)").run(level, tea);
}

test('cổng Bias khi lập dải dùng TEa PXN của đúng mức', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), entry = createEntryHandlers(db);
  const inst = must(config.saveInstrument({ data: { name: 'Máy A' } }, actor), 'máy');
  const t = must(config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: inst.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium' } }, actor), 'xét nghiệm');
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g1','Nhóm A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('l1','g1','LOT-1',1),('l2','g1','LOT-2',2)").run();
  must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 140, sd: 1.5, qcLotId: 'l1' } }, actor), 'mức 1');
  must(config.saveTestLevel({ testId: t.id, data: { level: 2, mean: 120, sd: 1.5, qcLotId: 'l2' } }, actor), 'mức 2');
  // Giống dữ liệu thật: gợi ý cũ đã chép Ricos 0,73% vào xét nghiệm.
  db.prepare("UPDATE tests SET tea=0.73, tea_source='ricos' WHERE id=?").run(t.id);
  const safety = (level) => must(entry.rangeCandidate(t.id, level), `dải mức ${level}`).safety;

  insertLabRef(db, { lab: 3.2, levels: [[1, 2.8]] });
  assert.deepEqual([safety(1).tea, safety(1).biasThreshold], [2.8, 0.7], 'mức 1 dùng TEa riêng của PXN');
  assert.equal(safety(2).tea, 3.2, 'mức 2 chưa khai riêng: TEa chung của PXN');

  db.prepare("DELETE FROM tea_refs WHERE id='ref-na'").run();
  assert.equal(safety(1).tea, 0.73, 'chưa có hồ sơ PXN: nguồn đã chọn ở Six Sigma');
  db.prepare("UPDATE tests SET tea_source='' WHERE id=?").run(t.id);
  assert.deepEqual([safety(1).tea, safety(1).biasThreshold], [null, null], 'không nguồn nào: không đọc tests.tea');
});

test('ngoại kiểm: "Trong TEa" theo TEa PXN, thiếu thì để trống', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), eqa = createEqaHandlers(db);
  const inst = must(config.saveInstrument({ data: { name: 'AU5800' } }, actor), 'máy');
  const t = must(config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: inst.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium' } }, actor), 'xét nghiệm');
  db.prepare("UPDATE tests SET tea=0.73, tea_source='ricos' WHERE id=?").run(t.id);
  const round = { program: 'SINH HÓA', provider: 'TT', programCode: 'BC', unitCode: '1', year: 2026, round: 'ĐỢT 01', reportCode: '', reportDate: '2026-02-20', assignedLevel: '' };
  // Lệch 2% so với giá trị ấn định 140 (z = 2,8 / 2 = 1,4).
  const rows = [{ ref: 'NA@AU5800', code: 'NA', instrument: 'AU5800', sample: 'M1', unit: 'mmol/L', result: 142.8, assigned: 140, sigmaP: 2, zProvider: 1.4, method: '', peerGroup: '', peer: {} }];
  const view = must(eqa.importEqaRound({ data: { round, rows, source: 'pdf', sourceName: 'x.pdf', mappings: [{ code: 'NA', instrument: 'AU5800', testId: t.id }] } }, actor), 'nhập');
  const result = () => eqa.getEqaRound(view.round.id).results[0];

  assert.deepEqual([result().tea_pct, result().within_tea], [0.73, false], 'chưa có hồ sơ PXN: nguồn đã chọn');
  insertLabRef(db, { lab: 3, levels: [[1, 1]] });
  assert.deepEqual([result().tea_pct, result().within_tea], [3, true], 'TEa chung của PXN, không lấy TEa theo mức QC');
  db.prepare("DELETE FROM tea_refs WHERE id='ref-na'").run();
  db.prepare("UPDATE tests SET tea_source='clia' WHERE id=?").run(t.id);
  const clia = result();
  assert.ok(Math.abs(clia.tea_pct - 4 / 140 * 100) < 1e-9, 'CLIA ±4 mmol/L quy đổi tại giá trị ấn định của mẫu');
  db.prepare("UPDATE tests SET tea_source='' WHERE id=?").run(t.id);
  assert.deepEqual([result().tea_pct, result().within_tea], [null, null], 'thiếu TEa: không báo "Vượt TEa"');
});

test('nguồn chọn tại danh mục đi qua cổng Bias, ngoại kiểm và Sigma mà không đổi snapshot kỳ cũ', () => {
  const db = openDatabase(':memory:');
  try {
    const config = createConfigHandlers(db), entry = createEntryHandlers(db), eqa = createEqaHandlers(db), sigma = createSigmaHandlers(db);
    const inst = must(config.saveInstrument({ data: { name: 'Máy chọn nguồn TEa' } }, actor), 'máy');
    const draft = { name: 'Sodium (Na)', instrumentId: inst.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium', teaSource: 'ricos', tea: 0.73 };
    const t = must(config.saveTest({ data: { ...draft, operationalTeaSource: 'clia' } }, actor), 'xét nghiệm');
    insertLabRef(db, { lab: 3, levels: [[1, 2.8]] });
    must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 140, sd: 1.5 } }, actor), 'mức 1');
    must(config.saveTestLevel({ testId: t.id, data: { level: 2, mean: 200, sd: 1.5 } }, actor), 'mức 2');
    assert.ok(Math.abs(entry.rangeCandidate(t.id, 1).data.safety.tea - 4 / 140 * 100) < 1e-10);
    assert.equal(entry.rangeCandidate(t.id, 2).data.safety.tea, 2);
    const period = must(sigma.savePeriod({ testId: t.id, period: '2026-10', teaSource: 'clia', levels: [{ level: 1, cv: 1, biasEqa: 0 }] }, actor), 'kỳ CLIA');
    const teaBefore = period.levels[0].tea;
    const view = must(eqa.importEqaRound({ data: {
      round: { program: 'TEa vận hành', provider: 'TT', year: 2026, round: '01', reportDate: '2026-10-20' },
      rows: [{ ref: 'NA', code: 'NA', instrument: 'Máy', sample: 'M1', unit: 'mmol/L', result: 142.8, assigned: 140, sigmaP: 2 }],
      mappings: [{ code: 'NA', instrument: 'Máy', testId: t.id }], source: 'pdf', sourceName: 'test.pdf',
    } }, actor), 'ngoại kiểm');
    assert.equal(eqa.getEqaRound(view.round.id).results[0].within_tea, true);
    const saved = must(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'ricos' } }, actor), 'chọn Ricos');
    assert.equal(saved.operational_tea_source, 'ricos');
    assert.equal(entry.rangeCandidate(t.id, 1).data.safety.tea, 0.73);
    assert.equal(eqa.getEqaRound(view.round.id).results[0].within_tea, false);
    assert.equal(sigma.listPeriods(t.id)[0].levels[0].tea, teaBefore, 'đổi nguồn vận hành không sửa TEa kỳ đã chốt');
    must(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'lab' } }, actor), 'chọn PXN');
    assert.equal(entry.rangeCandidate(t.id, 1).data.safety.tea, 2.8);
    assert.equal(eqa.getEqaRound(view.round.id).results[0].tea_pct, 3, 'ngoại kiểm dùng TEa PXN chung, không mượn mức QC');
    const auditBefore = db.prepare('SELECT COUNT(*) n FROM activity').get().n;
    assert.equal(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'khong-hop-le' } }, actor).error.code, 'invalid-operational-tea-source');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM activity').get().n, auditBefore, 'dữ liệu không hợp lệ không ghi hoặc tạo audit');
    const unchanged = must(config.saveTest({ id: t.id, data: draft }, actor), 'lưu từ client cũ');
    assert.equal(unchanged.operational_tea_source, 'lab', 'client không gửi trường mới không được xoá lựa chọn');
  } finally { db.close(); }
});

test('form nhiều máy lưu nguồn TEa cho từng cấu hình và không ghi đè máy cũ khi gán thêm', () => {
  const db = openDatabase(':memory:');
  try {
    const config = createConfigHandlers(db);
    const machines = ['A', 'B', 'C'].map((name) => must(config.saveInstrument({ data: { name } }, actor), name));
    const draft = { name: 'Sodium (Na)', unit: 'mmol/L', teaRefKey: 'qclab-sodium', operationalTeaSource: 'clia' };
    const saved = must(config.saveTest({ data: { ...draft, instrumentIds: machines.slice(0, 2).map((m) => m.id) } }, actor), 'hai máy');
    assert.ok(config.listTests().every((item) => item.operational_tea_source === 'clia'));
    const ids = saved.assignment_ids;
    must(config.saveTest({ id: saved.id, data: { ...draft, operationalTeaSource: 'ricos', assignmentIds: ids,
      instrumentIds: machines.map((m) => m.id), preserveExistingAssignments: true } }, actor), 'gán thêm máy');
    const tests = config.listTests();
    assert.ok(tests.filter((item) => ids.includes(item.id)).every((item) => item.operational_tea_source === 'clia'));
    assert.equal(tests.find((item) => item.instrument_id === machines[2].id).operational_tea_source, 'ricos');
  } finally { db.close(); }
});

test('Sigma và danh mục đồng bộ nguồn hai chiều, giữ EFLM và toàn bộ snapshot kỳ cũ', () => {
  const db = openDatabase(':memory:');
  try {
    const config = createConfigHandlers(db), sigma = createSigmaHandlers(db);
    const machines = ['Máy A', 'Máy B'].map(name => must(config.saveInstrument({ data: { name } }, actor), name));
    const draft = { name: 'Sodium (Na)', unit: 'mmol/L', teaRefKey: 'qclab-sodium', teaSource: 'ricos', tea: 0.73 };
    const t = must(config.saveTest({ data: { ...draft, instrumentId: machines[0].id, operationalTeaSource: 'clia' } }, actor), 'máy A');
    const peer = must(config.saveTest({ data: { ...draft, instrumentId: machines[1].id, operationalTeaSource: 'lab' } }, actor), 'máy B');
    assert.equal(t.tea_source, 'clia', 'danh mục ghi cùng nguồn cho cả trường tương thích');
    insertLabRef(db, { lab: 3, levels: [[1, 2.8]] });
    for (const [level, mean] of [[1, 140], [2, 200]]) must(config.saveTestLevel({ testId: t.id, data: { level, mean, sd: 2 } }, actor), 'mức');
    const before = must(sigma.savePeriod({ testId: t.id, period: '2026-10', teaSource: 'clia', levels: [{ level: 1, cv: 1, biasEqa: 0 }, { level: 2, cv: 1, biasEqa: 0 }] }, actor), 'kỳ');
    const originalStored = db.prepare('SELECT tea,tea_source,lv_json FROM sigma_data WHERE id=?').get(before.id);
    const fromSigma = must(sigma.saveTeaConfig({ testId: t.id, source: 'ricos', tea: 0.73 }, actor), 'đổi từ Sigma');
    assert.deepEqual([fromSigma.tea_source, fromSigma.operational_tea_source], ['ricos', 'ricos']);
    assert.equal(operationalTeaSummary(fromSigma, [labRef()], catalog).source, 'ricos', 'nguồn vận hành thắng hồ sơ PXN đã có');
    assert.equal(config.listTests().find(row => row.id === peer.id).operational_tea_source, 'lab', 'không đổi nguồn của máy khác');
    const fromCatalog = must(config.saveTest({ id: t.id, data: { ...draft, instrumentId: machines[0].id, operationalTeaSource: 'lab' } }, actor), 'đổi từ danh mục');
    assert.deepEqual([fromCatalog.tea_source, fromCatalog.operational_tea_source], ['lab', 'lab']);
    const eflm = must(sigma.saveTeaConfig({ testId: t.id, source: 'eflm', tea: 5.5, eflmAnalyte: 'Sodium', eflmLookupDate: '2026-11-11', eflmRef: 'EFLM database' }, actor), 'EFLM');
    assert.equal(resolveOperationalTea(eflm, [labRef()], catalog, 140, 1).value, 5.5);
    must(config.saveTest({ id: t.id, data: { ...draft, instrumentId: machines[0].id, operationalTeaSource: 'clia' } }, actor), 'rời EFLM');
    const back = must(config.saveTest({ id: t.id, data: { ...draft, instrumentId: machines[0].id, operationalTeaSource: 'eflm' } }, actor), 'trở về EFLM');
    assert.equal(back.eflm_tea, 5.5);
    assert.equal(back.eflm_lookup_date, '2026-11-11');
    assert.equal(resolveOperationalTea(back, [labRef()], catalog, 140, 1).value, 5.5, 'không dùng số CLIA/Ricos hoặc PXN làm EFLM');
    assert.deepEqual(sigma.listPeriods(t.id)[0], before, 'cả TEa từng mức, nguồn, kết quả Sigma/MU đều giữ nguyên');
    assert.deepEqual(db.prepare('SELECT tea,tea_source,lv_json FROM sigma_data WHERE id=?').get(before.id), originalStored, 'kỳ đã có snapshot không bị ghi lại');
  } finally { db.close(); }
});

test('đổi nguồn giữ TEa đã có số, bổ sung kỳ còn thiếu; lỗi audit hoàn nguyên cấu hình và lịch sử', () => {
  const db = openDatabase(':memory:');
  try {
    const config = createConfigHandlers(db), sigma = createSigmaHandlers(db);
    const machine = must(config.saveInstrument({ data: { name: 'Máy lịch sử TEa' } }, actor), 'máy');
    const draft = { name: 'Sodium (Na)', instrumentId: machine.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium' };
    const t = must(config.saveTest({ data: { ...draft, operationalTeaSource: 'ricos' } }, actor), 'xét nghiệm');
    must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 140, sd: 2 } }, actor), 'mức');
    const legacyId = `${t.id}:2026-09`;
    const legacyLevel = [{ level: 1, cv: 1, biasEqa: 0, targetMean: 140 }];
    db.prepare('INSERT INTO sigma_data(id,test_id,period,tea,tea_source,lv_json) VALUES (?,?,?,?,?,?)').run(legacyId, t.id, '2026-09', null, 'lab', JSON.stringify(legacyLevel));
    assert.equal(sigma.listPeriods(t.id)[0].levels[0].tea, 0.73, 'dữ liệu cũ đang giải từ nguồn dự phòng');
    must(sigma.saveTeaConfig({ testId: t.id, source: 'clia' }, actor), 'đổi nguồn ở Sigma');
    assert.equal(sigma.listPeriods(t.id)[0].levels[0].tea, 0.73, 'không bị kéo sang CLIA theo cấu hình mới');
    assert.equal(sigma.listPeriods(t.id)[0].teaSource, 'lab', 'giữ nguồn gốc kỳ cũ');
    const frozen = sigma.listPeriods(t.id)[0].levels[0];
    assert.match(frozen.teaCriterion, /Ricos|Westgard/i, 'snapshot giữ đúng căn cứ nguồn dự phòng đã dùng');
    const editLegacy = must(sigma.savePeriod({ testId: t.id, period: '2026-09', teaSource: 'lab', levels: [{ level: 1, cv: 1.1, biasEqa: 0 }] }, actor), 'sửa CV kỳ cũ');
    assert.equal(editLegacy.levels[0].tea, 0.73);
    assert.equal(editLegacy.levels[0].teaCriterion, frozen.teaCriterion);
    must(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'lab' } }, actor), 'chọn nguồn còn thiếu');
    const missing = must(sigma.savePeriod({ testId: t.id, period: '2026-10', teaSource: 'lab', levels: [{ level: 1, cv: 1, biasEqa: 0 }] }, actor), 'kỳ thiếu');
    assert.equal(missing.levels[0].tea, null);
    // Tái hiện bản trước đã ghi cờ khóa null trong dữ liệu của người dùng.
    const lockedMissing = JSON.parse(db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(missing.id).lv_json);
    lockedMissing[0].teaLocked = true;
    db.prepare('UPDATE sigma_data SET lv_json=? WHERE id=?').run(JSON.stringify(lockedMissing), missing.id);
    must(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'ricos' } }, actor), 'đổi nguồn ở danh mục');
    assert.equal(sigma.listPeriods(t.id)[1].levels[0].tea, 0.73, 'kỳ còn thiếu nhận được TEa dù bản trước đã khóa null');
    const edited = must(sigma.savePeriod({ testId: t.id, period: '2026-10', teaSource: 'lab', levels: [{ level: 1, cv: 1.2, biasEqa: 0 }] }, actor), 'sửa CV');
    assert.equal(edited.levels[0].tea, 0.73, 'sửa CV không làm mất TEa vừa giải được');
    db.prepare('INSERT INTO sigma_data(id,test_id,period,tea,tea_source,lv_json) VALUES (?,?,?,?,?,?)').run(`${t.id}:2026-11`, t.id, '2026-11', null, 'lab', JSON.stringify(legacyLevel));
    const historyBefore = db.prepare('SELECT * FROM sigma_data ORDER BY id').all();
    const configBefore = db.prepare('SELECT * FROM tests WHERE id=?').get(t.id);
    db.exec("CREATE TRIGGER fail_tea_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END");
    assert.equal(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'clia' } }, actor).ok, false);
    assert.deepEqual(db.prepare('SELECT * FROM sigma_data ORDER BY id').all(), historyBefore, 'lỗi audit không để lại snapshot một phần');
    assert.deepEqual(db.prepare('SELECT * FROM tests WHERE id=?').get(t.id), configBefore, 'nguồn cũng được hoàn nguyên');
  } finally { db.close(); }
});

test('hồi quy khóa null: chọn CLIA tính ngay hai mức theo Mean, giữ snapshot số đã lưu', () => {
  const db = openDatabase(':memory:');
  try {
    const config = createConfigHandlers(db), sigma = createSigmaHandlers(db);
    const machine = must(config.saveInstrument({ data: { name: 'Máy CLIA thiếu TEa' } }, actor), 'máy');
    const t = must(config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: machine.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium', operationalTeaSource: 'lab' } }, actor), 'xét nghiệm');
    for (const [level, mean] of [[1, 140], [2, 200]]) must(config.saveTestLevel({ testId: t.id, data: { level, mean, sd: 2 } }, actor), 'mức');
    const levels = [{ level: 1, targetMean: 140, cv: 1.85, biasEqa: 0.01 }, { level: 2, targetMean: 200, cv: 0.38, biasEqa: 0.02 }];
    const fixed = must(sigma.savePeriod({ testId: t.id, period: '2026-09', teaSource: 'lab', levels: levels.map(level => ({ ...level, tea: 9 })) }, actor), 'kỳ có số');
    const missing = must(sigma.savePeriod({ testId: t.id, period: '2026-11', teaSource: 'lab', levels }, actor), 'kỳ thiếu');
    const oldLocked = JSON.parse(db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(missing.id).lv_json).map(level => ({ ...level, teaLocked: true }));
    db.prepare('UPDATE sigma_data SET lv_json=? WHERE id=?').run(JSON.stringify(oldLocked), missing.id);
    assert.ok(sigma.listPeriods(t.id)[1].levels.every(level => level.tea == null));
    must(sigma.saveTeaConfig({ testId: t.id, source: 'clia' }, actor), 'chọn CLIA');
    const actual = sigma.listPeriods(t.id);
    assert.deepEqual(actual[0], fixed, 'kỳ có snapshot số không đổi');
    assert.ok(Math.abs(actual[1].levels[0].tea - 4 / 140 * 100) < 1e-10);
    assert.equal(actual[1].levels[1].tea, 2);
    assert.deepEqual(actual[1].levels.map(level => level.sigma.sigma.toFixed(2)), ['1.54', '5.21']);
    assert.deepEqual(actual[1].levels.map(level => level.teaConversion), [{ targetMean: 140, unit: 'mmol/L' }, { targetMean: 200, unit: 'mmol/L' }]);
    assert.deepEqual(sigma.listPeriods(t.id), actual, 'nạp lại vẫn tính được dù cờ khóa null cũ còn trong dữ liệu');
  } finally { db.close(); }
});

test('Mean hiển thị theo đúng căn cứ CLIA; snapshot thiếu Mean không mượn cấu hình mới', () => {
  const db = openDatabase(':memory:');
  try {
    const config = createConfigHandlers(db), sigma = createSigmaHandlers(db);
    const machine = must(config.saveInstrument({ data: { name: 'Máy Mean quy đổi' } }, actor), 'máy');
    const t = must(config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: machine.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium', operationalTeaSource: 'clia' } }, actor), 'xét nghiệm');
    must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 140, sd: 2 } }, actor), 'Mean ban đầu');
    const saved = must(sigma.savePeriod({ testId: t.id, period: '2026-10', teaSource: 'clia', levels: [{ level: 1, cv: 1, biasEqa: 0 }] }, actor), 'kỳ CLIA');
    assert.equal(saved.levels[0].targetMean, null, 'không thay Mean snapshot của nghiệp vụ MU');
    assert.deepEqual(saved.levels[0].teaConversion, { targetMean: 140, unit: 'mmol/L' }, 'đọc đúng Mean thực dùng qua bộ giải');
    must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 180, sd: 2 } }, actor), 'Mean hiện hành mới');
    assert.deepEqual(sigma.listPeriods(t.id)[0], saved, 'Mean mới không đổi giá trị hoặc căn cứ của snapshot cũ');
    const levels = JSON.parse(db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(saved.id).lv_json);
    delete levels[0].teaBasis.targetMean;
    db.prepare('UPDATE sigma_data SET lv_json=? WHERE id=?').run(JSON.stringify(levels), saved.id);
    const legacy = sigma.listPeriods(t.id)[0].levels[0];
    assert.equal(legacy.tea, saved.levels[0].tea);
    assert.deepEqual(legacy.teaConversion, { targetMean: null, unit: 'mmol/L' }, 'không suy Mean lịch sử từ 180 đang khai');
  } finally { db.close(); }
});

test('màn Sigma tính lại theo nguồn vận hành dù kỳ đã lưu Ricos; CV/Bias và bản gốc không đổi', () => {
  const db = openDatabase(':memory:');
  try {
    const config = createConfigHandlers(db), sigma = createSigmaHandlers(db);
    const machine = must(config.saveInstrument({ data: { name: 'Máy Sigma động' } }, actor), 'máy');
    const draft = { name: 'Sodium (Na)', instrumentId: machine.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium' };
    const t = must(config.saveTest({ data: { ...draft, operationalTeaSource: 'ricos' } }, actor), 'xét nghiệm');
    for (const [level, mean] of [[1, 140], [2, 200]]) must(config.saveTestLevel({ testId: t.id, data: { level, mean, sd: 2 } }, actor), 'mức');
    const saved = must(sigma.savePeriod({ testId: t.id, period: '2026-11', tea: 0.73, teaSource: 'ricos', levels: [
      { level: 1, tea: 0.73, targetMean: 140, cv: 1.85, biasEqa: 0.01, uCref: 0.1, uCal: 0.1 },
      { level: 2, tea: 0.73, targetMean: 200, cv: 0.38, biasEqa: 0.02, uCref: 0.1, uCal: 0.1 },
    ] }, actor), 'kỳ Ricos');
    const raw = db.prepare('SELECT * FROM sigma_data WHERE id=?').get(saved.id);
    const values = (period) => period.levels.map(level => level.sigma?.sigma.toFixed(2) ?? null);
    assert.deepEqual(values(sigma.listPeriods(t.id, 'operational')[0]), ['0.39', '1.87']);
    must(sigma.saveTeaConfig({ testId: t.id, source: 'clia' }, actor), 'chọn CLIA');
    const live = sigma.listPeriods(t.id, 'operational')[0];
    assert.equal(live.teaSource, 'clia');
    assert.deepEqual(values(live), ['1.54', '5.21']);
    assert.deepEqual(live.levels.map(level => [level.cv, level.biasEqa]), [[1.85, 0.01], [0.38, 0.02]]);
    assert.deepEqual(live.levels.map(level => level.teaConversion), [{ targetMean: 140, unit: 'mmol/L' }, { targetMean: 200, unit: 'mmol/L' }]);
    assert.deepEqual(live.levels.map(level => level.teaSnapshot), [0.73, 0.73], 'payload lưu CV/Bias vẫn nhận snapshot gốc');
    assert.deepEqual(live.savedTea, { tea: 0.73, source: 'ricos' });
    assert.notEqual(live.levels[1].mu.teaRatio, saved.levels[1].mu.teaRatio, 'MU so với TEa cũng cập nhật');
    assert.deepEqual(sigma.listPeriods(t.id)[0], saved, 'lịch sử đọc theo bản đã lưu vẫn giữ nguyên');
    assert.deepEqual(db.prepare('SELECT * FROM sigma_data WHERE id=?').get(saved.id), raw, 'đổi cách tính trên màn hình không sửa dữ liệu kỳ');
    must(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'lab' } }, actor), 'chọn PXN chưa có giá trị');
    const missing = sigma.listPeriods(t.id, 'operational')[0];
    assert.equal(missing.teaSource, 'lab');
    assert.ok(missing.levels.every(level => level.tea == null && level.sigma == null), 'nguồn đang chọn thiếu thì báo thiếu, không giữ kết quả Ricos/CLIA');
    must(config.saveTest({ id: t.id, data: { ...draft, operationalTeaSource: 'ricos' } }, actor), 'đổi ở danh mục');
    assert.deepEqual(values(sigma.listPeriods(t.id, 'operational')[0]), ['0.39', '1.87'], 'đổi ở danh mục cũng cập nhật phép tính');
    assert.deepEqual(db.prepare('SELECT * FROM sigma_data WHERE id=?').get(saved.id), raw);
  } finally { db.close(); }
});

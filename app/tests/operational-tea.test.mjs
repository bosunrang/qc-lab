// TEa vận hành (2026-11-03): cổng Bias khi lập dải, cột "Trong TEa" của ngoại
// kiểm và mục TEa ở danh mục xét nghiệm dùng chung một thứ tự nguồn — hồ sơ
// TEa của PXN (theo mức, rồi TEa chung), rồi nguồn PXN đã chọn ở trang Six
// Sigma, rồi báo thiếu. Không bao giờ lấy `tests.tea`: ô đó từng được chép
// một lần từ gợi ý danh mục (Natri 0,73% Ricos) nên lệch với TEa PXN dùng.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';
import { hasLabTea, MISSING_LAB_TEA_NOTE, operationalTeaSummary, resolveOperationalTea } from '../main/domain/sigma-tea-core.ts';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');

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

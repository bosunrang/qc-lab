// Cong tac "Xem lo cu" tren trang Phan tich Westgard:
// `westgard:listPreviousLotBlocks` phai chi ra DUNG lo cu tren chuoi chuyen
// tiep DA CHAP NHAN, voi Mean/SD cua chinh lo do, va danh gia lai theo bo luat
// dang bat hien nay.
//
// Diem quan trong nhat cua bai nay KHONG phai ban than handler moi ma la tinh
// DOI XUNG voi trang Nhap QC: hai trang deu cho bam "Xem lo cu", nen phai chi
// ra cung mot lo va cung mot Mean/SD. Truoc khi tach `db/lot-lineage.ts`, moi
// handler tu di chuoi chuyen tiep bang SQL rieng - dung lop lech ma dot 11/09
// vua di go o `operational-levels`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-v2-dist/main/ipc/westgard-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };

/** 1 xet nghiem 1 muc, lo CU da duoc chuyen tiep sang lo MOI (ho so
 * `accepted`), moi lo co diem QC rieng va Mean/SD rieng. */
function scenario() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;

  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', test.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g1','Nhom A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lOld','g1','OLD-1',1),('lNew','g1','NEW-1',1)").run();

  // Muc dang dung lo MOI (Mean 100/SD 2); lich su chot lai Mean/SD cua lo CU.
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2, qcLotId: 'lNew' } }, actor);
  db.prepare('UPDATE test_levels SET mean_sd_history_json=? WHERE test_id=? AND level=1')
    .run(JSON.stringify([{ at: '2026-07-01T00:00:00.000Z', qcLotId: 'lOld', mean: 200, sd: 4 }]), test.id);

  db.prepare(`INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,status,start_date,approved_at)
    VALUES ('tr1','p1','lOld','lNew','accepted','2026-07-01','2026-07-01T00:00:00.000Z')`).run();

  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  // Lo CU: 1 diem binh thuong + 1 diem lech >3SD (200 + 3.5*4 = 214) -> 1-3s.
  ins.run('o1', test.id, 1, '2026-06-01', '2026-06-01-1', 200, 'OLD-1', 200, 4);
  ins.run('o2', test.id, 1, '2026-06-02', '2026-06-02-1', 214, 'OLD-1', 200, 4);
  // Lo MOI: 1 diem dat.
  ins.run('n1', test.id, 1, '2026-07-02', '2026-07-02-1', 101, 'NEW-1', 100, 2);
  return { db, test, westgard: createWestgardHandlers(db), entry: createEntryHandlers(db) };
}

// 1) Khoi lo cu co dung lo, dung Mean/SD cua lo do, va danh gia THAT su chay.
{
  const { westgard, test } = scenario();
  const blocks = westgard.listPreviousLotBlocks(test.id);
  assert.equal(blocks.length, 1, 'dung 1 lo cu tren chuoi chuyen tiep');
  const [block] = blocks;
  assert.equal(block.level, 1);
  assert.equal(block.lotNo, 'OLD-1');
  assert.equal(block.mean, 200, 'Mean phai la cua LO CU, khong phai muc hien hanh');
  assert.equal(block.sd, 4);
  assert.equal(block.analysis.points.length, 2, 'chi diem cua lo cu');
  assert.deepEqual(block.analysis.points.map((p) => p.id), ['o1', 'o2']);
  // Diem lech 3.5SD phai bi ket luan loai bo theo 1-3s, kem z dung dau.
  const flagged = block.analysis.points[1];
  assert.equal(flagged.verdict, 'rej');
  assert.ok(flagged.rules.includes('1-3s'), `mong doi 1-3s, nhan duoc ${flagged.rules}`);
  assert.ok(Math.abs(flagged.z - 3.5) < 1e-9, `z phai tinh theo Mean/SD lo cu, nhan duoc ${flagged.z}`);
  // Cot "Loai sai so" phai co noi dung - day la ly do dung ArchivedBlock thay
  // vi PreviousLotSeries (chi co verdict + rules).
  assert.equal(flagged.errorType, 'RE — Sai số ngẫu nhiên');
  assert.notEqual(flagged.errorDesc, '');
  // CUSUM khong ap dung cho lo da ngung chay.
  assert.equal(block.analysis.cusumOn, false);
}

// 2) DOI XUNG voi trang Nhap QC: cung lo, cung Mean/SD, cung tap diem.
{
  const { westgard, entry, test } = scenario();
  const blocks = westgard.listPreviousLotBlocks(test.id);
  const series = entry.listPreviousLotSeries(test.id);
  assert.equal(blocks.length, series.length, 'hai trang phai thay cung so chuoi lo cu');
  for (const [index, block] of blocks.entries()) {
    const item = series[index];
    assert.equal(block.lotId, item.lotId, 'cung lo cu');
    assert.equal(block.lotNo, item.lot);
    assert.equal(block.mean, item.mean, 'cung Mean cho lo cu');
    assert.equal(block.sd, item.sd, 'cung SD cho lo cu');
    assert.deepEqual(block.analysis.points.map((p) => p.id), item.points.map((p) => p.id), 'cung tap diem');
    assert.deepEqual(block.analysis.points.map((p) => p.verdict), item.points.map((p) => p.verdict), 'cung ket luan');
  }
}

// 3) Ho so chuyen tiep CHUA duoc chap nhan thi khong co lo cu nao - cong tac
//    "Xem lo cu" khong duoc hien.
for (const status of ['planned', 'active', 'rejected']) {
  const { db, westgard, test } = scenario();
  db.prepare('UPDATE lot_transitions SET status=? WHERE id=?').run(status, 'tr1');
  assert.deepEqual(westgard.listPreviousLotBlocks(test.id), [],
    `ho so trang thai "${status}" chua tao ra lo cu`);
}

// 4) Muc khong con van hanh (nhom lo da dung) thi khong con chuoi lo cu nao -
//    cung tap "muc dang van hanh" voi moi noi khac (db/operational-levels.ts).
{
  const { db, westgard, test } = scenario();
  db.prepare("UPDATE lot_groups SET status='stopped' WHERE id='g1'").run();
  assert.deepEqual(westgard.listPreviousLotBlocks(test.id), []);
}

// 5) Lo cu khong tra duoc Mean/SD hop le thi bo qua (khong ve mot khoi rong).
{
  const { db, westgard, test } = scenario();
  db.prepare("UPDATE test_levels SET mean_sd_history_json='[]' WHERE test_id=?").run(test.id);
  // Van con fallback snapshot tren diem -> khoi cu the van dung.
  assert.equal(westgard.listPreviousLotBlocks(test.id)[0].mean, 200, 'fallback snapshot tren diem');
  db.prepare("UPDATE qc_points SET qc_mean=NULL, qc_sd=NULL WHERE lot='OLD-1'").run();
  assert.deepEqual(westgard.listPreviousLotBlocks(test.id), [], 'het nguon Mean/SD thi bo qua');
}

console.log('app-v2 Westgard previous-lot blocks tests passed');

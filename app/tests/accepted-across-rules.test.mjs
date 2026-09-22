// Chuỗi điểm ĐƯỢC CHẤP NHẬN phải tính cả luật LIÊN MỨC.
//
// `acceptedPoints()` chỉ quét được luật TỪNG MỨC (nó nhận một chuỗi điểm của
// một mức). Trước 2026-09-11, `analyzeLevel()` gọi nó với đúng `active.within`
// nên một điểm bị loại CHỈ bởi luật liên mức (R4s, hoặc 2-2s/2of3-2s/3-1s khi
// chạy ở phạm vi across) không bao giờ được xét: object trả về tự mâu thuẫn
// (`verdict: 'rej'` kèm `accepted: true`), và điểm đó vẫn vào biểu đồ
// Levey-Jennings lẫn thống kê Mean/SD/CV thực của trang Nhập QC.
//
// App cũ có cùng lỗ hổng (`acceptedLotPoints()` cũng chỉ nhận tập luật
// `within`), nên đây là lệch golden master CÓ CHỦ ĐÍCH.
//
// Từ 22/09/2026: thống kê dùng cùng kết luận với bảng, loại toàn bộ run.
// Chỉ bắt đầu chuỗi luật mới sau mốc khắc phục đã duyệt và xác nhận hiệu quả.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };

/** 1 xét nghiệm 2 mức, cùng Panel QC + nhóm lô đang vận hành (điều kiện để
 * `activeLevels()` nhận cả hai mức, xem westgard-active-levels.test.mjs).
 * `runs` là mảng [zMức1, zMức2] theo từng lần chạy. Ghi điểm THẲNG vào bảng
 * để dựng được cả kịch bản mà `addPoint()` sẽ chặn. */
function scenario(runs) {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
  config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 200, sd: 4 } }, actor);

  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', test.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g','Nhom',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('l1','g','L1',1),('l2','g','L2',2)").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='l1' WHERE test_id=? AND level=1").run(test.id);
  db.prepare("UPDATE test_levels SET qc_lot_id='l2' WHERE test_id=? AND level=2").run(test.id);

  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  const target = [{ mean: 100, sd: 2, lot: 'L1' }, { mean: 200, sd: 4, lot: 'L2' }];
  runs.forEach(([z1, z2], r) => {
    const date = `2026-08-${String(r + 1).padStart(2, '0')}`;
    [z1, z2].forEach((z, idx) => {
      if (z == null) return;
      const t = target[idx];
      ins.run(`L${idx + 1}r${r}`, test.id, idx + 1, date, `run${r}`, t.mean + z * t.sd, t.lot, t.mean, t.sd);
    });
  });
  return { db, test, westgard: createWestgardHandlers(db) };
}

const byId = (analysis) => Object.fromEntries(analysis.points.map((p) => [p.id, p]));

// 1) R4s — luật LIÊN MỨC THUẦN (scope 'across', không bao giờ nằm trong
//    `within`), nên trước đây `acceptedPoints()` không có cách nào thấy nó.
{
  const { westgard, test } = scenario([[2.5, -2.5]]);
  const p = byId(westgard.analyzeLevel(test.id, 1))['L1r0'];
  assert.deepEqual(p.rules, ['1-2s', 'R4s'], 'đối chứng: dữ liệu đủ điều kiện nổ R4s');
  assert.equal(p.verdict, 'rej');
  assert.equal(p.accepted, false, 'điểm bị R4s loại KHÔNG được vào chuỗi chấp nhận');
  // Mức 2 cũng bị chính R4s đó loại.
  const q = byId(westgard.analyzeLevel(test.id, 2))['L2r0'];
  assert.equal(q.verdict, 'rej');
  assert.equal(q.accepted, false, 'cả hai mức của lần chạy bị loại');
}

// 2) 2-2s ở phạm vi across — luật scope 'both': CÓ nằm trong `within`, nhưng
//    trong chuỗi một mức chỉ có 1 điểm nên nhánh within không thể nổ; chỉ
//    nhánh liên mức thấy được. Đây là biến thể dễ bỏ sót nhất.
{
  const { westgard, test } = scenario([[2.5, 2.5]]);
  const p = byId(westgard.analyzeLevel(test.id, 1))['L1r0'];
  assert.deepEqual(p.rules, ['1-2s', '2-2s'], 'đối chứng: 2 mức cùng phía vượt 2SD trong một lần chạy');
  assert.equal(p.verdict, 'rej');
  assert.equal(p.accepted, false, '2-2s liên mức cũng phải loại điểm khỏi chuỗi');
}

// 3) Đối chứng ngược: chỉ CẢNH BÁO thì vẫn được chấp nhận — bản sửa không
//    được loại nhầm mọi điểm có luật.
{
  const { westgard, test } = scenario([[2.1, 0]]);
  const p = byId(westgard.analyzeLevel(test.id, 1))['L1r0'];
  assert.deepEqual(p.rules, ['1-2s']);
  assert.equal(p.verdict, 'warn');
  assert.equal(p.accepted, true, '1-2s chỉ cảnh báo, điểm vẫn vào chuỗi');
}
{
  const { westgard, test } = scenario([[0, 0], [0.5, -0.5]]);
  const points = westgard.analyzeLevel(test.id, 1).points;
  assert.deepEqual(points.map((p) => p.accepted), [true, true], 'chuỗi sạch thì không loại điểm nào');
}

// 4) Chưa có mốc khắc phục: không tự bỏ điểm vi phạm khỏi cửa sổ để
//    nhận lại lần chạy sau. Verdict và accepted phải nhất quán.
{
  const { westgard, test } = scenario([[0, 0], [2.5, -2.5], [2.2, 0]]);
  const p = byId(westgard.analyzeLevel(test.id, 1));
  assert.equal(p['L1r0'].accepted, true);
  assert.equal(p['L1r1'].accepted, false, 'điểm của lần chạy bị R4s loại');
  assert.equal(p['L1r2'].accepted, false, 'điểm vẫn bị 2-2s loại khi chưa có khắc phục hiệu quả');
  assert.equal(p['L1r2'].verdict, 'rej');
  assert.deepEqual(p['L1r2'].rules, ['1-2s', '2-2s']);
}

// 5) Mức chưa có Mean/SD: không đánh giá được thì không kết luận gì.
{
  const { westgard, test, db } = scenario([[0, 0]]);
  db.prepare('UPDATE test_levels SET mean=NULL, sd=NULL WHERE test_id=? AND level=1').run(test.id);
  const p = byId(createWestgardHandlers(db).analyzeLevel(test.id, 1))['L1r0'];
  assert.equal(p.verdict, 'none');
  assert.equal(p.accepted, false, 'chưa đánh giá được thì không gắn accepted');
  void westgard;
}

console.log('app: chuỗi chấp nhận tính cả luật liên mức — tests passed');

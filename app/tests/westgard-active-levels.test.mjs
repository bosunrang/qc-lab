// Kiểm chứng end-to-end ĐẦU VÀO của engine Westgard: đúng những mức QC nào
// được đưa vào `combinedWestgardByPoint()`.
//
// Không phải chuyện lọc danh sách cho gọn: tập mức này là đầu vào của đánh giá
// LIÊN MỨC (cùng `run_id`) và số lượng mức quyết định một luật chạy ở phạm vi
// within hay across (`makeScopeOf`). Trước 2026-09-10 `activeLevels()` trả MỌI
// dòng `test_levels`, nên một mức thuộc nhóm lô ĐÃ DỪNG vẫn kéo vào và làm
// điểm của mức đang chạy nổ `2-2s` → "Loại bỏ", trong khi app cũ
// (`operationalLevels()` + `qcOperationalAccess.lotPoints()`) chỉ cảnh báo
// `1-2s`. Đây là lệch KẾT LUẬN, không phải lệch hiển thị.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };

/** Dựng 1 xét nghiệm 2 mức, mỗi mức 1 nhóm lô riêng, cùng 1 lần chạy có cả
 * hai mức lệch +2,5SD cùng chiều (điều kiện của 2-2s liên mức). Ghi điểm
 * THẲNG vào bảng: cổng `addPoint()` sẽ chặn mức không vận hành, mà ở đây cần
 * dữ liệu đã tồn tại (di trú, hoặc nhóm lô bị dừng SAU khi đã nhập). */
function scenario({ groupBStatus, groupBActive = 1, panelActive = 1 }) {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
  config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 200, sd: 4 } }, actor);

  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,?)').run('p1', 'Panel', inst.id, panelActive);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', test.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('gA','Nhom A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lA1','gA','A1',1),('lA2','gA','A2',1)").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='lA1' WHERE test_id=? AND level=1").run(test.id);
  db.prepare('INSERT INTO lot_groups(id,name,active,status) VALUES (?,?,?,?)').run('gB', 'Nhom B', groupBActive, groupBStatus);
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lB1','gB','B1',2),('lB2','gB','B2',2)").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='lB1' WHERE test_id=? AND level=2").run(test.id);

  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  ins.run('pt1', test.id, 1, '2026-08-01', '2026-08-01-1', 105, 'A1', 100, 2);
  ins.run('pt2', test.id, 2, '2026-08-01', '2026-08-01-1', 210, 'B1', 200, 4);
  return { db, test, westgard: createWestgardHandlers(db) };
}

// 1) Nhóm lô của mức 2 CÒN vận hành → 2-2s liên mức nổ đúng (đối chứng: chứng
//    minh dữ liệu thật sự đủ điều kiện nổ luật, nên các nhánh dưới không phải
//    "không nổ vì thiếu dữ liệu").
{
  const { westgard, test } = scenario({ groupBStatus: '' });
  const analysis = westgard.analyzeLevel(test.id, 1);
  assert.equal(analysis.points[0].verdict, 'rej');
  assert.deepEqual(analysis.points[0].rules, ['1-2s', '2-2s']);
  assert.equal(westgard.listTestSummaries()[0].levels.length, 2);
}

// 2) Nhóm lô của mức 2 ĐÃ DỪNG → mức đó rời khỏi cả tổng quan lẫn đánh giá
//    liên mức; điểm mức 1 chỉ còn cảnh báo 1-2s.
for (const state of [{ groupBStatus: 'stopped' }, { groupBStatus: 'planned' }, { groupBStatus: '', groupBActive: 0 }]) {
  const { westgard, test } = scenario(state);
  const analysis = westgard.analyzeLevel(test.id, 1);
  assert.equal(analysis.points[0].verdict, 'warn', `nhóm lô không vận hành không được đổi kết luận (${JSON.stringify(state)})`);
  assert.deepEqual(analysis.points[0].rules, ['1-2s']);
  const levels = westgard.listTestSummaries()[0].levels;
  assert.equal(levels.length, 1, 'chỉ mức đang vận hành vào tổng quan');
  assert.equal(levels[0].level, 1);
  // Mức đã bị loại thì `analyzeLevel` trả rỗng, không ném lỗi.
  assert.deepEqual(westgard.analyzeLevel(test.id, 2).points, []);
}

// 3) Xét nghiệm KHÔNG nằm trong Panel QC đang hoạt động: app cũ vẫn giữ mức
//    trong danh sách nhưng `lotPoints()` trả rỗng, nên tổng quan hiện mức với
//    0 điểm thay vì biến mất — giữ đúng sự phân biệt đó.
{
  const { westgard, test } = scenario({ groupBStatus: '', panelActive: 0 });
  const levels = westgard.listTestSummaries()[0].levels;
  assert.equal(levels.length, 2, 'Panel tắt không xoá mức khỏi danh sách');
  assert.deepEqual(levels.map((lv) => lv.pointCount), [0, 0], 'Panel tắt thì không điểm nào được đánh giá');
  assert.deepEqual(westgard.analyzeLevel(test.id, 1).points, []);
}

// 4) Mức chưa gán lô (hoặc lô chưa thuộc nhóm nào) không phải mức vận hành.
{
  const { db, westgard, test } = scenario({ groupBStatus: '' });
  db.prepare('UPDATE test_levels SET qc_lot_id=NULL WHERE test_id=? AND level=2').run(test.id);
  assert.deepEqual(westgard.listTestSummaries()[0].levels.map((lv) => lv.level), [1]);
  db.prepare("UPDATE qc_lots SET group_id=NULL WHERE id='lA1'").run();
  assert.deepEqual(westgard.listTestSummaries()[0].levels, [], 'lô không thuộc nhóm nào thì mức không vận hành');
}

console.log('app westgard active-levels end-to-end tests passed');

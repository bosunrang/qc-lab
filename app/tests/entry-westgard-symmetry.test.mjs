// ĐỐI XỨNG Entry ↔ Westgard: cùng một điểm QC phải nhận cùng một kết luận ở
// trang Nhập QC và trang Phân tích Westgard.
//
// Vì sao cần một bài test RIÊNG thay vì mở rộng `westgard-active-levels.test.mjs`:
// bài đó chỉ gọi `westgard-handlers`, nên khi bản sửa 2026-09-10 chỉ vá phía
// Westgard mà bỏ quên `entry-handlers.activeEvaluation()` (vẫn đọc MỌI dòng
// `test_levels`), toàn bộ 75/75 test vẫn xanh trong khi hai trang đang cho hai
// kết luận khác nhau. Một bài test chỉ soi MỘT phía không bao giờ bắt được
// lệch giữa HAI phía — đây chính là đề nghị "thêm test đối xứng Entry ↔
// Westgard" trong docs/validation/SIGMA-WESTGARD-AUDIT-2026-09-10.md.
//
// Bài này KHÔNG khoá một verdict cụ thể là 'rej' hay 'warn' (đó là việc của
// westgard-standard/westgard-active-levels); nó khoá tính CHẤT: hai đường đọc
// luôn khớp nhau, trên mọi trạng thái nhóm lô / Panel.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };

/** 1 xét nghiệm 2 mức, mỗi mức một nhóm lô riêng, cùng MỘT lần chạy có cả hai
 * mức lệch +2,5SD cùng chiều — đủ điều kiện nổ `2-2s` LIÊN MỨC, tức kết luận
 * của mức 1 phụ thuộc việc mức 2 có được coi là đang vận hành hay không.
 * Ghi điểm thẳng vào bảng: cổng `addPoint()` chặn mức không vận hành, mà ở
 * đây cần dữ liệu đã tồn tại sẵn (nhóm lô bị dừng SAU khi đã nhập, hoặc dữ
 * liệu di trú). */
function scenario({ groupBStatus = '', groupBActive = 1, panelActive = 1 } = {}) {
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
  return { db, test, westgard: createWestgardHandlers(db), entry: createEntryHandlers(db) };
}

/** So kết luận của CÙNG một điểm qua hai đường đọc, cho mọi mức đang có. */
function assertSymmetric({ westgard, entry, test }, label) {
  const summaries = westgard.listTestSummaries().find((s) => s.testId === test.id);
  for (const level of [1, 2]) {
    const wgPoints = westgard.analyzeLevel(test.id, level).points;
    const entryPoints = entry.queryPoints(test.id, level);
    assert.equal(entryPoints.length, wgPoints.length, `${label} · mức ${level}: số điểm được đánh giá phải khớp`);
    for (const [index, wgPoint] of wgPoints.entries()) {
      const entryPoint = entryPoints[index];
      assert.equal(entryPoint.id, wgPoint.id, `${label} · mức ${level}: cùng thứ tự điểm`);
      // `verdict === 'none'` (mức chưa có Mean/SD) chỉ tồn tại ở hợp đồng của
      // Westgard; Entry biểu diễn cùng trạng thái đó bằng 'ok' + rỗng luật.
      const wgVerdict = wgPoint.verdict === 'none' ? 'ok' : wgPoint.verdict;
      assert.equal(entryPoint.verdict, wgVerdict, `${label} · mức ${level}: verdict phải khớp giữa Nhập QC và Westgard`);
      assert.deepEqual(entryPoint.rules, wgPoint.rules, `${label} · mức ${level}: danh sách luật phải khớp`);
    }
    // Cây điều hướng trang Nhập QC đọc `listTestSummaries()`, còn bảng
    // worksheet cùng màn hình đọc `queryPoints()` — hai nguồn này cũng phải
    // nói cùng một chuyện, nếu không một màn hình tự mâu thuẫn với chính nó.
    const levelSummary = summaries?.levels.find((lv) => lv.level === level);
    if (levelSummary) {
      assert.equal(levelSummary.pointCount, entryPoints.length,
        `${label} · mức ${level}: số điểm ở cây điều hướng phải khớp bảng worksheet`);
    } else {
      assert.equal(entryPoints.length, 0,
        `${label} · mức ${level}: mức không vào tổng quan thì worksheet cũng không được đánh giá điểm nào`);
    }
  }
}

// 1) ĐỐI CHỨNG — cả hai mức còn vận hành: `2-2s` liên mức nổ thật. Thiếu
//    nhánh này thì một cài đặt luôn trả rỗng ở cả hai phía cũng "đối xứng".
{
  const s = scenario();
  const point = s.westgard.analyzeLevel(s.test.id, 1).points[0];
  assert.equal(point.verdict, 'rej');
  assert.deepEqual(point.rules, ['1-2s', '2-2s']);
  assertSymmetric(s, 'cả hai nhóm lô đang vận hành');
}

// 2) Nhóm lô của mức 2 không còn vận hành (3 nhánh) — mức đó phải rời khỏi
//    đánh giá liên mức ở CẢ HAI trang, nên mức 1 chỉ còn cảnh báo `1-2s`.
//    Đây chính là ca lệch đo được trước bản sửa: Entry `rej [1-2s,2-2s]` vs
//    Westgard `warn [1-2s]`.
for (const state of [{ groupBStatus: 'stopped' }, { groupBStatus: 'planned' }, { groupBStatus: '', groupBActive: 0 }]) {
  const label = `nhóm lô mức 2 = ${JSON.stringify(state)}`;
  const s = scenario(state);
  const point = s.entry.queryPoints(s.test.id, 1)[0];
  assert.equal(point.verdict, 'warn', `${label}: nhóm lô không vận hành không được đổi kết luận của Nhập QC`);
  assert.deepEqual(point.rules, ['1-2s'], label);
  assertSymmetric(s, label);
}

// 3) Panel QC tắt: app cũ giữ mức trong danh sách nhưng không đánh giá điểm
//    nào. Trước bản sửa, cây Nhập QC nói "0 điểm / Đạt" trong khi bảng
//    worksheet cùng màn hình vẫn chấm "Loại bỏ".
{
  const s = scenario({ panelActive: 0 });
  assert.deepEqual(s.entry.queryPoints(s.test.id, 1), [], 'Panel tắt thì Nhập QC không đánh giá điểm nào');
  assertSymmetric(s, 'Panel QC đã tắt');
}

// 4) Mức chưa gán lô không phải mức vận hành ở cả hai trang.
{
  const s = scenario();
  s.db.prepare('UPDATE test_levels SET qc_lot_id=NULL WHERE test_id=? AND level=2').run(s.test.id);
  assert.deepEqual(s.entry.queryPoints(s.test.id, 2), [], 'mức chưa gán lô không có điểm nào được đánh giá');
  assertSymmetric(s, 'mức 2 chưa gán lô');
}

// 5) Hai endpoint phụ của Entry (cột lô song song, chuỗi lô cũ) cũng phải suy
//    phạm vi luật từ SỐ mức đang vận hành, không phải mọi dòng `test_levels`.
//    Ở đây chưa có hồ sơ chuyển tiếp nào nên cả hai trả rỗng; điều cần khoá là
//    chúng không ném lỗi và không tự dựng lại một tập mức khác.
{
  const s = scenario({ groupBStatus: 'stopped' });
  assert.deepEqual(s.entry.listParallelColumns(s.test.id), []);
  assert.deepEqual(s.entry.listPreviousLotSeries(s.test.id), []);
}

console.log('app Entry ↔ Westgard symmetry tests passed');

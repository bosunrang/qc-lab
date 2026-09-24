// Thẻ Nhập QC + biểu đồ Levey-Jennings — khoá ba quyết định của đợt rà soát
// 2026-09-23. Cả ba đều thuộc lớp lỗi "hai nửa của cùng một màn hình nói hai
// chuyện khác nhau về CÙNG một điểm QC", đúng lớp lỗi mà snapshot Mean/SD
// từng điểm và `db/operational-levels.ts` được sinh ra để chặn.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };

/** 1 xét nghiệm 2 mức; mức 2 gắn lô thuộc nhóm ĐÃ DỪNG (trạng thái có thật:
 * nhóm bị dừng SAU khi đã nhập, hoặc sau khi chuyển lô). Mức 1 vẫn vận hành
 * nên xét nghiệm vẫn hiện trong cây Nhập QC. */
function labWithStoppedLevel() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
  config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 200, sd: 4 } }, actor);
  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', test.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('gA','Nhom A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lA1','gA','A1',1)").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='lA1' WHERE test_id=? AND level=1").run(test.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('gB','Nhom B',1,'stopped')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lB1','gB','B1',2)").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='lB1' WHERE test_id=? AND level=2").run(test.id);
  return { db, test, config, entry: createEntryHandlers(db) };
}

/** 1 xét nghiệm, HAI mức đều đang vận hành và cùng nhóm lô — nền cho các ca
 * "lần chạy bị loại kéo theo mức còn lại". */
function twoOperationalLevels() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
  config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 200, sd: 4 } }, actor);
  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', test.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('gA','Nhom A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lA1','gA','A1',1),('lA2','gA','A2',2)").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='lA1' WHERE test_id=? AND level=1").run(test.id);
  db.prepare("UPDATE test_levels SET qc_lot_id='lA2' WHERE test_id=? AND level=2").run(test.id);
  return { db, test, config, entry: createEntryHandlers(db) };
}

test('EN01: mức thuộc nhóm lô đã dừng bị bảng nhập loại khỏi danh sách cột', () => {
  const { test: subject, config, entry } = labWithStoppedLevel();
  const levels = config.listTestLevels(subject.id);
  // Hợp đồng: danh sách trả VỀ ĐỦ (Bảng Mean/SD và Lịch sử cần mức đã dừng),
  // cờ `operational` mới là thứ thẻ Nhập QC phải lọc theo.
  assert.deepEqual(levels.map((l) => [l.level, l.operational]), [[1, 1], [2, 0]]);
  // Cổng ghi chặn mức đó, và nguồn đọc cũng không trả điểm nào — nên một cột
  // nhập dựng cho mức này chỉ có thể là một cột chết.
  const saved = entry.addPoint({ data: { testId: subject.id, level: 2, date: '2026-09-01', val: 200 } }, actor);
  assert.equal(saved.ok, false);
  assert.equal(saved.error.code, 'level-not-operational');
  assert.equal(entry.queryPoints(subject.id, 2).length, 0);

  // Bên renderer, `EntryPage` phải lọc theo đúng cờ đó TRƯỚC khi dựng cột —
  // `levels.length` còn là mẫu số của vệt cam "ngày còn thiếu" ở `rowClass()`.
  const page = readFileSync(new URL('../renderer/pages/EntryPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /allLevels\.filter\(\(l\) => l\.operational !== 0\)/);
  assert.match(page, /const levels = useMemo\(/);
});

test('EN02: luật cảnh báo đi kèm không bị xếp vào cột "Vi phạm loại bỏ"', () => {
  const { db, test: subject, entry } = labWithStoppedLevel();
  // Hai lần chạy cùng mức, cùng phía, đều vượt +2SD → `2-2s` (loại bỏ) nổ ở
  // điểm sau, và `1-2s` (cảnh báo) cũng nổ ở cả hai điểm.
  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  insert.run('p1', subject.id, 1, '2026-09-01', '2026-09-01-1', 105, 'A1', 100, 2);
  insert.run('p2', subject.id, 1, '2026-09-02', '2026-09-02-1', 105, 'A1', 100, 2);
  const points = entry.queryPoints(subject.id, 1);
  const last = points.at(-1);
  assert.equal(last.verdict, 'rej');
  assert.deepEqual([...last.rules].sort(), ['1-2s', '2-2s']);
  // Đây là cái khoá: `rejectRules` chỉ giữ luật THẬT SỰ gây loại bỏ.
  assert.deepEqual(last.rejectRules, ['2-2s']);
  assert.deepEqual(points[0].rejectRules, [], 'điểm chỉ cảnh báo không có luật loại bỏ nào');
});

test('EN03: hạ 2-2s xuống "Cảnh báo" cho riêng xét nghiệm thì không còn luật loại bỏ nào', () => {
  const { db, test: subject, entry } = labWithStoppedLevel();
  // Ghi đè theo TỪNG xét nghiệm — `rejectRules` phải đi qua đúng phép phân
  // giải 3 lớp, không phải cờ `alert` thô của registry.
  db.prepare('UPDATE tests SET rule_actions_json=? WHERE id=?').run(JSON.stringify({ '2-2s': 'alert' }), subject.id);
  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  insert.run('p1', subject.id, 1, '2026-09-01', '2026-09-01-1', 105, 'A1', 100, 2);
  insert.run('p2', subject.id, 1, '2026-09-02', '2026-09-02-1', 105, 'A1', 100, 2);
  const last = entry.queryPoints(subject.id, 1).at(-1);
  assert.equal(last.verdict, 'warn');
  assert.ok(last.rules.includes('2-2s'));
  assert.deepEqual(last.rejectRules, []);
});

/** Nạp đúng phần hình học + `drawLJ` của QcChart.tsx vào một sandbox, giống
 * cách `westgard-view.test.mjs` chạy `drawMulti` — biểu đồ nằm trọn trong
 * bitmap canvas nên không gate DOM nào nhìn thấy nó. */
function drawLjCircles(points, mean, sd) {
  const source = readFileSync(new URL('../renderer/components/QcChart.tsx', import.meta.url), 'utf8');
  const section = [
    source.slice(source.indexOf('function isRunCollateral('), source.indexOf('export interface QcChartCusum')),
    source.slice(source.indexOf('function geometry('), source.indexOf('const MULTI_COLORS')),
  ].join('\n');
  const LJ = { okBand: 'band', okMid: 'band', warnBand: 'band', rejectBand: 'band', grid: 'grid', mean: 'mean', line: 'line', okPoint: 'OK', warnPoint: 'WARN', rejectPoint: 'REJ' };
  const context = vm.createContext({ vnDayMonth: (date) => date, LJ, BANDS: [] });
  vm.runInContext(stripTypeScriptTypes(section), context);
  const circles = [];
  const pen = { fillStyle: null, strokeStyle: null };
  // `drawLJ` đặt `fillStyle` TRƯỚC `arc()` rồi mới đặt `strokeStyle` và gọi
  // `stroke()`, nên viền phải ghi lại ở đúng lúc vẽ viền — đọc `strokeStyle`
  // ngay tại `arc()` chỉ bắt được màu của đường kẻ lưới vẽ trước đó.
  const canvas = new Proxy({}, {
    get: (_, key) => key === 'arc' ? (x, y) => circles.push({ x, y, fill: pen.fillStyle, stroke: null })
      : key === 'stroke' ? () => { const last = circles.at(-1); if (last && last.stroke === null) last.stroke = pen.strokeStyle; }
      : key === 'measureText' ? () => ({ width: 20 }) : () => {},
    set: (_, key, value) => { if (key in pen) pen[key] = value; return true; },
  });
  context.drawLJ(canvas, 1000, 300, points, mean, sd, 2);
  return { circles, geometry: context.geometry(1000, 300, points.length, mean, sd) };
}

test('EN04: điểm cũ được vẽ theo z đã chốt, không theo Mean/SD hiện hành', () => {
  // Kịch bản thật: sau "Thiết lập dải PXN", dải đang dùng là Mean=100/SD=2.
  // Điểm cũ có giá trị ĐÚNG BẰNG 100 nhưng thuộc dải cũ (Mean=95/SD=2) nên z
  // thật của nó là +2,5 — engine kết luận Cảnh báo/Loại bỏ theo z đó.
  const point = { date: '2026-09-01', runId: 'r1', val: 100, z: 2.5, verdict: 'warn', rules: ['1-2s'] };
  const { circles, geometry } = drawLjCircles([point], 100, 2);
  assert.equal(circles.length, 1);
  // Vẽ theo `val` thì chấm nằm đúng đường Mean; phải nằm HẲN phía trên (y nhỏ
  // hơn), tại đúng +2,5SD của thang đang hiển thị.
  assert.ok(circles[0].y < geometry.y(100) - 1, 'chấm không được rơi vào đường Mean');
  assert.ok(Math.abs(circles[0].y - geometry.y(105)) < 0.5, 'chấm phải nằm ở +2,5SD theo z đã chốt');
});

test('EN05: điểm của dải đang dùng vẫn nằm đúng giá trị thật của nó', () => {
  // Không có đổi dải: z khớp với (val − mean)/sd, nên hai cách vẽ trùng nhau.
  const point = { date: '2026-09-01', runId: 'r1', val: 103, z: 1.5, verdict: 'ok', rules: [] };
  const { circles, geometry } = drawLjCircles([point], 100, 2);
  assert.ok(Math.abs(circles[0].y - geometry.y(103)) < 0.5);
});

test('EN06: tooltip và Z của bảng đọc Mean/SD đã chốt, không phải dải hiện hành', () => {
  const chart = readFileSync(new URL('../renderer/components/QcChart.tsx', import.meta.url), 'utf8');
  // Hit-test hover phải dùng CHUNG `plotValue()` với hàm vẽ, nếu không vùng
  // bắt hover trôi khỏi chấm đang hiện.
  assert.match(chart, /const valueOf = \(p: QcChartPoint\) => plotValue\(p, hasTarget, mean, sd\);/, 'drawLJ đặt điểm qua plotValue');
  assert.match(chart, /const value = plotValue\(point, hasTarget, targetMean, targetSd\);/, 'hit-test dùng CHUNG plotValue với hàm vẽ');
  assert.match(chart, /point\.val\.toFixed\(decimals\)/, 'tooltip theo số thập phân của xét nghiệm');
  const page = readFileSync(new URL('../renderer/pages/EntryPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /point\.qc_mean != null && point\.qc_sd != null && point\.qc_sd > 0/);
});

test('EN07: điểm đạt nhưng cả lần chạy bị loại được vẽ VÒNG RỖNG, không phải chấm đặc', () => {
  // Cùng một giá trị, cùng verdict 'ok' — chỉ khác ở chỗ lần chạy có bị mức
  // khác làm hỏng hay không. Trước bản sửa, hai điểm này vẽ y hệt nhau.
  const base = { date: '2026-09-01', runId: 'r1', val: 100, z: 0, verdict: 'ok', rules: [] };
  const counted = drawLjCircles([{ ...base, accepted: true }], 100, 2).circles[0];
  assert.equal(counted.fill, 'OK', 'điểm vào thống kê: chấm đặc màu Đạt');
  assert.equal(counted.stroke, '#fff');

  const collateral = drawLjCircles([{ ...base, accepted: false, runRejectedBy: [2] }], 100, 2).circles[0];
  assert.equal(collateral.fill, '#fff', 'điểm bị loại theo lần chạy: ruột rỗng');
  assert.equal(collateral.stroke, 'OK', 'viền vẫn mang màu kết luận thật của điểm');

  // Điểm TỰ vi phạm không đổi hình — nó là biến cố, không phải hệ quả.
  const rejected = drawLjCircles([{ ...base, verdict: 'rej', rules: ['1-3s'], accepted: false, runRejectedBy: [1] }], 100, 2).circles[0];
  assert.equal(rejected.fill, 'REJ');
  assert.equal(rejected.stroke, '#fff');
});

test('EN08: queryPoints trả kèm accepted + mức nào làm hỏng lần chạy', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const subject = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: subject.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
  config.saveTestLevel({ testId: subject.id, data: { level: 2, mean: 200, sd: 4 } }, actor);
  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', subject.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('gA','Nhom A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lA1','gA','A1',1),('lA2','gA','A2',2)").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='lA1' WHERE test_id=? AND level=1").run(subject.id);
  db.prepare("UPDATE test_levels SET qc_lot_id='lA2' WHERE test_id=? AND level=2").run(subject.id);
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  // Ngày 02: MỨC 1 vượt +3,5SD (1-3s, luật trong mức). Mức 2 hoàn toàn bình thường.
  const days = ['2026-09-01', '2026-09-02', '2026-09-03'];
  days.forEach((date, i) => {
    ins.run('a' + i, subject.id, 1, date, date + '-1', i === 1 ? 107 : (i % 2 ? 99.5 : 100.5), 'A1', 100, 2);
    ins.run('b' + i, subject.id, 2, date, date + '-1', i % 2 ? 199.5 : 200.5, 'A2', 200, 4);
  });
  const level2 = entry.queryPoints(subject.id, 2);
  const collateral = level2.find((p) => p.date === '2026-09-02');
  // Đây là ca người dùng gặp: điểm vẫn ĐẠT nhưng không vào thống kê.
  assert.equal(collateral.verdict, 'ok');
  assert.equal(collateral.accepted, false);
  assert.deepEqual(collateral.runRejectedBy, [1], 'nói rõ MỨC NÀO làm hỏng lần chạy');
  for (const date of ['2026-09-01', '2026-09-03']) {
    const point = level2.find((p) => p.date === date);
    assert.equal(point.accepted, true);
    assert.deepEqual(point.runRejectedBy, []);
  }
  // Mức 1 tự vi phạm: verdict đã nói rồi, không cần nhãn phụ ở renderer.
  const broken = entry.queryPoints(subject.id, 1).find((p) => p.date === '2026-09-02');
  assert.equal(broken.verdict, 'rej');
  assert.equal(broken.accepted, false);
  assert.deepEqual(broken.runRejectedBy, [1]);
});

/** Đúng phép chọn đại diện NGÀY mà `EntryPage` dùng cho cột "Chấp nhận":
 * mỗi mức lấy lần chạy cuối cùng ĐƯỢC CHẤP NHẬN; mức có điểm nhưng chưa lần
 * chạy nào được chấp nhận thì ngày chưa khép lại. Mức chưa nhập gì bị bỏ qua
 * (vệt cam "còn thiếu" của `rowClass()` lo việc đó). */
function dayVerdict(entry, testId, levels, date) {
  const reps = levels.flatMap((level) => {
    const runs = entry.queryPoints(testId, level).filter((p) => p.date === date);
    if (!runs.length) return [];
    const settled = [...runs].reverse().find((p) => p.accepted !== false);
    return [{ level, point: settled || runs[runs.length - 1], settled: !!settled }];
  });
  if (!reps.length) return null;
  if (reps.some((item) => !item.settled)) return 'rej';
  return reps.some((item) => item.point.verdict === 'warn') ? 'warn' : 'ok';
}

test('EN09: chạy lại MỘT mức không đủ để đóng ngày khi mức kia còn kẹt trong lần chạy hỏng', () => {
  const { db, test: subject, entry } = twoOperationalLevels();
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  // Lần chạy 1: Mức 1 vượt +3,5SD (1-3s) → CẢ lần chạy mất hiệu lực.
  ins.run('a1', subject.id, 1, '2026-09-03', '2026-09-03-1', 107, 'A1', 100, 2);
  ins.run('b1', subject.id, 2, '2026-09-03', '2026-09-03-1', 200.5, 'A2', 200, 4);
  assert.equal(dayVerdict(entry, subject.id, [1, 2], '2026-09-03'), 'rej');

  // Người dùng CHỈ chạy lại Mức 1 và lần này đạt. Theo Westgard/CLSI, lần
  // chạy bị loại thì MỌI mức phải chạy lại — Mức 2 vẫn chưa có kết quả nào
  // hợp lệ, nên ngày chưa được đóng dấu Chấp nhận.
  ins.run('a2', subject.id, 1, '2026-09-03', '2026-09-03-2', 100.4, 'A1', 100, 2);
  const level2 = entry.queryPoints(subject.id, 2);
  assert.equal(level2[0].verdict, 'ok');
  assert.equal(level2[0].accepted, false, 'điểm Mức 2 vẫn nằm trong lần chạy đã hỏng');
  assert.equal(dayVerdict(entry, subject.id, [1, 2], '2026-09-03'), 'rej');

  // Chạy lại nốt Mức 2 trong lần chạy mới thì ngày mới khép lại.
  ins.run('b2', subject.id, 2, '2026-09-03', '2026-09-03-2', 200.4, 'A2', 200, 4);
  assert.equal(dayVerdict(entry, subject.id, [1, 2], '2026-09-03'), 'ok');
});

test('EN10: ô nhắc chạy lại mở cho MỌI mức của lần chạy bị loại', () => {
  const { db, test: subject, entry } = twoOperationalLevels();
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  ins.run('a1', subject.id, 1, '2026-09-03', '2026-09-03-1', 107, 'A1', 100, 2);
  ins.run('b1', subject.id, 2, '2026-09-03', '2026-09-03-1', 200.5, 'A2', 200, 4);
  // `autoOpen` của EntryPage đọc đúng cờ này cho lần chạy cuối của từng mức.
  const lastOf = (level) => entry.queryPoints(subject.id, level).at(-1);
  assert.ok((lastOf(1).runRejectedBy?.length ?? 0) > 0, 'mức tự vi phạm được nhắc chạy lại');
  assert.ok((lastOf(2).runRejectedBy?.length ?? 0) > 0, 'mức bị kéo theo CŨNG được nhắc chạy lại');

  const page = readFileSync(new URL('../renderer/pages/EntryPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /const autoOpen = !!lastRun && \(lastRun\.runRejectedBy\?\.length \?\? 0\) > 0;/);

  // Ô giá trị trên lưới worksheet mang nét đứt + tooltip cho đúng điểm đó.
  assert.match(page, /\$\{excluded \? ' run-excluded' : ''\}/);
  assert.match(page, /title=\{excluded \|\| undefined\}/);
  const css = readFileSync(new URL('../renderer/styles/pages/entry.css', import.meta.url), 'utf8');
  assert.match(css, /\.qc-value-chip\.run-excluded\{border-style:dashed;/);
  // Nét đổi, MÀU không đổi: chip cảnh báo vẫn giữ viền cảnh báo của nó.
  assert.match(css, /\.qc-value-chip\.warn\.run-excluded\{border-color:var\(--warning-border\);\}/);
});

test('EN11: thống kê tích lũy bỏ điểm thuộc lần chạy bị loại và nói rõ đã bỏ bao nhiêu', () => {
  const { db, test: subject, entry } = twoOperationalLevels();
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  const days = ['2026-09-01', '2026-09-02', '2026-09-03'];
  days.forEach((date, i) => {
    ins.run('a' + i, subject.id, 1, date, date + '-1', i === 1 ? 107 : (i % 2 ? 99.5 : 100.5), 'A1', 100, 2);
    ins.run('b' + i, subject.id, 2, date, date + '-1', i % 2 ? 199.5 : 200.5, 'A2', 200, 4);
  });
  const rows = entry.queryPoints(subject.id, 2);
  // Đúng phép lọc của khối "Thống kê tích lũy" trong EntryPage.
  const recorded = rows.filter((p) => !p.voided);
  const cumulative = recorded.filter((p) => p.accepted !== false);
  assert.equal(recorded.length, 3, 'tổng ghi nhận giữ nguyên cho truy vết');
  assert.equal(cumulative.length, 2, 'điểm thuộc lần chạy bị loại không vào thống kê');
  assert.equal(recorded.length - cumulative.length, 1);

  const page = readFileSync(new URL('../renderer/pages/EntryPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /const cumulative = recorded\.filter\(\(p\) => p\.accepted !== false\);/);
  assert.match(page, /Tổng ghi nhận \{recorded\.length\}/);
});

test('EN13: thẻ biểu đồ là vùng thông tin, không lồng tương tác giả; số điểm nói rõ phần dùng thống kê', () => {
  const page = readFileSync(new URL('../renderer/pages/EntryPage.tsx', import.meta.url), 'utf8');
  const chart = readFileSync(new URL('../renderer/components/QcChart.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /role="button" tabIndex=\{0\}/,
    'không đặt role button cho cả thẻ khi bên trong còn có nút Xem lô cũ');
  assert.match(page, /const chartPointSummary = acceptedCount === chartPoints\.length/,
    'tiêu đề biểu đồ phân biệt tổng hiển thị với n dùng thống kê');
  assert.match(chart, /role="img" aria-label=\{chartAriaLabel\}/,
    'canvas có mô tả thay thế cho công cụ hỗ trợ');
});

test('EN12: listHistoryPoints không còn trả verdict giả danh kết luận Westgard', () => {
  const { db, test: subject, entry } = twoOperationalLevels();
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  // Điểm vượt +3,5SD phải nhận verdict từ engine Westgard, không từ một ngưỡng
  // z-score hiển thị độc lập.
  ins.run('a0', subject.id, 1, '2026-09-01', '2026-09-01-1', 107, 'A1', 100, 2);
  const [point] = entry.listHistoryPoints(subject.id);
  assert.equal('verdict' in point, false, 'không còn trường verdict');
  assert.equal('rules' in point, false, 'không còn trường rules');
  // Vẫn đủ dữ liệu để tab Lịch sử tự xếp theo dải Z như nó vẫn làm.
  for (const field of ['id', 'level', 'date', 'run_id', 'lot', 'val', 'qc_mean', 'qc_sd', 'operator_username']) {
    assert.ok(field in point, `thiếu trường ${field}`);
  }
  assert.equal(point.qc_mean, 100);
  assert.equal(point.qc_sd, 2);
});



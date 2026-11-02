import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const westgardHandlers = createWestgardHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL', cusumOn: true, cusumK: 0.5, cusumH: 6 } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1 } }, actor);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

const summary0 = westgardHandlers.listTestSummaries();
assert.equal(summary0.length, 1);
assert.equal(summary0[0].testName, 'Glucose');
assert.equal(summary0[0].instrumentName, 'May A');
assert.equal(summary0[0].levels[0].worstVerdict, 'ok');
assert.equal(summary0[0].unit, 'mg/dL');
assert.equal(summary0[0].levels[0].latest, null);

entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 14, runId: '2026-08-01-1' } }, actor);

const summary1 = westgardHandlers.listTestSummaries();
assert.equal(summary1[0].levels[0].worstVerdict, 'rej');
assert.equal(summary1[0].levels[0].pointCount, 1);
assert.equal(summary1[0].levels[0].latest.val, 14);
assert.equal(summary1[0].levels[0].latest.date, '2026-08-01');

const analysis = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(analysis.points.length, 1);
assert.equal(analysis.points[0].verdict, 'rej');
assert.ok(analysis.points[0].rules.includes('1-3s'));
assert.equal(analysis.points[0].z, 4); // (14-10)/1
assert.equal(analysis.cusum.cPos.length, 1);
assert.equal(analysis.cusum.h, 6, 'nguong h cau hinh phai duoc giu den renderer, khong roi ve mac dinh 4');
assert.equal(analysis.cusum.k, 0.5);
assert.equal(analysis.cusum.ma.length, 1, 'CUSUM phai gui kem MA(5) chi de ve xu huong');
const ruleSettings = westgardHandlers.listRuleSettings();
assert.ok(ruleSettings.some(r => r.id === '1-3s' && r.on === true));
// Dữ liệu cấu hình dạng action vẫn phản ánh đúng trạng thái bật/tắt ở panel.
db.prepare("INSERT INTO app_meta(key,value) VALUES('westgardRules',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
  .run(JSON.stringify({ '1-3s': 'inactive', '1-2s': 'alert' }));
const actionSettings = westgardHandlers.listRuleSettings();
assert.equal(actionSettings.find(r => r.id === '1-3s')?.on, false);
assert.equal(actionSettings.find(r => r.id === '1-2s')?.on, true);
db.prepare("DELETE FROM app_meta WHERE key='westgardRules'").run();

// GV2: đổi luật không đổi kết luận của lần chạy đã có — điểm z=+4 vẫn Loại bỏ.
// Phần còn lại của tệp kiểm cách nối cấu hình luật vào engine (ghi đè, bật/tắt,
// CUSUM trên chuỗi chấp nhận), không kiểm dòng thời gian — đã có ở
// rule-config-history.test.mjs — nên coi mỗi cấu hình như áp từ đầu bằng cách
// bỏ lịch sử ngay sau khi lưu.
const saveRuleActionFromStart = (...args) => {
  const result = westgardHandlers.saveRuleAction(...args);
  db.exec('DELETE FROM rule_config_history');
  return result;
};
assert.equal(westgardHandlers.saveRuleAction(test.id, '1-3s', 'inactive', actor).ok, true);
assert.equal(westgardHandlers.analyzeLevel(test.id, 1).points[0].verdict, 'rej', 'GV2: lần chạy đã có giữ kết luận');
db.exec('DELETE FROM rule_config_history');
const toggled = saveRuleActionFromStart(test.id, '1-3s', 'inactive', actor);
assert.equal(toggled.ok, true);
assert.equal(toggled.data.action, 'inactive');

const analysisAfterToggle = westgardHandlers.analyzeLevel(test.id, 1);
assert.ok(!analysisAfterToggle.points[0].rules.includes('1-3s'), '1-3s da tat khong duoc xuat hien');
assert.equal(analysisAfterToggle.points[0].verdict, 'warn', '|z|>2 van con canh bao qua 1-2s');

const entryPoints = entry.queryPoints(test.id, 1);
assert.equal(entryPoints[0].verdict, 'warn', 'Entry va Westgard phai tra CUNG mot verdict sau khi tat luat');
assert.ok(!entryPoints[0].rules.includes('1-3s'));

const alertOverride = saveRuleActionFromStart(test.id, '1-3s', 'alert', actor);
assert.equal(alertOverride.ok, true);
assert.equal(alertOverride.data.action, 'alert');
const analysisAsAlert = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(analysisAsAlert.points[0].verdict, 'warn', '1-3s doi thanh canh bao khong duoc loai bo');
assert.equal(analysisAsAlert.points[0].accepted, true, 'diem chi canh bao van nam trong chuoi chap nhan');

const rejectOverride = saveRuleActionFromStart(test.id, '1-2s', 'reject', actor);
assert.equal(rejectOverride.ok, true);
const pointAt25Sd = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-02', val: 12.5, runId: '2026-08-02-1' } }, actor);
assert.equal(pointAt25Sd.ok, true);
const analysisAsReject = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(analysisAsReject.points.at(-1).verdict, 'rej', '1-2s doi thanh loai bo phai reject diem 2.5SD');

const followShared = saveRuleActionFromStart(test.id, '1-3s', '', actor);
assert.equal(followShared.ok, true);
assert.equal(followShared.data.action, '');
const storedActions = JSON.parse(db.prepare('SELECT rule_actions_json FROM tests WHERE id=?').get(test.id).rule_actions_json);
assert.equal(Object.hasOwn(storedActions, '1-3s'), false, 'chon theo cau hinh chung phai xoa ghi de rieng');

// 9) CUSUM chạy trên CHUỖI ĐƯỢC CHẤP NHẬN (chốt 2026-09-11): điểm đã bị
// Westgard loại KHÔNG được nuôi C+ nữa — nó đã được chạy lại, tính tiếp là
// đếm MỘT sự cố hai lần và làm hai nửa của cùng một bảng nói hai chuỗi khác
// nhau. Lúc này `1-2s` đang là LOẠI BỎ nên cả điểm z=+4 lẫn z=+2.5 đều ngoài
// chuỗi; chỉ còn điểm z=+1 này, C+ = 0.5, còn xa h=6.
const trendPoint = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-03', val: 11, runId: '2026-08-03-1' } }, actor);
assert.equal(trendPoint.ok, true);
const beforeTrend = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(beforeTrend.points.at(-1).cusumSignal, null, 'diem bi Westgard loai khong duoc nuoi CUSUM');

// Hạ `1-3s`/`1-2s` xuống CẢNH BÁO: điểm z=+4 trở lại chuỗi chấp nhận (cảnh
// báo không loại điểm) nên C+ khởi động từ 3.5. Điểm z=+2.5 thì KHÔNG — nó
// vẫn bị `2-2s` loại (hai điểm liên tiếp cùng phía vượt 2SD), và đó đúng là
// điều cần: cùng một dữ liệu, chỉ điểm NẰM TRONG chuỗi mới nuôi C+.
for (const rule of ['1-3s', '1-2s']) {
  const back = saveRuleActionFromStart(test.id, rule, 'alert', actor);
  assert.equal(back.ok, true);
}
// Hai điểm z=+1.5: C+ = 3.5 → 4.0 → 5.0 → 6.0, chạm h=6 ở đúng điểm cuối.
// Mức z chọn để không luật nào khác che mất phép kiểm: |z|<2 nên `1-2s`
// không nổ, và điểm z=+1 ở giữa đã cắt chuỗi `4-1s`.
for (const [day, val] of [['2026-08-04', 11.5], ['2026-08-05', 11.5]]) {
  const added = entry.addPoint({ data: { testId: test.id, level: 1, date: day, val, runId: `${day}-1` } }, actor);
  assert.equal(added.ok, true);
}
// CUSUM vượt h phải thành CẢNH BÁO xu hướng để đi vào luồng NCE, nhưng không
// được tự loại điểm QC bình thường.
const trendAnalysis = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(trendAnalysis.points.at(-1).verdict, 'ok', 'CUSUM không tự đổi Westgard verdict');
assert.equal(trendAnalysis.points.at(-1).accepted, true, 'CUSUM không tự loại khỏi chuỗi accepted');
assert.equal(trendAnalysis.points.at(-1).cusumSignal, 'CUSUM +h');
const trendSummary = westgardHandlers.listTestSummaries()[0].levels[0];
assert.equal(trendSummary.latestVerdict, 'warn', 'CUSUM phải tạo cảnh báo cho luồng xử lý');
assert.ok(trendSummary.latestRules.includes('CUSUM +h'));

// 9b) Mốc bắt đầu lại chuỗi (`nce_cuts`) phải ĐẶT LẠI chuỗi cộng dồn. Không
// có mốc này thì C+ chỉ trôi về 0.5 mỗi điểm, nên một đợt drift đã khắc phục
// xong vẫn kéo cờ thêm nhiều điểm.
// - Mốc theo NGÀY (hồ sơ phiên bản cũ đã duyệt và hiệu quả): giai đoạn mới
//   từ ngày SAU ngày hoàn thành, nên điểm 2026-08-05 mở lại chuỗi từ 0 và
//   C+ của nó bằng 1,0, chưa tới ngưỡng h.
// - Mốc theo LẦN CHẠY (cho phép hoạt động trở lại bằng lần rerun): chính lần
//   chạy đó là lần đầu của giai đoạn mới (D-03).
db.prepare("INSERT INTO nce_records(id,nce_id,source,test_id,detected_at,status) VALUES ('nce-fix','NCE-1','iqc',?,'2026-08-04','closed')").run(test.id);
db.prepare("INSERT INTO nce_cuts(id,nce_record_id,test_id,date,run_id) VALUES ('cut-day','nce-fix',?,'2026-08-04',NULL)").run(test.id);
const afterFix = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(afterFix.points.at(-1).cusumSignal, null, 'moc cat theo ngay phai dat lai CUSUM');
assert.equal(afterFix.cusum.cPos.at(-1), 1, 'C+ phai bat dau lai tu 0 sau moc khac phuc');
db.prepare("DELETE FROM nce_cuts WHERE id='cut-day'").run();
assert.equal(westgardHandlers.analyzeLevel(test.id, 1).points.at(-1).cusumSignal, 'CUSUM +h', 'khong co moc cat thi chuoi cong don tiep');
db.prepare("INSERT INTO nce_cuts(id,nce_record_id,test_id,date,run_id) VALUES ('cut-run','nce-fix',?,'2026-08-05','2026-08-05-1')").run(test.id);
const afterRunCut = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(afterRunCut.points.at(-1).cusumSignal, null, 'moc cat theo lan chay phai dat lai CUSUM');
assert.equal(afterRunCut.cusum.cPos.at(-1), 1, 'lan chay rerun la lan dau cua giai doan moi');
db.prepare("DELETE FROM nce_cuts WHERE nce_record_id='nce-fix'").run();
db.prepare("DELETE FROM nce_records WHERE id='nce-fix'").run();

const badTest = westgardHandlers.saveRuleAction('khong-ton-tai', '1-3s', 'inactive', actor);
assert.equal(badTest.ok, false);
assert.equal(badTest.error.code, 'not-found');
const badRule = westgardHandlers.saveRuleAction(test.id, 'luat-gia', 'inactive', actor);
assert.equal(badRule.ok, false);
assert.equal(badRule.error.code, 'invalid-rule');
const badAction = westgardHandlers.saveRuleAction(test.id, '1-3s', 'danger', actor);
assert.equal(badAction.ok, false);
assert.equal(badAction.error.code, 'invalid-action');

console.log('app westgard-handlers end-to-end tests passed');



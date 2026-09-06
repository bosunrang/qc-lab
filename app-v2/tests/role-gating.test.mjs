// Kiểm chứng end-to-end RANH GIỚI QUYỀN THẬT ở main process: mọi handler
// ghi phải chặn đúng vai trò, và khi bị chặn thì KHÔNG được đụng vào DB lẫn
// nhật ký hoạt động (chặn nằm TRƯỚC writeAudit — nếu đảo thứ tự, mỗi lần một
// người không có quyền bấm nút sẽ đẻ ra 1 dòng audit rác).
//
// Trước bản này, `actor.role` không xuất hiện ở BẤT KỲ handler dữ liệu nào —
// vai trò "chỉ xem" thêm/huỷ được điểm QC và khoá/mở được kỳ báo cáo qua
// `window.qcApi` (ẩn nút ở renderer chỉ là hiển thị). Bài test này tồn tại
// để điều đó không lặng lẽ quay lại.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-v2-dist/main/ipc/report-handlers.js');
const { createSigmaHandlers } = require('../../app-v2-dist/main/ipc/sigma-handlers.js');
const { createNceHandlers } = require('../../app-v2-dist/main/ipc/nce-handlers.js');
const { createReagentHandlers } = require('../../app-v2-dist/main/ipc/reagent-handlers.js');
const { createWestgardHandlers } = require('../../app-v2-dist/main/ipc/westgard-handlers.js');
const { createSettingsHandlers } = require('../../app-v2-dist/main/ipc/settings-handlers.js');
const { createAuditHandlers } = require('../../app-v2-dist/main/ipc/audit-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const report = createReportHandlers(db);
const sigma = createSigmaHandlers(db);
const nce = createNceHandlers(db);
const reagent = createReagentHandlers(db);
const westgard = createWestgardHandlers(db);
const settings = createSettingsHandlers(db, ':memory:');
const audit = createAuditHandlers(db);

const admin = { userId: 'u-admin', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test' };
const tech = { userId: 'u-tech', username: 'ktv', name: 'Ky thuat vien', role: 'technician', clientId: 'test' };
const viewer = { userId: 'u-view', username: 'xem', name: 'Nguoi xem', role: 'viewer', clientId: 'test' };
// Vai trò lạ (dữ liệu hỏng/bản cũ) phải bị coi như KHÔNG có quyền, không
// phải "không khớp điều kiện nào nên cho qua".
const unknown = { userId: 'u-x', username: 'la', name: 'Vai tro la', role: 'guest', clientId: 'test' };

function activityCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM activity').get().n;
}

function assertForbidden(result, what) {
  assert.equal(result.ok, false, `${what}: phai bi chan`);
  assert.equal(result.error.code, 'forbidden', `${what}: phai tra ma loi 'forbidden'`);
}

// ── Dữ liệu nền do admin tạo ───────────────────────────────────────────────
const instrument = config.saveInstrument({ data: { name: 'May Quyen' } }, admin).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin).data;
const operational = makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
const comparison = reagent.createComparison({ data: { name: 'Hoa chat A' } }, admin).data;

// ── 1) viewer: bị chặn ở MỌI đường ghi ────────────────────────────────────
const beforeViewer = activityCount();
const pointCountBefore = db.prepare('SELECT COUNT(*) AS n FROM qc_points').get().n;

assertForbidden(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-01', val: 5, runId: 'r1' } }, viewer), 'viewer addPoint');
assertForbidden(entry.voidPoint({ data: { pointId: 'bat-ky', reason: 'Ly do du dai' } }, viewer), 'viewer voidPoint');
assertForbidden(sigma.savePeriod({ testId: test.id, period: '2026-09', tea: 10, levels: [{ level: 1, cv: 3 }] }, viewer), 'viewer saveSigmaPeriod');
assertForbidden(westgard.saveRuleAction(test.id, '1-3s', false, viewer), 'viewer saveRuleAction');
assertForbidden(nce.create({ data: { testId: test.id, level: 1, date: '2026-09-01', ruleId: '1-3s', errorType: 'SE', correction: 'Chay lai QC', dueDate: '2026-09-05' } }, viewer), 'viewer createNce');
assertForbidden(reagent.saveMetadata({ id: comparison.id, data: { reagent: 'Doi ten' } }, viewer), 'viewer saveReagentMetadata');
assertForbidden(reagent.removeComparison({ id: comparison.id }, viewer), 'viewer removeReagentComparison');
assertForbidden(report.lockPeriod({ data: { ym: '2026-09' } }, viewer), 'viewer lockPeriod');
assertForbidden(report.unlockPeriod({ data: { ym: '2026-09', note: 'Ly do du dai' } }, viewer), 'viewer unlockPeriod');
assertForbidden(config.saveInstrument({ data: { name: 'May cua viewer' } }, viewer), 'viewer saveInstrument');
assertForbidden(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 5, sd: 0.2 } }, viewer), 'viewer saveTestLevel');
assertForbidden(settings.saveLabProfile({ data: { name: 'Khoa cua viewer' } }, viewer), 'viewer saveLabProfile');
assertForbidden(audit.archive({ data: { months: 12 } }, viewer), 'viewer archiveActivity');

// Bị chặn thì KHÔNG được ghi gì: không thêm điểm QC, không thêm dòng audit
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM qc_points').get().n, pointCountBefore, 'viewer bi chan van khong duoc them diem QC');
assert.equal(activityCount(), beforeViewer, 'thao tac bi chan KHONG duoc de ra dong audit rac');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM period_locks').get().n, 0, 'viewer khong khoa duoc ky bao cao');

// Cổng quyền chạy TRƯỚC cổng validate: input sai định dạng + không có
// quyền phải trả 'forbidden', không phải 'invalid-period' (không tiết lộ
// input hợp lệ hay không cho vai trò không được phép, và giữ thứ tự cổng
// nhất quán ở mọi handler).
const wrongBoth = report.lockPeriod({ data: { ym: '2026/09' } }, viewer);
assert.equal(wrongBoth.error.code, 'forbidden', 'cong quyen phai chan truoc cong validate');

// ── 2) Vai trò lạ cũng bị chặn như viewer ─────────────────────────────────
assertForbidden(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-02', val: 5, runId: 'r1' } }, unknown), 'vai tro la addPoint');
assertForbidden(config.saveInstrument({ data: { name: 'May la' } }, unknown), 'vai tro la saveInstrument');

// ── 3) technician: ghi được dữ liệu QC ────────────────────────────────────
const techPoint = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-01', val: 5, runId: 'r1' } }, tech);
assert.equal(techPoint.ok, true, 'KTV phai them duoc diem QC');
assert.equal(westgard.saveRuleAction(test.id, '1-2s', true, tech).ok, true, 'KTV phai bat/tat duoc luat Westgard');
assert.equal(sigma.savePeriod({ testId: test.id, period: '2026-09', tea: 10, levels: [{ level: 1, cv: 3 }] }, tech).ok, true, 'KTV phai luu duoc ky Sigma');
assert.equal(reagent.saveMetadata({ id: comparison.id, data: { reagent: 'KTV sua ten' } }, tech).ok, true, 'KTV phai sua duoc so sanh hoa chat');
const techNce = nce.create({ data: { testId: test.id, level: 1, date: '2026-09-01', ruleId: '1-3s', errorType: 'SE', correction: 'Chay lai QC sau hieu chuan', dueDate: '2026-09-05' } }, tech);
assert.equal(techNce.ok, true, 'KTV phai lap duoc ho so NCE');

// ── 4) technician: KHÔNG đụng được cấu hình/khoá kỳ/xoá/cài đặt/nhật ký ──
assertForbidden(config.saveInstrument({ data: { name: 'May cua KTV' } }, tech), 'KTV saveInstrument');
assertForbidden(config.saveTest({ data: { name: 'Test cua KTV', instrumentId: instrument.id } }, tech), 'KTV saveTest');
assertForbidden(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 5, sd: 0.2 } }, tech), 'KTV saveTestLevel');
assertForbidden(config.saveTeaRef({ data: { test: 'Glucose', value: 10, source: 'clia', reference: 'CLIA 2024', reason: 'Ly do du dai de qua gate', effective: '2026-01-01', prepared: 'A', approved: 'B', approvedDate: '2026-01-01' } }, tech), 'KTV saveTeaRef');
assertForbidden(report.lockPeriod({ data: { ym: '2026-09' } }, tech), 'KTV lockPeriod');
assertForbidden(reagent.removeComparison({ id: comparison.id }, tech), 'KTV removeReagentComparison');
assertForbidden(settings.saveLabProfile({ data: { name: 'Khoa cua KTV' } }, tech), 'KTV saveLabProfile');
assertForbidden(audit.archive({ data: { months: 12 } }, tech), 'KTV archiveActivity');

// ── 5) admin: làm được cả 2 nhóm ──────────────────────────────────────────
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: operational.lotIds[0] } }, admin).ok, true, 'admin phai luu duoc Mean/SD');
assert.equal(report.lockPeriod({ data: { ym: '2026-10' } }, admin).ok, true, 'admin phai khoa duoc ky bao cao');
assert.equal(settings.saveLabProfile({ data: { name: 'Khoa Xet nghiem' } }, admin).ok, true, 'admin phai luu duoc ho so PXN');
assert.equal(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-03', val: 5.1, runId: 'r1' } }, admin).ok, true, 'admin phai them duoc diem QC');

// ── 5b) Xuất backup: CHỈ admin — bản backup chứa cả chuỗi mật khẩu PBKDF2
// của mọi người dùng, không phải dữ liệu ai cũng được tải về.
const backup = require('../../app-v2-dist/main/ipc/backup-handlers.js').createBackupHandlers(db, ':memory:');
assertForbidden(backup.exportBackup(viewer), 'viewer exportBackup');
assertForbidden(backup.exportBackup(tech), 'KTV exportBackup');
assert.equal(backup.exportBackup(admin).ok, true, 'admin phai xuat duoc backup');

// ── 6) Đọc KHÔNG bị chặn: chỉ-xem vẫn xem được dữ liệu QC ────────────────
// Cố ý: 6 trang (Tổng quan/Nhập QC/Westgard/Sigma/Hoá chất/Báo cáo) mở cho
// mọi vai trò ở CẢ app cũ lẫn app-v2 — chặn ghi, không chặn đọc.
assert.ok(entry.queryPoints(test.id, 1).length > 0, 'doc diem QC khong bi chan');
assert.ok(report.queryReport({ testId: test.id }).length > 0, 'doc bao cao khong bi chan');
assert.ok(westgard.listTestSummaries().length > 0, 'doc tong quan Westgard khong bi chan');

console.log('app-v2 role-gating end-to-end tests passed');

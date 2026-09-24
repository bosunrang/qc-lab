// End-to-end cho 2 nghiệp vụ "Cấu hình chung" được bổ sung 2026-09-03 sau khi
// rà soát lại toàn bộ trang so với hệ thống. Cả hai đều thuộc loại HỎNG ÂM THẦM
// (không có thông báo lỗi nào, chỉ sai dữ liệu), nên cần test riêng:
//
//  (1) `saveLot` đổi số lô phải GHI LẠI nhãn lô trên mọi điểm QC cũ.
//      `qc_points.lot` là CHUỖI TĨNH chụp lúc nhập, không tham chiếu
//      `qc_lots.id` — không cascade thì điểm cũ biến mất khỏi mọi bộ lọc theo
//      lô (Nhập QC/Westgard/Sigma) mà không có gì báo. Kèm `previewLotRename`
//      đếm trước (renderer hỏi người dùng bằng chính con số đó).
//  (2) `activateLotGroup` áp Mean/SD ĐÃ LƯU của nhóm lô sang các mức QC và
//      DỪNG nhóm bị thay thế. Trước bản này app chỉ có `stopLotGroup`
//      (một chiều) nên nhóm đã dừng không có đường bật lại.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const report = createReportHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test' };
const viewer = { userId: 'u2', username: 'xem', name: 'Người xem', role: 'viewer', clientId: 'test' };

const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, actor).data;
const lotOld = config.saveLot({ data: { lotNo: 'L-CU', level: 1 } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lotOld.id } }, actor);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1, lotId: lotOld.id }] });

// ── (1) Đổi số lô: đếm trước rồi ghi lại nhãn trên điểm QC cũ ──────────────
entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-03-02', val: 101 } }, actor);
entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-03-03', val: 99 } }, actor);
const before = entry.queryPoints(test.id, 1);
assert.equal(before.length, 2, 'phai co 2 diem QC');
assert.equal(before.every((point) => point.lot === 'L-CU'), true, 'diem QC phai chup nhan lo luc nhap');

// preview CHỈ ĐẾM, không ghi gì
const preview = config.previewLotRename({ id: lotOld.id, lotNo: 'L-MOI' });
assert.equal(preview.ok, true);
assert.equal(preview.data.rename.affected, 2, 'preview phai dem dung 2 diem');
assert.equal(preview.data.rename.oldLotNo, 'L-CU');
assert.equal(preview.data.rename.lockedCount, 0, 'chua khoa ky nao');
assert.equal(entry.queryPoints(test.id, 1).every((point) => point.lot === 'L-CU'), true,
  'preview KHONG duoc ghi gi vao DB');

// đổi tên KHÁC thì không có gì để đếm
const previewSame = config.previewLotRename({ id: lotOld.id, lotNo: 'L-CU' });
assert.equal(previewSame.data.rename, null, 'ten khong doi thi khong co ke hoach doi');

const renamed = config.saveLot({ id: lotOld.id, data: { lotNo: 'L-MOI', level: 1 } }, actor);
assert.equal(renamed.ok, true);
const after = entry.queryPoints(test.id, 1);
assert.equal(after.length, 2, 'khong duoc mat diem nao');
assert.equal(after.every((point) => point.lot === 'L-MOI'), true, 'moi diem QC cu phai mang nhan lo moi');
assert.equal(after.map((point) => point.val).sort((x, y) => x - y).join(','), '99,101', 'gia tri diem QC khong doi');

// Sửa trường khác (không đổi số lô) thì KHÔNG chạm vào điểm QC
config.saveLot({ id: lotOld.id, data: { lotNo: 'L-MOI', level: 1, supplier: 'Randox' } }, actor);
assert.equal(entry.queryPoints(test.id, 1).every((point) => point.lot === 'L-MOI'), true);

// ...và KHÔNG gỡ lô khỏi nhóm lô. Form "Sửa lô QC" không có ô chọn nhóm
// (membership do modal Nhóm lô QC quản lý) nên nó không gửi `groupId`; trước
// 2026-09-11 `saveLot` ghi thẳng `group_id=NULL` trong trường hợp đó, nên chỉ
// sửa mỗi ô Nhà cung cấp là lô LẶNG LẼ rời nhóm. Không dừng ở thẻ nhóm lô
// thiếu một lô: mức QC gắn lô đó hết "đang vận hành" ngay lập tức, biến mất
// khỏi Tổng quan/Westgard và ngừng được đánh giá ở Nhập QC.
{
  const groupedLots = config.listLots().filter((lot) => lot.id === lotOld.id);
  assert.equal(groupedLots.length, 1);
  assert.notEqual(groupedLots[0].group_id, null, 'sua lo khong duoc go lo khoi nhom lo');
  assert.equal(entry.queryPoints(test.id, 1).length, 2, 'muc QC van phai dang van hanh sau khi sua lo');
}

// Kỳ đã khoá vẫn được đếm và báo rõ (đổi nhãn lô là thao tác được PHÉP, khác
// xoá xét nghiệm — nhưng người dùng phải biết nó chạm vào kỳ đã chốt).
report.lockPeriod({ data: { ym: '2026-03', note: 'chot ky' } }, actor);
const previewLocked = config.previewLotRename({ id: lotOld.id, lotNo: 'L-BA' });
assert.equal(previewLocked.data.rename.affected, 2);
assert.equal(previewLocked.data.rename.lockedCount, 2, 'phai dem duoc diem thuoc ky da khoa');
assert.deepEqual(previewLocked.data.rename.lockedPeriods, ['2026-03']);
report.unlockPeriod({ data: { ym: '2026-03', note: 'mo lai de test tiep' } }, actor);

// ── (2) Kích hoạt nhóm lô ─────────────────────────────────────────────────
// Nhóm lô mới gồm 2 lô mức 1/2; mức 1 của xét nghiệm đang dùng lô cũ.
const lotNewL1 = config.saveLot({ data: { lotNo: 'G1-M1', level: 1 } }, actor).data;
const lotNewL2 = config.saveLot({ data: { lotNo: 'G1-M2', level: 2 } }, actor).data;
const group = config.saveLotGroup({ data: { name: 'Nhóm mới', lotIds: [lotNewL1.id, lotNewL2.id] } }, actor).data;

// Chưa có Mean/SD nào cho lô của nhóm → 'unready', KHÔNG đụng gì.
const unready = config.activateLotGroup({ id: group.id }, actor);
assert.equal(unready.ok, false);
assert.equal(unready.error.code, 'unready');
assert.equal(config.listTestLevels(test.id).find((level) => level.level === 1).qc_lot_id, lotOld.id,
  'nhanh unready khong duoc doi lo dang dung');

// Lưu Mean/SD cho lô mới (mức 1) — đây là bước "phê duyệt" trước khi kích hoạt.
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 105, sd: 3, qcLotId: lotNewL1.id } }, actor);
// Đưa mức 1 trở về lô cũ để mô phỏng "nhóm mới chưa được dùng" mà Mean/SD của
// lô mới đã có trong lịch sử — chính tình huống hệ thống dùng để áp.
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lotOld.id } }, actor);

const applied = config.activateLotGroup({ id: group.id }, actor);
assert.equal(applied.ok, true);
assert.equal(applied.data.status, 'applied');
assert.equal(applied.data.applied, 1, 'chi muc 1 co Mean/SD cho lo cua nhom');
const level1 = config.listTestLevels(test.id).find((level) => level.level === 1);
assert.equal(level1.qc_lot_id, lotNewL1.id, 'muc 1 phai chuyen sang lo cua nhom');
assert.equal(level1.mean, 105, 'phai ap dung Mean da luu cho lo do, khong phai gia tri cu');
assert.equal(level1.sd, 3);
assert.equal(JSON.parse(level1.mean_sd_history_json).length >= 1, true, 'phai chot Mean/SD cu vao lich su');

// Nhóm đang được dùng, không còn gì mới để áp → 'already-active', vẫn gỡ nhãn dừng.
config.stopLotGroup({ id: group.id }, actor);
const again = config.activateLotGroup({ id: group.id }, actor);
assert.equal(again.ok, true);
assert.equal(again.data.status, 'already-active');
assert.equal(again.data.applied, 0);
// '' (không phải 'active') — "Đang hoạt động" giờ SUY từ `inUse`, không
// phải literal lưu cứng (xem manage-validation.ts).
const reactivated = config.listLotGroups().find((item) => item.id === group.id);
assert.equal(reactivated.status, '', 'already-active phai go nhan da dung');
assert.equal(reactivated.inUse, true, 'nhom van dang duoc dung that');

// Chỉ admin
assert.equal(config.activateLotGroup({ id: group.id }, viewer).ok, false);
assert.equal(config.previewLotRename({ id: 'khong-ton-tai', lotNo: 'X' }).data.rename, null);
assert.equal(config.activateLotGroup({ id: 'khong-ton-tai' }, actor).error.code, 'not-found');

// Nhóm rỗng
const emptyGroup = config.saveLotGroup({ data: { name: 'Nhóm rỗng', lotIds: [] } }, actor);
if (emptyGroup.ok) {
  assert.equal(config.activateLotGroup({ id: emptyGroup.data.id }, actor).error.code, 'empty-group');
}

// ── (3) Sửa hồ sơ chuyển lô + Mean/SD ỨNG VIÊN chỉ áp khi "Chấp nhận" ──────
// Bộ lô/xét nghiệm RIÊNG cho phần này, tránh lẫn với trạng thái đã đổi ở
// (1)/(2) phía trên (level 1 của `test` giờ đang gắn `lotNewL1` sau khi kích
// hoạt nhóm lô).
const panel = config.savePanel({ data: { name: 'Panel A', instrumentId: instrument.id, testIds: [test.id] } }, actor).data;
const runningLot = config.saveLot({ data: { lotNo: 'RUN-1', level: 1, opened: '2026-02-10', exp: '2026-08-31' } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 200, sd: 5, qcLotId: runningLot.id } }, actor);
assert.equal(config.listTestLevels(test.id).find((l) => l.level === 1).mean_sd_effective_from, '2026-02-10',
  'gan lo lan dau phai lay Ngay mo cua lo lam moc hieu luc');
db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,lot,val,qc_mean,qc_sd,operator_username)
  VALUES ('old-lot-point',?,1,'2026-03-15','1','RUN-1',201,200,5,'admin')`).run(test.id);
const candidateLot = config.saveLot({ data: { lotNo: 'CAND-1', level: 1, opened: '2026-04-02', exp: '2027-01-31' } }, actor).data;

const created = config.createLotTransition({
  data: {
    panelId: panel.id, fromLotId: runningLot.id, toLotId: candidateLot.id, startDate: '2026-04-01', note: 'ban dau',
    criteria: [{ testId: test.id, level: 1, mean: 210, sd: 4 }],
  },
}, actor);
assert.equal(created.ok, true);
assert.equal(created.data.status, 'planned');

// "Dự kiến": Mean/SD ứng viên đã LƯU trong hồ sơ nhưng CHƯA áp — lô đang
// chạy (`runningLot`) vẫn phải là lô vận hành chính thức. Đây đúng là lỗi
// đã sửa trong phiên này (bản trước áp Mean/SD ngay lúc tạo hồ sơ).
let lvl1 = config.listTestLevels(test.id).find((l) => l.level === 1);
assert.equal(lvl1.qc_lot_id, runningLot.id, 'luc Du kien lo dang chay KHONG duoc doi');
assert.equal(lvl1.mean, 200); assert.equal(lvl1.sd, 5);
assert.deepEqual(JSON.parse(created.data.criteria_json), [{ testId: test.id, level: 1, mean: 210, sd: 4 }]);

const edited = config.createLotTransition({ id: created.data.id, data: { panelId: panel.id, fromLotId: runningLot.id, toLotId: candidateLot.id, startDate: '2026-04-05', note: 'da sua', criteria: [{ testId: test.id, level: 1, mean: 212, sd: 4.2 }] } }, actor);
assert.equal(edited.ok, true);
assert.equal(edited.data.id, created.data.id, 'sua phai giu nguyen id, khong tao ban ghi moi');
assert.equal(edited.data.start_date, '2026-04-05');
assert.equal(edited.data.note, 'da sua');
assert.equal(edited.data.status, 'planned', 'sua KHONG duoc doi trang thai');
assert.equal(config.listLotTransitions().length, 1, 'khong duoc sinh them ho so');

// "Chấp nhận": ĐÂY mới thật sự áp Mean/SD ứng viên (bản đã SỬA: 212/4.2,
// không phải bản gốc 210/4), đánh dấu lô cũ hết dùng. MỘT hàm lưu duy nhất
// (2026-09-03, khớp hệ thống): status đi kèm createLotTransition, không phải
// hàm riêng — không cần gửi lại `criteria` vì hồ sơ đã giữ criteria_json từ
// lần sửa trước, và status thiếu thì giữ nguyên (ở đây gửi rõ 'accepted').
const accepted = config.createLotTransition({ id: created.data.id, data: { panelId: panel.id, fromLotId: runningLot.id, toLotId: candidateLot.id, startDate: '2026-04-05', note: 'da sua', status: 'accepted', criteria: [{ testId: test.id, level: 1, mean: 212, sd: 4.2 }] } }, actor);
assert.equal(accepted.ok, true);
assert.equal(accepted.data.status, 'accepted');
lvl1 = config.listTestLevels(test.id).find((l) => l.level === 1);
assert.equal(lvl1.qc_lot_id, candidateLot.id, 'Chap nhan phai chuyen sang lo moi');
assert.equal(lvl1.mean, 212, 'phai la ban da SUA, khong phai ban goc');
assert.equal(lvl1.sd, 4.2);
assert.equal(lvl1.mean_sd_effective_from, '2026-04-02', 'lo moi phai bat dau hieu luc tu Ngay mo da khai cua lo');
assert.equal(config.listLots().find((l) => l.id === runningLot.id).depleted, 1, 'lo cu phai duoc danh dau het dung');
const oldHistory = JSON.parse(lvl1.mean_sd_history_json).find((h) => h.qcLotId === runningLot.id && h.mean === 200 && h.sd === 5);
assert.ok(oldHistory, 'phai chot Mean/SD cu vao lich su');
assert.equal(oldHistory.lot, 'RUN-1', 'lich su phai giu nhan lo cu doc lap voi lo dang chay');
assert.equal(oldHistory.effectiveFrom, '2026-02-10', 'moc cu phai bat dau tu Ngay mo lo cu');
assert.equal(oldHistory.effectiveTo, '2026-04-05', 'moc cu ket thuc tai ngay chuyen tiep');
assert.equal(oldHistory.source, 'mfg');
const retainedPoints = entry.listHistoryPoints(test.id);
assert.equal(retainedPoints.some((p) => p.id === 'old-lot-point' && p.lot === 'RUN-1'), true,
  'sau chuyen tiep, endpoint lich su van phai tra diem cua lo cu');
assert.equal(entry.queryPoints(test.id, 1).some((p) => p.id === 'old-lot-point'), false,
  'bang nhap hien hanh van chi doc lo moi, khong tron diem lo cu vao chuoi dang chay');

// Cả lô cũ lẫn lô mới của hồ sơ đã chấp nhận là bằng chứng truy xuất nguồn
// kiểm vocabulary cũ `concluded`, nên cổng này bị vô hiệu hoàn toàn.
const removeAcceptedFrom = config.removeLot({ id: runningLot.id }, actor);
assert.equal(removeAcceptedFrom.ok, false);
assert.equal(removeAcceptedFrom.error.code, 'used-by-accepted-transition');
const removeAcceptedTo = config.removeLot({ id: candidateLot.id }, actor);
assert.equal(removeAcceptedTo.ok, false);
assert.equal(removeAcceptedTo.error.code, 'used-by-assay', 'lô mới đang được mức QC dùng nên cổng trực tiếp phải chặn trước');
assert.equal(config.listLotTransitions().some((tr) => tr.id === accepted.data.id), true, 'bị chặn thì hồ sơ chuyển tiếp phải còn nguyên');

// Hồ sơ đã 'accepted' thì KHÔNG đổi status khác 'accepted' được nữa (khớp
// hệ thống: `switchesLot(old) && status!=='accepted'` → 'accepted-immutable').
// Sửa các trường khác (ngày/ghi chú) kèm status='accepted' vẫn hợp lệ,
// KHÔNG chạy lại cascade lần nữa vì `finalChanged` lúc này là false.
const blocked = config.createLotTransition({ id: created.data.id, data: { panelId: panel.id, fromLotId: runningLot.id, toLotId: candidateLot.id, startDate: '2026-04-09', status: 'active' } }, actor);
assert.equal(blocked.ok, false);
assert.equal(blocked.error.code, 'accepted-immutable');
assert.equal(config.listLotTransitions()[0].start_date, '2026-04-05', 'bi chan thi khong duoc ghi gi');
assert.equal(config.createLotTransition({ id: 'khong-ton-tai', data: { panelId: panel.id, fromLotId: runningLot.id, toLotId: candidateLot.id } }, actor).error.code, 'not-found');

// "Không chấp nhận": hồ sơ KHÁC, không đụng gì tới cấu hình.
const runningLot2 = config.saveLot({ data: { lotNo: 'RUN-2', level: 2 } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 50, sd: 1, qcLotId: runningLot2.id } }, actor);
const candidateLot2 = config.saveLot({ data: { lotNo: 'CAND-2', level: 2 } }, actor).data;
const toReject = config.createLotTransition({ data: { panelId: panel.id, fromLotId: runningLot2.id, toLotId: candidateLot2.id, criteria: [{ testId: test.id, level: 2, mean: 55, sd: 1.2 }] } }, actor);
const rejected = config.createLotTransition({ id: toReject.data.id, data: { panelId: panel.id, fromLotId: runningLot2.id, toLotId: candidateLot2.id, status: 'rejected' } }, actor);
assert.equal(rejected.ok, true);
assert.equal(rejected.data.status, 'rejected');
const lvl2 = config.listTestLevels(test.id).find((l) => l.level === 2);
assert.equal(lvl2.qc_lot_id, runningLot2.id, 'Khong chap nhan KHONG duoc doi lo dang dung');
assert.equal(lvl2.mean, 50); assert.equal(lvl2.sd, 1);
assert.equal(config.listLots().find((l) => l.id === runningLot2.id).depleted, 0, 'lo dang chay KHONG bi danh dau het dung');

// "Không chấp nhận" KHÔNG khoá hồ sơ — hệ thống cho sửa/đổi status lại được
// (chỉ 'accepted' mới khoá vĩnh viễn).
const reopened = config.createLotTransition({ id: toReject.data.id, data: { panelId: panel.id, fromLotId: runningLot2.id, toLotId: candidateLot2.id, status: 'planned' } }, actor);
assert.equal(reopened.ok, true);
assert.equal(reopened.data.status, 'planned');

const groupLotA = config.saveLot({ data: { lotNo: 'GRP-A', level: 1 } }, actor).data;
const groupLotB = config.saveLot({ data: { lotNo: 'GRP-B', level: 1 } }, actor).data;
const lotGroup = config.saveLotGroup({ data: { name: 'Nhóm GRP', lotIds: [groupLotA.id, groupLotB.id] } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 90, sd: 2, qcLotId: groupLotA.id } }, actor);
const groupLotC = config.saveLot({ data: { lotNo: 'GRP-C', level: 1 } }, actor).data;
const groupTransition = config.createLotTransition({
  data: { panelId: panel.id, fromLotId: groupLotA.id, toLotId: groupLotC.id, status: 'accepted', criteria: [{ testId: test.id, level: 1, mean: 95, sd: 2.5 }] },
}, actor);
assert.equal(groupTransition.ok, true);
const groupsAfter = config.listLotGroups();
const activeGroup = groupsAfter.find((g) => g.id === lotGroup.id);
assert.deepEqual(activeGroup.lotIds.sort(), [groupLotB.id, groupLotC.id].sort(), 'nhom dang hoat dong: lo cu ra, lo moi vao, giu nguyen id nhom');
assert.equal(activeGroup.name, 'Nhóm GRP', 'ten tu dat KHONG duoc doi khi lo moi vao nhom');
// '' (không phải 'active') — cascade "Chấp nhận" không đụng status của
// nhóm ĐANG hoạt động, chỉ thay thành viên; "Đang hoạt động" SUY từ `inUse`.
assert.equal(activeGroup.status, '');
assert.equal(activeGroup.inUse, true, 'nhom van dang duoc dung sau khi thay lo');
const archivedGroup = groupsAfter.find((g) => g.id !== lotGroup.id && g.lotIds.includes(groupLotA.id));
assert.ok(archivedGroup, 'lo cu phai duoc luu tru vao mot nhom RIENG, khong roi ra khoi moi nhom');
assert.equal(archivedGroup.name, 'Nhóm GRP', 'nhom luu tru giu nguyen ten cu');
assert.equal(archivedGroup.status, 'stopped');
assert.equal(archivedGroup.active, 0);
assert.deepEqual(archivedGroup.lotIds.sort(), [groupLotA.id, groupLotB.id].sort(), 'nhom luu tru giu NGUYEN ca 2 lo goc (anh chup, khong phai group_id song)');
assert.equal(archivedGroup.note, 'Đã dùng khi chuyển tiếp lô GRP-A sang GRP-C');
assert.equal(config.listLots().find((l) => l.id === groupLotC.id).group_id, lotGroup.id, 'lo moi phai duoc gan dung group_id cua nhom dang hoat dong');

// Tên TỰ SINH (đúng bằng tổ hợp số lô) thì PHẢI tự đổi theo tổ hợp mới.
const autoLotA = config.saveLot({ data: { lotNo: 'AUTO-A', level: 3 } }, actor).data;
const autoLotB = config.saveLot({ data: { lotNo: 'AUTO-B', level: 3 } }, actor).data;
const autoGroup = config.saveLotGroup({ data: { name: 'AUTO-A/AUTO-B', lotIds: [autoLotA.id, autoLotB.id] } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 3, mean: 10, sd: 1, qcLotId: autoLotA.id } }, actor);
const autoLotC = config.saveLot({ data: { lotNo: 'AUTO-C', level: 3 } }, actor).data;
config.createLotTransition({
  data: { panelId: panel.id, fromLotId: autoLotA.id, toLotId: autoLotC.id, status: 'accepted', criteria: [{ testId: test.id, level: 3, mean: 11, sd: 1.1 }] },
}, actor);
assert.equal(config.listLotGroups().find((g) => g.id === autoGroup.id).name, 'AUTO-C/AUTO-B', 'ten tu sinh phai tu doi theo to hop lo moi');

console.log('config-lot-lifecycle: doi so lo cascade dung, kich hoat nhom lo 3 trang thai, sua ho so chuyen lo dung cong chan, chap nhan giu dung thanh vien nhom lo.');



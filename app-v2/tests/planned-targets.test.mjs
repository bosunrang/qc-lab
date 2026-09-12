// Mean/SD "Dự kiến" — nhập sẵn Mean/SD cho lô của một nhóm lô CHƯA dùng, mức
// QC vẫn chạy lô cũ; tới khi bấm "Kích hoạt nhóm lô" mới áp vào `test_levels`.
// Đây là bài test cho ĐÚNG hai nửa hợp đồng: (a) lưu dự kiến KHÔNG được đụng
// cấu hình đang chạy, (b) kích hoạt PHẢI áp đúng số đã nhập dự kiến, ưu tiên
// hơn số cũ tìm ngược trong lịch sử.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');

const db = openDatabase(':memory:');
const cfg = createConfigHandlers(db);
const admin = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test' };
const tech = { userId: 'u2', username: 'ktv', name: 'KTV', role: 'technician', clientId: 'test' };
const un = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.data; };

const ins = un(cfg.saveInstrument({ data: { name: 'May A' } }, admin));
const glucose = un(cfg.saveTest({ data: { name: 'Glucose', instrumentId: ins.id } }, admin));
const ure = un(cfg.saveTest({ data: { name: 'Ure', instrumentId: ins.id } }, admin));
const lotCu = un(cfg.saveLot({ data: { lotNo: 'LO-CU', level: 1 } }, admin));
const lotCu2 = un(cfg.saveLot({ data: { lotNo: 'LO-CU-2', level: 2 } }, admin));
const lotMoi = un(cfg.saveLot({ data: { lotNo: 'LO-MOI', level: 1 } }, admin));
const lotMoi2 = un(cfg.saveLot({ data: { lotNo: 'LO-MOI-2', level: 2 } }, admin));
un(cfg.saveLotGroup({ data: { name: 'Nhom dang chay', active: true, status: '', lotIds: [lotCu.id, lotCu2.id] } }, admin));
const nhomMoi = un(cfg.saveLotGroup({ data: { name: 'Nhom moi', active: true, status: '', lotIds: [lotMoi.id, lotMoi2.id] } }, admin));
un(cfg.savePanel({ data: { name: 'Panel', instrumentId: ins.id, active: true, testIds: [glucose.id, ure.id] } }, admin));

// Cả 2 xét nghiệm đang chạy lô của nhóm cũ ở Mức 1.
un(cfg.saveTestLevel({ testId: glucose.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: lotCu.id } }, admin));
un(cfg.saveTestLevel({ testId: ure.id, data: { level: 1, mean: 8, sd: 0.4, qcLotId: lotCu.id } }, admin));
const levelOf = (testId, level = 1) => cfg.listTestLevels(testId).find((row) => row.level === level);

// ---- 1) Lưu dự kiến KHÔNG được đụng cấu hình đang chạy
{
  const saved = un(cfg.savePlannedTargets({
    items: [
      { testId: glucose.id, level: 1, qcLotId: lotMoi.id, mean: 5.4, sd: 0.25, low: null, high: null },
      { testId: ure.id, level: 1, qcLotId: lotMoi.id, mean: 8.6, sd: 0.45, low: null, high: null },
    ],
  }, admin));
  assert.equal(saved.saved, 2);
  const live = levelOf(glucose.id);
  assert.equal(live.qc_lot_id, lotCu.id, 'mức QC phải VẪN chạy lô cũ sau khi lưu dự kiến');
  assert.equal(live.mean, 5, 'Mean đang chạy không được đổi');
  assert.equal(live.sd, 0.2, 'SD đang chạy không được đổi');
  const rows = cfg.listPlannedTargets();
  assert.equal(rows.length, 2, 'phải có đúng 2 dòng dự kiến');
  assert.equal(rows.find((r) => r.test_id === glucose.id).mean, 5.4);
  assert.equal(rows.find((r) => r.test_id === glucose.id).qc_lot_id, lotMoi.id);
  // Lịch sử Mean/SD KHÔNG được nhận số dự kiến — lịch sử chỉ ghi giai đoạn ĐÃ
  // có hiệu lực; trộn vào là mời gọi lỗi "áp nhầm số chưa duyệt".
  assert.equal(JSON.parse(live.mean_sd_history_json || '[]').some((h) => h.mean === 5.4), false,
    'số dự kiến không được lọt vào mean_sd_history_json');
}

// ---- 2) Lưu lại đè lên chính nó (upsert), không đẻ dòng thứ hai
{
  un(cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotMoi.id, mean: 5.5, sd: 0.26, low: null, high: null }] }, admin));
  const rows = cfg.listPlannedTargets();
  assert.equal(rows.length, 2, 'lưu lại cùng (xét nghiệm, mức, lô) là cập nhật, không thêm dòng');
  assert.equal(rows.find((r) => r.test_id === glucose.id).mean, 5.5);
}

// ---- 3) Các cổng từ chối
{
  const currentLot = cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotCu.id, mean: 5, sd: 0.2, low: null, high: null }] }, admin);
  assert.equal(currentLot.ok, false);
  assert.equal(currentLot.error.code, 'planned-current-lot', 'lô ĐANG DÙNG thì không có gì để "dự kiến"');

  const wrongLevel = cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotMoi2.id, mean: 5, sd: 0.2, low: null, high: null }] }, admin);
  assert.equal(wrongLevel.ok, false);
  assert.equal(wrongLevel.error.code, 'wrong-lot-level', 'lô Mức 2 không gán được cho Mức 1');

  const noSd = cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotMoi.id, mean: 5, sd: null, low: null, high: null }] }, admin);
  assert.equal(noSd.ok, false, 'thiếu SD phải bị chặn, không được đọc là 0');

  const empty = cfg.savePlannedTargets({}, admin);
  assert.equal(empty.ok, false);
  assert.equal(empty.error.code, 'empty');

  // Cấu hình là admin-only, y hệt saveTestLevel.
  const denied = cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotMoi.id, mean: 5.4, sd: 0.25, low: null, high: null }] }, tech);
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'forbidden', 'KTV không được đặt Mean/SD dự kiến');

  // Một hàng sai thì KHÔNG hàng nào được ghi (validate toàn bộ trước khi ghi).
  const before = cfg.listPlannedTargets().length;
  const partial = cfg.savePlannedTargets({
    items: [
      { testId: ure.id, level: 1, qcLotId: lotMoi.id, mean: 9.9, sd: 0.5, low: null, high: null },
      { testId: 'khong-ton-tai', level: 1, qcLotId: lotMoi.id, mean: 1, sd: 1, low: null, high: null },
    ],
  }, admin);
  assert.equal(partial.ok, false);
  assert.equal(cfg.listPlannedTargets().length, before, 'hàng hợp lệ đi kèm hàng sai cũng không được ghi');
  assert.equal(cfg.listPlannedTargets().find((r) => r.test_id === ure.id).mean, 8.6, 'giá trị cũ giữ nguyên');
}

// ---- 4) Bỏ một mục dự kiến
{
  un(cfg.savePlannedTargets({ items: [{ testId: ure.id, level: 1, qcLotId: lotMoi.id, mean: 8.6, sd: 0.45, low: null, high: null }] }, admin));
  const removed = un(cfg.savePlannedTargets({ remove: [{ testId: ure.id, level: 1, qcLotId: lotMoi.id }] }, admin));
  assert.equal(removed.removed, 1);
  assert.equal(cfg.listPlannedTargets().some((r) => r.test_id === ure.id), false, 'mục đã bỏ phải biến mất');
  // Đặt lại cho bước kích hoạt bên dưới.
  un(cfg.savePlannedTargets({ items: [{ testId: ure.id, level: 1, qcLotId: lotMoi.id, mean: 8.6, sd: 0.45, low: null, high: null }] }, admin));
}

// ---- 5) Kích hoạt nhóm lô: áp ĐÚNG số dự kiến, rồi tiêu thụ dòng dự kiến
{
  const result = un(cfg.activateLotGroup({ id: nhomMoi.id }, admin));
  assert.equal(result.status, 'applied');
  assert.equal(result.applied, 2, 'cả 2 mức QC phải được áp');
  const glu = levelOf(glucose.id);
  assert.equal(glu.qc_lot_id, lotMoi.id, 'mức QC phải chuyển sang lô mới');
  assert.equal(glu.mean, 5.5, 'phải áp đúng Mean DỰ KIẾN (bản cập nhật gần nhất)');
  assert.equal(glu.sd, 0.26);
  assert.equal(glu.applied, 'mfg', 'Mean/SD áp qua kích hoạt nhóm luôn là nguồn NSX');
  // Mean/SD cũ phải được chốt vào lịch sử, không mất dấu.
  assert.equal(JSON.parse(glu.mean_sd_history_json || '[]').some((h) => h.mean === 5 && h.qcLotId === lotCu.id), true,
    'giá trị của lô cũ phải vào lịch sử');
  assert.equal(cfg.listPlannedTargets().length, 0, 'dòng dự kiến đã áp thì phải được tiêu thụ');
}

// ---- 6) Dự kiến THẮNG lịch sử: nhóm từng dùng rồi quay lại, nhưng đã nhập số mới
{
  // Giờ mức QC đang chạy lô MỚI; lô CŨ đã có mốc trong lịch sử (Mean 5).
  const plannedBack = 5.9;
  un(cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotCu.id, mean: plannedBack, sd: 0.3, low: null, high: null }] }, admin));
  const groups = cfg.listLotGroups();
  const nhomCu = groups.find((g) => g.name === 'Nhom dang chay');
  un(cfg.activateLotGroup({ id: nhomCu.id }, admin));
  const glu = levelOf(glucose.id);
  assert.equal(glu.qc_lot_id, lotCu.id, 'quay lại lô cũ');
  assert.equal(glu.mean, plannedBack, 'phải lấy số DỰ KIẾN vừa nhập, không lấy số cũ trong lịch sử');
  assert.equal(glu.sd, 0.3);
}

// ---- 7) Lưu thẳng Mean/SD cho chính lô đó thì dòng dự kiến hết nghĩa
{
  un(cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotMoi.id, mean: 6.1, sd: 0.31, low: null, high: null }] }, admin));
  assert.equal(cfg.listPlannedTargets().length, 1);
  // Chuyển thẳng sang đúng lô đó qua bảng Mean/SD.
  un(cfg.saveTestLevel({ testId: glucose.id, data: { level: 1, mean: 6.2, sd: 0.32, qcLotId: lotMoi.id } }, admin));
  assert.equal(cfg.listPlannedTargets().length, 0, 'lô đã thành lô đang dùng thì dòng dự kiến phải bị xoá');
  assert.equal(levelOf(glucose.id).mean, 6.2, 'giá trị vừa lưu thẳng mới là giá trị đang chạy');
}

// ---- 8) Xoá lô thì dòng dự kiến theo nó biến mất (ON DELETE CASCADE)
{
  const lotRieng = un(cfg.saveLot({ data: { lotNo: 'LO-TAM', level: 1 } }, admin));
  un(cfg.savePlannedTargets({ items: [{ testId: glucose.id, level: 1, qcLotId: lotRieng.id, mean: 7, sd: 0.35, low: null, high: null }] }, admin));
  assert.equal(cfg.listPlannedTargets().length, 1);
  un(cfg.removeLot({ id: lotRieng.id }, admin));
  assert.equal(cfg.listPlannedTargets().length, 0, 'xoá lô phải kéo theo dòng dự kiến của lô đó');
}

// ---- 9) Trạng thái nhóm lô đi theo, đúng nghiệp vụ app cũ
// App cũ: lưu "Dự kiến" thì nhóm nhận số mang nhãn 'planned'; "Chuyển qua nhóm
// lô này" thì nhóm bị thay mang nhãn 'stopped' còn nhóm mới gỡ nhãn.
{
  const t1 = un(cfg.saveTest({ data: { name: 'Natri', instrumentId: ins.id } }, admin));
  const t2 = un(cfg.saveTest({ data: { name: 'Kali', instrumentId: ins.id } }, admin));
  const a1 = un(cfg.saveLot({ data: { lotNo: 'G9-A-N1', level: 1 } }, admin));
  const a2 = un(cfg.saveLot({ data: { lotNo: 'G9-A-N2', level: 2 } }, admin));
  const b1 = un(cfg.saveLot({ data: { lotNo: 'G9-B-N1', level: 1 } }, admin));
  const b2 = un(cfg.saveLot({ data: { lotNo: 'G9-B-N2', level: 2 } }, admin));
  const gA = un(cfg.saveLotGroup({ data: { name: 'G9 Nhom A', active: true, status: '', lotIds: [a1.id, a2.id] } }, admin));
  const gB = un(cfg.saveLotGroup({ data: { name: 'G9 Nhom B', active: true, status: '', lotIds: [b1.id, b2.id] } }, admin));
  const statusOf = (id) => cfg.listLotGroups().find((g) => g.id === id).status;

  un(cfg.saveTestLevel({ testId: t1.id, data: { level: 1, mean: 140, sd: 2, qcLotId: a1.id } }, admin));
  un(cfg.saveTestLevel({ testId: t2.id, data: { level: 1, mean: 4, sd: 0.1, qcLotId: a1.id } }, admin));

  // "Dự kiến" cho nhóm B (chưa dùng) -> nhóm B mang nhãn 'planned'
  un(cfg.savePlannedTargets({ items: [{ testId: t1.id, level: 1, qcLotId: b1.id, mean: 141, sd: 2.1, low: null, high: null }] }, admin));
  assert.equal(statusOf(gB.id), 'planned', 'nhóm nhận Mean/SD dự kiến phải hiện "Dự kiến"');
  assert.equal(statusOf(gA.id), '', 'nhóm đang chạy không được đổi trạng thái');

  // "Chuyển qua nhóm lô này" cho MỘT xét nghiệm -> nhóm B gỡ nhãn (đang chạy
  // thật), nhóm A VẪN chạy vì Kali còn dùng lô của nó.
  un(cfg.saveTestLevel({ testId: t1.id, data: { level: 1, mean: 141, sd: 2.1, qcLotId: b1.id } }, admin));
  assert.equal(statusOf(gB.id), '', 'nhóm vừa nhận mức QC phải gỡ nhãn "Dự kiến"');
  assert.equal(statusOf(gA.id), '', 'nhóm cũ CÒN xét nghiệm khác dùng thì không được đánh dấu "Đã dừng"');
  // ^ Lệch app cũ CÓ CHỦ ĐÍCH: app cũ dừng nhóm cũ ngay, mà nhóm 'stopped' bị
  // loại khỏi "mức QC đang vận hành" nên Kali sẽ biến mất khỏi Nhập QC/
  // Westgard dù lô của nó vẫn còn nguyên.

  // Chuyển nốt xét nghiệm cuối -> giờ nhóm A mới thật sự hết dùng
  un(cfg.saveTestLevel({ testId: t2.id, data: { level: 1, mean: 4.1, sd: 0.12, qcLotId: b1.id } }, admin));
  assert.equal(statusOf(gA.id), 'stopped', 'hết mức QC nào dùng thì nhóm cũ phải hiện "Đã dừng"');
}

// ---- 10) Kích hoạt khi chỉ MỘT PHẦN xét nghiệm có Mean/SD cho lô mới
// Đây là ca đã làm mất dữ liệu trên màn hình: nhóm cũ bị gắn "Đã dừng" trong
// khi vẫn còn xét nghiệm dùng lô của nó — mà nhóm 'stopped' bị loại khỏi "mức
// QC đang vận hành", nên những xét nghiệm ở lại BIẾN MẤT khỏi Nhập QC/Westgard.
{
  const { listOperationalLevels } = require('../../app-v2-dist/main/db/operational-levels.js');
  const names = ['G10 Mot', 'G10 Hai', 'G10 Ba'];
  const group10Tests = names.map((name) => un(cfg.saveTest({ data: { name, instrumentId: ins.id } }, admin)));
  const a1 = un(cfg.saveLot({ data: { lotNo: 'G10-A-N1', level: 1 } }, admin));
  const a2 = un(cfg.saveLot({ data: { lotNo: 'G10-A-N2', level: 2 } }, admin));
  const b1 = un(cfg.saveLot({ data: { lotNo: 'G10-B-N1', level: 1 } }, admin));
  const b2 = un(cfg.saveLot({ data: { lotNo: 'G10-B-N2', level: 2 } }, admin));
  const gA = un(cfg.saveLotGroup({ data: { name: 'G10 Nhom A', active: true, status: '', lotIds: [a1.id, a2.id] } }, admin));
  const gB = un(cfg.saveLotGroup({ data: { name: 'G10 Nhom B', active: true, status: '', lotIds: [b1.id, b2.id] } }, admin));
  un(cfg.savePanel({ data: { name: 'G10 Panel', instrumentId: ins.id, active: true, testIds: group10Tests.map((t) => t.id) } }, admin));
  for (const t of group10Tests) un(cfg.saveTestLevel({ testId: t.id, data: { level: 1, mean: 10, sd: 0.5, qcLotId: a1.id } }, admin));
  const statusOf = (id) => cfg.listLotGroups().find((g) => g.id === id).status;

  // Chỉ xét nghiệm ĐẦU có Mean/SD cho lô của nhóm B
  un(cfg.savePlannedTargets({ items: [{ testId: group10Tests[0].id, level: 1, qcLotId: b1.id, mean: 11, sd: 0.6, low: null, high: null }] }, admin));
  const partial = un(cfg.activateLotGroup({ id: gB.id }, admin));
  assert.equal(partial.applied, 1, 'chỉ mức QC có số mới được áp');
  assert.deepEqual(partial.stoppedGroups, [], 'nhóm cũ CÒN xét nghiệm dùng thì chưa được dừng');
  assert.equal(statusOf(gA.id), '', 'nhóm cũ phải vẫn đang chạy');
  for (const t of group10Tests.slice(1)) {
    assert.equal(listOperationalLevels(db, t.id).length, 1,
      `"${t.name}" phải CÒN mức QC đang vận hành sau khi nhóm khác được kích hoạt`);
  }

  // Chuyển nốt 2 xét nghiệm còn lại -> giờ nhóm A mới thật sự hết dùng
  un(cfg.savePlannedTargets({ items: group10Tests.slice(1).map((t) => ({ testId: t.id, level: 1, qcLotId: b1.id, mean: 11, sd: 0.6, low: null, high: null })) }, admin));
  const rest = un(cfg.activateLotGroup({ id: gB.id }, admin));
  assert.equal(rest.applied, 2);
  assert.deepEqual(rest.stoppedGroups, [gA.id], 'hết mức QC nào dùng thì nhóm cũ mới bị dừng');
  assert.equal(statusOf(gA.id), 'stopped');
  for (const t of group10Tests) assert.equal(listOperationalLevels(db, t.id).length, 1, 'mọi xét nghiệm vẫn vận hành, nay trên nhóm mới');
}

console.log('app-v2 planned-targets tests passed');

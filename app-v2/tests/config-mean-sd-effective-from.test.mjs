// Kiểm chứng `test_levels.mean_sd_effective_from` — port effectiveFrom:
// isoToday() app cũ (commitTargetMatrix()/applyLotGroupActivation()): MỌI
// lần lưu Mean/SD qua Bảng Mean/SD đều đóng dấu NGÀY LƯU cho cấu hình đang
// hoạt động, kể cả khi giá trị không đổi so với trước — khác hẳn
// `mean_sd_history_json` (chỉ chốt khi giá trị THẬT SỰ đổi). Thiếu cột này
// khiến tab "Lịch sử dữ liệu" không có cách nào biết cấu hình hiện hành có
// hiệu lực từ bao giờ, luôn hiện "Không giới hạn" dù người dùng vừa lưu
// xong (bug thật người dùng phát hiện qua ảnh chụp).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };
const today = new Date().toISOString().slice(0, 10);

const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, actor).data;

// 1) Mức 1 tự tạo lúc thêm xét nghiệm — CHƯA từng lưu qua Bảng Mean/SD nên
// chưa có mốc hiệu lực nào (khác hẳn xử lý cho "changed" của history).
const freshLevel = config.listTestLevels(test.id).find((l) => l.level === 1);
assert.equal(freshLevel.mean_sd_effective_from, '', 'muc tu tao chua duoc dong dau hieu luc');

// 2) Lưu Mean/SD lần đầu — phải đóng dấu ĐÚNG hôm nay.
const lot1 = config.saveLot({ data: { lotNo: 'L1', level: 1 } }, actor).data;
const saved1 = config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lot1.id } }, actor);
assert.equal(saved1.ok, true);
assert.equal(saved1.data.mean_sd_effective_from, today, 'luu Mean/SD lan dau phai dong dau hom nay');

// 3) Lưu lại Y HỆT số cũ (không đổi mean/sd) — vẫn phải đóng dấu lại hôm
// nay, KHÔNG chỉ khi giá trị khác (đúng app cũ: mỗi lần bấm "Lưu Mean/SD
// mức này" đều re-stamp effectiveFrom, không điều kiện gì).
const saved2 = config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lot1.id } }, actor);
assert.equal(saved2.ok, true);
assert.equal(saved2.data.mean_sd_effective_from, today, 'luu lai cung so cu van phai dong dau lai hom nay');
// Vì giá trị không đổi, KHÔNG được chốt thêm dòng lịch sử nào (khác hẳn
// mean_sd_effective_from — 2 cột có 2 điều kiện khác nhau).
assert.equal(JSON.parse(saved2.data.mean_sd_history_json).length, 0, 'gia tri khong doi thi khong chot lich su');

// 4) Đổi sang giá trị khác — vẫn đóng dấu hôm nay, VÀ chốt giá trị cũ vào
// lịch sử (2 hành vi độc lập, không cái nào thay cái kia).
const saved3 = config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 105, sd: 3, qcLotId: lot1.id } }, actor);
assert.equal(saved3.ok, true);
assert.equal(saved3.data.mean_sd_effective_from, today);
assert.equal(JSON.parse(saved3.data.mean_sd_history_json).some((h) => h.mean === 100 && h.sd === 2), true,
  'gia tri cu (100/2) phai duoc chot vao lich su khi doi sang gia tri moi');

console.log('app-v2 config-mean-sd-effective-from oracle tests passed');

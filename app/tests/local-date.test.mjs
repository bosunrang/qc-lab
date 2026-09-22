// Oracle test cho isoLocalDate()/isoLocalDateAfter() — `local-date.ts` KHÔNG
// import module nào nên nạp thẳng `.ts` qua ESM được (xem CLAUDE.md).
//
// Bẫy được khoá ở đây: `new Date().toISOString().slice(0,10)` trả ngày UTC.
// Ở múi giờ dương (VN = UTC+7), 06:05 sáng ngày 10 có ISO là 23:05Z NGÀY 09
// — ca QC sáng sớm sẽ bị tính vào hôm qua.
import assert from 'node:assert/strict';
import { isoLocalDate, isoLocalDateAfter } from '../main/domain/local-date.ts';

// Dựng thời điểm theo GIỜ ĐỊA PHƯƠNG của máy chạy test, rồi kiểm rằng hàm
// trả đúng ngày địa phương đó bất kể chênh lệch UTC.
const earlyMorning = new Date(2026, 8, 10, 6, 5, 0); // 06:05 ngày 10/09/2026
assert.equal(isoLocalDate(earlyMorning), '2026-09-10');
const lateEvening = new Date(2026, 8, 10, 23, 55, 0);
assert.equal(isoLocalDate(lateEvening), '2026-09-10');

// Không được rơi về ngày UTC khi hai bên lệch nhau.
const utcDate = earlyMorning.toISOString().slice(0, 10);
if (earlyMorning.getTimezoneOffset() < 0) {
  assert.notEqual(utcDate, '2026-09-10', 'múi giờ dương: ISO UTC phải là ngày hôm trước — đúng cái bẫy này tồn tại để chặn');
}

// Hạn xử lý NCE +7 ngày, kể cả khi bắc qua cuối tháng.
assert.equal(isoLocalDateAfter(7, new Date(2026, 8, 10, 6, 5, 0)), '2026-09-17');
assert.equal(isoLocalDateAfter(7, new Date(2026, 8, 28, 23, 55, 0)), '2026-10-05');
assert.equal(isoLocalDateAfter(0, new Date(2026, 0, 1, 0, 1, 0)), '2026-01-01');
// Năm nhuận.
assert.equal(isoLocalDateAfter(1, new Date(2028, 1, 28, 12, 0, 0)), '2028-02-29');

console.log('app local-date oracle tests passed');

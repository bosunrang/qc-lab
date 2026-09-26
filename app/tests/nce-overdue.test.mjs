// Quy tắc hồ sơ NCE quá hạn nằm ở main (kế hoạch kiến trúc F.2): hàm thuần
// `nceOverdueDays` và trường `overdue_days` mà `listNceRecords` trả về. Các
// ca dưới đây chuyển từ test view-model Tổng quan, nơi quy tắc từng nằm.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { nceOverdueDays, nceOwner } = require('../../app-dist/main/domain/nce-overdue.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { isoLocalDate } = require('../../app-dist/main/domain/local-date.js');

const nce = (over = {}) => ({
  id: 'N1', due_date: '2026-09-01', record_status: 'active', approval_status: 'pending',
  detail_json: JSON.stringify({ owner: 'Nguyễn An', correction: 'Đã kiểm tra lại QC' }),
  ...over,
});

test('hồ sơ đã ghi thật, chưa khép vòng, quá ngày hạn mới tính quá hạn', () => {
  assert.equal(nceOverdueDays(nce(), '2026-09-04'), 3);
  assert.equal(nceOverdueDays(nce({ approval_status: 'returned' }), '2026-09-04'), 3, 'hồ sơ bị trả lại vẫn chưa khép vòng');
  assert.equal(nceOverdueDays(nce({ approval_status: 'approved' }), '2026-09-04'), 0);
  assert.equal(nceOverdueDays(nce({ record_status: 'cancelled' }), '2026-09-04'), 0);
  assert.equal(nceOverdueDays(nce({ detail_json: JSON.stringify({ correction: 'Đã xử lý' }) }), '2026-09-04'), 0, 'nháp chưa có người phụ trách không tính quá hạn');
  assert.equal(nceOverdueDays(nce({ due_date: '2026-09-04' }), '2026-09-04'), 0, 'đến hạn hôm nay chưa phải quá hạn');
  assert.equal(nceOverdueDays(nce({ due_date: '' }), '2026-09-04'), 0, 'không có hạn thì không quá hạn');
  assert.equal(nceOverdueDays(nce({ detail_json: '{hỏng' }), '2026-09-04'), 0, 'JSON hỏng coi như chưa ghi đủ');
  assert.equal(nceOwner(nce()), 'Nguyễn An');
});

test('listNceRecords trả overdue_days tính theo ngày địa phương của máy chính', () => {
  const db = openDatabase(':memory:');
  const handlers = createNceHandlers(db);
  const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
  const today = isoLocalDate();
  const past = isoLocalDate(new Date(Date.now() - 5 * 86400000));
  const created = handlers.create({ data: { date: past, correction: 'Dừng trả kết quả, chạy lại QC', dueDate: past, protocol: { owner: 'Nguyễn An' } } }, actor);
  assert.equal(created.ok, true, JSON.stringify(created));
  const row = handlers.listRecords().find((item) => item.id === created.data.id);
  assert.equal(row.overdue_days, nceOverdueDays(row, today));
  assert.ok(row.overdue_days >= 4, `hạn 5 ngày trước phải quá hạn, được ${row.overdue_days}`);
  assert.equal(created.data.overdue_days, row.overdue_days, 'kết quả của thao tác ghi cũng mang cùng trường');
});

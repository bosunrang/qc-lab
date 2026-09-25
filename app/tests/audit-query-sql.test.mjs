// `audit.query` lọc và phân trang bằng SQL (kế hoạch E.2). Trước đây mỗi lần
// lật trang Nhật ký nạp cả bảng (tới 50.000 dòng) rồi lọc bằng JS. Kết quả
// phải trùng đúng cách cũ — `filterActivity` + `paginateActivity` trên toàn bộ
// bảng — nên test lấy cách cũ làm chuẩn đối chiếu.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Lọc ngày theo giờ địa phương: cố định giờ Việt Nam (UTC+7) để ca sát nửa
// đêm có nghĩa ở mọi máy chạy test. Đặt TRƯỚC khi nạp module (bộ định dạng
// giờ được dựng lúc nạp).
process.env.TZ = 'Asia/Ho_Chi_Minh';

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createAuditHandlers } = require('../../app-dist/main/ipc/audit-handlers.js');
const { rowToAuditEntry } = require('../../app-dist/main/ipc/shared.js');
const { filterActivity, paginateActivity } = require('../../app-dist/main/domain/audit-filter.js');
const { formatAuditDateTimeVN } = require('../../app-dist/main/domain/audit-format.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test' };

function seed(count) {
  const db = openDatabase(':memory:');
  const insert = db.prepare('INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const people = [['Nguyễn Văn Ánh', 'ktv1', 'technician'], ['Trần Thị Đào', 'admin', 'admin'], ['Lê Xem', 'xem', 'viewer']];
  const types = ['Thêm điểm QC', 'Huỷ điểm QC', 'Đăng nhập', 'Sửa lô QC'];
  const start = Date.parse('2026-01-01T16:30:00Z'); // 23:30 giờ Việt Nam: sát ranh giới ngày
  db.exec('BEGIN');
  for (let i = 1; i <= count; i++) {
    const [user, username, role] = people[i % people.length];
    insert.run(`a${i}`, i, new Date(start + i * 5 * 3600_000).toISOString(), user, username, `u-${username}`, role,
      types[i % types.length], `Glucose mức ${(i % 3) + 1} giá trị ${(5 + (i % 7)).toFixed(1)} mmol/L`, i % 2 ? 'Glucose' : 'Cholesterol',
      'app-desktop', `p${i}`, `h${i}`);
  }
  db.exec('COMMIT');
  return db;
}

function oracle(db, input) {
  const all = db.prepare('SELECT * FROM activity ORDER BY seq ASC').all().map(rowToAuditEntry);
  const filtered = filterActivity(all, String(input.query || ''), String(input.from || ''), String(input.to || ''));
  const page = paginateActivity(filtered, Number(input.page) || 1, Number(input.pageSize) || 25);
  return { ...page, total: all.length };
}

test('kết quả trùng cách lọc cũ trên mọi tổ hợp tìm chữ, khoảng ngày và trang', () => {
  const db = seed(700);
  const audit = createAuditHandlers(db);
  const queries = ['', 'glucose', 'GLUCOSE MUC 2', 'nguyen van anh', 'Đào', 'ktv', 'quản trị', 'chỉ xem', 'huy diem', '42', '5.0', 'không có dòng nào', '  '];
  const ranges = [['', ''], ['2026-01-10', ''], ['', '2026-02-01'], ['2026-01-05', '2026-01-20'], ['2026-03-01', '2026-02-01'], ['2027-01-01', ''],
    ['2026-01-07', '2026-01-07'], ['2026-02-30', ''], ['', 'abc'], ['2026-1-5', '2026-01-20']];
  const pages = [[1, 25], [3, 25], [999, 25], [1, 1], [2, 1000], [0, 0], [-4, 10]];
  let checked = 0;
  for (const query of queries) for (const [from, to] of ranges) for (const [page, pageSize] of pages) {
    const input = { query, from, to, page, pageSize };
    const actual = audit.query(input, admin);
    assert.equal(actual.ok, true);
    assert.deepEqual(actual.data, oracle(db, input), JSON.stringify(input));
    checked++;
  }
  assert.ok(checked > 500);
});

test('lọc ngày theo ngày giờ Việt Nam mà bảng hiển thị, không theo ngày UTC', () => {
  const db = openDatabase(':memory:');
  const insert = db.prepare("INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash) VALUES (?,?,?,'A','a','u','admin','Thêm điểm QC','','','t','','')");
  insert.run('late', 1, '2026-09-25T16:59:59.999Z'); // 23:59:59 ngày 25/09 giờ Việt Nam
  insert.run('early', 2, '2026-09-25T17:00:00.000Z'); // 00:00 ngày 26/09
  insert.run('dawn', 3, '2026-09-25T23:30:00.000Z'); // 06:30 ngày 26/09, ngày UTC vẫn là 25/09
  const audit = createAuditHandlers(db);
  const seqs = (from, to) => audit.query({ from, to, page: 1, pageSize: 25 }, admin).data.rows.map((r) => r.seq);
  assert.equal(formatAuditDateTimeVN('2026-09-25T23:30:00.000Z'), '06:30 26/9/2026', 'bảng hiện 26/09');
  assert.deepEqual(seqs('2026-09-26', '2026-09-26'), [3, 2]);
  assert.deepEqual(seqs('2026-09-25', '2026-09-25'), [1]);
  assert.deepEqual(seqs('', '2026-09-25'), [1]);
  assert.deepEqual(seqs('2026-09-26', ''), [3, 2]);
  for (const [from, to] of [['2026-09-26', '2026-09-26'], ['2026-09-25', '2026-09-25']]) {
    assert.deepEqual(audit.query({ from, to, page: 1, pageSize: 25 }, admin).data, oracle(db, { from, to, page: 1, pageSize: 25 }));
  }
});

test('tìm theo giờ hiển thị (giờ Việt Nam) vẫn khớp', () => {
  const db = seed(40);
  const audit = createAuditHandlers(db);
  const row = rowToAuditEntry(db.prepare('SELECT * FROM activity WHERE seq=7').get());
  const shown = formatAuditDateTimeVN(row.ts);
  const result = audit.query({ query: shown, page: 1, pageSize: 25 }, admin);
  assert.ok(result.data.rows.some((r) => r.seq === 7), `tìm "${shown}" phải ra dòng 7`);
  assert.deepEqual(result.data, oracle(db, { query: shown, page: 1, pageSize: 25 }));
});

test('định dạng giờ nhật ký dùng bộ định dạng dựng sẵn cho kết quả như toLocale*', () => {
  const start = Date.parse('2025-12-31T16:59:00Z');
  for (let i = 0; i < 500; i++) {
    const date = new Date(start + i * 7_919_000);
    const expected = `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} ${date.toLocaleDateString('vi-VN')}`;
    assert.equal(formatAuditDateTimeVN(date.toISOString()), expected);
  }
  assert.equal(formatAuditDateTimeVN('không phải ngày'), '');
});

test('không phải admin thì không đọc được nhật ký', () => {
  const audit = createAuditHandlers(seed(3));
  assert.equal(audit.query({}, { ...admin, role: 'technician' }).ok, false);
});

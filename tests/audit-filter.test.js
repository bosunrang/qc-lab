const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const searchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
const isoDate = date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
const formatDateTimeVN = value => new Date(value).toLocaleDateString('vi-VN');
const roleLabel = role => role === 'admin' ? 'Quản trị' : role;
const parseDate = value => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || ''));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');
};
const ctx = loadSandbox(['modules/users-auth.js'], {
  searchText,
  isoDate,
  formatDateTimeVN,
  roleLabel,
  state: { activity: [] },
  headOnly: () => '',
  esc: value => String(value || ''),
  escAttr: value => String(value || ''),
  btn: (label, onclick, cls, title, options = {}) => `<button${options.disabled ? ' disabled' : ''}>${label}</button>`,
  emptyState: (title, message) => `<div class="empty"><b>${title}</b>${message}</div>`,
  dateBox: (id, value, cls, attrs) => `<span class="datebox ${cls}"><input id="${id}" class="date-text" placeholder="dd/mm/yyyy" ${attrs}><input class="native-date" type="date"></span>`,
  auditVerifyChain: () => ({ ok: true, checked: 0, legacy: 0 }),
  ACTIVITY_HARD_CAP: 120000,
  ACTIVITY_ROTATE_TO: 100000,
  rerender: () => {},
  vnPickerParse: parseDate,
  parseVN: parseDate,
});

const rows = [
  { seq: 1, ts: '2026-07-20T01:00:00.000Z', user: 'Quản trị viên', username: 'admin', role: 'admin', type: 'Thêm điểm QC', target: 'Sodium', detail: 'Mức 1' },
  { seq: 2, ts: '2026-07-21T01:00:00.000Z', user: 'Nguyễn Lan', username: 'lan.nt', role: 'technician', type: 'Cập nhật lô', target: 'Glucose', detail: 'LOT G02' },
  { seq: 3, ts: '2026-07-22T01:00:00.000Z', user: 'Trần Minh', username: 'minh.tt', role: 'technician', type: 'Xuất báo cáo', target: 'Sodium', detail: 'Tháng 07/2026' },
];

run(ctx, `state.activity=${JSON.stringify(rows)}; auditQ='sodium'; auditFrom=''; auditTo='';`);
assert.deepEqual(Array.from(run(ctx, 'auditFilteredActivities().map(row=>row.seq)')), [3, 1], 'Tìm kiếm phải xét cả đối tượng và trả mới nhất trước');

run(ctx, `auditQ='nguyen lan';`);
assert.deepEqual(Array.from(run(ctx, 'auditFilteredActivities().map(row=>row.seq)')), [2], 'Tìm kiếm phải bỏ dấu tiếng Việt');

run(ctx, `auditQ=''; auditFrom='2026-07-21'; auditTo='2026-07-22';`);
assert.deepEqual(Array.from(run(ctx, 'auditFilteredActivities().map(row=>row.seq)')), [3, 2], 'Khoảng ngày phải bao gồm cả hai đầu');

run(ctx, `auditSetDate('from','21/07/2026'); auditSetDate('to','');`);
assert.equal(run(ctx, 'auditFrom'), '2026-07-21', 'Xóa ngày kết thúc không được tự xóa ngày bắt đầu');

run(ctx, `auditQ='không có'; auditFrom=''; auditTo='';`);
assert.equal(run(ctx, 'auditFilteredActivities().length'), 0);

assert.deepEqual(Array.from(run(ctx, 'AUDIT_PAGE_SIZES')), [25, 50, 100]);

const manyRows = Array.from({ length: 30 }, (_, index) => ({ ...rows[index % rows.length], seq: index + 1 }));
run(ctx, `state.activity=${JSON.stringify(manyRows)}; auditQ=''; auditFrom=''; auditTo=''; auditPage=1; auditPageSize=25;`);
const firstPage = run(ctx, 'pageAudit()');
assert.match(firstPage, /id="auditSearch"/);
assert.match(firstPage, /class="datebox audit-date"/);
assert.match(firstPage, /placeholder="dd\/mm\/yyyy"/);
assert.match(firstPage, /class="audit-table-wrap"/);
assert.match(firstPage, /Hiển thị 1–25 \/ 30 dòng/);
assert.match(firstPage, /Trang 1\/2/);
assert.match(firstPage, /Lưu trữ nhật ký cũ/, 'Trang nhật ký phải có nút lưu trữ nhật ký cũ');

run(ctx, 'auditPage=2;');
const secondPage = run(ctx, 'pageAudit()');
assert.match(secondPage, /Hiển thị 26–30 \/ 30 dòng/);
assert.match(secondPage, /Trang 2\/2/);

console.log('Audit search, date filter and pagination tests passed');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const searchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
const isoDate = date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
const formatDateTimeVN = value => new Date(value).toLocaleDateString('vi-VN');
const roleLabel = role => role === 'admin' ? 'Quản trị' : role;
const parseDate = value => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || ''));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');
};
const activityAuditFilter = {
  dateKey: activity => { const date = new Date(activity && activity.ts); return Number.isFinite(+date) ? isoDate(date) : ''; },
  filter: (items, query, from, to) => (items || []).filter(activity => {
    const date = activityAuditFilter.dateKey(activity);
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;
    return !searchText(query) || searchText([activity.seq, formatDateTimeVN(activity.ts), activity.user, activity.username, roleLabel(activity.role || 'viewer'), activity.type, activity.target, activity.detail].join(' ')).includes(searchText(query));
  }).slice().reverse(),
};
const activityAuditPagination = (items, page, pageSize) => { const size = [25, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 25, count = Math.max(1, Math.ceil((items || []).length / size)), current = Math.min(Math.max(1, Number(page) || 1), count), offset = (current - 1) * size; return { page: current, pageCount: count, offset, rows: (items || []).slice(offset, offset + size), resultFrom: (items || []).length ? offset + 1 : 0, resultTo: Math.min(offset + size, (items || []).length) }; };
const activityAuditFilterState = { withQuery: (state, query) => ({ ...state, query, page: 1 }), withPageSize: (state, pageSize, sizes) => ({ ...state, pageSize: sizes.includes(Number(pageSize)) ? Number(pageSize) : 25, page: 1 }), withPage: (state, page) => ({ ...state, page: Math.max(1, Number(page) || 1) }), cleared: state => ({ ...state, query: '', from: '', to: '', page: 1 }) };
const updateActivityAuditDateRange = (state, field, value) => field === 'from' ? { from: value, to: value && state.to && value > state.to ? value : state.to } : { from: value && state.from && value < state.from ? value : state.from, to: value };
const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js'], {
  searchText,
  isoDate,
  formatDateTimeVN,
  roleLabel,
  state: { activity: [] },
  esc: value => String(value || ''),
  escAttr: value => String(value || ''),
  parseVN: parseDate,
  activityAuditFilter,
  activityAuditPagination,
  activityAuditFilterState,
  updateActivityAuditDateRange,
  activityAuditPageSizes: [25, 50, 100],
});
// headOnly/btn/emptyState/dateBox/rerender/vnPickerParse/auditVerifyChain/
// ACTIVITY_HARD_CAP/ACTIVITY_ROTATE_TO giờ cũng được generated/modular-pilot.js
// gán thật (root.X=...) khi nạp — đặt stub SAU khi loadSandbox() chạy xong để
// không bị bundle ghi đè (xem bài học Lát 1/2 của Pha G trong
// docs/TYPESCRIPT-MIGRATION-PLAN.md).
Object.assign(ctx, {
  headOnly: () => '',
  btn: (label, onclick, cls, title, options = {}) => `<button${options.disabled ? ' disabled' : ''}>${label}</button>`,
  emptyState: (title, message) => `<div class="empty"><b>${title}</b>${message}</div>`,
  dateBox: (id, value, cls, attrs) => `<span class="datebox ${cls}"><input id="${id}" class="date-text" placeholder="dd/mm/yyyy" ${attrs}><input class="native-date" type="date"></span>`,
  rerender: () => {},
  vnPickerParse: parseDate,
  auditVerifyChain: () => ({ ok: true, checked: 0, legacy: 0 }),
  ACTIVITY_HARD_CAP: 120000,
  ACTIVITY_ROTATE_TO: 100000,
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

// Trang Nhật ký hoạt động đã chuyển sang React (src/react/pages/AuditPage.tsx,
// xem docs/REACT-ADOPTION-PLAN.md) — pageAudit() không còn tồn tại. Phần phân
// trang dưới đây kiểm qua auditModel() (dữ liệu thuần AuditPage.tsx dùng để
// vẽ) thay vì quét chuỗi HTML của pageAudit() cũ.
const manyRows = Array.from({ length: 30 }, (_, index) => ({ ...rows[index % rows.length], seq: index + 1 }));
run(ctx, `state.activity=${JSON.stringify(manyRows)}; auditQ=''; auditFrom=''; auditTo=''; auditPage=1; auditPageSize=25;`);
const firstPage = run(ctx, 'auditModel()');
assert.equal(firstPage.total, 30);
assert.equal(firstPage.rows.length, 25);
assert.equal(firstPage.resultFrom, 1);
assert.equal(firstPage.resultTo, 25);
assert.equal(firstPage.page, 1);
assert.equal(firstPage.pageCount, 2);

run(ctx, 'auditPage=2;');
const secondPage = run(ctx, 'auditModel()');
assert.equal(secondPage.rows.length, 5);
assert.equal(secondPage.resultFrom, 26);
assert.equal(secondPage.resultTo, 30);
assert.equal(secondPage.page, 2);

// Bảo đảm không có nút "xóa nhật ký" toàn phần trong UI React của trang này —
// chỉ được lưu trữ có kiểm chứng (xem CLAUDE.md "app deliberately has no
// 'delete all audit' action").
const auditPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'pages', 'AuditPage.tsx'), 'utf8');
assert.match(auditPageSource, /Lưu trữ nhật ký cũ/, 'Trang nhật ký phải có nút lưu trữ nhật ký cũ');
assert.doesNotMatch(auditPageSource, /Xóa nhật ký/, 'Nhật ký chỉ được lưu trữ có kiểm chứng, không được xóa trắng trong app');

console.log('Audit search, date filter and pagination tests passed');

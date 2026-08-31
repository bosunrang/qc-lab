// Oracle test: doi chieu app-v2/main/domain/audit-filter.ts voi
// root.activityAuditFilter/root.activityAuditPagination/
// root.updateActivityAuditDateRange cua ban cu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { loadSandbox } = require('../../tests/helpers/sandbox.js');
const { filterActivity, paginateActivity, updateAuditDateRange } = require('../../app-v2-dist/main/domain/audit-filter.js');

const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);

function mkActivity(seq, ts, user, type, detail, target = '') {
  return { seq, ts, user, username: user.toLowerCase(), role: 'admin', type, detail, target, prevHash: '', hash: '' };
}

const items = [
  mkActivity(1, '2026-08-01T08:00:00.000Z', 'Nguyen Van A', 'Them may xet nghiem', 'Tao may Cobas', 'Cobas'),
  mkActivity(2, '2026-08-05T09:00:00.000Z', 'Tran Thi B', 'Sua xet nghiem', 'Cap nhat Glucose', 'Glucose'),
  mkActivity(3, '2026-08-10T10:00:00.000Z', 'Nguyen Van A', 'Them diem QC', 'Muc 1: 5.2', 'Glucose'),
];

// 1) Khong loc gi -> dao nguoc thu tu (moi nhat truoc)
{
  const oldR = ctx.activityAuditFilter.filter(items, '', '', '');
  const newR = filterActivity(items, '', '', '');
  assert.deepEqual(newR.map(a => a.seq), oldR.map(a => a.seq));
  assert.deepEqual(newR.map(a => a.seq), [3, 2, 1]);
}

// 2) Loc theo khoang ngay
{
  const oldR = ctx.activityAuditFilter.filter(items, '', '2026-08-03', '2026-08-08');
  const newR = filterActivity(items, '', '2026-08-03', '2026-08-08');
  assert.deepEqual(newR.map(a => a.seq), oldR.map(a => a.seq));
  assert.deepEqual(newR.map(a => a.seq), [2]);
}

// 3) Loc theo van ban tim kiem (khong phan biet dau/hoa-thuong)
{
  const oldR = ctx.activityAuditFilter.filter(items, 'glucose', '', '');
  const newR = filterActivity(items, 'glucose', '', '');
  assert.deepEqual(newR.map(a => a.seq), oldR.map(a => a.seq));
  assert.deepEqual(newR.map(a => a.seq), [3, 2]);
}

// 4) Phan trang - so sanh qua JSON (doi tuong cu tao trong vm context khac
// realm nen deepStrictEqual se bao "khong reference-equal" du cung cau truc)
{
  const oldR = ctx.activityAuditPagination(items, 1, 2);
  const newR = paginateActivity(items, 1, 2);
  assert.equal(JSON.stringify(newR), JSON.stringify(oldR));
}
{
  const oldR = ctx.activityAuditPagination(items, 2, 2);
  const newR = paginateActivity(items, 2, 2);
  assert.equal(JSON.stringify(newR), JSON.stringify(oldR));
}

// 5) Cap nhat khoang ngay - dao nguoc thu tu tu dong keo dau kia
{
  const oldR = ctx.updateActivityAuditDateRange({ from: '2026-08-10', to: '' }, 'to', '2026-08-05');
  const newR = updateAuditDateRange({ from: '2026-08-10', to: '' }, 'to', '2026-08-05');
  assert.equal(JSON.stringify(newR), JSON.stringify(oldR));
  assert.deepEqual(newR, { from: '2026-08-05', to: '2026-08-05' });
}

console.log('app-v2 audit-filter oracle tests passed');

const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/period-service.js', 'modules/entry-service.js']);

assert.equal(ctx.PeriodService.normalizePeriod('2026-7'), '2026-07');
assert.equal(ctx.PeriodService.normalizePeriod('2026-13'), '');
assert.equal(ctx.PeriodService.periodForDate('2026-07-14'), '2026-07');

const state = {
  periodLocks: [],
  data: { T1: [{ id: 'p1', date: '2026-07-14', level: 1, lot: 'L1', val: 10 }] },
  actions: [],
};

const locked = ctx.PeriodService.lock(state, {
  ym: '2026-7', lockedAt: '2026-07-14T00:00:00.000Z', lockedBy: 'Admin', note: 'Đã đối soát', id: 'lock1'
});
assert.equal(locked.lock.ym, '2026-07');
assert.equal(ctx.PeriodService.findLock(state, '2026-07').id, 'lock1');
assert.equal(ctx.EntryService.addPoint(state, {
  tid: 'T1', level: 1, date: '2026-07-14', val: 11, runId: '2026-07-14-2',
  cfg: { lot: 'L1', mean: 10, sd: 1 }, staff: {}, id: 'p2'
}).error, 'period-locked');
assert.equal(ctx.EntryService.saveDateNote(state, 'T1', '2026-07-14', 'sửa').error, 'period-locked');
assert.equal(ctx.EntryService.voidPoint(state, {
  tid: 'T1', pointId: 'p1', reason: 'nhập nhầm', staff: { operatorName: 'Admin' },
  nowIso: '2026-07-14T00:00:00.000Z', today: '2026-07-14', id: 'a1', pointRunNo: () => 1,
  formatDate: s => s, formatNumber: n => String(n)
}).error, 'period-locked');

assert.equal(ctx.PeriodService.unlock(state, { ym: '2026-07', reason: 'Bổ sung đối soát' }).reason, 'Bổ sung đối soát');
assert.equal(ctx.PeriodService.findLock(state, '2026-07'), null);
assert.equal(ctx.PeriodService.unlock(state, { ym: '2026-07', reason: 'mở lại kiểm tra' }).error, 'not-locked');

console.log('PeriodService tests passed');

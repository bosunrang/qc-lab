const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);

assert.equal(ctx.ReportPeriodPresentation.currentYearMonth('2026-08', '2026-01'), '2026-08');
assert.equal(ctx.ReportPeriodPresentation.currentYearMonth('2026-8', '2026-01'), '2026-01');
assert.equal(ctx.ReportPeriodPresentation.setPart('2026-08', 'month', 3), '2026-03');
assert.deepEqual([...ctx.ReportPeriodPresentation.sortedLocks([{ ym: '2026-07' }, { ym: '2026-08' }])].map(x => x.ym), ['2026-08', '2026-07']);

assert.equal(ctx.PeriodService.normalizePeriod('2026-7'), '2026-07');
assert.equal(ctx.PeriodService.normalizePeriod('2026-13'), '');
assert.equal(ctx.PeriodService.periodForDate('2026-07-14'), '2026-07');

const state = {
  periodLocks: [],
  tests: [{ id: 'T1', name: 'Glucose' }],
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
assert.equal(ctx.EntryService.updateDateNoteCommand(state, {
  testId: 'T1', date: '2026-07-14', value: 'sửa', formatDate: value => value
}).error, 'period-locked');
assert.equal(state.data.T1[0].note, undefined, 'command bị khóa không được mutation ghi chú');
assert.equal(ctx.EntryService.voidPoint(state, {
  tid: 'T1', pointId: 'p1', reason: 'nhập nhầm', staff: { operatorName: 'Admin' },
  nowIso: '2026-07-14T00:00:00.000Z', today: '2026-07-14', id: 'a1', pointRunNo: () => 1,
  formatDate: s => s, formatNumber: n => String(n)
}).error, 'period-locked');

/* lockedPoints(): câu hỏi dùng chung cho MỌI thao tác phá hủy/viết lại hàng loạt.
   Gộp theo kỳ, bỏ qua điểm ngoài kỳ khóa và ngày hỏng; điểm đã hủy VẪN tính vì
   chúng vẫn là hồ sơ của kỳ đó. */
{
  const many = [
    { id: 'a', date: '2026-07-01' },            // trong kỳ khóa
    { id: 'b', date: '2026-07-31' },            // trong kỳ khóa
    { id: 'c', date: '2026-07-05', voided: true }, // đã hủy nhưng vẫn là hồ sơ kỳ khóa
    { id: 'd', date: '2026-08-01' },            // kỳ chưa khóa
    { id: 'e', date: '' },                      // ngày hỏng
    null,
  ];
  // periods sinh trong realm vm nên sao chép sang mảng của Node trước khi deepEqual
  const summary = ctx.PeriodService.lockedPoints(state, many);
  assert.equal(summary.count, 3, 'chỉ đếm điểm thuộc kỳ đã khóa, gồm cả điểm đã hủy');
  assert.deepEqual([...summary.periods], ['2026-07']);
  assert.equal(ctx.PeriodService.lockedPoints(state, []).count, 0);
  assert.equal(ctx.PeriodService.lockedPoints(state, null).count, 0);

  ctx.PeriodService.lock(state, { ym: '2026-08', lockedAt: '', lockedBy: 'Admin', id: 'lock2' });
  const twoPeriods = ctx.PeriodService.lockedPoints(state, many);
  assert.equal(twoPeriods.count, 4);
  assert.deepEqual([...twoPeriods.periods], ['2026-07', '2026-08'], 'các kỳ phải được sắp xếp để hiện ra ổn định');
  ctx.PeriodService.unlock(state, { ym: '2026-08', reason: 'dọn sau khi kiểm' });
}

assert.equal(ctx.PeriodService.unlock(state, { ym: '2026-07', reason: 'Bổ sung đối soát' }).reason, 'Bổ sung đối soát');
assert.equal(ctx.PeriodService.findLock(state, '2026-07'), null);
assert.equal(ctx.PeriodService.unlock(state, { ym: '2026-07', reason: 'mở lại kiểm tra' }).error, 'not-locked');

console.log('PeriodService tests passed');

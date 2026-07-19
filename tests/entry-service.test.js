const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/entry-service.js']);
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;}');

const plain = v => JSON.parse(JSON.stringify(v));

{
  const window = ctx.EntryService.buildEntryWindow({
    points: [
      { id: 'late', date: '2026-07-10', runId: '2026-07-10-2' },
      { id: 'early', date: '2026-07-01', runId: '2026-07-01-1' },
    ],
    days: 7,
    today: '2026-07-10',
  });
  assert.deepEqual(plain(window.all.map(p => p.id)), ['late', 'early'], 'window keeps the original source array order');
  assert.deepEqual(plain(window.pts.map(p => p.id)), ['late'], 'window filters by an inclusive date range');
  assert.equal(window.start, '2026-07-04');
  assert.equal(window.end, '2026-07-10');

  const grouped = ctx.EntryService.groupByMachine([
    { id: 'T2', machine: 'Máy B' },
    { id: 'T1', machine: '' },
    { id: 'T3', machine: 'Máy A' },
  ]);
  assert.deepEqual([...grouped.keys()], ['(Chưa gán máy)', 'Máy A', 'Máy B']);
  assert.deepEqual(plain(grouped.get('Máy B').map(t => t.id)), ['T2']);

  const calendar = plain(ctx.EntryService.buildSheetCalendar('2024-02', '2026-07-14'));
  assert.equal(calendar.start, '2024-02-01');
  assert.equal(calendar.end, '2024-02-29');
  assert.equal(calendar.days.length, 29);
  assert.equal(calendar.days[28], '2024-02-29');
  assert.equal(calendar.yearMin, 2021);
  assert.equal(calendar.yearMax, 2031);

  const fallbackCalendar = ctx.EntryService.buildSheetCalendar('invalid', '2026-07-14');
  assert.equal(fallbackCalendar.activeMonth, '2026-07');

  const status = plain(ctx.EntryService.summarizeRunStatus([
    [
      { id: 'rejected', runId: '2026-07-14-1' },
      { id: 'accepted', runId: '2026-07-14-2' },
    ],
    [{ id: 'warning', runId: '2026-07-14-1' }],
  ], new Map([
    ['rejected', { level: 'rej', rules: ['1-3s'] }],
    ['accepted', { level: 'ok', rules: [] }],
    ['warning', { level: 'warn', rules: ['1-2s'] }],
  ])));
  assert.equal(status.hasPoint, true);
  assert.equal(status.worst, 'warn', 'an accepted later run replaces a rejected earlier run for that level');
  assert.deepEqual(status.warnRules, ['1-2s']);
  assert.deepEqual(status.rejRules, []);

  const warningAfterOk = plain(ctx.EntryService.summarizeRunStatus([[
    { id: 'ok-first', runId: '2026-07-14-1' },
    { id: 'warn-latest', runId: '2026-07-14-2' },
  ]], new Map([
    ['ok-first', { level: 'ok', rules: [] }],
    ['warn-latest', { level: 'warn', rules: ['6x'] }],
  ])));
  assert.equal(warningAfterOk.worst, 'warn', 'a warning is accepted and remains the visible latest run');

  const currentView = plain(ctx.EntryService.buildPointView({
    point: { val: 13 }, verdict: { level: 'rej', rules: ['1-3s'] }, mean: 10, sd: 1,
  }));
  assert.equal(currentView.z, 3);
  assert.equal(currentView.valueClass, 'rej');
  assert.deepEqual(currentView.rules, ['1-3s']);

  const previousView = plain(ctx.EntryService.buildPointView({
    point: { val: 9 }, verdict: { level: 'ok', rules: [] }, mean: 10, sd: 1, previousLot: 'OLD',
  }));
  assert.equal(previousView.z, -1);
  assert.equal(previousView.isPrevious, true);
  assert.equal(previousView.valueClass, 'prev');
}

{
  const state = {
    lab: {},
    tests: [{ id: 'T1', levels: [{ level: 1, lot: 'L1', mean: 10, sd: 1 }] }],
    data: { T1: [
      { id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, lot: 'L1', val: 10 },
      { id: 'p2', date: '2026-07-01', runId: '2026-07-01-2', level: 1, lot: 'L1', val: 11 },
    ] },
    actions: [],
  };
  assert.equal(ctx.EntryService.nextRunIdFor(state, 'T1', '2026-07-01'), '2026-07-01-3');

  const note = plain(ctx.EntryService.saveDateNote(state, 'T1', '2026-07-01', ' ghi chú mới '));
  assert.equal(note.note, 'ghi chú mới');
  assert.equal(state.data.T1[0].note, 'ghi chú mới');
  assert.equal(state.data.T1[1].note, 'ghi chú mới');

  const added = plain(ctx.EntryService.addPoint(state, {
    tid: 'T1',
    level: 1,
    date: '2026-07-02',
    val: 12,
    runId: '2026-07-02-1',
    cfg: { lot: 'L1', mean: 10, sd: 1 },
    staff: { operatorName: 'KTV A', operatorCode: 'A' },
    id: 'p3',
  }));
  assert.equal(added.id, 'p3');
  assert.equal(added.qcMean, 10);
  assert.equal(added.operatorName, 'KTV A');

  const recorded = plain(ctx.EntryService.recordPoint(state, {
    tid: 'T1', level: 1, date: '2026-07-03', value: '13',
    runId: '2026-07-03-1', cfg: { lot: 'L1', mean: 10, sd: 1 }, id: 'p4'
  }));
  assert.equal(recorded.ok, true);
  assert.equal(recorded.point.id, 'p4');
}

{
  const prepared = ctx.EntryService.preparePointInput({
    tid: ' T1 ', level: '2', date: '2026-07-03', value: ' 12.5 ',
    runId: ' 2026-07-03-2 ', cfg: { lot: 'L1', mean: 10, sd: 1 }, id: 'p4'
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.point.tid, 'T1');
  assert.equal(prepared.point.level, 2);
  assert.equal(prepared.point.val, 12.5);
  assert.equal(prepared.point.runId, '2026-07-03-2');

  const invalid = ctx.EntryService.preparePointInput({
    tid: 'T1', level: 1, date: '2026-07-03', value: 'abc', cfg: {}
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes('invalid-value'));
}

{
  const state = {
    lab: {},
    tests: [{ id: 'T1', levels: [{ level: 1, lot: 'L1', mean: 10, sd: 1 }] }],
    data: { T1: [
      { id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, lot: 'L1', val: 10 },
      { id: 'p2', date: '2026-07-01', runId: '2026-07-01-2', level: 1, lot: 'L1', val: 11 },
      { id: 'p3', date: '2026-07-01', runId: '2026-07-01-3', level: 1, lot: 'L1', val: 12 },
    ] },
    actions: [],
  };
  const result = plain(ctx.EntryService.voidPoint(state, {
    tid: 'T1',
    pointId: 'p2',
    reason: 'nhập nhầm giá trị',
    staff: { operatorName: 'KTV A' },
    nowIso: '2026-07-11T00:00:00.000Z',
    today: '2026-07-11',
    id: 'a1',
    pointRunNo: ctx.pointRunNo,
    formatDate: s => s,
    formatNumber: n => String(n),
  }));
  assert.equal(result.point.voided, true);
  assert.equal(result.reason, 'nhập nhầm giá trị');
  assert.equal(state.data.T1.find(p => p.id === 'p3').runId, '2026-07-01-3', 'historical run ids must remain stable after voiding a point');
  ctx.__setState(state);
  ctx.normalizePointLots();
  assert.equal(ctx.__getState().data.T1.find(p => p.id === 'p3').runId, '2026-07-01-3', 'normalization must not re-number historical runs after reload');
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0].rule, 'Hủy điểm QC');
  assert.equal(state.actions[0].approvalStatus, 'pending');
}

{
  const rows = plain(ctx.EntryService.buildSheetRowsData({
    levels: [{ level: 1 }, { level: 2 }],
    sheetStart: '2026-07-01',
    sheetEnd: '2026-07-03',
    sheetDays: ['2026-07-01', '2026-07-02', '2026-07-03'],
    pointsByLevel: {
      1: [
        { id: 'p2', date: '2026-07-01', runId: '2026-07-01-2', level: 1, val: 11 },
        { id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, val: 10 },
      ],
      2: [
        { id: 'p3', date: '2026-07-01', runId: '2026-07-01-1', level: 2, val: 20 },
      ],
    },
    previousPointsByLevel: {
      1: [
        { id: 'old1', date: '2026-07-02', runId: '2026-07-02-1', level: 1, val: 9, _prevLot: 'OLD' },
      ],
    },
    pointRunNo: ctx.pointRunNo,
  }));

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].runs.map(r => r.runNo), [1, 2, 3], 'existing runs plus a next-run slot should be ordered numerically');
  assert.equal(rows[0].runs[0].levels[1].id, 'p1');
  assert.equal(rows[0].runs[0].levels[2].id, 'p3');
  assert.equal(rows[0].runs[1].levels[1].id, 'p2');
  assert.equal(rows[0].runs[2].nextRun, true);
  assert.equal(rows[1].runs[0].levels[1]._prevLot, 'OLD', 'previous-lot points should be included in the same sheet model for read-only display');
  assert.equal(rows[2].runs[0].runId, '', 'empty days keep one blank first-run row');
  assert.equal(ctx.EntryService.sheetFirstRunNo(rows[0]), 1);
  assert.deepEqual(plain(ctx.EntryService.sheetLevelRuns(rows[0], 1)).map(r => r.runNo), [1, 2]);
}

console.log('EntryService tests passed');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/entry-service.js']);
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;}');

const plain = v => JSON.parse(JSON.stringify(v));

{
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'entry-routes.js'), 'utf8');
  assert.match(routeSource, /EntryService\.updateDateNoteCommand\(/, 'route phải dùng date-note command');
  assert.doesNotMatch(routeSource, /EntryService\.saveDateNote\(/, 'route không được gọi mutation primitive trực tiếp');
  assert.match(routeSource, /save\(result\.effects\.save\)/, 'route phải dùng save policy do command trả về');
}

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

  const currentWindow = ctx.EntryService.buildEntryWindow({
    points: [{ id: 'latest', date: '2026-07-01', runId: '2026-07-01-1' }],
    days: 60,
    today: '2026-07-19',
  });
  assert.equal(currentWindow.start, '2026-05-21', 'preset range counts back from today');
  assert.equal(currentWindow.end, '2026-07-19', 'default end date is today, not the latest QC point');

  const manualWindow = ctx.EntryService.buildEntryWindow({
    points: [{ id: 'latest', date: '2026-07-01', runId: '2026-07-01-1' }],
    days: 60,
    end: '2026-07-01',
    today: '2026-07-19',
  });
  assert.equal(manualWindow.start, '2026-05-03');
  assert.equal(manualWindow.end, '2026-07-01', 'a manually selected end date remains authoritative');

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

  const command = plain(ctx.EntryService.updateDateNoteCommand(state, {
    testId: 'T1', date: '2026-07-01', value: ' ghi chú command ', formatDate: value => '01/07/2026'
  }));
  assert.equal(command.ok, true);
  assert.equal(command.note, 'ghi chú command');
  assert.equal(command.messageCode, 'note-saved');
  assert.deepEqual(command.effects.audit, {
    action: 'Ghi chú QC', detail: 'Ngày 01/07/2026 · ghi chú command', target: ''
  });
  assert.deepEqual(command.effects.save, { clearDerived: false, testId: 'T1' });
  assert.equal(state.data.T1[0].note, 'ghi chú command');

  const removedNote = plain(ctx.EntryService.updateDateNoteCommand(state, {
    testId: 'T1', date: '2026-07-01', value: '', formatDate: () => '01/07/2026'
  }));
  assert.equal(removedNote.messageCode, 'note-removed');
  assert.equal(removedNote.effects.audit.detail, 'Ngày 01/07/2026 · xóa ghi chú');
  assert.equal(state.data.T1[1].note, '');

  assert.equal(ctx.EntryService.updateDateNoteCommand(state, { testId: '', date: '2026-07-01' }).error, 'invalid-test');
  assert.equal(ctx.EntryService.updateDateNoteCommand(state, { testId: 'T1', date: '01/07/2026' }).error, 'invalid-date');
  assert.equal(ctx.EntryService.updateDateNoteCommand(state, { testId: 'T2', date: '2026-07-01' }).error, 'test-not-found');
  assert.equal(ctx.EntryService.updateDateNoteCommand(state, { testId: 'T1', date: '2026-07-09' }).error, 'no-points');

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
    reason: '',
    kind: 'data-entry',
    openNce: false,
    staff: { operatorName: 'KTV A' },
    nowIso: '2026-07-11T00:00:00.000Z',
    today: '2026-07-11',
    id: 'a1',
    pointRunNo: ctx.pointRunNo,
    formatDate: s => s,
    formatNumber: n => String(n),
  }));
  assert.equal(result.point.voided, true);
  assert.equal(result.reason, 'Nhập sai dữ liệu');
  assert.equal(result.point.voidKind, 'data-entry');
  assert.equal(result.point.voidRequiresRerun, false);
  assert.equal(state.data.T1.find(p => p.id === 'p3').runId, '2026-07-01-3', 'historical run ids must remain stable after voiding a point');
  ctx.__setState(state);
  ctx.normalizePointLots();
  assert.equal(ctx.__getState().data.T1.find(p => p.id === 'p3').runId, '2026-07-01-3', 'normalization must not re-number historical runs after reload');
  assert.equal(state.actions.length, 0, 'nhập sai dữ liệu chỉ để lại audit, không tự mở NCE');
}

{
  const state = {
    tests: [{ id: 'T1', levels: [{ level: 1, lot: 'L1', mean: 10, sd: 1 }] }],
    data: { T1: [{ id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, lot: 'L1', val: 14 }] },
    actions: [],
  };
  const result = plain(ctx.EntryService.voidPoint(state, {
    tid: 'T1', pointId: 'p1', reason: '', kind: 'analytical', openNce: true, rule: '1-3s', errorType: 'RE — Sai số ngẫu nhiên', qcVerdict: 'rej',
    staff: { operatorId: 'u1', operatorUsername: 'ktv', operatorName: 'KTV A' },
    nowIso: '2026-07-11T00:00:00.000Z', today: '2026-07-11', dueDate: '2026-07-18',
    id: 'a1', nceId: 'NCE-20260711-A001', formatDate: s => s, formatNumber: n => String(n),
  }));
  assert.equal(result.point.voidRequiresRerun, true);
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0].protocolVersion, 3);
  assert.equal(state.actions[0].nceId, 'NCE-20260711-A001');
  assert.equal(state.actions[0].eventSource, 'iqc');
  assert.equal(state.actions[0].rule, '1-3s');
  assert.equal(state.actions[0].errorType, 'RE — Sai số ngẫu nhiên');
  assert.equal(state.actions[0].qcVerdict, 'rej');
  assert.equal(state.actions[0].date, '2026-07-01', 'ngày hồ sơ phải phản ánh ngày điểm QC xảy ra, không phải ngày thao tác hủy');
  assert.equal(state.actions[0].openedFromVoid, true, 'hồ sơ sinh từ thao tác hủy phải giữ nguồn tạo rõ ràng');
  assert.match(state.actions[0].correction, /Kết quả QC thực tế không hợp lệ/);
}

{
  const existing={id:'nce1',protocolVersion:2,nceId:'NCE-CU',pointId:'p1',approvalStatus:'pending'};
  const state={tests:[{id:'T1'}],data:{T1:[{id:'p1',date:'2026-07-01',runId:'1',level:1,lot:'L1',val:14}]},actions:[existing]};
  const result=plain(ctx.EntryService.voidPoint(state,{tid:'T1',pointId:'p1',reason:'Máy báo lỗi khi chạy QC',kind:'analytical',openNce:true,staff:{operatorName:'KTV A'},nowIso:'2026-07-11T00:00:00.000Z',today:'2026-07-11',id:'a2',nceId:'NCE-MOI',formatDate:s=>s,formatNumber:n=>String(n)}));
  assert.equal(state.actions.length,1,'không tạo NCE trùng khi điểm đã có hồ sơ đang mở');
  assert.equal(result.reusedAction,true);
  assert.equal(result.action.id,'nce1');
}

{
  const cancelled={id:'nce-cu',protocolVersion:3,nceId:'NCE-DA-HUY',pointId:'p1',approvalStatus:'pending',recordStatus:'cancelled'};
  const state={tests:[{id:'T1'}],data:{T1:[{id:'p1',date:'2026-07-01',runId:'1',level:1,lot:'L1',val:14}]},actions:[cancelled]};
  const result=plain(ctx.EntryService.voidPoint(state,{tid:'T1',pointId:'p1',reason:'Máy báo lỗi khi chạy QC',kind:'analytical',openNce:true,staff:{operatorName:'KTV A'},nowIso:'2026-07-11T00:00:00.000Z',today:'2026-07-11',id:'nce-moi',nceId:'NCE-MOI',formatDate:s=>s,formatNumber:n=>String(n)}));
  assert.equal(state.actions.length,2,'hồ sơ đã hủy chỉ là lịch sử, không được tái sử dụng cho sự cố mới');
  assert.equal(result.reusedAction,false);
  assert.equal(result.action.id,'nce-moi');
  assert.equal(result.action.recordStatus,'active');
}

{
  const state={tests:[{id:'T1'}],data:{T1:[{id:'p1',date:'2026-07-01',level:1,val:10}]},actions:[]};
  const result=plain(ctx.EntryService.voidPoint(state,{tid:'T1',pointId:'p1',reason:'',kind:'other',openNce:false,staff:{operatorName:'KTV A'},nowIso:'2026-07-11T00:00:00.000Z',today:'2026-07-11',id:'a1',formatDate:s=>s,formatNumber:n=>String(n)}));
  assert.equal(result.error,'reason-too-short','lý do khác vẫn bắt buộc nội dung giải thích');
  assert.equal(state.data.T1[0].voided,undefined);
}

{
  // ISO 15189 đòi lý do cho mọi thao tác hủy dữ liệu: nhãn loại hủy là phân loại,
  // ghi chú tự do của người dùng phải được giữ lại chứ không bị chuỗi mẫu nuốt mất.
  const state={tests:[{id:'T1'}],data:{T1:[
    {id:'p1',date:'2026-07-01',runId:'1',level:1,lot:'L1',val:14},
    {id:'p2',date:'2026-07-02',runId:'1',level:1,lot:'L1',val:14},
  ]},actions:[]};
  const withNote=plain(ctx.EntryService.voidPoint(state,{tid:'T1',pointId:'p1',reason:'Máy báo lỗi hút mẫu lúc 08:15',kind:'analytical',openNce:true,staff:{operatorName:'KTV A'},nowIso:'2026-07-11T00:00:00.000Z',today:'2026-07-11',id:'a1',nceId:'NCE-1',formatDate:s=>s,formatNumber:n=>String(n)}));
  assert.equal(withNote.reason,'Kết quả QC thực tế không hợp lệ — Máy báo lỗi hút mẫu lúc 08:15','ghi chú được nối vào sau nhãn loại hủy');
  assert.equal(state.data.T1[0].voidReason,withNote.reason);
  const withoutNote=plain(ctx.EntryService.voidPoint(state,{tid:'T1',pointId:'p2',reason:'',kind:'analytical',openNce:true,staff:{operatorName:'KTV A'},nowIso:'2026-07-11T00:00:00.000Z',today:'2026-07-11',id:'a2',nceId:'NCE-2',formatDate:s=>s,formatNumber:n=>String(n)}));
  assert.equal(withoutNote.reason,'Kết quả QC thực tế không hợp lệ','không ghi chú thì vẫn giữ nhãn loại hủy');
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

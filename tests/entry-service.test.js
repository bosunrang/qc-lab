const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/entry-service.js']);
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;}');

const plain = v => JSON.parse(JSON.stringify(v));

{
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'entry-routes.js'), 'utf8');
  const entryActionsSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'entry-tests-actions.js'), 'utf8');
  const drawSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'draw.js'), 'utf8');
  const rangeSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'range.js'), 'utf8');
  assert.match(routeSource, /EntryService\.updateDateNoteCommand\(/, 'route phải dùng date-note command');
  assert.doesNotMatch(routeSource, /EntryService\.saveDateNote\(/, 'route không được gọi mutation primitive trực tiếp');
  assert.match(routeSource, /save\(result\.effects\.save\)/, 'route phải dùng save policy do command trả về');
  assert.match(routeSource, /metric\('Mean thực',st\?fmtTestValue\(t,st\.m\)/, 'Mean thực phải dùng số thập phân của xét nghiệm');
  assert.match(routeSource, /metric\('SD thực',st\?fmtTestStat\(t,st\.sd\)/, 'SD thực phải dùng số thập phân thống kê của xét nghiệm');
  assert.match(routeSource, /metric\('Mean mục tiêu',fmtTestValue\(t,chartMean\)/, 'Mean mục tiêu phải dùng số thập phân của xét nghiệm');
  assert.match(routeSource, /metric\('SD mục tiêu',fmtTestValue\(t,chartSd\)/, 'SD mục tiêu phải dùng số thập phân của xét nghiệm');
  assert.match(routeSource, /<details class="panel entry-secondary-panel qc-points-panel"/, 'bảng điểm tra cứu phải thu gọn mặc định');
  assert.doesNotMatch(routeSource, /metric\('LOT \/ Hạn dùng'/, 'dải thông số biểu đồ không lặp lại lô và hạn dùng');
  assert.match(routeSource, /class="lj-point-count">\$\{chartPts\.length\} điểm/, 'số điểm biểu đồ phải nằm cạnh mức và lô');
  assert.match(routeSource, /class="entryLJStack" data-render-scale="2"/, 'biểu đồ nhập QC phải yêu cầu canvas 2x để tránh mờ khi co giãn');
  assert.match(routeSource, /Lô'\} \$\{esc\(lvlLot\|\|'\?'\)\}.*qc-table-count/, 'số điểm phải nằm cùng cụm tiêu đề với số lô');
  assert.match(routeSource, /<b>\$\{fmtPointValue\(p,t\)\}<\/b>/, 'điểm trong khoảng xem phải dùng số thập phân của xét nghiệm');
  assert.match(routeSource, /Mean tích lũy<\/span><b>\$\{cumulativeSt\?fmtTestValue\(t,cumulativeSt\.m\)/, 'Mean tích lũy phải dùng số thập phân của xét nghiệm');
  assert.match(routeSource, /class="qc-level-head" tabindex="0" data-qc-tooltip=/, 'tiêu đề mức phải có tooltip Mean\/SD dùng được bằng chuột và bàn phím');
  assert.match(routeSource, /±2SD \$\{limits\}/, 'tooltip tiêu đề mức phải có khoảng ±2SD');
  assert.match(entryActionsSource, /id="cfgAssayDecimals"/, 'form xét nghiệm phải có ô chọn số thập phân');
  assert.match(entryActionsSource, /decimalPlaces=decimalRaw===''\?null:Number\(decimalRaw\)/, 'Tự động phải được lưu bằng null, lựa chọn thủ công phải lưu bằng số');
  assert.match(rangeSource, /fmtTestValue\(r\.t,r\.l\.mean\)/, 'hộp dải kiểm soát phải dùng số thập phân của xét nghiệm');
  assert.match(rangeSource, /fmtTestValue\(r\.t,r\.l\.mean-2\*r\.l\.sd\)/, 'giới hạn kiểm soát phải dùng số thập phân của xét nghiệm');
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
  assert.equal(prepared.point.valueDecimals, 1);
  assert.equal(prepared.point.runId, '2026-07-03-2');

  const ph = plain(ctx.EntryService.recordPoint({data:{}},{
    tid:'PH',level:1,date:'2026-07-03',value:'7.405',runId:'2026-07-03-1',cfg:{lot:'2111',mean:7.4,sd:.01},id:'ph1'
  }));
  assert.equal(ph.point.val,7.405,'giá trị dùng tính toán không bị làm tròn');
  assert.equal(ph.point.valueDecimals,3,'giữ độ chính xác từ chuỗi người dùng nhập');
  assert.equal(ctx.fmtPointValue(ph.point),'7.405');
  assert.equal(ctx.fmtPointValue({val:7.405}),'7.405','điểm cũ chưa có metadata vẫn suy ra đủ chữ số');
  assert.equal(ctx.fmtPointValue({val:7.4,valueDecimals:3}),'7.400','giữ cả số 0 tận cùng đã nhập');
  assert.equal(ctx.fmtPointValue({val:450},{decimalPlaces:1}),'450.0','1 trùng với mặc định nhưng vẫn phải cho ra cùng kết quả');
  /* decimalPlaces=0 là LỰA CHỌN TAY hợp lệ (ví dụ đếm tế bào WBC/RBC), phải được tôn
     trọng nguyên vẹn — không bị ép lên mặc định 1. Đây là chỗ dễ hỏng nhất: Number(null)
     (chưa cấu hình) === Number(0) (đã chọn 0) === 0, nên phải kiểm giá trị THÔ trước khi
     ép kiểu, nếu không mọi xét nghiệm chưa từng đụng ô này sẽ bị hiểu nhầm thành "đã chọn
     0 chữ số" và mất mặc định 1 — chỉ ngược với hồi quy đã sửa bên dưới. */
  assert.equal(ctx.fmtPointValue({val:450},{decimalPlaces:0}),'450','decimalPlaces=0 phải được tôn trọng, không bị ép về mặc định');
  assert.equal(ctx.testDecimalPlaces({decimalPlaces:0}),0,'đã chọn tay 0 chữ số thì testDecimalPlaces phải trả đúng 0, không phải mặc định');
  /* HỒI QUY TỪ BÁO CÁO THẬT (2026-08-02). Sau khi bỏ SD ra khỏi phép suy, điểm QC cũ —
     nhập trước khi có point.valueDecimals — chỉ còn suy từ chính val. Kali "4.0" lưu thành
     val=4, mà String(4)="4" nên ra 0 chữ số: bảng nhập QC hiện "4". Toàn bộ dữ liệu lịch sử
     mất phần thập phân trong im lặng. Mặc định 1 chữ số chặn đúng chỗ này. */
  assert.equal(ctx.fmtPointValue({val:4},{levels:[{level:1,mean:4,sd:0.1}]}),'4.0','điểm QC cũ không có metadata vẫn phải giữ 1 chữ số thập phân');
  assert.equal(ctx.fmtPointValue({val:4,valueDecimals:0},null),'4.0','gõ "4" hay "4.0" đều hiển thị như nhau');
  assert.equal(ctx.fmtPointValue({val:7.405},null),'7.405','nhưng gõ nhiều chữ số hơn thì KHÔNG bị làm tròn xuống 1');
  assert.equal(ctx.testDecimalPlaces({}),1,'xét nghiệm mới chưa cấu hình gì thì mặc định 1 chữ số');
  assert.equal(ctx.fmtPointValue({val:450},{decimalPlaces:3}),'450.000','lựa chọn thủ công phải được áp dụng chính xác');
  assert.equal(ctx.fmtPointValue({val:7.405},{decimalPlaces:2}),'7.41','lựa chọn thủ công chỉ làm tròn phần hiển thị');
  assert.equal(ctx.fmtTestValue({decimalPlaces:1},100.25),'100.3');

  /* SỐ LẺ CỦA SD PHẢI TÁCH KHỎI SỐ LẺ CỦA GIÁ TRỊ.
     Bản đầu dùng chung testDecimalPlaces() lấy max của mean/sd/low/high nên hỏng theo CẢ
     HAI chiều, tùy có cấu hình tay hay không:
       - không cấu hình: SD 0.153 kéo giá trị nhập "5.6" thành "5.600" — độ chính xác giả,
         mà con số trong hồ sơ nội kiểm ngụ ý độ phân giải của máy;
       - cấu hình decimalPlaces=1: SD 0.153 hiện thành "0.2" — người đọc báo cáo hết tự
         kiểm chứng được z-score và CV, đúng thứ mà fmt(sd,3) cũ bảo vệ.
     Chốt nguyên bảng để không ai gộp lại hai đường này. */
  const val=(t,p)=>ctx.fmtPointValue(p,t), sd=(t,v)=>ctx.fmtTestStat(t,v);
  {
    const glucose={levels:[{level:1,mean:5.6,sd:0.153}]};
    assert.equal(val(glucose,{val:5.6,valueDecimals:1}),'5.6','SD nhiều chữ số KHÔNG được kéo số lẻ của giá trị lên');
    assert.equal(sd(glucose,0.153),'0.153','SD giữ đủ chữ số như fmt(sd,3) trước đây');

    const fixed={decimalPlaces:2,levels:[{level:1,mean:5.6,sd:0.153}]};
    assert.equal(val(fixed,{val:5.6,valueDecimals:1}),'5.60');
    assert.equal(sd(fixed,0.153),'0.1530','cấu hình tay chỉ chi phối GIÁ TRỊ, không được cắt cụt SD');

    const natri={levels:[{level:1,mean:140,sd:1.5}]};
    assert.equal(val(natri,{val:141,valueDecimals:0}),'141.0','chưa cấu hình tay thì mặc định 1 chữ số, kể cả khi người dùng gõ số nguyên');
    assert.equal(sd(natri,1.5),'1.500');

    const ph={levels:[{level:1,mean:7.4,sd:0.01}]};
    assert.equal(val(ph,{val:7.405,valueDecimals:3}),'7.405');
    assert.equal(val(ph,{val:7.405}),'7.405','điểm cũ chưa có metadata vẫn suy từ chính giá trị');
    assert.equal(sd(ph,0.01),'0.010');
    /* SD tính ra là số thực có nhiễu dấu phẩy động; số lẻ phải suy từ CẤU HÌNH chứ không
       từ chính giá trị SD, nếu không sẽ ra 6 chữ số rác. */
    assert.equal(sd(ph,0.009999999999999998),'0.010','nhiễu dấu phẩy động không được lọt ra hiển thị');
  }
  assert.equal(ctx.qcValueDecimals('.5'),1,'".5" cũng là số — thiếu phần nguyên không có nghĩa là 0 chữ số');
  assert.equal(ctx.qcValueDecimals(',25'),2,'dấu phẩy thập phân theo thói quen nhập tiếng Việt');
  assert.equal(ctx.qcValueDecimals('1.5e2'),0,'150 thì không còn phần thập phân');

  /* valueDecimals là trường MỚI trên điểm QC nên phải được làm sạch tường minh:
     sanitizeBackup() chỉ ghi đè trường nó biết, trường lạ đi qua tự do — đúng cái mẫu đã
     cắn ở archiveRegistry. */
  {
    const build=v=>({lab:{},tests:[{id:'T1',name:'pH',levels:[{level:1,mean:7.4,sd:0.01}]}],
      data:{T1:[{id:'p1',date:'2026-08-01',runId:'r1',level:1,val:7.405,valueDecimals:v}]},actions:[],activity:[],users:[]});
    const clean=v=>ctx.QCCore.sanitizeBackup(build(v)).data.T1[0].valueDecimals;
    assert.equal(clean(3),3);
    assert.equal(clean(0),0,'0 chữ số là lựa chọn hợp lệ, không phải "chưa đặt"');
    [1e9,-5,'abc','3',2.5,null,undefined].forEach(bad=>assert.equal(clean(bad),null,`valueDecimals rác (${String(bad)}) phải về null`));
  }

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

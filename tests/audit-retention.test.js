const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js']);
run(ctx, `
  var currentUser = { id: 'u1', username: 'admin', name: 'Admin', role: 'admin' };
  var fb = { clientId: 'client-a' };
  function userName(){ return currentUser.name; }
  function role(){ return currentUser.role; }
  function __getState(){ return state; }
`);
const auditCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'audit.js'), 'utf8');
vm.runInContext(auditCode, ctx, { filename: 'modules/audit.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'generated', 'modular-pilot.js'), 'utf8'), ctx, { filename: 'generated/modular-pilot.js' });
run(ctx, `currentUser={id:'u1',username:'admin',name:'Admin',role:'admin'};`);

/* auditArchiveCut: tách đúng phần cũ hơn cutoff, dòng thiếu ts được giữ lại,
   tipHash là hash cuối cùng của phần bị cắt. */
{
  const activity = [
    { id: 'a1', seq: 1, ts: '2024-01-01T00:00:00.000Z', hash: 'h1', prevHash: '' },
    { id: 'a2', seq: 2, ts: '2024-06-01T00:00:00.000Z', hash: 'h2', prevHash: 'h1' },
    { id: 'a3', seq: 3, ts: '2026-01-01T00:00:00.000Z', hash: 'h3', prevHash: 'h2' },
    { id: 'a4', seq: 4, hash: 'h4', prevHash: 'h3' }, // không có ts -> giữ lại
  ];
  const cut = ctx.auditArchiveCut(activity, '2025-01-01T00:00:00.000Z');
  assert.equal(cut.segment.map(a => a.id).join(','), 'a1,a2');
  assert.equal(cut.retained.map(a => a.id).join(','), 'a3,a4');
  assert.equal(cut.tipHash, 'h2');
  const noHash = ctx.auditArchiveCut([{ id: 'x', ts: '2020-01-01T00:00:00.000Z' }], '2025-01-01T00:00:00.000Z');
  assert.equal(noHash.tipHash, '');
}

/* Xoay vòng tự động: vượt HARD_CAP thì logAct loại phần cũ nhất, relink chuỗi
   (verify phải ok), checkpoint ghi đúng hash đỉnh của phần đã loại, seq chạy tiếp. */
{
  run(ctx, `
    ACTIVITY_HARD_CAP = 5; ACTIVITY_ROTATE_TO = 3;
    state.activity = [];
    for (let i = 1; i <= 5; i++) logAct('Thao tác ' + i, 'chi tiết ' + i, 'mục ' + i);
  `);
  assert.equal(ctx.__getState().activity.length, 5); // chưa vượt cap -> chưa xoay
  const droppedTip = ctx.__getState().activity[2].hash; // đỉnh của 3 dòng sẽ bị loại
  run(ctx, `logAct('Thao tác 6', 'chi tiết 6', 'mục 6');`);
  const after = ctx.__getState().activity;
  assert.equal(after.length, 4); // 3 dòng giữ lại + 1 checkpoint
  const checkpoint = after[after.length - 1];
  assert.equal(checkpoint.type, 'Xoay vòng nhật ký hoạt động');
  assert.ok(checkpoint.detail.includes(droppedTip), 'checkpoint phải ghi hash đỉnh phần đã loại');
  assert.ok(checkpoint.detail.includes('3 dòng cũ nhất'));
  assert.equal(after.slice(0, 3).map(a => a.detail).join('|'), 'chi tiết 4|chi tiết 5|chi tiết 6');
  assert.equal(checkpoint.seq, 7);
  assert.equal(ctx.auditVerifyChain().ok, true, 'chuỗi sau xoay vòng phải hợp lệ');
  // logAct sau xoay vòng vẫn nối chuỗi bình thường
  run(ctx, `logAct('Thao tác 7', 'chi tiết 7', 'mục 7');`);
  assert.equal(ctx.__getState().activity.length, 5);
  assert.equal(ctx.auditVerifyChain().ok, true);
}

/* Mô phỏng đúng luồng lưu trữ có chủ đích (confirmArchiveActivityLog trừ phần
   DOM/CSV): cắt theo cutoff -> relink -> logAct checkpoint -> chuỗi hợp lệ và
   checkpoint chứa tipHash để đối chiếu với file CSV đã xuất. */
{
  run(ctx, `
    ACTIVITY_HARD_CAP = 120000; ACTIVITY_ROTATE_TO = 100000;
    state.activity = [];
    logAct('Đăng nhập', 'phiên cũ', 'Tài khoản');
    state.activity[0].ts = '2023-01-01T00:00:00.000Z';
    state.activity[0].hash = auditEntryHash(state.activity[0]);
    logAct('Nhập QC', 'phiên mới', 'Glucose');
  `);
  const before = ctx.__getState().activity;
  const cut = run(ctx, `auditArchiveCut(state.activity, '2024-01-01T00:00:00.000Z')`);
  assert.equal(cut.segment.length, 1);
  assert.equal(cut.tipHash, before[0].hash);
  run(ctx, `
    var __cut = auditArchiveCut(state.activity, '2024-01-01T00:00:00.000Z');
    state.activity = auditRelinkChain(__cut.retained);
    logAct('Lưu trữ nhật ký hoạt động', 'Hash đỉnh phần lưu trữ: ' + __cut.tipHash, 'Nhật ký');
  `);
  const after = ctx.__getState().activity;
  assert.equal(after.length, 2); // 1 dòng giữ lại + 1 checkpoint
  assert.equal(after[0].detail, 'phiên mới');
  assert.equal(after[1].type, 'Lưu trữ nhật ký hoạt động');
  assert.ok(after[1].detail.includes(before[0].hash));
  assert.equal(ctx.auditVerifyChain().ok, true);
}

/* Neo chuoi hash: cat prefix KHONG duoc lam doi hash cua phan con lai (de file CSV
   luu tru noi thang vao chuoi dang song), va auditVerifyChain() phai bat dau tu neo. */
{
  run(ctx, `
    ACTIVITY_HARD_CAP = 120000; ACTIVITY_ROTATE_TO = 100000;
    state.activity = []; state.activityAnchor = '';
    for (let i = 1; i <= 6; i++) logAct('Thao tác ' + i, 'chi tiết ' + i, 'mục ' + i);
  `);
  const before = JSON.parse(JSON.stringify(ctx.__getState().activity));
  run(ctx, `
    var __c = auditArchiveCut(state.activity, '2999-01-01T00:00:00.000Z');
  `);
  // cat 3 dong dau bang chinh duong ma confirmArchiveActivityLog() dung
  run(ctx, `
    var __seg = state.activity.slice(0, 3), __ret = state.activity.slice(3);
    state.activity = __ret;
    state.activityAnchor = auditLastHashOf(__seg);
  `);
  const after = ctx.__getState().activity;
  // So bằng chuỗi chứ không deepStrictEqual: mảng trả về từ sandbox vm thuộc realm
  // khác nên khác Array.prototype, deepStrictEqual sẽ fail dù nội dung giống hệt.
  assert.equal(after.map(a => a.hash).join('|'), before.slice(3).map(a => a.hash).join('|'),
    'cắt prefix không được băm lại phần còn lại — hash lịch sử phải giữ nguyên');
  assert.equal(ctx.__getState().activityAnchor, before[2].hash, 'neo = hash dòng cuối phần bị cắt');
  assert.equal(ctx.auditVerifyChain().ok, true, 'chuỗi còn lại vẫn hợp lệ nhờ neo');
  assert.equal(ctx.auditVerifyChain(after, '').ok, false, 'thiếu neo thì đúng ra phải báo lỗi');
  run(ctx, `logAct('Sau lưu trữ', 'nối tiếp', 'mục 7');`);
  assert.equal(ctx.auditVerifyChain().ok, true, 'ghi tiếp sau khi cắt vẫn nối đúng chuỗi');
}

/* Neo chi co nghia khi con dong de noi vao: xoa sach nhat ky roi ghi lai ma con giu neo
   cu se lam auditVerifyChain() bao "audit bi sua" gia ngay o dong dau tien. */
{
  run(ctx, `
    state.activity = [];              // vd clearActivityLog / nhap backup / reset
    logAct('Sau khi xóa', 'dòng đầu tiên', 'Nhật ký');
  `);
  assert.equal(ctx.__getState().activityAnchor, '', 'nhật ký rỗng thì neo phải được gỡ');
  assert.equal(ctx.auditVerifyChain().ok, true);
}

/* Moc hieu nang: xoay vong phai la O(1). Ban dau no relink ca chuoi — do duoc 2 235ms
   cho 20 000 dong, tuc ~11 GIAY o nguong tran, chan ngay giua mot thao tac khac. */
{
  run(ctx, `
    ACTIVITY_HARD_CAP = 120000; ACTIVITY_ROTATE_TO = 100000;
    state.activity = []; state.activityAnchor = '';
    for (let i = 0; i < 3500; i++) logAct('Nhập QC', 'chi tiết ' + i, 'Glucose');
    ACTIVITY_HARD_CAP = 3400; ACTIVITY_ROTATE_TO = 2500;
  `);
  // logAct() đẩy dòng mới TRƯỚC rồi mới xoay vòng, nên phần bị loại là 3001 dòng đầu
  // của mảng 12001 phần tử — đỉnh của nó là index 3000, tức length-9000 lúc chưa đẩy.
  const tipBefore = ctx.__getState().activity[ctx.__getState().activity.length - 2500].hash;
  const t0 = Date.now();
  run(ctx, `logAct('Nhập QC', 'giọt tràn ly', 'Glucose');`);
  const ms = Date.now() - t0;
  const after = ctx.__getState().activity;
  assert.equal(after.length, 2501, '2500 dòng giữ lại + 1 dòng checkpoint');
  assert.equal(ctx.__getState().activityAnchor, tipBefore, 'neo = hash đỉnh phần bị loại');
  assert.equal(ctx.auditVerifyChain().ok, true, 'chuỗi sau xoay vòng phải hợp lệ');
  /* 2 500 dòng: cắt bằng neo đo được ~1ms, còn băm lại cả chuỗi như bản đầu là ~158ms.
     Ngưỡng 60ms nằm giữa với biên rộng, mà vẫn giữ test dưới 1 giây — cỡ 12 000 dòng
     trước đây khiến riêng file này chạy 15s trong khi cả bộ chỉ 1,5s. */
  assert.ok(ms < 60, `xoay vòng phải gần như tức thời, đo được ${ms}ms — nếu vượt thì rất có thể ai đó đã băm lại cả chuỗi`);
}

console.log('Audit retention tests passed');

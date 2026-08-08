/**
 * Khóa kỳ báo cáo phải chặn được MỌI đường phá hủy / viết lại hàng loạt, không chỉ
 * addPoint / voidPoint / saveDateNote.
 *
 * Trước 2026-08-01, panel "Khóa kỳ báo cáo" nói với người dùng rằng khóa kỳ "chặn
 * sửa/hủy điểm QC của kỳ đó ở MỌI xét nghiệm", nhưng PeriodService chỉ được gọi ở
 * đúng ba chỗ trong entry-service.js. Hai đường đi xuyên qua khóa mà không ai biết:
 *
 *   1. delTest()             → `delete state.data[id]` xóa sạch điểm của kỳ đã chốt
 *   2. renameLotAcrossPoints → viết lại p.lot của điểm trong kỳ đã chốt, im lặng
 *
 * (1) nay bị CHẶN — đường đúng là mở khóa kỳ (bắt nhập lý do + tự ghi nhật ký) rồi
 * mới xóa. (2) vẫn cho phép, vì số lô là nhãn nhận dạng và không đổi theo thì điểm
 * cũ biến mất khỏi mọi bộ lọc lô (xem chú thích ở renameLotAcrossPoints) — nhưng
 * phải HỎI TRƯỚC kèm đúng số điểm, thay vì chỉ ghi nhật ký SAU khi đã làm.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox([
  'core.js', 'modules/state.js', 'modules/qc-domain.js',
  'modules/period-service.js', 'modules/manage-tests-actions.js',
]);
const plain = (v) => JSON.parse(JSON.stringify(v));

/* sameText/testDisplayName sống ở manage-routes.js/sigma.js — stub thay vì kéo cả
   hai file render vào sandbox chỉ để lấy hai hàm một dòng. */
const seed = `
  state = {
    lab: {}, machines: [], instruments: [{ id: 'I1', name: 'AU480', active: true }], assayGroups: [],
    qcPanels: [{ id: 'P1', name: 'Panel', instrumentId: 'I1', testIds: ['T1'], active: true }],
    lotTransitions: [], lotGroups: [{ id: 'G1', name: 'Group', lotIds: ['L1'], active: true }],
    qcLots: [{ id: 'L1', groupId: 'G1', lotNo: 'OLD123', level: 1, active: true }],
    tests: [{ id: 'T1', name: 'Glucose', instrumentId: 'I1', active: true,
      levels: [{ level: 1, qcLotId: 'L1', lot: 'OLD123', mean: 5, sd: 0.1, meanSdHistory: [] }] }],
    data: { T1: [
      { id: 'p1', date: '2026-07-10', runId: '2026-07-10-1', level: 1, val: 5.1, lot: 'OLD123' },
      { id: 'p2', date: '2026-07-11', runId: '2026-07-11-1', level: 1, val: 4.9, lot: 'OLD123' },
      { id: 'p3', date: '2026-08-02', runId: '2026-08-02-1', level: 1, val: 5.0, lot: 'OLD123' }
    ] },
    sigmaData: {}, actions: [], activity: [], users: [],
    reagentTests: [], reagentOperators: [], reagentSampleTypes: [],
    periodLocks: [], teaRefs: [], westgardRules: {}
  };
  selTest = null; entrySel = null;
  info = []; confirms = []; audits = []; saves = 0; confirmAnswer = true; fields = {};
  requireAdmin = function(){ return true; };
  infoDialog = async function(message){ info.push(String(message)); };
  confirmDialog = async function(opts){ confirms.push(opts); return confirmAnswer; };
  logAct = function(action, detail, target){ audits.push(action + ' | ' + detail + ' | ' + target); };
  save = function(){ saves++; }; rerender = function(){}; closeModal = function(){}; clearDerived = function(){};
  sameText = function(a, b){ return String(a||'').toLowerCase() === String(b||'').toLowerCase(); };
  testDisplayName = function(t){ return (t && t.name) || ''; };
  document = { getElementById: function(id){ return { value: fields[id] || '' }; } };
  lotPoints = function(){ return (state.data.T1 || []).map(function(p){ return p.lot; }); };
`;

async function main() {
  // ===== 1. delTest bị CHẶN khi còn điểm thuộc kỳ đã khóa =====
  const blocked = plain(await run(ctx, `(async function(){
    ${seed}
    PeriodService.lock(state, { ym: '2026-07', lockedAt: '', lockedBy: 'Admin', id: 'lock1' });
    await delTest('T1');
    return { info: info, confirms: confirms.length, testStillThere: !!state.tests.find(function(x){return x.id==='T1';}),
      pointsLeft: (state.data.T1 || []).length, saves: saves, audits: audits };
  })()`));

  assert.equal(blocked.testStillThere, true, 'xét nghiệm còn điểm ở kỳ đã khóa thì không được xóa');
  assert.equal(blocked.pointsLeft, 3, 'không được đụng tới điểm QC');
  assert.equal(blocked.saves, 0, 'bị chặn thì không được ghi gì');
  assert.deepEqual(blocked.audits, [], 'không có thao tác nào để ghi nhật ký');
  assert.equal(blocked.confirms, 0, 'chặn ngay, không hỏi "bạn có chắc không"');
  assert.equal(blocked.info.length, 1);
  assert.match(blocked.info[0], /2 điểm QC thuộc kỳ đã khóa/, 'phải nói rõ còn bao nhiêu điểm bị khóa');
  assert.match(blocked.info[0], /07\/2026/, 'phải chỉ đích danh kỳ nào đang khóa');
  assert.match(blocked.info[0], /mở khóa/i, 'phải chỉ ra đường đi đúng, không chỉ từ chối');

  // ===== 2. Không còn kỳ khóa thì xóa được, và nhật ký ghi rõ số điểm mất đi =====
  const allowed = plain(await run(ctx, `(async function(){
    ${seed}
    await delTest('T1');
    return { testGone: !state.tests.find(function(x){return x.id==='T1';}), dataGone: !state.data.T1,
      confirmDetail: (confirms[0] || {}).detail || '', saves: saves, audits: audits };
  })()`));

  assert.equal(allowed.testGone, true);
  assert.equal(allowed.dataGone, true);
  assert.equal(allowed.saves, 1);
  assert.match(allowed.confirmDetail, /3 điểm QC/, 'hộp xác nhận phải nói con số cụ thể sắp mất');
  assert.match(allowed.audits[0], /Xóa xét nghiệm và 3 điểm QC/, 'nhật ký phải ghi lại đã mất bao nhiêu điểm');

  // ===== 3. Đổi số lô: hỏi TRƯỚC, kèm số điểm và kỳ đã khóa; bấm Hủy là không đổi gì =====
  const cancelled = plain(await run(ctx, `(async function(){
    ${seed}
    PeriodService.lock(state, { ym: '2026-07', lockedAt: '', lockedBy: 'Admin', id: 'lock1' });
    fields = { cfgLotNo: 'NEW456', cfgLotLevel: '1' };
    confirmAnswer = false;
    await saveConfigLot('L1');
    return { confirm: confirms[0] || null, lotNo: state.qcLots[0].lotNo, lots: lotPoints(),
      saves: saves, audits: audits };
  })()`));

  assert.ok(cancelled.confirm, 'phải hỏi trước khi viết lại hàng loạt');
  assert.match(cancelled.confirm.message, /3 điểm QC/, 'phải nói đúng số điểm sẽ bị viết lại');
  assert.match(cancelled.confirm.detail, /2 điểm thuộc kỳ đã khóa/, 'phải tách riêng phần thuộc kỳ đã khóa');
  assert.match(cancelled.confirm.detail, /07\/2026/);
  assert.equal(cancelled.lotNo, 'OLD123', 'bấm Hủy thì cấu hình lô không được đổi');
  assert.deepEqual(cancelled.lots, ['OLD123', 'OLD123', 'OLD123'], 'bấm Hủy thì không điểm nào bị viết lại');
  assert.equal(cancelled.saves, 0);
  assert.deepEqual(cancelled.audits, []);

  // ===== 4. Đồng ý thì đổi thật, cả điểm của kỳ đã khóa =====
  const renamed = plain(await run(ctx, `(async function(){
    ${seed}
    PeriodService.lock(state, { ym: '2026-07', lockedAt: '', lockedBy: 'Admin', id: 'lock1' });
    fields = { cfgLotNo: 'NEW456', cfgLotLevel: '1' };
    await saveConfigLot('L1');
    return { lotNo: state.qcLots[0].lotNo, lots: lotPoints(), saves: saves, audits: audits };
  })()`));

  assert.equal(renamed.lotNo, 'NEW456');
  assert.deepEqual(renamed.lots, ['NEW456', 'NEW456', 'NEW456'], 'đổi tên phải phủ hết điểm cũ, nếu không chúng biến mất khỏi mọi bộ lọc lô');
  assert.equal(renamed.saves, 1);
  assert.match(renamed.audits[0], /Đã cập nhật 3 điểm QC cũ theo số lô mới/);

  // ===== 5. Không đổi số lô thì đừng hỏi =====
  const quiet = plain(await run(ctx, `(async function(){
    ${seed}
    PeriodService.lock(state, { ym: '2026-07', lockedAt: '', lockedBy: 'Admin', id: 'lock1' });
    fields = { cfgLotNo: 'OLD123', cfgLotLevel: '1', cfgLotNote: 'chỉ sửa ghi chú' };
    await saveConfigLot('L1');
    return { confirms: confirms.length, note: state.qcLots[0].note, saves: saves };
  })()`));

  assert.equal(quiet.confirms, 0, 'sửa trường khác mà không đổi số lô thì không được hỏi thừa');
  assert.equal(quiet.note, 'chỉ sửa ghi chú');
  assert.equal(quiet.saves, 1);

  console.log('Locked-period guard tests passed');
}

main().catch((error) => { console.error(error); process.exit(1); });

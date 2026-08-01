/**
 * derivedIndex (qc-domain.js derived()) phải TỰ TRƯỢT khi cấu hình đổi.
 *
 * Trước 2026-08-01 nó là memo thuần — `if(derivedIndex)return derivedIndex` — nên
 * chỉ đúng khi MỌI đường ghi cấu hình đều nhớ gọi clearDerived(). Quên một chỗ thì
 * màn hình hiện panel / nhóm lô / mức vận hành cũ mà không có gì báo, và không có
 * cách nào tự phát hiện. Nay derived() so chữ ký (tham chiếu + độ dài + các trường
 * vô hướng nó lọc theo) giống cách cache của action-workflow-service.js đang làm.
 *
 * Bài test chốt bằng VIỆC CACHE TỰ TRƯỢT, không chốt bằng mốc thời gian — cùng lý
 * do đã ghi trong CLAUDE.md cho cache NCE: phép đo thời gian không phân biệt được
 * chính xác cái gì hỏng, còn tính tự trượt thì có.
 *
 * Hai nửa của hợp đồng đều phải đúng:
 *   1. đổi thứ derived() ĐỌC       → phải dựng lại (nếu không: màn hình sai)
 *   2. đổi thứ derived() KHÔNG đọc → phải giữ nguyên (nếu không: mất sạch cache,
 *      chữ ký thành "luôn dựng lại" mà test vẫn xanh)
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js']);

const seed = `
  state = {
    lab: {}, machines: [], instruments: [{ id: 'I1', name: 'AU480', active: true }], assayGroups: [],
    qcPanels: [{ id: 'P1', name: 'Panel', instrumentId: 'I1', testIds: ['T1', 'T2'], active: true }],
    lotTransitions: [{ id: 'TR1', fromLotId: 'L1', toLotId: 'L2', status: 'draft' }],
    lotGroups: [{ id: 'G1', name: 'Group', lotIds: ['L1', 'L2'], active: true, status: '' }],
    qcLots: [{ id: 'L1', groupId: 'G1', lotNo: 'LOT1', level: 1, active: true },
             { id: 'L2', groupId: 'G1', lotNo: 'LOT2', level: 2, active: true }],
    tests: [{ id: 'T1', name: 'Glucose', instrumentId: 'I1', active: true,
                levels: [{ level: 1, qcLotId: 'L1', lot: 'LOT1', mean: 5, sd: 0.1 }] },
            { id: 'T2', name: 'Sodium', instrumentId: 'I1', active: true,
                levels: [{ level: 1, qcLotId: 'L1', lot: 'LOT1', mean: 140, sd: 2 }] }],
    data: { T1: [{ id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, val: 5.1, lot: 'LOT1' }], T2: [] },
    sigmaData: {}, actions: [], activity: [], users: [],
    reagentTests: [], reagentOperators: [], reagentSampleTypes: [],
    periodLocks: [], teaRefs: [], westgardRules: {}
  };
  clearDerived();
`;

// Cache phải thật sự có tác dụng: gọi hai lần không đổi gì thì cùng một đối tượng.
assert.equal(run(ctx, `(function(){ ${seed} return derived()===derived(); })()`), true,
  'không đổi gì thì derived() phải trả về đúng đối tượng đã dựng');

/* Mỗi dòng: đổi một thứ mà derived() có đọc, KHÔNG gọi clearDerived(), rồi đòi
   derived() phải dựng lại. Phủ cả bốn kiểu trượt: thay nguyên state, thay tham
   chiếu mảng, thêm/bớt phần tử, và sửa trường vô hướng TẠI CHỖ. */
const mustRebuild = [
  ['thay nguyên state', `state = JSON.parse(JSON.stringify(state));`],
  ['thay mảng qcPanels', `state.qcPanels = state.qcPanels.slice();`],
  ['thêm panel', `state.qcPanels.push({ id: 'P2', testIds: [], active: true });`],
  ['tắt panel tại chỗ', `state.qcPanels[0].active = false;`],
  ['thay mảng testIds của panel', `state.qcPanels[0].testIds = ['T1'];`],
  ['thêm testId vào panel tại chỗ', `state.qcPanels[0].testIds.push('T3');`],
  ['đổi status nhóm lô tại chỗ', `state.lotGroups[0].status = 'stopped';`],
  ['tắt nhóm lô tại chỗ', `state.lotGroups[0].active = false;`],
  ['thay mảng lotIds của nhóm', `state.lotGroups[0].lotIds = ['L1'];`],
  ['thêm lô vào nhóm tại chỗ', `state.lotGroups[0].lotIds.push('L3');`],
  ['duyệt chuyển tiếp lô tại chỗ', `state.lotTransitions[0].status = 'accepted';`],
  ['đổi lô đích của chuyển tiếp', `state.lotTransitions[0].toLotId = 'L9';`],
  ['thêm lô QC', `state.qcLots.push({ id: 'L3', groupId: 'G1', lotNo: 'LOT3', level: 3 });`],
  ['thay một lô QC', `state.qcLots[0] = { ...state.qcLots[0] };`],
  ['thêm xét nghiệm', `state.tests.push({ id: 'T3', name: 'K', levels: [] });`],
  ['thay mảng levels của xét nghiệm', `state.tests[0].levels = state.tests[0].levels.slice();`],
  ['thêm mức cho xét nghiệm tại chỗ', `state.tests[0].levels.push({ level: 2, qcLotId: 'L2', lot: 'LOT2', mean: 8, sd: 0.2 });`],
];

for (const [label, mutation] of mustRebuild) {
  const rebuilt = run(ctx, `(function(){
    ${seed}
    var before = derived();
    ${mutation}
    return derived() !== before;
  })()`);
  assert.equal(rebuilt, true, `derived() phải tự dựng lại sau khi: ${label} (không gọi clearDerived)`);
}

/* Nửa còn lại: những thứ derived() KHÔNG đọc thì không được làm mất cache. Thiếu
   phần này, một chữ ký hỏng kiểu "luôn khác nhau" vẫn qua được toàn bộ phần trên. */
const mustKeep = [
  ['thêm điểm QC', `state.data.T1.push({ id: 'p2', date: '2026-07-02', runId: '2026-07-02-1', level: 1, val: 5.2, lot: 'LOT1' });`],
  ['thay mảng điểm QC', `state.data.T1 = state.data.T1.slice();`],
  ['sửa Mean/SD của mức', `state.tests[0].levels[0].mean = 99;`],
  ['đổi tên xét nghiệm', `state.tests[0].name = 'Glucose (GLU)';`],
  ['thêm hồ sơ NCE', `state.actions.push({ id: 'A1', testId: 'T1' });`],
  ['khóa kỳ báo cáo', `state.periodLocks.push({ id: 'lock1', ym: '2026-07' });`],
];

for (const [label, mutation] of mustKeep) {
  const kept = run(ctx, `(function(){
    ${seed}
    var before = derived();
    ${mutation}
    return derived() === before;
  })()`);
  assert.equal(kept, true, `derived() không được vứt cache khi chỉ: ${label}`);
}

// clearDerived() vẫn phải xả được bằng tay (đường mà mọi save() mặc định dùng).
assert.equal(run(ctx, `(function(){
  ${seed}
  var before = derived();
  clearDerived();
  return derived() !== before;
})()`), true, 'clearDerived() vẫn phải buộc dựng lại');

// Nội dung sau khi dựng lại phải đúng, không chỉ là một đối tượng khác.
const content = run(ctx, `(function(){
  ${seed}
  derived();
  state.qcPanels[0].testIds = ['T2'];
  var idx = derived();
  return { hasT1: idx.testPanel.has('T1'), hasT2: idx.testPanel.has('T2') };
})()`);
assert.equal(content.hasT2, true);
assert.equal(content.hasT1, false, 'dựng lại phải phản ánh cấu hình mới, không chỉ đổi tham chiếu');

console.log('Derived cache self-invalidation tests passed');

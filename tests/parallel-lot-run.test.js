/**
 * Chạy song song 2 lô (lot-to-lot verification) — assets/modules/qc-domain.js.
 *
 * Ranh giới quan trọng nhất được khoá ở đây: lô đang chạy song song KHÔNG được
 * ảnh hưởng tới kết luận Westgard của lô đang vận hành, và ngược lại. Lô song
 * song chỉ tồn tại khi hồ sơ chuyển tiếp ở trạng thái 'active' VÀ lô mới đã có
 * Mean/SD riêng — không bao giờ mượn Mean/SD của lô cũ.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
run(ctx, 'function __setState(s){state=s;clearDerived();}');

function makeFixture({ transitionStatus = 'active', plannedTarget = true } = {}) {
  const levels = [{
    level: 1, qcLotId: 'lotA', lot: 'LOT-A', mean: 10, sd: 1,
    low: null, high: null, rangeK: 2, applied: 'mfg',
    meanSdHistory: plannedTarget
      ? [{ id: 'hB', qcLotId: 'lotB', lot: 'LOT-B', mean: 20, sd: 2, low: null, high: null, effectiveFrom: '', effectiveTo: '', source: 'mfg', planned: true, note: 'Dự kiến' }]
      : [],
  }];
  return {
    lab: {},
    tests: [{ id: 't1', name: 'Glucose', instrumentId: 'i1', machine: 'Máy A', active: true, levels, ruleActions: {}, ruleScopes: {} }],
    instruments: [{ id: 'i1', name: 'Máy A' }],
    qcPanels: [{ id: 'p1', name: 'Panel A', instrumentId: 'i1', testIds: ['t1'], active: true }],
    qcLots: [
      { id: 'lotA', groupId: 'g1', lotNo: 'LOT-A', level: 1, exp: '2027-01-01', active: true, depleted: false },
      { id: 'lotB', groupId: '', lotNo: 'LOT-B', level: 1, exp: '2028-01-01', active: true, depleted: false },
    ],
    lotGroups: [{ id: 'g1', name: 'LOT-A', lotIds: ['lotA'], active: true }],
    lotTransitions: [{ id: 'tr1', panelId: 'p1', fromLotId: 'lotA', toLotId: 'lotB', startDate: '2026-07-01', status: transitionStatus }],
    westgardRules: {},
    data: {},
  };
}

// --- Lô song song chỉ xuất hiện khi hồ sơ 'active' VÀ lô mới có Mean/SD riêng ---
{
  const state = makeFixture();
  ctx.__setState(state);
  const par = ctx.parallelLotForLevel(state.tests[0], 1);
  assert.ok(par, 'hồ sơ active + lô mới có Mean/SD dự kiến => có lô song song');
  assert.equal(par.lotNo, 'LOT-B');
  assert.equal(par.mean, 20, 'Mean phải là của lô mới, không phải lô đang dùng');
  assert.equal(par.sd, 2, 'SD phải là của lô mới, không phải lô đang dùng');
}
for (const status of ['planned', 'accepted', 'rejected']) {
  const state = makeFixture({ transitionStatus: status });
  ctx.__setState(state);
  assert.equal(ctx.parallelLotForLevel(state.tests[0], 1), null, `trạng thái "${status}" không phải đang chạy song song`);
}
{
  const state = makeFixture({ plannedTarget: false });
  ctx.__setState(state);
  assert.equal(ctx.parallelLotForLevel(state.tests[0], 1), null, 'lô mới chưa có Mean/SD riêng thì không được coi là đang chạy song song');
}

// --- Cột nhập: mức đang chạy song song có 2 cột, mỗi cột giữ Mean/SD của chính lô đó ---
{
  const state = makeFixture();
  ctx.__setState(state);
  const cols = ctx.entryColumns(state.tests[0]);
  assert.equal(cols.length, 2, 'mức đang chạy song song phải sinh 2 cột nhập');
  assert.equal(cols[0].parallel, false);
  assert.equal(cols[0].lot, 'LOT-A');
  assert.equal(cols[0].mean, 10);
  assert.equal(cols[1].parallel, true);
  assert.equal(cols[1].lot, 'LOT-B');
  assert.equal(cols[1].mean, 20);
  assert.notEqual(cols[0].key, cols[1].key, 'hai cột phải có key khác nhau để bảng nhập không gộp điểm');

  const plain = makeFixture({ transitionStatus: 'planned' });
  ctx.__setState(plain);
  assert.equal(ctx.entryColumns(plain.tests[0]).length, 1, 'không chạy song song thì mỗi mức đúng 1 cột như cũ');
  // Cột nhập chỉ được dựng từ mức đang vận hành, không phải t.levels thô
  // (vế còn lại của guard ở partial-render-helpers.test.js).
  assert.ok(String(ctx.entryColumns).includes('operationalLevels(t)'), 'entryColumns phải dựng từ operationalLevels');
}

// --- Cách ly đánh giá: điểm lô song song không đụng tới Westgard của lô đang vận hành ---
{
  const state = makeFixture();
  // Lô đang dùng: 3 điểm ổn định quanh Mean 10. Lô song song: 3 điểm quanh Mean 20.
  state.data.t1 = [
    { id: 'a1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, val: 10.1, lot: 'LOT-A', qcMean: 10, qcSd: 1 },
    { id: 'a2', date: '2026-07-02', runId: '2026-07-02-1', level: 1, val: 9.9, lot: 'LOT-A', qcMean: 10, qcSd: 1 },
    { id: 'a3', date: '2026-07-03', runId: '2026-07-03-1', level: 1, val: 10.2, lot: 'LOT-A', qcMean: 10, qcSd: 1 },
    { id: 'b1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, val: 27, lot: 'LOT-B', qcMean: 20, qcSd: 2 }, // z = +3.5
    { id: 'b2', date: '2026-07-02', runId: '2026-07-02-1', level: 1, val: 26.5, lot: 'LOT-B', qcMean: 20, qcSd: 2 },
    { id: 'b3', date: '2026-07-03', runId: '2026-07-03-1', level: 1, val: 27, lot: 'LOT-B', qcMean: 20, qcSd: 2 },
  ];
  ctx.__setState(state);
  const t = state.tests[0];

  // Lô đang vận hành: activeWestgard không được nhìn thấy điểm của lô song song.
  const wg = ctx.activeWestgard(t);
  ['b1', 'b2', 'b3'].forEach(id => assert.equal(wg.byPoint.has(id), false, `điểm lô song song ${id} không được lọt vào Westgard của lô đang vận hành`));
  ['a1', 'a2', 'a3'].forEach(id => assert.ok(wg.byPoint.has(id), `điểm lô đang dùng ${id} vẫn phải được đánh giá`));
  ['a1', 'a2', 'a3'].forEach(id => assert.equal(wg.byPoint.get(id).level, 'ok', 'lô đang dùng vẫn ổn định dù lô song song lệch xa'));

  // Lô song song: đánh giá theo Mean/SD của CHÍNH nó (26 với Mean 20/SD 2 = +3s).
  const cols = ctx.entryColumns(t), parCol = cols.find(c => c.parallel);
  const par = ctx.parallelWestgard(t, parCol);
  assert.equal(par.pts.length, 3, 'chỉ lấy đúng điểm của lô song song');
  assert.ok(par.byPoint.has('b1'));
  assert.equal(par.byPoint.has('a1'), false, 'không được lẫn điểm của lô đang dùng');
  assert.ok(par.byPoint.get('b1').rules.includes('1-3s'), '27 so với Mean 20/SD 2 là +3,5s => phải bắt 1-3s theo Mean/SD của chính lô mới');
}

// --- Hủy điểm QC (voidQcPoint): kết luận phải theo đúng lô, kể cả lô song song ---
// Trước 2026-08-03, confirmVoidQcPoint() trong entry-routes.js chỉ tra activeWestgard(t),
// vốn không phủ điểm của lô song song (xem test cách ly ở trên) — hủy một điểm 1-3s ở lô
// song song sẽ ghi "Không có luật Westgard"/"invalid" lên hồ sơ NCE thay vì đúng vi phạm.
// pointVoidVerdict(t,p) (qc-domain.js) là hàm dùng chung duy nhất cho việc này.
{
  const state = makeFixture();
  state.data.t1 = [
    { id: 'a1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, val: 10.1, lot: 'LOT-A', qcMean: 10, qcSd: 1 },
    { id: 'b1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, val: 27, lot: 'LOT-B', qcMean: 20, qcSd: 2 }, // z = +3.5
  ];
  ctx.__setState(state);
  const t = state.tests[0];

  const activeVerdict = ctx.pointVoidVerdict(t, state.data.t1.find(p => p.id === 'a1'));
  assert.equal(activeVerdict.level, 'ok', 'điểm của lô đang vận hành vẫn tra qua activeWestgard như cũ');

  const parallelVerdict = ctx.pointVoidVerdict(t, state.data.t1.find(p => p.id === 'b1'));
  assert.equal(parallelVerdict.level, 'rej', 'điểm 27 (Mean 20/SD 2 => +3,5s) của lô song song phải được nhận đúng là bị loại');
  assert.ok(parallelVerdict.rules.includes('1-3s'), 'phải giữ đúng tên luật vi phạm để ghi lên hồ sơ NCE, không được rơi về rỗng');

  const emptyVerdict = ctx.pointVoidVerdict(t, null);
  assert.equal(emptyVerdict.level, 'ok', 'điểm rỗng không được ném lỗi');
  assert.equal(emptyVerdict.rules.length, 0, 'điểm rỗng không có luật vi phạm nào');
}

console.log('Parallel lot run tests passed');

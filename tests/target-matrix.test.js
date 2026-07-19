/**
 * Regression tests for the "Mean/SD theo nhóm lô QC" (target matrix) bug:
 * a QC level only ever has ONE live Mean/SD slot (assets/modules/state.js
 * levels are per-level, not per-lot). Saving Mean/SD for a lot from a
 * different, parallel lot group used to silently overwrite that slot with
 * no record of what the previous lot's Mean/SD was - so switching the
 * "Nhóm lô QC" dropdown back and forth made values "leak" between groups.
 *
 * Fix: applyTargetPick() (assets/modules/entry-tests-actions.js) now snapshots
 * the outgoing lot's Mean/SD into meanSdHistory before reassigning the slot,
 * and lotTargetSnapshot() (assets/modules/qc-domain.js) lets the read side look
 * up a specific lot's own value instead of falling back to whatever lot is
 * currently live.
 */
const assert = require('node:assert/strict');
const { loadSandbox } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/entry-tests-actions.js']);
// Values crossing the vm sandbox boundary belong to a different realm (their own
// Object prototype), which makes assert.deepEqual report false mismatches even
// for identical-looking plain objects. Round-trip through JSON first.
const plain = (v) => JSON.parse(JSON.stringify(v));
const snapshot = (t, level, lotId, lotNo) => plain(ctx.lotTargetSnapshot(t, level, lotId, lotNo));

function makeTest() {
  return { id: 't1', name: 'Sodium', levels: [{ level: 2, qcLotId: '', lot: '', mean: null, sd: null, low: null, high: null, rangeK: 2, applied: 'mfg', meanSdHistory: [] }] };
}
const lotA = { id: 'lotA', lotNo: '1102', level: 2, exp: '2026-01-01' };
const lotB = { id: 'lotB', lotNo: '2122', level: 2, exp: '2027-01-01' };

// --- Case 1: saving Mean/SD for a second, unrelated lot must not erase the first lot's values ---
{
  const t = makeTest();
  ctx.applyTargetPick(t, lotA, { use: true, mean: 158, low: 153, high: 163, sd: 2.5 }, '2026-01-01', 'Cập nhật Mean/SD');
  ctx.applyTargetPick(t, lotB, { use: true, mean: 200, low: 190, high: 210, sd: 5 }, '2026-06-01', 'Cập nhật Mean/SD');

  assert.equal(t.levels[0].qcLotId, 'lotB', 'the level now live-points at the most recently saved lot');
  assert.equal(t.levels[0].mean, 200);

  const snapA = snapshot(t, 2, 'lotA', '1102');
  const snapB = snapshot(t, 2, 'lotB', '2122');
  assert.deepEqual(snapA, { mean: 158, sd: 2.5, low: 153, high: 163 }, 'lot A must keep its own Mean/SD instead of showing lot B\'s value');
  assert.deepEqual(snapB, { mean: 200, sd: 5, low: 190, high: 210 }, 'lot B must show its own (live) Mean/SD');
}

// --- Case 2: switching back and forth between the two lots repeatedly must not lose data either way ---
{
  const t = makeTest();
  ctx.applyTargetPick(t, lotA, { use: true, mean: 158, low: null, high: null, sd: 2.5 }, '2026-01-01', 'n');
  ctx.applyTargetPick(t, lotB, { use: true, mean: 200, low: null, high: null, sd: 5 }, '2026-02-01', 'n');
  ctx.applyTargetPick(t, lotA, { use: true, mean: 160, low: null, high: null, sd: 2.6 }, '2026-03-01', 'n'); // back to A, update it
  ctx.applyTargetPick(t, lotB, { use: true, mean: 205, low: null, high: null, sd: 5.1 }, '2026-04-01', 'n'); // back to B, update it

  assert.deepEqual(snapshot(t, 2, 'lotA', '1102'), { mean: 160, sd: 2.6, low: null, high: null }, 'lot A keeps its latest own value after round-tripping');
  assert.deepEqual(snapshot(t, 2, 'lotB', '2122'), { mean: 205, sd: 5.1, low: null, high: null }, 'lot B keeps its latest own value after round-tripping');
}

// --- Case 3: first-ever save (no prior lot on this level) must not fabricate a bogus history entry ---
{
  const t = makeTest();
  ctx.applyTargetPick(t, lotA, { use: true, mean: 158, low: null, high: null, sd: 2.5 }, '2026-01-01', 'n');
  assert.equal(t.levels[0].meanSdHistory.length, 1, 'only the real save should be recorded, no phantom "previous lot" snapshot');
  assert.equal(t.levels[0].meanSdHistory[0].qcLotId, 'lotA');
}

// --- Case 4: unchecking "Dùng" for the currently-linked lot clears the live assignment ---
{
  const t = makeTest();
  ctx.applyTargetPick(t, lotA, { use: true, mean: 158, low: null, high: null, sd: 2.5 }, '2026-01-01', 'n');
  const changed = ctx.applyTargetPick(t, lotA, { use: false }, '2026-02-01', 'n');
  assert.equal(changed, true);
  assert.equal(t.levels[0].qcLotId, '', 'unassigning the lot must clear qcLotId');
  assert.equal(t.levels[0].lot, '');
}

/**
 * "Dự kiến" (planned): saving Mean/SD for a new lot group without switching over yet.
 * applyPlannedTarget() (entry-tests-actions.js) must NOT touch the live qcLotId/lot -
 * the currently-linked lot keeps running QC uninterrupted - it only records a
 * meanSdHistory entry tagged planned:true, which plannedTargetFor()/lotTargetSnapshot()
 * (qc-domain.js) can read back so the form pre-fills next time without being mistaken
 * for real, already-applied history (see manageHistory() in manage-routes.js, which
 * must keep excluding planned entries from the "Lịch sử dữ liệu QC" timeline).
 */
// --- Case 5: planned save on lot B leaves lot A's live assignment untouched ---
{
  const t = makeTest();
  ctx.applyTargetPick(t, lotA, { use: true, mean: 158, low: null, high: null, sd: 2.5 }, '2026-01-01', 'n');
  const changed = ctx.applyPlannedTarget(t, lotB, { use: true, mean: 200, low: null, high: null, sd: 5 }, 'Cập nhật Mean/SD (dự kiến)');
  assert.equal(changed, true);
  assert.equal(t.levels[0].qcLotId, 'lotA', 'planned save must not switch the live lot');
  assert.equal(t.levels[0].mean, 158, 'planned save must not touch the live Mean/SD');

  const planned = plain(ctx.plannedTargetFor(t, lotB));
  assert.ok(planned, 'plannedTargetFor should find the planned entry for lot B');
  assert.equal(planned.mean, 200);
  assert.equal(planned.planned, true);
  assert.equal(ctx.plannedTargetFor(t, lotA), null, 'the currently-linked lot is never reported as "planned"');

  assert.deepEqual(snapshot(t, 2, 'lotB', '2122'), { mean: 200, sd: 5, low: null, high: null }, 'lotTargetSnapshot should read the planned entry back for lot B');
}

// --- Case 6: saving "planned" again for the same lot updates in place, no duplicate history entries ---
{
  const t = makeTest();
  ctx.applyPlannedTarget(t, lotB, { use: true, mean: 200, low: null, high: null, sd: 5 }, 'n');
  ctx.applyPlannedTarget(t, lotB, { use: true, mean: 210, low: null, high: null, sd: 5.2 }, 'n');
  const plannedEntries = t.levels[0].meanSdHistory.filter(h => h.planned && h.qcLotId === 'lotB');
  assert.equal(plannedEntries.length, 1, 'updating a planned save should replace the previous draft, not accumulate');
  assert.equal(plannedEntries[0].mean, 210);
}

// --- Case 7: "switching" to a lot that already had a planned draft with the same values must clear the planned flag ---
// (regression: applyTargetPick's update-in-place branch used to leave a stale planned:true on the now-live entry,
// which would make it wrongly disappear from manageHistory()'s real timeline even though it is now applied.)
{
  const t = makeTest();
  ctx.applyTargetPick(t, lotA, { use: true, mean: 158, low: null, high: null, sd: 2.5 }, '2026-01-01', 'n');
  ctx.applyPlannedTarget(t, lotB, { use: true, mean: 200, low: null, high: null, sd: 5 }, 'n');
  ctx.applyTargetPick(t, lotB, { use: true, mean: 200, low: null, high: null, sd: 5 }, '2026-02-01', 'n'); // now actually switch to lot B, same values as the draft
  assert.equal(t.levels[0].qcLotId, 'lotB', 'lot B is now the live lot');
  const liveEntry = t.levels[0].meanSdHistory.find(h => h.qcLotId === 'lotB');
  assert.equal(liveEntry.planned, false, 'the now-applied entry must not still be flagged as an unapplied draft');
  assert.equal(ctx.plannedTargetFor(t, lotB), null, 'plannedTargetFor must not report the live lot as "planned"');
}

// --- Case 8: correcting Mean/SD of the same live lot updates its canonical row, never duplicates that lot ---
{
  const t=makeTest();
  ctx.applyTargetPick(t,lotA,{use:true,mean:140,low:135,high:145,sd:2.5},'2026-07-19','n');
  ctx.applyTargetPick(t,lotA,{use:true,mean:139,low:134,high:144,sd:2.5},'2026-07-19','n');
  const rows=t.levels[0].meanSdHistory.filter(h=>h.qcLotId==='lotA');
  assert.equal(rows.length,1,'the same lot must have one canonical Mean/SD history row');
  assert.equal(rows[0].mean,139);assert.equal(rows[0].low,134);assert.equal(rows[0].high,144);
}

// --- Case 9: legacy duplicate rows are collapsed on normalization, keeping the latest correction ---
{
  const t=makeTest(),level=t.levels[0];level.meanSdHistory=[
    {id:'old',qcLotId:'lotA',lot:'1102',mean:140,sd:2.5},
    {id:'new',qcLotId:'lotA',lot:'1102',mean:139,sd:2.5}
  ];
  ctx.dedupeLotTargetHistory(level);
  assert.equal(level.meanSdHistory.length,1);assert.equal(level.meanSdHistory[0].id,'new');assert.equal(level.meanSdHistory[0].mean,139);
}

// --- Danh mục xét nghiệm: ô thêm mới gợi ý bằng tên quốc tế hoặc viết tắt ---
{
  assert.equal(ctx.configAssayFindRef('Sodium')[0], 'Sodium', 'tên quốc tế chọn đúng xét nghiệm');
  assert.equal(ctx.configAssayFindRef('Na')[0], 'Sodium', 'viết tắt chọn đúng xét nghiệm');
  assert.equal(ctx.configAssayFindRef('Không có trong bảng'), null, 'vẫn cho phép tên ngoài danh mục thay vì ghép nhầm');
  const fields={cfgAssayTeaRefKey:{value:''},cfgAssayTeaSource:{value:''},cfgAssayName:{value:''},cfgAssayUnit:{value:''},cfgAssaySection:{value:'Điện giải'},cfgAssayTea:{value:''}};
  ctx.document={getElementById:id=>fields[id]};ctx.configAssaySuggestionInput('Potassium');
  assert.equal(fields.cfgAssayTeaRefKey.value,'qclab-potassium','modal lưu analyteId thay vì dùng tên làm khóa');
  assert.equal(fields.cfgAssayUnit.value,'mmol/L','gợi ý TEa tự điền đơn vị');
  assert.equal(fields.cfgAssayTea.value,5.61,'gợi ý TEa tự điền TEa%');
  assert.equal(fields.cfgAssaySection.value,'Điện giải','Khoa/Khu vực vẫn theo máy, không bị nhóm TEa ghi đè');
}

console.log('Target matrix (per-lot Mean/SD) tests passed');

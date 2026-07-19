/**
 * Regression test: renaming an in-use QC lot's lot number (assets/modules/
 * entry-tests-actions.js saveConfigLot()) used to orphan every previously-entered
 * QC point for that lot.
 *
 * QC points store their lot as a static string snapshot (p.lot), not a qcLotId
 * reference. Every lot-scoped point filter (pointsForLot/operationalLotPoints/
 * lotPointsByNo in qc-domain.js) matches that string against the level's current
 * `.lot`. Renaming the SAME lot (same id, e.g. fixing a typo in the lot number)
 * updated the level's `.lot` to the new string but left historical points tagged
 * with the old one — they vanished from the current-lot view (string mismatch)
 * and were NOT picked up as "previous lot" either, since previousLotSeries()
 * only recognizes a lot change via an accepted lotTransitions record, and a plain
 * rename never creates one.
 *
 * Fix: renameLotAcrossPoints(oldLevel, oldLotNo, newLotNo) rewrites p.lot on every
 * matching point across all tests' state.data, called from saveConfigLot() only
 * when the lot number actually changed.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/entry-tests-actions.js']);
const plain = (v) => JSON.parse(JSON.stringify(v));

const built = run(ctx, `(function(){
  var lotId = 'L1';
  var t = { id: 'T1', name: 'Glucose', instrumentId: 'I1', analyteId: 'a1', active: true,
    levels: [{ level: 1, qcLotId: lotId, lot: 'OLD123', mean: 5, sd: 0.1, mfgMean: 5, mfgSd: 0.1, applied: 'mfg', meanSdHistory: [] }] };
  state = {
    tests: [t],
    data: { T1: [
      { id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, val: 5.1, lot: 'OLD123', voided: false },
      { id: 'p2', date: '2026-07-02', runId: '2026-07-02-1', level: 1, val: 4.9, lot: 'OLD123', voided: false }
    ] },
    sigmaData: {}, lab: {}, machines: [],
    instruments: [{ id: 'I1', name: 'AU480', active: true }],
    assayGroups: [],
    qcPanels: [{ id: 'P1', name: 'Panel', instrumentId: 'I1', testIds: ['T1'], active: true }],
    lotTransitions: [],
    lotGroups: [{ id: 'G1', name: 'Group', lotIds: [lotId], active: true }],
    qcLots: [{ id: lotId, groupId: 'G1', lotNo: 'OLD123', level: 1, active: true }],
    actions: [], activity: [], users: [], reagentTests: [], reagentOperators: [], reagentSampleTypes: [],
    periodLocks: [], teaRefs: [], westgardRules: {}
  };
  var beforeCurrent = operationalLotPoints(t, 1).length;

  var renamedPoints = renameLotAcrossPoints(1, 'OLD123', 'NEW456');
  var lvl = t.levels[0]; lvl.lot = 'NEW456';
  var lot = state.qcLots.find(x => x.id === lotId); lot.lotNo = 'NEW456';

  var afterCurrent = operationalLotPoints(t, 1).length;
  var afterPrevious = previousLotSeries(t, 1).reduce(function(n, s) { return n + s.pts.length; }, 0);
  var afterLotStrings = (state.data.T1 || []).map(function(p) { return p.lot; });

  // A no-op rename (same string) must not touch anything.
  var noopRenamed = renameLotAcrossPoints(1, 'NEW456', 'NEW456');

  return { beforeCurrent, renamedPoints, afterCurrent, afterPrevious, afterLotStrings, noopRenamed };
})()`);

const result = plain(built);
assert.equal(result.beforeCurrent, 2, 'both points are visible under the original lot number');
assert.equal(result.renamedPoints, 2, 'both historical points are cascaded to the new lot number');
assert.equal(result.afterCurrent, 2, 'renaming the lot must not orphan its existing QC points from the current-lot view');
assert.equal(result.afterPrevious, 0, 'the renamed points are not double-counted as a separate "previous lot" (same lot id, no transition record)');
assert.deepEqual(result.afterLotStrings, ['NEW456', 'NEW456'], 'every point\'s stored lot string is rewritten to match the new lot number');
assert.equal(result.noopRenamed, 0, 'renaming a lot to the same number is a no-op (guards against needless full-data scans)');

// --- deleteConfigLot() must not silently destroy an ACCEPTED lot-transition record ---
// A depleted lot (retired via an accepted transition) no longer has any test's
// qcLotId pointing at it — the pre-existing "lot is in use" guard can't see it — yet
// deleteConfigLot() unconditionally filters state.lotTransitions for any record
// referencing the deleted lot. deleteLotTransition() explicitly refuses to remove
// an accepted transition directly (it's already applied to config/Mean-SD, so it's
// an audit-relevant historical record); deleting the lot underneath it must not be
// a back door around that same protection.
(async () => {
  const deleteCtx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/entry-tests-actions.js']);
  const deleted = await run(deleteCtx, `(async function(){
    var lotOld = { id: 'L1', groupId: 'G1', lotNo: 'OLD1', level: 1, active: true, depleted: true };
    var lotNew = { id: 'L2', groupId: 'G1', lotNo: 'NEW1', level: 1, active: true, depleted: false };
    var t = { id: 'T1', name: 'Glucose', instrumentId: 'I1',
      levels: [{ level: 1, qcLotId: 'L2', lot: 'NEW1', mean: 5, sd: 0.1, meanSdHistory: [] }] };
    var acceptedTr = { id: 'TR1', panelId: 'P1', fromLotId: 'L1', toLotId: 'L2', status: 'accepted', startDate: '2026-06-01' };
    state = {
      tests: [t], data: {}, sigmaData: {}, lab: {}, machines: [],
      instruments: [{ id: 'I1', name: 'AU480', active: true }], assayGroups: [],
      qcPanels: [{ id: 'P1', name: 'Panel', instrumentId: 'I1', testIds: ['T1'], active: true }],
      lotTransitions: [acceptedTr],
      lotGroups: [{ id: 'G1', name: 'Group', lotIds: ['L1', 'L2'], active: true }],
      qcLots: [lotOld, lotNew],
      actions: [], activity: [], users: [], reagentTests: [], reagentOperators: [], reagentSampleTypes: [],
      periodLocks: [], teaRefs: [], westgardRules: {}
    };
    role = function(){ return 'admin'; };
    requireAdmin = function(){ return true; };
    var infoDialogCalls = [];
    infoDialog = function(msg){ infoDialogCalls.push(msg); return Promise.resolve(); };
    var confirmDialogCalled = false;
    confirmDialog = function(){ confirmDialogCalled = true; return Promise.resolve(true); };
    logAct = function(){}; save = function(){}; rerender = function(){}; closeModal = function(){};

    await deleteConfigLot('L1');
    var blockedLotStillPresent = state.qcLots.some(function(l){ return l.id === 'L1'; });
    var blockedTransitionStillPresent = state.lotTransitions.some(function(x){ return x.id === 'TR1'; });
    var blockedConfirmSkipped = !confirmDialogCalled;
    var blockedMessage = infoDialogCalls[0] || '';

    // A non-accepted (e.g. rejected) transition referencing the lot must NOT block deletion.
    acceptedTr.status = 'rejected';
    confirmDialogCalled = false; infoDialogCalls = [];
    await deleteConfigLot('L1');
    var allowedLotRemoved = !state.qcLots.some(function(l){ return l.id === 'L1'; });
    var allowedTransitionRemoved = !state.lotTransitions.some(function(x){ return x.id === 'TR1'; });

    return { blockedLotStillPresent, blockedTransitionStillPresent, blockedConfirmSkipped, blockedMessage, allowedLotRemoved, allowedTransitionRemoved };
  })()`);
  const d = plain(deleted);
  assert.equal(d.blockedLotStillPresent, true, 'a lot referenced by an accepted transition is not deleted');
  assert.equal(d.blockedTransitionStillPresent, true, 'the accepted transition record survives the blocked delete attempt');
  assert.equal(d.blockedConfirmSkipped, true, 'the guard fires before the destructive confirm dialog, not after');
  assert.match(d.blockedMessage, /chấp nhận/i, 'the block message explains why (references the accepted transition)');
  assert.equal(d.allowedLotRemoved, true, 'once the transition is no longer accepted, deleting the lot proceeds normally');
  assert.equal(d.allowedTransitionRemoved, true, 'a non-accepted transition referencing the deleted lot is still cleaned up as before');

  console.log('Lot rename cascade tests passed');
})().catch(err => { console.error(err); process.exitCode = 1; });

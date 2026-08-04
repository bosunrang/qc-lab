/**
 * Tests for the QC-lot transition workflow (assets/modules/state.js).
 *
 * This is the most side-effect-heavy piece of business logic in the app:
 * accepting a lot transition rewrites lot groups (archiving the old grouping,
 * renaming/merging the new one) and applies the new lot's own pre-reviewed
 * Mean/SD onto every test that used the retired lot.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js']);
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;}');
// ensureShape() also touches searchText() (normally from router-render.js, not loaded
// in this minimal sandbox) via a legacy state.machines->instruments migration step —
// stub it with a case-insensitive compare, good enough since Case 4c below doesn't
// exercise that migration path at all (fixture already has real instrument objects).
run(ctx, "function searchText(s){return String(s==null?'':s).toLowerCase();}");
// Values crossing the vm sandbox boundary belong to a different realm (their own
// Array/Object prototypes), which makes assert.deepEqual/deepStrictEqual report
// false mismatches even for identical-looking arrays/objects. Round-trip through
// JSON (in this file's realm) whenever we need to structurally compare sandbox data.
function getState() { return JSON.parse(JSON.stringify(ctx.__getState())); }

function makeFixture() {
  return {
    lab: {},
    tests: [{
      id: 't1', name: 'Glucose', instrumentId: 'i1', machine: 'Máy A',
      levels: [{
        level: 1, qcLotId: 'lotA', lot: 'LOT-A', mean: 10, sd: 1,
        low: null, high: null, rangeK: 2, applied: 'mfg', meanSdHistory: [],
      }],
    }],
    instruments: [{ id: 'i1', name: 'Máy A' }],
    qcPanels: [{ id: 'p1', name: 'Panel A', instrumentId: 'i1', testIds: ['t1'], active: true }],
    qcLots: [
      { id: 'lotA', groupId: 'g1', lotNo: 'LOT-A', level: 1, exp: '2026-01-01', active: true, depleted: false },
      { id: 'lotB', groupId: '', lotNo: 'LOT-B', level: 1, exp: '2027-01-01', active: true, depleted: false },
    ],
    lotGroups: [{ id: 'g1', name: 'LOT-A', lotIds: ['lotA'], active: true }],
    lotTransitions: [],
    data: {},
  };
}
const acceptedTr = { id: 'tr1', panelId: 'p1', fromLotId: 'lotA', toLotId: 'lotB', startDate: '2026-06-01', status: 'accepted' };

// --- Case 1: accepted transition uses the new lot's own planned Mean/SD and rewires groups ---
{
  const fixture = makeFixture();
  fixture.tests[0].levels[0].meanSdHistory.push({id:'hB',qcLotId:'lotB',lot:'LOT-B',mean:12,sd:1.2,low:9.6,high:14.4,effectiveFrom:'',effectiveTo:'',source:'mfg',planned:true,note:'Dự kiến'});
  fixture.lotTransitions = [acceptedTr];
  ctx.__setState(fixture);

  const count = ctx.applyAcceptedLotTransitionToConfig(acceptedTr);
  assert.equal(count, 1, 'should update exactly the one test on the panel');

  const state = getState();
  const level = state.tests[0].levels[0];
  assert.equal(level.qcLotId, 'lotB', 'level should now point at the new lot');
  assert.equal(level.lot, 'LOT-B');
  assert.equal(level.mean, 12, 'Mean must come from the new lot, never from the old lot');
  assert.equal(level.sd, 1.2, 'SD must come from the new lot, never from the old lot');
  assert.equal(level.meanSdHistory.length, 2, 'should record both the pre-transition and post-transition snapshot');
  assert.equal(level.meanSdHistory[0].qcLotId, 'lotA');
  assert.equal(level.meanSdHistory[1].qcLotId, 'lotB');
  assert.equal(level.meanSdHistory[1].planned, false, 'planned target becomes the one live history record');

  // The lot group that referenced the old lot is rewired to the new lot...
  const activeGroup = state.lotGroups.find(g => g.id === 'g1');
  assert.deepEqual(activeGroup.lotIds, ['lotB']);
  assert.equal(activeGroup.active, true);
  // ...and the old grouping is archived (kept for history), not deleted outright.
  const archived = state.lotGroups.find(g => g.active === false);
  assert.ok(archived, 'old lot group should be archived, not discarded');
  assert.deepEqual(archived.lotIds, ['lotA']);
  assert.equal(archived.stoppedByTransitionId, 'tr1');

  // Depletion is a separate, explicit step (syncLotDepletionFromTransitions), not implicit here.
  assert.equal(state.qcLots.find(l => l.id === 'lotA').depleted, false, 'depletion is not applied until synced');
  ctx.syncLotDepletionFromTransitions();
  const synced = getState();
  assert.equal(synced.qcLots.find(l => l.id === 'lotA').depleted, true, 'retired lot should be marked depleted after sync');
  assert.equal(synced.qcLots.find(l => l.id === 'lotB').depleted, false);
}

// --- Case 1c: stale lot.groupId must not resurrect the retired lot into the active group on reload ---
// Regression: accepting a transition rewired g.lotIds but left the old lot's legacy
// groupId pointing at the active group; ensureShape()'s legacy migration then pushed
// the old lot back in on the next load (group became "NEW/other/OLD").
{
  run(ctx, 'function ensureLabBrandShape(){} function normalizePointLots(){} function reconcileSigmaLevelsWithLotGroups(){return{pruned:0};} function sgReconcileAllTeaSnapshots(){}');
  const fixture = makeFixture();
  fixture.tests[0].levels[0].meanSdHistory.push({id:'hB',qcLotId:'lotB',lot:'LOT-B',mean:12,sd:1.2,low:9.6,high:14.4,effectiveFrom:'',effectiveTo:'',source:'mfg',planned:true,note:'Dự kiến'});
  fixture.qcLots[0].groupId = 'g1'; // legacy pointer at the active group
  fixture.lotTransitions = [acceptedTr];
  fixture.machines = []; fixture.actions = []; fixture.users = [];
  ctx.__setState(fixture);
  ctx.applyAcceptedLotTransitionToConfig(acceptedTr);
  const applied = getState();
  assert.notEqual(applied.qcLots.find(l => l.id === 'lotA').groupId, 'g1', 'accept must repoint the retired lot\'s groupId away from the active group');
  ctx.ensureShape(); // simulate next page load
  const reloaded = getState();
  assert.deepEqual(reloaded.lotGroups.find(g => g.id === 'g1').lotIds, ['lotB'], 'reload must not resurrect the retired lot into the active group');

  // Already-corrupted saved data (pre-fix) must self-heal on load.
  const corrupt = makeFixture();
  corrupt.tests[0].levels[0]={...corrupt.tests[0].levels[0],qcLotId:'lotB',lot:'LOT-B',mean:12,sd:1.2};
  corrupt.lotGroups=[
    {id:'g1',name:'LOT-B/LOT-A',lotIds:['lotB','lotA'],active:true},
    {id:'g2',name:'LOT-A',lotIds:['lotA'],active:false,status:'stopped',stoppedByTransitionId:'tr1'}
  ];
  corrupt.qcLots[0].groupId='g1'; corrupt.qcLots[0].depleted=true;
  corrupt.lotTransitions=[acceptedTr];
  corrupt.machines = []; corrupt.actions = []; corrupt.users = [];
  ctx.__setState(corrupt);
  ctx.ensureShape();
  const healed = getState();
  assert.deepEqual(healed.lotGroups.find(g => g.id === 'g1').lotIds, ['lotB'], 'corrupted active group must drop the retired lot on load');
  assert.deepEqual(healed.lotGroups.find(g => g.id === 'g2').lotIds, ['lotA'], 'archived group must keep its history untouched');
  assert.equal(healed.qcLots.find(l => l.id === 'lotA').groupId, 'g2', 'retired lot must repoint at its archived group');
}

// --- Case 1b: no Mean/SD for the new lot -> atomic refusal, no copied old target or group rewrite ---
{
  const fixture = makeFixture();fixture.lotTransitions=[acceptedTr];ctx.__setState(fixture);
  assert.equal(ctx.applyAcceptedLotTransitionToConfig(acceptedTr),0,'must refuse a transition whose new lot has no own Mean/SD');
  const state=getState();assert.equal(state.tests[0].levels[0].qcLotId,'lotA');assert.equal(state.lotGroups.length,1);assert.equal(state.tests[0].levels[0].meanSdHistory.length,0);
}

// --- Case 2: transition not accepted (planned/active/rejected) -> no mutation ---
for (const status of ['planned', 'active', 'rejected']) {
  const fixture = makeFixture();
  const tr = { ...acceptedTr, status };
  fixture.lotTransitions = [tr];
  ctx.__setState(fixture);

  const count = ctx.applyAcceptedLotTransitionToConfig(tr);
  assert.equal(count, 0, `status "${status}" must not switch the lot`);
  const state = getState();
  assert.equal(state.tests[0].levels[0].qcLotId, 'lotA', `status "${status}" must leave existing config untouched`);
  assert.equal(state.lotGroups.length, 1, `status "${status}" must not create/archive any lot group`);
}

// --- Case 3: guard rail - old and new lot must be the same QC level ---
{
  const fixture = makeFixture();
  fixture.qcLots.find(l => l.id === 'lotB').level = 2; // mismatched level
  fixture.lotTransitions = [acceptedTr];
  ctx.__setState(fixture);

  const count = ctx.applyAcceptedLotTransitionToConfig(acceptedTr);
  assert.equal(count, 0, 'must refuse to apply a transition across different QC levels');
  const state = getState();
  assert.equal(state.tests[0].levels[0].qcLotId, 'lotA', 'config must remain untouched when levels mismatch');
}

// --- Case 4: group naming across a transition — auto-named groups follow the new
// lot number, but a lab-chosen custom name must survive untouched. ---
// Before 2026-08-03, applyAcceptedLotTransitionToConfig() (and normalizeLotGroups(),
// which every ensureShape() call runs) always overwrote g.name with the auto "lot/lot"
// string whenever it computed a non-empty one — so typing a real name in "Sửa nhóm lô"
// (saveConfigGroup()) worked only until the very next reload/Firebase merge/backup
// import, then silently reverted with no error and no audit entry.
{
  // 4a: group name still matches the auto-derived pattern for its old lots -> keep following.
  const fixture = makeFixture();
  fixture.tests[0].levels[0].meanSdHistory.push({id:'hB',qcLotId:'lotB',lot:'LOT-B',mean:12,sd:1.2,low:9.6,high:14.4,effectiveFrom:'',effectiveTo:'',source:'mfg',planned:true,note:'Dự kiến'});
  fixture.lotTransitions = [acceptedTr];
  ctx.__setState(fixture);
  ctx.applyAcceptedLotTransitionToConfig(acceptedTr);
  const state4a = getState();
  assert.equal(state4a.lotGroups.find(g => g.id === 'g1').name, 'LOT-B', 'auto-named group must keep following the lot it now holds');
  assert.equal(state4a.lotGroups.find(g => g.active === false).name, 'LOT-A', 'the archived snapshot keeps the name the group had at that point');
}
{
  // 4b: admin gave the group a real name -> must survive the transition untouched.
  const fixture = makeFixture();
  fixture.lotGroups[0].name = 'Nhóm lô Quý 3/2026';
  fixture.tests[0].levels[0].meanSdHistory.push({id:'hB',qcLotId:'lotB',lot:'LOT-B',mean:12,sd:1.2,low:9.6,high:14.4,effectiveFrom:'',effectiveTo:'',source:'mfg',planned:true,note:'Dự kiến'});
  fixture.lotTransitions = [acceptedTr];
  ctx.__setState(fixture);
  ctx.applyAcceptedLotTransitionToConfig(acceptedTr);
  const state4b = getState();
  assert.equal(state4b.lotGroups.find(g => g.id === 'g1').name, 'Nhóm lô Quý 3/2026', 'a custom group name must not be overwritten by the transition');
  assert.equal(state4b.lotGroups.find(g => g.active === false).name, 'Nhóm lô Quý 3/2026', 'the archived snapshot must also keep the custom name, not the auto pattern');
}
{
  // 4c: the same custom name must also survive a plain reload/merge (ensureShape()),
  // not just an accepted transition — this was the actual user-visible bug.
  const fixture = makeFixture();
  fixture.lotGroups[0].name = 'Nhóm lô Quý 3/2026';
  fixture.configMigrationVersion = 1; // skip the legacy one-time migration path
  ctx.__setState(fixture);
  ctx.ensureShape();
  const reloaded = getState();
  assert.equal(reloaded.lotGroups.find(g => g.id === 'g1').name, 'Nhóm lô Quý 3/2026', 'ensureShape() (every boot/Firebase merge/backup import) must not reset a custom group name');
}

console.log('Lot transition tests passed');

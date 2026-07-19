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

console.log('Lot transition tests passed');

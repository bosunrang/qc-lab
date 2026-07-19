/**
 * Regression test: qcPointWarnings() (assets/modules/qc-rules.js) did not warn when
 * backfilling a QC value for a date that actually falls within a DIFFERENT lot's
 * effective period.
 *
 * entryInlineSave() always computes the point's Mean/SD/lot from the level's CURRENT
 * config (lvlCfg), regardless of which date is being entered — by design, since a
 * normal same-day entry is always within the current lot's period. But when
 * backfilling a missed entry for a past date that straddles a lot transition, the
 * app silently attributed it to the CURRENT (new) lot's Mean/SD even when that exact
 * date actually falls within the OLD lot's recorded effectiveFrom/effectiveTo window
 * (meanSdHistory, stamped by applyAcceptedLotTransitionToConfig in state.js) — giving
 * a wrong Z-score/Westgard verdict for that historical entry.
 *
 * Fix: qcPointWarnings() now checks meanSdHistory for an entry belonging to a
 * DIFFERENT lot whose [effectiveFrom, effectiveTo) window contains the entry date,
 * and warns (soft, confirmable — matching the existing 5SD/stale-Mean-SD/high-CV
 * warnings) rather than silently mis-attributing the point.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/qc-rules.js']);
const plain = (v) => JSON.parse(JSON.stringify(v));

function cfgFixture() {
  return {
    level: 1, qcLotId: 'lotNew', lot: 'LOT-NEW', mean: 5.6, sd: 0.12,
    meanSdHistory: [
      { id: 'h1', qcLotId: 'lotOld', lot: 'LOT-OLD', mean: 5.5, sd: 0.11, effectiveFrom: '', effectiveTo: '2026-07-10', source: 'mfg' },
      { id: 'h2', qcLotId: 'lotNew', lot: 'LOT-NEW', mean: 5.6, sd: 0.12, effectiveFrom: '2026-07-10', effectiveTo: '', source: 'mfg' },
    ],
  };
}

const built = run(ctx, `(function(){
  state = { data: { T1: [] } };
  const t = { id: 'T1' };
  const cfg = ${JSON.stringify(cfgFixture())};
  return {
    beforeTransition: qcPointWarnings(t, cfg, '2026-07-06', '2026-07-06-1', 5.45),
    onTransitionDay: qcPointWarnings(t, cfg, '2026-07-10', '2026-07-10-1', 5.5),
    wellAfterTransition: qcPointWarnings(t, cfg, '2026-07-15', '2026-07-15-1', 5.6),
    dayBeforeCutoff: qcPointWarnings(t, cfg, '2026-07-09', '2026-07-09-1', 5.5),
  };
})()`);

const result = plain(built);
assert.ok(result.beforeTransition.some(x => x.includes('LOT-OLD')), 'backfilling a date inside the OLD lot\'s effective window warns which lot actually applied then');
assert.ok(result.dayBeforeCutoff.some(x => x.includes('LOT-OLD')), 'the day right before the cutoff is still inside the old lot\'s window');
assert.ok(!result.onTransitionDay.some(x => x.includes('LOT-OLD')), 'the transition day itself belongs to the new lot (effectiveTo is exclusive) and is not flagged');
assert.ok(!result.wellAfterTransition.some(x => x.includes('LOT-OLD')), 'a normal entry safely after the transition is not flagged');

console.log('QC point warnings tests passed');

const { performance } = require('node:perf_hooks');
const { loadSandbox, run } = require('../tests/helpers/sandbox');
const { makeState } = require('./performance-baseline');

function median(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  return Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
}

function measure(fn, repeats = 3) {
  const samples = [];
  for (let i = 0; i < repeats; i++) {
    const started = performance.now();
    fn(i);
    samples.push(performance.now() - started);
  }
  return { medianMs: median(samples), samplesMs: samples.map(n => Number(n.toFixed(2))) };
}

const shape = { name: 'deployment', tests: 50, levels: 3, days: 730 };
const source = makeState(shape);
const shell = { ...source, data: {} };
const fullRaw = JSON.stringify(source);
const bootRaw = JSON.stringify({ format: 1, slot: 'a', shell });
const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/settings.js']);
ctx.__bootRaw = bootRaw;

const perceivedBoot = measure(() => run(ctx, `(()=>{
  const boot=JSON.parse(__bootRaw),errors=QCCore.validateBackup(boot.shell);if(errors.length)throw new Error(errors[0]);
  state=QCCore.sanitizeBackup(boot.shell,{owned:true});ensureShape({sanitized:true});
  const invariantErrors=QCCore.validateStateInvariants(state,{sanitized:true});if(invariantErrors.length)throw new Error(invariantErrors[0]);
})()`));

const hydratedCopies = Array.from({ length: 3 }, () => structuredClone(source));
const backgroundHydration = measure(i => {
  ctx.__hydrated = hydratedCopies[i];
  run(ctx, `(()=>{
  const parsed=__hydrated;
  state=QCCore.sanitizeBackup(parsed,{owned:true});ensureShape({sanitized:true});
  const errors=QCCore.validateStateInvariants(state,{sanitized:true});if(errors.length)throw new Error(errors[0]);
})()`);
}, 3);

process.stdout.write(`${JSON.stringify({
  benchmark: 'QC Lab partitioned startup',
  node: process.version,
  shape: { tests: shape.tests, levelsPerTest: shape.levels, days: shape.days, points: Object.values(source.data).reduce((n, rows) => n + rows.length, 0) },
  fullSnapshotMB: Number((Buffer.byteLength(fullRaw) / 1024 / 1024).toFixed(2)),
  bootShellKB: Number((Buffer.byteLength(bootRaw) / 1024).toFixed(2)),
  bootPayloadReductionPercent: Number((100 * (1 - Buffer.byteLength(bootRaw) / Buffer.byteLength(fullRaw))).toFixed(2)),
  perceivedBoot,
  backgroundHydration,
}, null, 2)}\n`);

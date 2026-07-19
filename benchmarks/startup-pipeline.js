const { performance } = require('node:perf_hooks');
const { loadSandbox, run } = require('../tests/helpers/sandbox');
const { makeState } = require('./performance-baseline');

function time(label, fn, repeats = 1) {
  const samples = [];
  for (let i = 0; i < repeats; i++) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return { label, medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(2)), samplesMs: samples.map(value => Number(value.toFixed(2))) };
}

const shape = { name: 'deployment', tests: 50, levels: 3, days: 730 };
const source = makeState(shape);
const raw = JSON.stringify(source);
const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/settings.js']);
ctx.__raw = raw;

const measurements = [];
measurements.push(time('json_parse', () => { ctx.__parsed = JSON.parse(raw); }, 3));
ctx.__parsed = JSON.parse(raw);
measurements.push(time('validate_backup', () => run(ctx, 'QCCore.validateBackup(__parsed)'), 3));
measurements.push(time('sanitize_backup', () => run(ctx, 'QCCore.sanitizeBackup(__parsed)'), 3));
ctx.__sanitized = run(ctx, 'QCCore.sanitizeBackup(__parsed)');
measurements.push(time('validate_invariants', () => run(ctx, 'QCCore.validateStateInvariants(__sanitized)'), 3));
measurements.push(time('validate_invariants_after_sanitize', () => run(ctx, 'QCCore.validateStateInvariants(__sanitized,{sanitized:true})'), 3));
measurements.push(time('normalize_points', () => run(ctx, 'state=__sanitized;normalizePointLots()')));
ctx.__sanitizedForEnsure = run(ctx, 'QCCore.sanitizeBackup(__parsed)');
measurements.push(time('ensure_shape_after_sanitize', () => run(ctx, 'state=__sanitizedForEnsure;ensureShape({sanitized:true})')));
measurements.push(time('current_full_boot_pipeline', () => run(ctx, `(()=>{
  const parsed=JSON.parse(__raw),errors=QCCore.validateBackup(parsed);if(errors.length)throw new Error(errors[0]);
  state=QCCore.sanitizeBackup(parsed,{owned:true});ensureShape({sanitized:true});
  const invariantErrors=QCCore.validateStateInvariants(state,{sanitized:true});if(invariantErrors.length)throw new Error(invariantErrors[0]);
})()`)));

process.stdout.write(`${JSON.stringify({
  benchmark: 'QC Lab startup pipeline',
  node: process.version,
  shape: { tests: shape.tests, levelsPerTest: shape.levels, days: shape.days, points: Object.values(source.data).reduce((sum, rows) => sum + rows.length, 0) },
  jsonMB: Number((Buffer.byteLength(raw) / 1024 / 1024).toFixed(2)),
  measurements,
}, null, 2)}\n`);

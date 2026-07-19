const { performance } = require('node:perf_hooks');
const { loadSandbox } = require('../tests/helpers/sandbox');

function time(fn, repeats = 3) {
  const samples = [];
  for (let i = 0; i < repeats; i++) {
    const started = performance.now();fn();samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return { medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(2)), samplesMs: samples.map(n => Number(n.toFixed(2))) };
}

const ctx = loadSandbox(['modules/chart-view-model.js']);
const count = 100000,values = Array.from({ length: count }, (_, i) => Math.sin(i / 31));
values[12345] = -20;values[87654] = 20;
const sampling = time(() => ctx.ChartViewModel.sampleIndices({ length: count, maxPoints: 640, valueAt: i => values[i], preserve: [50000] }));
const indices = ctx.ChartViewModel.sampleIndices({ length: count, maxPoints: 640, valueAt: i => values[i], preserve: [50000] });

const runCount = 10000,runs = Array.from({ length: runCount }, (_, i) => `2026-01-${i}`),queries = runs.slice().reverse();
const indexOfLookup = time(() => queries.forEach(run => runs.indexOf(run)), 1);
const runIndex = new Map(runs.map((run, i) => [run, i]));
const mapLookup = time(() => queries.forEach(run => runIndex.get(run)));

process.stdout.write(`${JSON.stringify({
  benchmark: 'QC Lab render pipeline',
  points: count,
  sampling,
  renderedIndices: indices.length,
  preserves: { first: indices.includes(0), last: indices.includes(count - 1), minSpike: indices.includes(12345), maxSpike: indices.includes(87654), forcedViolation: indices.includes(50000) },
  multiLevelRunLookup: { runs: runCount, indexOfLookup, mapLookup, speedup: Number((indexOfLookup.medianMs / Math.max(mapLookup.medianMs, 0.001)).toFixed(1)) },
  canvasAtDpr1: { oldBackingPixels: 1400 * 430 * 4, newBackingPixels: 1400 * 430, reductionPercent: 75 },
}, null, 2)}\n`);

const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/entry-ui-state.js']);
const plain = value => JSON.parse(JSON.stringify(value));

run(ctx, "entrySel={testId:'T1',level:2}; entryDays=14; entryExtraRun.add('T1|2|2026-07-14|2');");
assert.deepEqual(plain(ctx.EntryUIState.entrySel), { testId: 'T1', level: 2 });
assert.equal(ctx.EntryUIState.entryDays, 14);
assert.equal(ctx.EntryUIState.entryExtraRun.has('T1|2|2026-07-14|2'), true);

ctx.EntryUIState.entrySel = null;
assert.equal(ctx.entrySel, null, 'legacy global aliases must stay synchronized during migration');

console.log('Entry UI state tests passed');

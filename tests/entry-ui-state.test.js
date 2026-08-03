const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/entry-ui-state.js']);
const plain = value => JSON.parse(JSON.stringify(value));

run(ctx, "entrySel={testId:'T1',level:2}; entryDays=14; entryExtraRun.add('T1|2|2026-07-14|2'); entryDetailOpen.add('points');");
assert.deepEqual(plain(ctx.EntryUIState.entrySel), { testId: 'T1', level: 2 });
assert.equal(ctx.EntryUIState.entryDays, 14);
assert.equal(ctx.EntryUIState.entryExtraRun.has('T1|2|2026-07-14|2'), true);
assert.equal(ctx.EntryUIState.entryDetailOpen.has('points'), true);
assert.equal(ctx.EntryUIState.entryTreeCollapsed, null, 'trạng thái cây chờ đọc tùy chọn hiển thị trên máy khi mở trang Nhập QC');

ctx.entryTreeCollapsed = true;
assert.equal(ctx.EntryUIState.entryTreeCollapsed, true, 'ẩn/hiện cây phải đồng bộ qua UI state');

ctx.EntryUIState.entrySel = null;
assert.equal(ctx.entrySel, null, 'legacy global aliases must stay synchronized during migration');

console.log('Entry UI state tests passed');

'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-row-window.ts')).href;
const program = `
  import { westgardRowsWindow } from ${JSON.stringify(source)};
  console.log(JSON.stringify({
    collapsed: westgardRowsWindow([1, 2, 3, 4, 5], 3, 3),
    loadedMore: westgardRowsWindow([1, 2, 3, 4, 5], 4, 3),
    fullyLoaded: westgardRowsWindow([1, 2, 3, 4, 5], 5, 3),
    beyondTotal: westgardRowsWindow([1, 2, 3, 4, 5], 99, 3),
    invalidCount: westgardRowsWindow([1, 2], 0, 3),
    invalidLimit: westgardRowsWindow([1, 2], 0, 0),
    empty: westgardRowsWindow(null, 3, 3),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'không thể chạy mô-đun TypeScript Westgard row window');
const output = JSON.parse(result.stdout);
assert.deepEqual(output.collapsed, { rows: [3, 4, 5], total: 5, visibleCount: 3, limited: true });
assert.deepEqual(output.loadedMore, { rows: [2, 3, 4, 5], total: 5, visibleCount: 4, limited: true });
assert.deepEqual(output.fullyLoaded, { rows: [1, 2, 3, 4, 5], total: 5, visibleCount: 5, limited: false });
assert.deepEqual(output.beyondTotal, { rows: [1, 2, 3, 4, 5], total: 5, visibleCount: 5, limited: false });
assert.deepEqual(output.invalidCount, { rows: [1, 2], total: 2, visibleCount: 2, limited: false });
assert.deepEqual(output.invalidLimit, { rows: [1, 2], total: 2, visibleCount: 2, limited: false });
assert.deepEqual(output.empty, { rows: [], total: 0, visibleCount: 0, limited: false });

console.log('Westgard row-window TypeScript tests passed');

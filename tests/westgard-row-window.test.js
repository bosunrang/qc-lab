'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-row-window.ts')).href;
const program = `
  import { westgardRowsWindow } from ${JSON.stringify(source)};
  console.log(JSON.stringify({
    collapsed: westgardRowsWindow([1, 2, 3, 4, 5], false, 3),
    expanded: westgardRowsWindow([1, 2, 3, 4, 5], true, 3),
    invalidLimit: westgardRowsWindow([1, 2], false, 0),
    empty: westgardRowsWindow(null, false, 3),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'không thể chạy mô-đun TypeScript Westgard row window');
const output = JSON.parse(result.stdout);
assert.deepEqual(output.collapsed, { rows: [3, 4, 5], total: 5, expanded: false, limited: true });
assert.deepEqual(output.expanded, { rows: [1, 2, 3, 4, 5], total: 5, expanded: true, limited: false });
assert.deepEqual(output.invalidLimit, { rows: [1, 2], total: 2, expanded: false, limited: false });
assert.deepEqual(output.empty, { rows: [], total: 0, expanded: false, limited: false });

console.log('Westgard row-window TypeScript tests passed');

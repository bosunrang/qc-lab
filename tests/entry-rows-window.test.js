'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-rows-window.ts')).href;
const program = `
  import { entryRowsWindow, entryLotLabels } from ${JSON.stringify(source)};
  console.log(JSON.stringify([entryRowsWindow([1, 2, 3, 4], false, 2), entryRowsWindow([1, 2, 3], true, 2), entryRowsWindow(null, false, 2), entryLotLabels([{ lot: 'L1' }, { lot: ' L2 ' }]), entryLotLabels([])]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry rows window TypeScript');
const [limited, expanded, empty, labels, noLot] = JSON.parse(result.stdout);
assert.deepEqual(limited, { rows: [3, 4], total: 4, limited: true, expanded: false });
assert.deepEqual(expanded, { rows: [1, 2, 3], total: 3, limited: false, expanded: true });
assert.deepEqual(empty, { rows: [], total: 0, limited: false, expanded: false });
assert.equal(labels, 'L1 / L2');
assert.equal(noLot, 'Chưa gán lô');
console.log('Entry rows window TypeScript tests passed');

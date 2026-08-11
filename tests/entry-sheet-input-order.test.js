'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-sheet-input-order.ts')).href;
const program = `
  import { createEntrySheetInputOrder } from ${JSON.stringify(source)};
  const order = createEntrySheetInputOrder({ date: item => item.date, run: item => item.run, level: item => item.level });
  console.log(JSON.stringify(order([{ id: 'later', date: '2026-08-02', run: 1, level: 1 }, { id: 'l2', date: '2026-08-01', run: 1, level: 2 }, { id: 'r2', date: '2026-08-01', run: 2, level: 1 }, { id: 'l1', date: '2026-08-01', run: 1, level: 1 }]).map(item => item.id)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry sheet input order TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['l1', 'l2', 'r2', 'later']);
console.log('Entry sheet input order TypeScript tests passed');

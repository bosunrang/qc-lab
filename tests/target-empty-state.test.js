'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-empty-state.ts')).href;
const program = `
  import { targetEmptyState } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetEmptyState(0, ['L1'], [], '1'), targetEmptyState(2, ['L1', 'L2'], ['L1', 'L2'], '2'), targetEmptyState(2, ['L1'], [], '1')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target empty state TypeScript');
const [panel, depleted, search] = JSON.parse(result.stdout);
assert.equal(panel.title, 'Panel chưa có xét nghiệm');
assert.equal(depleted.title, 'Lô mức 2 đã hết QC');
assert.match(depleted.description, /L1, L2/);
assert.equal(search.title, 'Không tìm thấy xét nghiệm');
console.log('Target empty state TypeScript tests passed');

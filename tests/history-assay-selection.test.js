'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-assay-selection.ts')).href;
const program = `
  import { historyAssaySelection } from ${JSON.stringify(source)};
  console.log(JSON.stringify([historyAssaySelection([{ id: 'T1', name: 'Na' }, { id: 'T2', name: 'K' }], 'T2'), historyAssaySelection([{ id: 'T1', name: 'Na' }], 'missing'), historyAssaySelection([], 'T1')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history assay selection TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ selectedId: 'T2', assay: { id: 'T2', name: 'K' } }, { selectedId: 'T1', assay: { id: 'T1', name: 'Na' } }, { selectedId: '' }]);
console.log('History assay selection TypeScript tests passed');

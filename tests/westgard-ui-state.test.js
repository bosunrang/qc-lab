'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-ui-state.ts')).href;
const program = `
  import { westgardUiState } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    [...westgardUiState.toggleOpen(new Set(['a']), 'b')], [...westgardUiState.toggleOpen(new Set(['a']), 'a')],
    westgardUiState.viewMode('archived'), westgardUiState.viewMode('bad'), westgardUiState.chartMode('cusum'), westgardUiState.chartMode('bad'), westgardUiState.query(null), westgardUiState.query(12),
    westgardUiState.archivedGroup('G1'), westgardUiState.archivedTest('T1'),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy westgard UI state TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [['a', 'b'], [], 'archived', 'current', 'cusum', 'lj', '', '12', { groupId: 'G1', testId: '' }, { testId: 'T1' }]);
console.log('Westgard UI state TypeScript tests passed');

'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'nce', 'action-current-issues.ts')).href;
const program = `
  import { createActionCurrentIssues } from ${JSON.stringify(source)};
  const test = { id: 'GLU' }, views = [{ l: { level: 1 }, pts: [{ id: 'warn-old', date: '2026-08-01' }, { id: 'rej', date: '2026-08-02' }, { id: 'done', date: '2026-08-03' }, { id: 'ok', date: '2026-08-04' }] }];
  const get = createActionCurrentIssues({ operationalTests: () => [test], activeWestgard: () => ({ views, byPoint: new Map([['warn-old', { level: 'warn', rules: ['1-2s'] }], ['rej', { level: 'rej', rules: ['1-3s'] }], ['done', { level: 'warn', rules: ['2-2s'] }], ['ok', { level: 'ok', rules: [] }]]) }), pointWorkflowComplete: id => id === 'done' });
  console.log(JSON.stringify(get().map(item => [item.p.id, item.rules])));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action current issues TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [['rej', ['1-3s']], ['warn-old', ['1-2s']]]);
console.log('Action current issues TypeScript tests passed');

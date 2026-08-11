'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-test-search.ts')).href;
const program = `
  import { createWestgardTestSearch } from ${JSON.stringify(source)};
  const search = createWestgardTestSearch({ text: value => String(value || '').toLowerCase(), label: test => test.label, id: test => test.id });
  const tests = [{ id: 'a', label: 'Glucose · Máy A' }, { id: 'b', label: 'Sodium · Máy B' }];
  console.log(JSON.stringify([search.select(tests, 'sodium', 'a'), search.select(tests, 'glucose', 'a'), search.select(tests, 'none', 'a')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy westgard test search TypeScript');
const [switched, retained, empty] = JSON.parse(result.stdout);
assert.deepEqual([switched.matches.map(item => item.id), switched.selected, switched.changed], [['b'], 'b', true]);
assert.deepEqual([retained.selected, retained.changed], ['a', false]);
assert.deepEqual([empty.matches, empty.selected, empty.changed], [[], 'a', false]);
console.log('Westgard test search TypeScript tests passed');

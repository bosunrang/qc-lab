'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-cusum-levels.ts')).href;
const program = `
  import { createWestgardCusumLevels } from ${JSON.stringify(source)};
  const levels = createWestgardCusumLevels({ levels: () => [{ level: 1, lot: 'A' }, { level: 2, lot: 'B' }], points: (_test, level) => level === 1 ? [4, 5] : [] });
  console.log(JSON.stringify(levels({ id: 'T1' })));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy Westgard CUSUM levels TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ level: 1, lot: 'A', pts: [4, 5] }, { level: 2, lot: 'B', pts: [] }]);
console.log('Westgard CUSUM levels TypeScript tests passed');

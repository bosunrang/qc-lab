'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'same-normalized-text.ts')).href;
const program = `
  import { createSameNormalizedText } from ${JSON.stringify(source)};
  const same = createSameNormalizedText({ normalize: value => String(value || '').trim().toLowerCase() });
  console.log(JSON.stringify([same(' Glucose ', 'glucose'), same('Na', 'K')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy same normalized text TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [true, false]);
console.log('Same normalized text TypeScript tests passed');

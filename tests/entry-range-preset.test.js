'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-range-preset.ts')).href;
const program = `
  import { entryRangePreset } from ${JSON.stringify(source)};
  console.log(JSON.stringify([entryRangePreset(30), entryRangePreset(365)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'khÃ´ng thá»ƒ cháº¡y entry range preset TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ days: 30, start: null, end: null }, { days: 90, start: null, end: null }]);
console.log('Entry range preset TypeScript tests passed');

'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-colors.ts')).href;
const program = `
  import { LEVEY_JENNINGS_COLORS } from ${JSON.stringify(source)};
  if(!Object.isFrozen(LEVEY_JENNINGS_COLORS)||LEVEY_JENNINGS_COLORS.line!=='#0e8f8f'||LEVEY_JENNINGS_COLORS.rejectPoint!=='#c5221f')throw new Error('must expose immutable legacy palette');
  console.log('Levey-Jennings colors TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings colors TypeScript');
console.log(result.stdout.trim());

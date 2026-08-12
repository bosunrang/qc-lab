'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-selector-html.ts')).href;
const program = `
  import { targetSelectorHtml } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetSelectorHtml('<option>P1</option>', '<option>G1</option>'), targetSelectorHtml('', '')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target selector HTML TypeScript');
const [full, empty] = JSON.parse(result.stdout);
assert.match(full, /setTargetPanel\(this.value\).*<option>P1<\/option>/s);
assert.match(full, /setTargetGroup\(this.value\).*<option>G1<\/option>/s);
assert.match(empty, /<option value="">Chưa có panel<\/option>/);
console.log('Target selector HTML TypeScript tests passed');

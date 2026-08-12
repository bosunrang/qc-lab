'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-level-tabs-html.ts')).href;
const program = `
  import { targetLevelTabsHtml } from ${JSON.stringify(source)};
  console.log(targetLevelTabsHtml([1, 2, 3], '2'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target level tabs HTML TypeScript');
assert.equal(result.stdout.trim(), '<button class="" onclick="setTargetLevel(1)">Mức 1</button><button class="on" onclick="setTargetLevel(2)">Mức 2</button><button class="" onclick="setTargetLevel(3)">Mức 3</button>');
console.log('Target level tabs HTML TypeScript tests passed');

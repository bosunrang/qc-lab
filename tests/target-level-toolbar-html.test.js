'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-level-toolbar-html.ts')).href;
const program = `
  import { targetLevelToolbarHtml } from ${JSON.stringify(source)};
  console.log(targetLevelToolbarHtml('2', ['LOT<1>', 'LOT2'], '<button>Mức 2</button>', value => String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target level toolbar HTML TypeScript');
assert.equal(result.stdout.trim(), '<div class="target-level-toolbar"><div><b>Mức 2</b><span class="target-level-lot">LOT&lt;1&gt; / LOT2</span></div><div class="dayseg"><button>Mức 2</button></div></div>');
console.log('Target level toolbar HTML TypeScript tests passed');

'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'firebase-connection-panel-html.ts')).href;
const program = `import { createFirebaseConnectionPanelHtml } from ${JSON.stringify(source)}; console.log(createFirebaseConnectionPanelHtml({escape:value => '[' + value + ']',escapeAttribute:value => 'ATTR:' + value,button:(label, action) => '<button>' + label + ':' + action + '</button>'})({labCode:'labA',email:'a@b.vn',config:{projectId:'p'},locked:true,dataPath:'qclab/labA'}));`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript Firebase connection panel HTML');
assert.match(result.stdout, /id="fbCode"[^>]*readonly/);
assert.match(result.stdout, /id="fbConfig"[^>]*readonly/);
assert.match(result.stdout, /\[qclab\/labA\]/);
assert.match(result.stdout, /saveFb\(\)/);
console.log('Firebase connection panel HTML TypeScript tests passed');

'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'lis-gateway-panel-html.ts')).href;
const program = `import { createLisGatewayPanelHtml } from ${JSON.stringify(source)}; console.log(createLisGatewayPanelHtml({escape:value => '[' + value + ']',escapeAttribute:value => 'ATTR:' + value,button:(label, action) => '<button>' + label + ':' + action + '</button>'})({url:'http://127.0.0.1:8787',token:'tok',enabled:true,status:'ok',statusText:'Đã kết nối'}));`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript LIS Gateway panel HTML');
assert.match(result.stdout, /value="ATTR:http:\/\/127\.0\.0\.1:8787"/);
assert.match(result.stdout, /type="checkbox" checked/);
assert.match(result.stdout, /class="alert ok"/);
assert.match(result.stdout, /lisGatewaySaveSettings\(\)/);
console.log('LIS Gateway panel HTML TypeScript tests passed');

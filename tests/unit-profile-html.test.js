'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'unit-profile-html.ts')).href;
const program = `import { createUnitProfileHtml } from ${JSON.stringify(source)}; console.log(createUnitProfileHtml({escapeAttribute:value => 'ATTR:' + value,button:(label, action) => '<button>' + label + ':' + action + '</button>'})({name:'BV A',dept:'Hóa sinh',address:'1 Đường A'}));`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript unit profile HTML');
assert.match(result.stdout, /id="labName"[^>]*value="ATTR:BV A"/);
assert.match(result.stdout, /id="labDept"[^>]*value="ATTR:Hóa sinh"/);
assert.match(result.stdout, /id="labAddr"[^>]*value="ATTR:1 Đường A"/);
assert.match(result.stdout, /saveLab\(\)/);
console.log('Unit profile HTML TypeScript tests passed');

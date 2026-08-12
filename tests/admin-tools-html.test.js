'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'admin-tools-html.ts')).href;
const program = `import { createAdminToolsHtml } from ${JSON.stringify(source)}; console.log(createAdminToolsHtml((label, action) => '<button>' + label + ':' + action + '</button>')('Hôm nay', '10 MB'));`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript admin tools HTML');
for (const action of ['exportData()', 'importData(event)', 'verifyBackupFile(event)', 'checkStorageUsage()', 'resetAllData()']) assert.match(result.stdout, new RegExp(action.replace(/[()]/g, '\\$&')));
assert.match(result.stdout, /Hôm nay 10 MB/);
console.log('Admin tools HTML TypeScript tests passed');

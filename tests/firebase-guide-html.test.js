'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'firebase-guide-html.ts')).href;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', `import { firebaseGuideHtml } from ${JSON.stringify(source)}; console.log(firebaseGuideHtml());`], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript Firebase guide HTML');
assert.match(result.stdout, /class="firebase-guide"/);
assert.equal((result.stdout.match(/class="fb-step"/g) || []).length, 5);
assert.match(result.stdout, /qclab-acl\/labA\/\{uid\}/);
assert.match(result.stdout, /Email\/Password/);
console.log('Firebase guide HTML TypeScript tests passed');

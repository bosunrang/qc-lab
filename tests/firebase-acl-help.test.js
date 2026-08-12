'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'firebase-acl-help.ts')).href;
const program = `import { firebaseAclHelp } from ${JSON.stringify(source)}; console.log(firebaseAclHelp('labA', 'uid-123'));`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript Firebase ACL help');
assert.match(result.stdout, /qclab-acl\/labA\/uid-123 = true/);
console.log('Firebase ACL help TypeScript tests passed');

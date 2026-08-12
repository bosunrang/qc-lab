'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'firebase-rules.ts')).href;
const program = `import { firebaseRulesText } from ${JSON.stringify(source)}; console.log(firebaseRulesText());`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript Firebase Rules');
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase', 'database.rules.json'), 'utf8'));
assert.deepEqual(JSON.parse(result.stdout), expected, 'Firebase Rules TypeScript phải khớp artifact triển khai');
console.log('Firebase Rules TypeScript tests passed');

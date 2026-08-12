'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'sync', 'firebase-config-parser.ts')).href;
const program = `
  import { parseFirebaseConfig } from ${JSON.stringify(source)};
  const literal = 'const firebaseConfig = { apiKey: "key", authDomain: "app.firebaseapp.com", databaseURL: "https://app.firebaseio.com", projectId: "app", appId: "1:2:web:3", };';
  console.log(JSON.stringify(parseFirebaseConfig(literal)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript Firebase config parser');
assert.equal(JSON.parse(result.stdout).projectId, 'app');

const invalid = `import { parseFirebaseConfig } from ${JSON.stringify(source)}; parseFirebaseConfig('{}');`;
const invalidResult = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', invalid], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.notEqual(invalidResult.status, 0, 'Firebase config thiếu trường bắt buộc phải bị từ chối');
assert.match(invalidResult.stderr, /Firebase config không hợp lệ/);
console.log('Firebase config parser TypeScript tests passed');

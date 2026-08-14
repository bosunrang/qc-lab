const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const rulesPath = path.join(__dirname, '..', 'firebase', 'database.rules.json');
const committed = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'firebase-rules.ts')).href;
const program = `import { firebaseRulesText } from ${JSON.stringify(source)}; console.log(firebaseRulesText());`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy Firebase Rules TypeScript');
const displayed = JSON.parse(result.stdout);

assert.deepEqual(displayed, committed, 'Firebase Rules trong UI phải giống artifact triển khai');
assert.equal(committed.rules['.read'], false);
assert.equal(committed.rules['.write'], false);
assert.equal(committed.rules['qclab-acl'].$labCode.$uid['.write'], false, 'client không được tự thêm UID vào ACL');

const shared = committed.rules['qclab-shared'].$labCode;
for (const permission of ['.read', '.write']) {
  assert.match(shared[permission], /auth != null/);
  assert.match(shared[permission], /qclab-acl/);
  assert.match(shared[permission], /\$labCode/);
  assert.match(shared[permission], /auth\.uid/);
}
assert.match(shared['.validate'], /_ts/);
assert.match(shared._ts['.validate'], /isNumber/);
assert.match(shared._client['.validate'], /isString/);

console.log('Firebase Rules ACL contract tests passed');

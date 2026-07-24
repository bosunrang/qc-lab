const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const rulesPath = path.join(__dirname, '..', 'firebase', 'database.rules.json');
const committed = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const ctx = loadSandbox(['modules/settings.js']);
const displayed = JSON.parse(run(ctx, 'firebaseRulesText()'));

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

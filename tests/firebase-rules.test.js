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
assert.equal(shared['.write'], undefined, 'không được cấp quyền ghi ở room cha vì sẽ vô hiệu rules con');
assert.match(shared['.read'], /auth != null/);
assert.match(shared['.read'], /qclab-acl/);
assert.match(shared['.read'], /\$labCode/);
assert.match(shared['.read'], /auth\.uid/);
assert.match(shared['.validate'], /_ts/);
assert.match(shared._ts['.validate'], /isNumber/);
assert.match(shared._client['.validate'], /isString/);

const activityWrite = shared.activity.$index['.write'];
assert.match(activityWrite, /!data\.exists\(\)/, 'audit mới được phép thêm');
assert.match(activityWrite, /newData\.val\(\) === data\.val\(\)/, 'audit cũ chỉ được ghi lại y nguyên');
assert.match(shared.activity.$index['.validate'], /hash/);
assert.match(shared.activity.$index['.validate'], /length === 64/);

assert.match(shared.users['.write'], /child\('admin'\)\.val\(\) === true/, 'chỉ Firebase ACL admin được sửa users');
assert.match(shared.$branch['.write'], /\$branch !== 'activity'/);
assert.match(shared.$branch['.write'], /\$branch !== 'users'/);
assert.match(shared.$branch['.write'], /child\('write'\)\.val\(\) === true/);

console.log('Firebase Rules ACL contract tests passed');

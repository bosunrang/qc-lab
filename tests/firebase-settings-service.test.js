'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'sync', 'firebase-settings-service.ts')).href;
const program = `
  import { createFirebaseSettingsService } from ${JSON.stringify(source)};
  const service = createFirebaseSettingsService(value => { if (value === 'bad') throw new Error('bad config'); return {projectId:'lab'}; });
  console.log(JSON.stringify([service.prepare({labCode:'  ',email:'',password:'',config:'ok'}), service.prepare({labCode:' khoaXN ',email:' admin@lab.vn ',password:' secret ',config:'ok'})]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript Firebase settings service');
const [missing, valid] = JSON.parse(result.stdout);
assert.deepEqual(missing, {ok:false,error:'missing-credentials'});
assert.deepEqual(valid, {ok:true,labCode:'khoaXN',email:'admin@lab.vn',password:' secret ',config:{projectId:'lab'}});
console.log('Firebase settings service TypeScript tests passed');

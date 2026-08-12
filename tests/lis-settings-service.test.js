'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'lis', 'lis-settings-service.ts')).href;
const program = `
  import { createLisSettingsService } from ${JSON.stringify(source)};
  const service = createLisSettingsService(value => String(value).startsWith('http://127.0.0.1:8787') ? 'http://127.0.0.1:8787' : '');
  console.log(JSON.stringify([
    service.prepare({enabled:true,url:'bad',token:'x',savedToken:''}),
    service.prepare({enabled:true,url:'http://127.0.0.1:8787/path',token:'',savedToken:''}),
    service.prepare({enabled:true,url:'http://127.0.0.1:8787/path',token:'  new  ',savedToken:'old'}),
    service.prepare({enabled:false,url:'http://127.0.0.1:8787',token:'',savedToken:'old'})
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript LIS settings service');
const [badUrl, missingToken, enabled, disabled] = JSON.parse(result.stdout);
assert.deepEqual(badUrl, {ok:false,error:'invalid-url'});
assert.deepEqual(missingToken, {ok:false,error:'missing-token'});
assert.deepEqual(enabled, {ok:true,settings:{enabled:true,url:'http://127.0.0.1:8787',token:'new'}});
assert.deepEqual(disabled, {ok:true,settings:{enabled:false,url:'http://127.0.0.1:8787',token:'old'}});
console.log('LIS settings service TypeScript tests passed');

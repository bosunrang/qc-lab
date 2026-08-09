const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { loadSandbox, run } = require('./helpers/sandbox');

(async()=>{
  const ctx=loadSandbox(['modules/users-auth.js'],{crypto:webcrypto});
  assert.equal(run(ctx, `passwordError('')`), 'Mật khẩu không được để trống.');
  assert.match(run(ctx, `passwordError('1234567')`), /8 ký tự/);
  assert.equal(run(ctx, `passwordError('mat-khau-hop-le')`), '');

  const hash=await run(ctx, `hashPass('Mật-khẩu-kiểm-thử-2026')`);
  assert.match(hash,/^pbkdf2\$600000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(await run(ctx, `verifyPass('Mật-khẩu-kiểm-thử-2026',${JSON.stringify(hash)})`),true);
  assert.equal(await run(ctx, `verifyPass('sai-mật-khẩu',${JSON.stringify(hash)})`),false);

  const legacy=await run(ctx, `legacyHashPass('legacy-pass')`);
  assert.equal(await run(ctx, `verifyPass('legacy-pass',${JSON.stringify(legacy)})`),true,'legacy hash remains upgradeable at login');
  const usersSource=fs.readFileSync(path.join(__dirname,'..','assets','modules','users-auth.js'),'utf8');
  const backupSource=fs.readFileSync(path.join(__dirname,'..','assets','modules','backup-ui.js'),'utf8');
  assert.doesNotMatch(usersSource,/function clearActivityLog\b/,'không được có đường xóa trắng audit trong app');
  assert.match(usersSource,/async function resetAllData\([\s\S]*?reauthenticateCurrentUser\(\{title:'Xác thực xóa sạch dữ liệu'/,'reset toàn bộ phải xác thực lại');
  assert.match(backupSource,/async function importData\([\s\S]*?reauthenticateCurrentUser\(\{title:'Xác thực nhập backup'/,'thay toàn bộ dữ liệu bằng backup phải xác thực lại');
  console.log('Authentication hashing and verification tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

const assert = require('node:assert/strict');
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
  console.log('Authentication hashing and verification tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const license = require('../electron/license');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qclab-license-test-'));
try{
  const none=license.currentStatus(dir);
  assert.equal(none.valid,false);
  assert.equal(none.reason,'none');
  assert.match(none.machineId,/^[0-9A-F]{4}(?:-[0-9A-F]{4}){5}$/);

  assert.deepEqual(license.verifyLicenseString(''),{valid:false,reason:'empty'});
  assert.equal(license.verifyLicenseString('not-a-license').reason,'format');
  assert.equal(license.verifyLicenseString('bm90LWpzb24=.bad').reason,'payload');
  const fakePayload=Buffer.from(JSON.stringify({lab:'PXN',machineId:license.machineIdCanonical()})).toString('base64');
  assert.equal(license.verifyLicenseString(fakePayload+'.AAAA').reason,'signature','unsigned payload must never activate');

  license.saveLicense(dir,'  invalid-license  ');
  assert.equal(license.readStoredLicense(dir),'invalid-license');
  assert.equal(license.currentStatus(dir).valid,false);

  const trial=license.trialStatus(dir);
  assert.equal(license.TRIAL_DAYS,14,'thời hạn dùng thử phải được chốt ở 14 ngày');
  assert.equal(trial.active,true);
  assert.equal(trial.daysLeft,license.TRIAL_DAYS);
  assert.ok(fs.existsSync(path.join(dir,'qclab-trial.dat')));
  fs.writeFileSync(path.join(dir,'qclab-trial.dat'),JSON.stringify({startedAt:new Date(Date.now()-13.5*24*60*60*1000).toISOString()}),'utf8');
  const nearExpiry=license.trialStatus(dir);assert.equal(nearExpiry.active,true);assert.equal(nearExpiry.daysLeft,1,'qua 13 ngày vẫn còn đúng ngày dùng thử cuối');
  fs.writeFileSync(path.join(dir,'qclab-trial.dat'),JSON.stringify({startedAt:new Date(Date.now()-14.1*24*60*60*1000).toISOString()}),'utf8');
  const expired=license.trialStatus(dir);assert.equal(expired.active,false);assert.equal(expired.daysLeft,0,'qua 14 ngày phải yêu cầu kích hoạt');
  fs.writeFileSync(path.join(dir,'qclab-trial.dat'),'{broken','utf8');
  assert.equal(license.trialStatus(dir).active,true,'corrupt trial marker follows documented first-run recovery behavior');
  console.log('Electron license tests passed');
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}

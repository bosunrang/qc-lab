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
  assert.equal(trial.active,true);
  assert.equal(trial.daysLeft,license.TRIAL_DAYS);
  assert.ok(fs.existsSync(path.join(dir,'qclab-trial.dat')));
  fs.writeFileSync(path.join(dir,'qclab-trial.dat'),'{broken','utf8');
  assert.equal(license.trialStatus(dir).active,true,'corrupt trial marker follows documented first-run recovery behavior');
  console.log('Electron license tests passed');
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}

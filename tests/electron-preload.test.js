const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const exposed={},calls=[];
const electron={
  contextBridge:{exposeInMainWorld(name,value){exposed[name]=value;}},
  ipcRenderer:{invoke(channel,payload){calls.push({channel,payload});return Promise.resolve({channel,payload});}}
};
const lab=Buffer.from('Phòng xét nghiệm A','utf8').toString('base64');
const trial=Buffer.from(JSON.stringify({active:true,daysLeft:12,totalDays:30}),'utf8').toString('base64');
const context=vm.createContext({
  require(name){if(name==='electron')return electron;throw new Error('Unexpected require: '+name);},
  process:{argv:['electron','app','--qclab-lab='+lab,'--qclab-id='+Buffer.from('LIC-1').toString('base64'),'--qclab-trial='+trial]},
  Buffer
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','electron','preload.js'),'utf8'),context,{filename:'electron/preload.js'});

assert.deepEqual(Object.keys(exposed).sort(),['qcActivation','qcDialog','qcLicense','qcPrintPdf']);
assert.equal(exposed.qcLicense.lab,'Phòng xét nghiệm A');
assert.equal(exposed.qcLicense.licenseId,'LIC-1');
assert.equal(exposed.qcLicense.trial.daysLeft,12);

exposed.qcDialog.alert(null);
exposed.qcPrintPdf.save(123,null);
exposed.qcPrintPdf.printPaper(456);
exposed.qcActivation.status();
exposed.qcActivation.activate(null);
exposed.qcActivation.continueTrial();

assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  {channel:'qc-dialog:alert',payload:''},
  {channel:'qc-print:pdf',payload:{token:'123',name:'Bao-cao'}},
  {channel:'qc-print:paper',payload:'456'},
  {channel:'qc-license:status'},
  {channel:'qc-license:activate',payload:''},
  {channel:'qc-license:continue-trial'}
]);
console.log('Electron preload IPC contract tests passed');

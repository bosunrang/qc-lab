const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadSandbox, run } = require('./helpers/sandbox');

(async()=>{
  const ctx=loadSandbox(['core.js','modules/state.js','modules/firebase-sync.js','modules/state-storage.js','modules/audit.js','generated/modular-pilot.js','modules/backup-ui.js'],{crypto:webcrypto});
  const result=await run(ctx,`
    (async function(){
      currentUser={id:'u1',username:'admin',name:'Admin',role:'admin'};
      document={getElementById:function(){return null;}};
      userName=function(){return currentUser.name;};role=function(){return currentUser.role;};
      state.activity=[];state.activityAnchor='';fb.clientId='client-a';
      logAct('Thêm điểm QC','Ngày 09/08/2026 · M1 · 3.85','Potassium');
      var valid=QCCore.verifyAuditChain(state.activity,state.activityAnchor);
      var validPack=await createBackupPackage(state),restored=await prepareBackupImport(validPack.text);

      var tampered=JSON.parse(JSON.stringify(state));
      tampered.activity[0].detail='Nội dung đã bị thay đổi';
      var tamperedPack=await createBackupPackage(tampered),backupError='';
      try{await prepareBackupImport(tamperedPack.text);}catch(e){backupError=e.message;}

      state=tampered;var offCalls=0;
      fb.ready=true;fb.initialized=true;fb.ref={off:function(){offCalls++;}};fb.synced={};
      var cloudAllowed=fbAuditMaySync(state,'Nhật ký cục bộ');
      return{valid:valid.ok,restored:restored.activity.length,backupError:backupError,cloudAllowed:cloudAllowed,disconnected:fb.ref===null,offCalls:offCalls};
    })()
  `);
  const value=JSON.parse(JSON.stringify(result));
  assert.equal(value.valid,true,'chuỗi audit nguyên vẹn phải được chấp nhận');
  assert.equal(value.restored,1,'backup có chuỗi audit hợp lệ phải nhập được');
  assert.match(value.backupError,/Chuỗi audit trong backup không hợp lệ.*hash không khớp/,'checksum gói hợp lệ không được che mất audit payload đã bị sửa');
  assert.equal(value.cloudAllowed,false,'audit hỏng không được phép đồng bộ');
  assert.equal(value.disconnected,true,'phải ngắt kênh đồng bộ khi audit hỏng');
  assert.equal(value.offCalls,1,'listener Firebase phải được gỡ khi chặn audit hỏng');
  console.log('Audit ingress integrity gates passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

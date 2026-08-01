const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadSandbox, run } = require('./helpers/sandbox');
const { makeState } = require('../benchmarks/performance-baseline');

(async()=>{
  const ctx = loadSandbox(['core.js', 'modules/archive-service.js', 'modules/backup-service.js'], { crypto:webcrypto });
  const result = await run(ctx, `
    (async function(){
      const note='Dữ liệu QC phục hồi '.repeat(35);
      const points=Array.from({length:30000},(_,i)=>({
        id:'p'+i,date:'2026-07-'+String(i%28+1).padStart(2,'0'),
        runId:'run-'+i,level:i%3+1,val:100+(i%17)/10,
        qcMean:100,qcSd:2,lot:'LOT-2026',note
      }));
      const source={
        schemaVersion:QCCore.STATE_SCHEMA_VERSION,
        lab:{name:'PXN kiểm thử phục hồi',dept:'Hóa sinh',address:''},
        tests:[{id:'t1',name:'Glucose',unit:'mmol/L',levels:[
          {level:1,mean:100,sd:2,lot:'LOT-2026'},
          {level:2,mean:100,sd:2,lot:'LOT-2026'},
          {level:3,mean:100,sd:2,lot:'LOT-2026'}
        ]}],
        data:{t1:points}
      };
      const json=serializeBackupData(source),pack=await createBackupPackage(source),restored=await prepareBackupImport(pack.text),legacy=await prepareBackupImport(json),inspected=await inspectBackupText(pack.text,pack.bytes);
      let corruptError='';try{await inspectBackupText(pack.text.replace('"id":"p0"','"id":"changed"'));}catch(e){corruptError=e.message;}
      return{
        bytes:new TextEncoder().encode(json).length,packBytes:pack.bytes,
        maxBytes:BACKUP_IMPORT_MAX_BYTES,warnBytes:BACKUP_IMPORT_WARN_BYTES,
        allowedError:backupImportSizeError(new TextEncoder().encode(json).length),
        oversizedError:backupImportSizeError(BACKUP_IMPORT_MAX_BYTES+1),
        warning:backupSizeWarning(BACKUP_IMPORT_WARN_BYTES),
        compact:!json.includes(String.fromCharCode(10)+'  '),checksumStatus:inspected.meta.checksumStatus,checksumLength:inspected.meta.checksum.length,corruptError,
        pointCount:restored.data.t1.length,legacyCount:legacy.data.t1.length,
        first:restored.data.t1[0],last:restored.data.t1[restored.data.t1.length-1]
      };
    })()
  `);

  const value = JSON.parse(JSON.stringify(result));
  assert.ok(value.bytes > 20 * 1024 * 1024, `fixture phải lớn hơn 20 MB, thực tế ${value.bytes} byte`);
  assert.ok(value.bytes < value.maxBytes, 'backup 20–50 MB phải nằm trong giới hạn import');
  assert.equal(value.maxBytes, 128 * 1024 * 1024);
  assert.equal(value.warnBytes, 96 * 1024 * 1024);
  assert.equal(value.allowedError, '');
  assert.match(value.oversizedError, /128 MB/);
  assert.match(value.warning, /gần giới hạn 128 MB/);
  assert.equal(value.compact, true, 'backup mới phải dùng JSON gọn để giảm dung lượng');
  assert.equal(value.checksumStatus, 'verified');
  assert.equal(value.checksumLength, 64);
  assert.match(value.corruptError, /Checksum SHA-256 không khớp/);
  assert.equal(value.pointCount, 30000);
  assert.equal(value.legacyCount, 30000, 'backup JSON cũ vẫn phải nhập được');
  assert.equal(value.first.id, 'p0');
  assert.equal(value.first.note.startsWith('Dữ liệu QC phục hồi'), true);
  assert.equal(value.last.id, 'p29999');

  const tenYearJson=ctx.serializeBackupData(makeState({tests:50,levels:3,days:3650})),tenYearBytes=new TextEncoder().encode(tenYearJson).length;
  assert.equal(ctx.backupImportSizeError(tenYearBytes),'',`backup 10 năm phải còn nhập được, thực tế ${(tenYearBytes/1024/1024).toFixed(1)} MB`);
  assert.ok(tenYearBytes<128*1024*1024,'snapshot 547.500 điểm phải nằm dưới hợp đồng 128 MB');

  console.log(`Backup round-trip test passed (${(value.packBytes/1024/1024).toFixed(1)} MB package; ${(tenYearBytes/1024/1024).toFixed(1)} MB ten-year contract)`);
})().catch(error=>{console.error(error);process.exitCode=1;});

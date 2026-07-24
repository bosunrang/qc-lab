const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/backup-service.js']);
const result = run(ctx, `
  (function(){
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
    const json=serializeBackupData(source);
    const restored=prepareBackupImport(json);
    return{
      bytes:new TextEncoder().encode(json).length,
      maxBytes:BACKUP_IMPORT_MAX_BYTES,
      allowedError:backupImportSizeError(new TextEncoder().encode(json).length),
      oversizedError:backupImportSizeError(BACKUP_IMPORT_MAX_BYTES+1),
      pointCount:restored.data.t1.length,
      first:restored.data.t1[0],
      last:restored.data.t1[restored.data.t1.length-1]
    };
  })()
`);

const value = JSON.parse(JSON.stringify(result));
assert.ok(value.bytes > 20 * 1024 * 1024, `fixture phải lớn hơn 20 MB, thực tế ${value.bytes} byte`);
assert.ok(value.bytes < value.maxBytes, 'backup 20–50 MB phải nằm trong giới hạn import');
assert.equal(value.allowedError, '');
assert.match(value.oversizedError, /64 MB/);
assert.equal(value.pointCount, 30000);
assert.equal(value.first.id, 'p0');
assert.equal(value.first.note.startsWith('Dữ liệu QC phục hồi'), true);
assert.equal(value.last.id, 'p29999');

console.log(`Backup round-trip test passed (${(value.bytes/1024/1024).toFixed(1)} MB, ${value.pointCount} points)`);

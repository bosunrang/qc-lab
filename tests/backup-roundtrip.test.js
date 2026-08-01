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

  /* DUNG LƯỢNG KHÔNG ĐƯỢC KHÓA ĐƯỜNG RA. Trước 2026-08-01 trần 128 MB chặn cứng cả ba
     đường cùng lúc (xuất, backup an toàn, nhập) nên vượt trần là không xuất được, không
     nhập được, không reset được. Chốt ở đây bằng HÀNH VI chứ không bằng text: giả lập gói
     200 MB rồi kiểm tra file vẫn được ghi ra. Stub createBackupPackage thay vì dựng state
     200 MB thật để test không tốn vài giây và vài trăm MB RAM. */
  {
    const big=200*1024*1024;
    assert.notEqual(ctx.backupImportSizeError(big),'','200 MB phải vẫn nằm trên ngưỡng khuyến nghị');
    let downloaded=[],confirms=0;
    ctx.createBackupPackage=async()=>({text:'{}',bytes:big,meta:{checksum:'x'}});
    ctx.downloadBackupText=(name)=>{downloaded.push(name);return true;};
    ctx.confirmDialog=async()=>{confirms++;return true;};
    ctx.infoDialog=async()=>{};
    ctx.markBackupDone=()=>{};ctx.updateBackupBanner=()=>{};ctx.logAct=()=>{};ctx.save=()=>{};
    ctx.state={schemaVersion:ctx.QCCore.STATE_SCHEMA_VERSION};
    ctx.vnDate=()=>'01/08/2026';ctx.isoToday=()=>'2026-08-01';

    assert.equal(await ctx.backupCurrentData('truoc-nhap'),true,'backup an toàn KHÔNG được thất bại vì dung lượng — nhập backup và xóa sạch dữ liệu đều hủy khi nó trả false');
    assert.equal(downloaded.length,1,'backup an toàn phải thực sự ghi ra file');
    assert.equal(confirms,0,'backup an toàn chạy ngầm, không được chen hộp thoại vào giữa luồng đang hỏi');

    downloaded=[];
    await ctx.exportData();
    assert.equal(downloaded.length,1,'xuất backup quá cỡ vẫn phải ra file sau khi người dùng xác nhận');
    assert.equal(confirms,1,'và chỉ hỏi MỘT lần, không hỏi chồng thêm cảnh báo ngưỡng mềm');

    downloaded=[];ctx.confirmDialog=async()=>{confirms++;return false;};
    await ctx.exportData();
    assert.equal(downloaded.length,0,'người dùng từ chối thì không ghi file');
  }

  console.log(`Backup round-trip test passed (${(value.packBytes/1024/1024).toFixed(1)} MB package; ${(tenYearBytes/1024/1024).toFixed(1)} MB ten-year contract)`);
})().catch(error=>{console.error(error);process.exitCode=1;});

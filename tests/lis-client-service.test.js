'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadSandbox,run}=require('./helpers/sandbox');

(async()=>{
  const storage=new Map(),requests=[];
  const ctx=loadSandbox(['modules/westgard-view-model.js','modules/lis-client-service.js'],{URL,AbortController,fetch:async(url,opts={})=>{requests.push({url,opts});if(ctx.__failNext&&!url.endsWith('/health')){ctx.__failNext=false;return{ok:false,status:503,json:async()=>({message:'Gateway bận'})};}return{ok:true,status:200,json:async()=>url.endsWith('/health')?{ok:true}:{qc:[]}};},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:()=>null},setInterval,clearInterval});
  assert.equal(ctx.lisNormalizeGatewayUrl('http://127.0.0.1:8787/path'),'http://127.0.0.1:8787');
  assert.equal(ctx.lisNormalizeGatewayUrl('http://localhost:8787'),'http://localhost:8787');
  assert.equal(ctx.lisNormalizeGatewayUrl('https://example.com'),'','không được xuất QC sang host tùy ý');

  const snapshots=run(ctx,`(function(){
    isoToday=function(){return'2026-08-01';};pointRunNo=function(){return 1;};
    var t={id:'T1',instrumentId:'I1'},p1={id:'p1',date:'2026-08-01'},p2={id:'p2',date:'2026-07-31'};
    activeWestgard=function(){return{views:[{l:{level:1},pts:[p1]},{l:{level:2},pts:[p2]}],byPoint:new Map([['p1',{level:'ok',rules:[]}],['p2',{level:'ok',rules:[]}]])};};
    var missing=lisQcSnapshotForTest(t,new Date('2026-08-01T10:00:00Z'));
    activeWestgard=function(){return{views:[{l:{level:1},pts:[p1]}],byPoint:new Map([['p1',{level:'rej',rules:['1-3s']}]])};};
    var rejected=lisQcSnapshotForTest(t,new Date('2026-08-01T10:00:00Z'));
    activeWestgard=function(){return{views:[{l:{level:1},pts:[]}],byPoint:new Map()};};
    var empty=lisQcSnapshotForTest(t,new Date('2026-08-01T10:00:00Z'));
    return{missing:missing,rejected:rejected,empty:empty};
  })()`);
  const value=JSON.parse(JSON.stringify(snapshots));
  assert.equal(value.missing.status,'warn');assert.match(value.missing.reason,/Thiếu QC hôm nay/);
  assert.equal(value.rejected.status,'rej');assert.deepEqual(value.rejected.rules,['1-3s']);
  assert.equal(value.empty.status,'unknown');

  storage.set('qclab_lis_gateway',JSON.stringify({enabled:true,url:'http://127.0.0.1:8787',token:'tok-abc'}));
  await run(ctx,`(async function(){
    currentUser={id:'u1'};formatDateTimeVN=function(){return'';};isoToday=function(){return'2026-08-01';};pointRunNo=function(){return 1;};
    var p={id:'p1',date:'2026-08-01'};operationalTests=function(){return[{id:'T1',instrumentId:'I1'}];};
    activeWestgard=function(){return{views:[{l:{level:1},pts:[p]}],byPoint:new Map([['p1',{level:'ok',rules:[]}]])};};
    return lisGatewaySync(null);
  })()`);
  assert.equal(requests.length,2);assert.equal(requests[0].url,'http://127.0.0.1:8787/health');assert.equal(requests[1].url,'http://127.0.0.1:8787/api/v1/qc-status');
  assert.equal(requests[1].opts.headers.authorization,'Bearer tok-abc','mọi request phải mang token — gateway không còn chế độ mở');
  /* Cả lô đi trong MỘT request thay vì PUT tuần tự từng xét nghiệm. */
  const sentBody=JSON.parse(requests[1].opts.body),sent=sentBody.items[0];
  assert.equal(sentBody.items.length,1,'phải gửi dạng lô {items:[...]}');
  assert.equal(sent.qclabTestId,'T1');assert.equal(sent.status,'ok');assert.equal('patientId' in sent,false);

  /* HÀNG CHỜ KHÔNG ĐƯỢC MẤT. Bản đầu xóa pendingIds ngay trước khi gọi sync; nếu lần gửi
     trước còn chạy thì sync trả busy tức khắc và những id vừa xóa mất luôn, không retry —
     cộng với cửa sổ hết hạn 12 giờ thì một trạng thái `rej` không gửi được đồng nghĩa
     gateway tiếp tục trả `accepted` cho kết quả bệnh nhân suốt nửa ngày.
     Chốt bằng HÀNH VI: ép sync đang chạy rồi gọi lại, sau đó kiểm hàng chờ còn nguyên. */
  const busy=JSON.parse(JSON.stringify(run(ctx,`(function(){
    lisGatewayRuntime.pendingIds=new Set(['T1','T2']);lisGatewayRuntime.syncAll=false;lisGatewayRuntime.running=true;
    var claim=lisGatewayClaimPending();
    var before={pending:[...lisGatewayRuntime.pendingIds]};
    lisGatewaySync(claim.ids,{claim:claim});
    return{before:before.pending,after:[...lisGatewayRuntime.pendingIds],retryArmed:!!lisGatewayRuntime.syncT};
  })()`)));
  assert.deepEqual(busy.before,[],'claim lấy hàng chờ ra trước khi gửi');
  assert.deepEqual(busy.after.sort(),['T1','T2'],'đang bận thì phải TRẢ LẠI hàng chờ, không được nuốt');
  assert.equal(busy.retryArmed,true,'và phải hẹn chạy lại');

  /* Gửi hỏng cũng phải trả lại hàng chờ và hẹn thử lại theo backoff. */
  const failed=JSON.parse(JSON.stringify(await run(ctx,`(async function(){
    lisGatewayRuntime.running=false;lisGatewayRuntime.retryMs=0;clearTimeout(lisGatewayRuntime.syncT);lisGatewayRuntime.syncT=null;
    lisGatewayRuntime.pendingIds=new Set(['T1']);lisGatewayRuntime.syncAll=false;
    var claim=lisGatewayClaimPending();
    __failNext=true;
    var r=await lisGatewaySync(claim.ids,{claim:claim});
    return{ok:r.ok,retryMs:r.retryMs,pending:[...lisGatewayRuntime.pendingIds],armed:!!lisGatewayRuntime.syncT};
  })()`)));
  assert.equal(failed.ok,false);
  assert.deepEqual(failed.pending,['T1'],'gửi hỏng thì hàng chờ phải được trả lại nguyên vẹn');
  assert.ok(failed.retryMs>0,'và phải hẹn thử lại theo backoff');
  assert.equal(failed.armed,true);
  run(ctx,'clearTimeout(lisGatewayRuntime.syncT);lisGatewayRuntime.syncT=null;clearInterval(lisGatewayRuntime.heartbeatT);');

  const stateStorage=fs.readFileSync(path.join(__dirname,'../assets/modules/state-storage.js'),'utf8'),users=fs.readFileSync(path.join(__dirname,'../assets/modules/users-auth.js'),'utf8');
  assert.match(stateStorage,/scheduleLisQcSync\(opts\)/,'save gateway phải lên lịch xuất QC sau thay đổi');
  assert.match(users,/setTimeout\(lisGatewayStart,0\)/,'đăng nhập phải đồng bộ snapshot QC ban đầu');
  console.log('LIS client service tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

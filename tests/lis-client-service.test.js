'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadSandbox,run}=require('./helpers/sandbox');

(async()=>{
  const storage=new Map(),requests=[];
  const ctx=loadSandbox(['modules/westgard-view-model.js','modules/lis-client-service.js'],{URL,AbortController,fetch:async(url,opts={})=>{requests.push({url,opts});return{ok:true,status:200,json:async()=>url.endsWith('/health')?{ok:true}:{qc:{}}};},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:()=>null}});
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

  storage.set('qclab_lis_gateway',JSON.stringify({enabled:true,url:'http://127.0.0.1:8787'}));
  await run(ctx,`(async function(){
    currentUser={id:'u1'};formatDateTimeVN=function(){return'';};isoToday=function(){return'2026-08-01';};pointRunNo=function(){return 1;};
    var p={id:'p1',date:'2026-08-01'};operationalTests=function(){return[{id:'T1',instrumentId:'I1'}];};
    activeWestgard=function(){return{views:[{l:{level:1},pts:[p]}],byPoint:new Map([['p1',{level:'ok',rules:[]}]])};};
    return lisGatewaySync(null);
  })()`);
  assert.equal(requests.length,2);assert.equal(requests[0].url,'http://127.0.0.1:8787/health');assert.equal(requests[1].url,'http://127.0.0.1:8787/api/v1/qc-status');
  const sent=JSON.parse(requests[1].opts.body);assert.equal(sent.qclabTestId,'T1');assert.equal(sent.status,'ok');assert.equal('patientId' in sent,false);

  const stateStorage=fs.readFileSync(path.join(__dirname,'../assets/modules/state-storage.js'),'utf8'),users=fs.readFileSync(path.join(__dirname,'../assets/modules/users-auth.js'),'utf8');
  assert.match(stateStorage,/scheduleLisQcSync\(opts\)/,'save gateway phải lên lịch xuất QC sau thay đổi');
  assert.match(users,/setTimeout\(lisGatewayStart,0\)/,'đăng nhập phải đồng bộ snapshot QC ban đầu');
  console.log('LIS client service tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

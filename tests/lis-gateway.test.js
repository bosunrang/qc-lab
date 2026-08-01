'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {LisBridge,LisError}=require('../lis-gateway/core');
const {JournalStore,MemoryStore}=require('../lis-gateway/store');
const {createLisServer}=require('../lis-gateway/server');

const NOW=Date.parse('2026-08-01T10:00:00.000Z');
const config={staleMinutes:60,mappings:[{analyzerId:'SIM-01',testCode:'GLU',qclabTestId:'T1',displayName:'Glucose',expectedUnit:'mmol/L'}]};
const message=(id,overrides={})=>({messageId:id,analyzerId:'SIM-01',testCode:'GLU',measuredAt:'2026-08-01T09:59:00Z',value:5.6,unit:'mmol/L',specimenRef:'DEMO-01',...overrides});

function request(server,method,url,body,headers={}){return new Promise((resolve,reject)=>{const address=server.address(),raw=body==null?'':JSON.stringify(body),req=http.request({host:'127.0.0.1',port:address.port,path:url,method,headers:{...headers,...(raw?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');try{resolve({status:res.statusCode,headers:res.headers,body:text?JSON.parse(text):null});}catch(error){reject(error);}});});req.on('error',reject);if(raw)req.write(raw);req.end();});}

(async()=>{
  const memory=new MemoryStore(),bridge=new LisBridge(config,memory);
  bridge.setQcStatus({qclabTestId:'T1',status:'ok',asOf:'2026-08-01T09:30:00Z',reason:'Westgard đạt'});
  const accepted=bridge.ingest(message('M1'),NOW);
  assert.equal(accepted.gate.decision,'accepted');assert.equal(accepted.gate.code,'QC_ACCEPTED');
  const duplicate=bridge.ingest(message('M1'),NOW);assert.equal(duplicate.duplicate,true);assert.equal(memory.events.filter(x=>x.type==='message').length,1,'message trùng không được ghi journal lần hai');
  assert.throws(()=>bridge.ingest(message('M1',{value:9.9}),NOW),e=>e instanceof LisError&&e.code==='MESSAGE_ID_CONFLICT');

  bridge.setQcStatus({qclabTestId:'T1',status:'warn',asOf:'2026-08-01T09:45:00Z'});
  assert.equal(bridge.ingest(message('M2'),NOW).gate.decision,'review');
  bridge.setQcStatus({qclabTestId:'T1',status:'rej',asOf:'2026-08-01T09:50:00Z',reason:'Vi phạm 1-3s'});
  assert.equal(bridge.ingest(message('M3'),NOW).gate.code,'QC_REJECTED');
  assert.equal(bridge.ingest(message('M4',{testCode:'UNKNOWN'}),NOW).gate.code,'UNMAPPED_TEST');
  assert.equal(bridge.ingest(message('M5',{unit:'mg/dL'}),NOW).gate.code,'UNIT_MISMATCH');
  assert.throws(()=>bridge.ingest(message('M6',{patientName:'Nguyễn Văn A'}),NOW),e=>e.code==='PHI_NOT_ALLOWED');

  const stale=new LisBridge(config,new MemoryStore());stale.setQcStatus({qclabTestId:'T1',status:'ok',asOf:'2026-08-01T08:00:00Z'});
  assert.equal(stale.ingest(message('STALE'),NOW).gate.code,'QC_STALE');
  const unknown=new LisBridge(config,new MemoryStore());unknown.setQcStatus({qclabTestId:'T1',status:'unknown',asOf:'2026-08-01T09:50:00Z',reason:'Chưa có QC hôm nay'});
  assert.equal(unknown.ingest(message('UNKNOWN'),NOW).gate.code,'QC_UNKNOWN');

  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'qclab-lis-'));
  try{
    const file=path.join(temp,'events.ndjson'),disk=new JournalStore(file),first=new LisBridge(config,disk);
    first.setQcStatus({qclabTestId:'T1',status:'ok',asOf:'2026-08-01T09:45:00Z'});first.ingest(message('PERSIST'),NOW);
    const restarted=new LisBridge(config,new JournalStore(file));assert.equal(restarted.status().messages,1);assert.equal(restarted.ingest(message('PERSIST'),NOW).duplicate,true,'restart vẫn phải chống message trùng');
    fs.appendFileSync(file,'{"type":');const recoveredStore=new JournalStore(file),recovered=new LisBridge(config,recoveredStore);assert.equal(recovered.status().messages,1);assert.equal(recoveredStore.warnings.length,1,'dòng cuối bị cắt do mất điện phải được cách ly');
    recovered.setQcStatus({qclabTestId:'T1',status:'warn',asOf:'2026-08-01T09:50:00Z'});const afterRepair=new LisBridge(config,new JournalStore(file));assert.equal(afterRepair.qc.get('T1').status,'warn','sau khi sửa tail, journal phải tiếp tục ghi và đọc được');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}

  const apiBridge=new LisBridge(config,new MemoryStore()),server=createLisServer({bridge:apiBridge});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const health=await request(server,'GET','/health');assert.equal(health.status,200);assert.equal(health.body.service,'qclab-lis-gateway');
    const preflight=await request(server,'OPTIONS','/api/v1/qc-status',null,{origin:'http://localhost:8080'});assert.equal(preflight.status,204);assert.equal(preflight.headers['access-control-allow-origin'],'http://localhost:8080');
    const denied=await request(server,'OPTIONS','/api/v1/qc-status',null,{origin:'https://evil.example'});assert.equal(denied.status,403);
    const qc=await request(server,'PUT','/api/v1/qc-status',{qclabTestId:'T1',status:'ok',asOf:new Date().toISOString()});assert.equal(qc.status,200);
    const result=await request(server,'POST','/api/v1/messages',message('HTTP',{measuredAt:new Date().toISOString()}));assert.equal(result.status,201);assert.equal(result.body.gate.decision,'accepted');
    const inbox=await request(server,'GET','/api/v1/messages');assert.equal(inbox.body.items.length,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
  console.log('LIS Gateway prototype tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

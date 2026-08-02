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

function request(server,method,url,body,headers={},rawOverride=null){return new Promise((resolve,reject)=>{const address=server.address(),raw=rawOverride!=null?rawOverride:(body==null?'':JSON.stringify(body)),req=http.request({host:'127.0.0.1',port:address.port,path:url,method,headers:{...(raw&&rawOverride==null?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');try{resolve({status:res.statusCode,headers:res.headers,body:text?JSON.parse(text):null});}catch(error){reject(error);}});});req.on('error',reject);if(raw)req.write(raw);req.end();});}

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

  /* Cửa ngõ phải ĐÓNG theo mặc định: không có token thì không dựng nổi server, chứ không
     phải dựng lên rồi cho qua hết. Bản đầu có `if(!token)return true` trong authorized()
     và `npm run lis:gateway` không đặt token — tức mặc định là mở toang. */
  assert.throws(()=>createLisServer({bridge:new LisBridge(config,new MemoryStore())}),/token/i,'không có token thì phải từ chối khởi tạo, không được chạy ở chế độ mở');

  const TOKEN='t0ken-'+'a'.repeat(20),auth={authorization:`Bearer ${TOKEN}`};
  const apiBridge=new LisBridge(config,new MemoryStore()),server=createLisServer({bridge:apiBridge,token:TOKEN});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    /* /health không cần token (liveness) nhưng vì thế KHÔNG được kèm số liệu vận hành. */
    const health=await request(server,'GET','/health');assert.equal(health.status,200);assert.equal(health.body.service,'qclab-lis-gateway');
    assert.equal('messages' in health.body,false,'/health không xác thực thì không được lộ số message/mapping');
    const stats=await request(server,'GET','/api/v1/status',null,auth);assert.equal(stats.status,200);assert.equal(typeof stats.body.messages,'number');
    assert.equal((await request(server,'GET','/api/v1/status')).status,401,'số liệu vận hành phải sau token');

    assert.equal((await request(server,'GET','/api/v1/messages')).status,401,'thiếu token phải bị từ chối');
    assert.equal((await request(server,'GET','/api/v1/messages',null,{authorization:'Bearer sai'})).status,401,'token sai phải bị từ chối');

    const preflight=await request(server,'OPTIONS','/api/v1/qc-status',null,{origin:'http://localhost:8080'});assert.equal(preflight.status,204);assert.equal(preflight.headers['access-control-allow-origin'],'http://localhost:8080');
    const denied=await request(server,'OPTIONS','/api/v1/qc-status',null,{origin:'https://evil.example'});assert.equal(denied.status,403);

    /* CSRF: `POST` kèm content-type text/plain là "simple request" nên trình duyệt KHÔNG
       preflight — bản đầu JSON.parse bất kể content-type nên một trang bất kỳ ghi thẳng
       vào journal (đo được 201 từ https://evil.example). Đòi application/json biến nó
       thành non-simple, buộc preflight, và preflight thì đã bị allowlist chặn ở trên. */
    const raw=JSON.stringify(message('CSRF',{measuredAt:new Date().toISOString()}));
    const csrf=await request(server,'POST','/api/v1/messages',null,{...auth,'content-type':'text/plain','content-length':Buffer.byteLength(raw)},raw);
    assert.equal(csrf.status,415,'content-type không phải JSON phải bị từ chối');
    assert.equal(apiBridge.status().messages,0,'request CSRF không được để lại dấu vết nào trong journal');

    const qc=await request(server,'PUT','/api/v1/qc-status',{qclabTestId:'T1',status:'ok',asOf:new Date().toISOString()},auth);assert.equal(qc.status,200);
    /* Cả lô trong MỘT request: bản đầu PUT tuần tự từng xét nghiệm, 50 xét nghiệm × 5s
       timeout là tới 250s treo, và mọi cập nhật QC phát sinh trong lúc đó bị bỏ. */
    const batch=await request(server,'PUT','/api/v1/qc-status',{items:[{qclabTestId:'T1',status:'warn',asOf:new Date().toISOString()},{qclabTestId:'T2',status:'ok',asOf:new Date().toISOString()}]},auth);
    assert.equal(batch.status,200);assert.equal(batch.body.qc.length,2);
    assert.equal(apiBridge.qc.get('T1').status,'warn','lô phải ghi đè trạng thái cũ');
    const badBatch=await request(server,'PUT','/api/v1/qc-status',{items:[{qclabTestId:'T3',status:'ok',asOf:new Date().toISOString()},{qclabTestId:'',status:'ok'}]},auth);
    assert.equal(badBatch.status,400);assert.equal(apiBridge.qc.has('T3'),false,'một phần tử hỏng thì cả lô bị từ chối, không ghi nửa chừng');

    const result=await request(server,'POST','/api/v1/messages',message('HTTP',{measuredAt:new Date().toISOString()}),auth);assert.equal(result.status,201);
    assert.equal(result.body.gate.decision,'review','T1 đang warn nên kết quả phải cần duyệt tay');
    const inbox=await request(server,'GET','/api/v1/messages',null,auth);assert.equal(inbox.body.items.length,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
  console.log('LIS Gateway prototype tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

/* ===== LIS GATEWAY CLIENT — KÉO KẾT QUẢ QC TỪ MIDDLEWARE VỀ ===== */
/* Chiều dữ liệu: máy xét nghiệm → middleware (phần mềm trung gian sẵn có của phòng) →
   LIS Gateway → app này. Middleware VỐN ĐÃ có kết quả chạy mẫu QC vì nó đi chung đường
   với mọi kết quả khác; mục tiêu là lấy từ nơi đã có thay vì bắt KTV gõ tay lại.

   Kết quả kéo về KHÔNG tự thành điểm QC. Nó nằm ở hàng chờ cho tới khi KTV đối chiếu
   mức/lô rồi bấm nhận — lúc đó mới đi qua EntryService như mọi điểm nhập tay, nên vẫn
   chịu khóa kỳ báo cáo, vẫn ghi audit, vẫn lưu theo phân vùng. Dữ liệu nội kiểm là hồ sơ
   được kiểm soát; để hệ thống ngoài ghi thẳng vào mà không ai nhìn là sai nguyên tắc. */
const LIS_GATEWAY_STORAGE_KEY='qclab_lis_gateway';
const LIS_POLL_MS=5*60*1000;
let lisGatewayRuntime={status:'idle',detail:'Chưa bật',lastPull:'',pollT:null,running:false,pending:[],unresolved:[],lastError:''};
function lisGatewayConfig(){try{const x=JSON.parse(localStorage.getItem(LIS_GATEWAY_STORAGE_KEY)||'null');return x&&typeof x==='object'?{enabled:x.enabled===true,url:lisNormalizeGatewayUrl(x.url)||'http://127.0.0.1:8787',token:String(x.token||'')}:{enabled:false,url:'http://127.0.0.1:8787',token:''};}catch(e){return{enabled:false,url:'http://127.0.0.1:8787',token:''};}}
/* Chốt cứng đúng hai origin: CSP `connect-src` trong index.html cũng chỉ mở hai cái này.
   Đổi cổng mà quên một trong hai chỗ thì fetch bị chặn ở tầng CSP và app chỉ hiện "Lỗi
   kết nối" chứ không nói vì sao. */
function lisNormalizeGatewayUrl(value){try{const u=new URL(String(value||'').trim());if(!['http://127.0.0.1:8787','http://localhost:8787'].includes(u.origin))return'';return u.origin;}catch(e){return'';}}
function lisGatewaySetStatus(status,detail){lisGatewayRuntime.status=status;lisGatewayRuntime.detail=detail||'';const el=typeof document!=='undefined'&&document.getElementById('lisGatewayStatus');if(el){el.className='alert '+(status==='ok'?'ok':status==='syncing'?'warn':status==='off'?'':'rej');el.textContent=lisGatewayStatusText();}}
function lisGatewayStatusText(){const label={idle:'Chưa kiểm tra',off:'Đang tắt',syncing:'Đang kiểm tra',ok:'Đã kết nối',error:'Lỗi kết nối'}[lisGatewayRuntime.status]||lisGatewayRuntime.status;return label+(lisGatewayRuntime.detail?' · '+lisGatewayRuntime.detail:'')+(lisGatewayRuntime.lastPull?' · '+formatDateTimeVN(lisGatewayRuntime.lastPull):'');}
async function lisGatewayFetch(path,opts={}){const cfg=lisGatewayConfig(),ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);try{const res=await fetch(cfg.url+path,{...opts,signal:ctl.signal,headers:{'content-type':'application/json',...(cfg.token?{authorization:'Bearer '+cfg.token}:{}),...(opts.headers||{})}}),body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(res.status===401?'Token không đúng hoặc chưa nhập. Xem token in ra khi chạy npm run lis:gateway.':(body.message||`HTTP ${res.status}`));return body;}finally{clearTimeout(timer);}}
async function lisGatewayHealth(){const body=await lisGatewayFetch('/health');if(!body||body.ok!==true)throw new Error('Gateway không trả trạng thái hợp lệ.');return body;}

/* Kéo hàng chờ về. Tách sẵn hai nhóm: đã khớp mapping (nhận được) và chưa khớp (phải sửa
   cấu hình trước) — để màn hình duyệt không trộn hai việc khác hẳn nhau vào một danh sách. */
async function lisGatewayPull(opts={}){
  const cfg=lisGatewayConfig();if(!cfg.enabled)return{ok:false,skipped:true};
  if(lisGatewayRuntime.running)return{ok:false,busy:true};
  lisGatewayRuntime.running=true;lisGatewaySetStatus('syncing','Đang lấy hàng chờ');
  try{
    await lisGatewayHealth();
    const body=await lisGatewayFetch('/api/v1/qc-results?status=pending&limit=500'),items=Array.isArray(body&&body.items)?body.items:[];
    lisGatewayRuntime.pending=items.filter(x=>x&&x.resolved&&x.resolved.ok);
    lisGatewayRuntime.unresolved=items.filter(x=>!(x&&x.resolved&&x.resolved.ok));
    lisGatewayRuntime.lastPull=new Date().toISOString();lisGatewayRuntime.lastError='';
    lisGatewaySetStatus('ok',`${lisGatewayRuntime.pending.length} chờ nhận`+(lisGatewayRuntime.unresolved.length?` · ${lisGatewayRuntime.unresolved.length} chưa khớp cấu hình`:''));
    return{ok:true,pending:lisGatewayRuntime.pending.length,unresolved:lisGatewayRuntime.unresolved.length};
  }catch(error){
    const detail=error&&error.name==='AbortError'?'Gateway không phản hồi':(error&&error.message||'Lỗi không xác định');
    lisGatewayRuntime.lastError=detail;lisGatewaySetStatus('error',detail);
    if(opts.manual)await infoDialog('Không lấy được kết quả QC từ Gateway:\n'+detail);
    return{ok:false,error:detail};
  }finally{lisGatewayRuntime.running=false;}
}

/* Dựng đúng những gì EntryService cần từ một bản ghi gateway. Ngày lấy theo GIỜ ĐỊA
   PHƯƠNG của máy chạy app, không phải phần ngày của chuỗi UTC: một kết quả đo lúc 6h05
   sáng giờ Việt Nam có measuredAt là 23:05 UTC hôm trước, cắt chuỗi UTC sẽ ghi điểm lùi
   một ngày và làm lệch cả chuỗi Westgard. */
function lisResultToPointInput(record){
  const m=record&&record.message||{},r=record&&record.resolved||{};
  const d=new Date(m.measuredAt||'');
  if(!Number.isFinite(d.getTime()))return null;
  const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return{tid:r.qclabTestId,level:r.level,date,value:m.value,runId:m.runId||'',staff:m.operator||'',lot:r.lot||''};
}

/* Nhận một bản ghi vào dữ liệu nội kiểm. Đi qua EntryService như điểm nhập tay nên khóa
   kỳ báo cáo vẫn chặn được; CHỈ báo `imported` về gateway sau khi ghi thành công, nếu
   không thì bản ghi biến khỏi hàng chờ mà chưa có điểm QC nào tương ứng. */
async function lisImportResult(messageId){
  if(!requireWrite())return{ok:false};
  const record=(lisGatewayRuntime.pending||[]).find(x=>x&&x.message&&x.message.messageId===messageId);
  if(!record)return{ok:false,error:'not-found'};
  const input=lisResultToPointInput(record);
  if(!input||!input.tid||!input.level)return{ok:false,error:'invalid-record'};
  const cfg=lvlCfg(state.tests.find(t=>t.id===input.tid),input.level);
  const saved=EntryService.recordPoint(state,{...input,cfg});
  if(!saved.ok){
    await infoDialog(saved.error==='period-locked'?'Kỳ này đã chốt, không thể nhận thêm điểm QC.':'Không ghi được điểm QC: '+saved.error);
    return{ok:false,error:saved.error};
  }
  logAct('Nhận QC từ LIS',`${input.date} · M${input.level} · ${fmt(input.value)}${input.runId?' · '+input.runId:''}`,(state.tests.find(t=>t.id===input.tid)||{}).name||'');
  save({testId:input.tid});
  try{await lisGatewayFetch('/api/v1/qc-results/decide',{method:'POST',body:JSON.stringify({messageId,status:'imported',by:userName()})});}
  catch(error){/* Điểm đã ghi rồi; gateway sẽ còn bản ghi ở hàng chờ và lần sau nhận lại
       sẽ bị chặn bởi chính EntryService (trùng lần chạy) chứ không sinh điểm ma. */
    await infoDialog('Đã ghi điểm QC nhưng chưa báo được về Gateway:\n'+(error&&error.message||'')+'\nBản ghi sẽ còn trong hàng chờ, hãy kiểm tra lại trước khi nhận lần nữa.');}
  await lisGatewayPull();rerender();
  return{ok:true,point:saved.point};
}

async function lisRejectResult(messageId,note){
  if(!requireWrite())return{ok:false};
  try{await lisGatewayFetch('/api/v1/qc-results/decide',{method:'POST',body:JSON.stringify({messageId,status:'rejected',by:userName(),note:note||''})});}
  catch(error){await infoDialog('Không bỏ được bản ghi:\n'+(error&&error.message||''));return{ok:false};}
  logAct('Bỏ kết quả QC từ LIS',`${messageId}${note?' · '+note:''}`,'LIS');
  await lisGatewayPull();rerender();
  return{ok:true};
}

/* Chỉ hỏi định kỳ, không đẩy gì đi. Nhịp thưa vì đây là hàng chờ chờ người duyệt, không
   phải luồng thời gian thực. */
function lisGatewayStart(){
  clearInterval(lisGatewayRuntime.pollT);lisGatewayRuntime.pollT=null;
  const cfg=lisGatewayConfig();if(!cfg.enabled){lisGatewaySetStatus('off','Chưa bật');return;}
  lisGatewayPull();
  lisGatewayRuntime.pollT=setInterval(()=>{if(!lisGatewayRuntime.running)lisGatewayPull();},LIS_POLL_MS);
}
async function lisGatewaySaveSettings(){
  if(!requireAdmin('Chỉ quản trị mới được cấu hình LIS Gateway.'))return;
  const enabled=!!document.getElementById('lisGatewayEnabled').checked,url=lisNormalizeGatewayUrl(document.getElementById('lisGatewayUrl').value),tokenEl=document.getElementById('lisGatewayToken'),token=String(tokenEl&&tokenEl.value||'').trim()||lisGatewayConfig().token;
  if(!url){await infoDialog('Prototype chỉ cho phép http://127.0.0.1:8787 hoặc http://localhost:8787.');return;}
  if(enabled&&!token){await infoDialog('Cần dán Bearer token của Gateway. Token được in ra khi chạy npm run lis:gateway.');return;}
  try{localStorage.setItem(LIS_GATEWAY_STORAGE_KEY,JSON.stringify({enabled,url,token}));}catch(e){await infoDialog('Không lưu được cấu hình LIS Gateway trên máy này.');return;}
  if(tokenEl)tokenEl.value='';
  if(!enabled){clearInterval(lisGatewayRuntime.pollT);lisGatewayRuntime.pollT=null;lisGatewayRuntime.pending=[];lisGatewayRuntime.unresolved=[];lisGatewaySetStatus('off','Đã tắt');await infoDialog('Đã tắt nhận kết quả QC từ LIS trên máy này.',{type:'success'});return;}
  lisGatewayStart();
  const result=await lisGatewayPull({manual:true});
  if(result.ok)await infoDialog(`Đã kết nối. ${result.pending} kết quả chờ nhận${result.unresolved?`, ${result.unresolved} chưa khớp cấu hình mapping`:''}.`,{type:'success'});
}
async function lisGatewaySyncNow(){
  if(!lisGatewayConfig().enabled){await infoDialog('Hãy bật LIS Gateway và lưu cấu hình trước khi kiểm tra.',{type:'warning'});return;}
  const result=await lisGatewayPull({manual:true});
  if(result.ok)await infoDialog(`${result.pending} kết quả chờ nhận${result.unresolved?`, ${result.unresolved} chưa khớp cấu hình mapping`:''}.`,{type:'success'});
}

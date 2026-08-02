/* ===== LIS GATEWAY CLIENT (PROTOTYPE) ===== */
const LIS_GATEWAY_STORAGE_KEY='qclab_lis_gateway';
/* Nhịp gửi lại trạng thái QC. Gateway coi một trạng thái là hết hạn sau 90 phút
   (DEFAULT_STALE_MINUTES) và chuyển sang GIỮ kết quả; 30 phút cho phép lỡ 2 nhịp trước
   khi điều đó xảy ra. Không có nhịp này thì `asOf` chỉ được làm mới khi có thay đổi QC,
   nên một phòng làm việc bình thường mà không nhập gì sẽ bị coi là mất liên lạc. */
const LIS_HEARTBEAT_MS=30*60*1000;
const LIS_RETRY_BASE_MS=5000,LIS_RETRY_MAX_MS=5*60*1000;
let lisGatewayRuntime={status:'idle',detail:'Chưa bật',lastSync:'',syncT:null,heartbeatT:null,syncAll:false,pendingIds:new Set(),running:false,retryMs:0,lastError:''};
function lisGatewayConfig(){try{const x=JSON.parse(localStorage.getItem(LIS_GATEWAY_STORAGE_KEY)||'null');return x&&typeof x==='object'?{enabled:x.enabled===true,url:lisNormalizeGatewayUrl(x.url)||'http://127.0.0.1:8787',token:String(x.token||'')}:{enabled:false,url:'http://127.0.0.1:8787',token:''};}catch(e){return{enabled:false,url:'http://127.0.0.1:8787',token:''};}}
function lisNormalizeGatewayUrl(value){try{const u=new URL(String(value||'').trim());if(!['http://127.0.0.1:8787','http://localhost:8787'].includes(u.origin))return'';return u.origin;}catch(e){return'';}}
function lisGatewaySetStatus(status,detail){lisGatewayRuntime.status=status;lisGatewayRuntime.detail=detail||'';const el=typeof document!=='undefined'&&document.getElementById('lisGatewayStatus');if(el){el.className='alert '+(status==='ok'?'ok':status==='syncing'?'warn':status==='off'?'':'rej');el.textContent=lisGatewayStatusText();}}
function lisGatewayStatusText(){const label={idle:'Chưa kiểm tra',off:'Đang tắt',syncing:'Đang đồng bộ',ok:'Đã kết nối',error:'Lỗi kết nối'}[lisGatewayRuntime.status]||lisGatewayRuntime.status;return label+(lisGatewayRuntime.detail?' · '+lisGatewayRuntime.detail:'')+(lisGatewayRuntime.lastSync?' · '+formatDateTimeVN(lisGatewayRuntime.lastSync):'');}
async function lisGatewayFetch(path,opts={}){const cfg=lisGatewayConfig(),ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),5000);try{const res=await fetch(cfg.url+path,{...opts,signal:ctl.signal,headers:{'content-type':'application/json',...(cfg.token?{authorization:'Bearer '+cfg.token}:{}),...(opts.headers||{})}}),body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(res.status===401?'Token không đúng hoặc chưa nhập. Xem token in ra khi chạy npm run lis:gateway.':(body.message||`HTTP ${res.status}`));return body;}finally{clearTimeout(timer);}}
async function lisGatewayHealth(){const body=await lisGatewayFetch('/health');if(!body||body.ok!==true)throw new Error('Gateway không trả trạng thái hợp lệ.');return body;}
function lisQcSnapshotForTest(t,now=new Date()){
  const wg=activeWestgard(t),today=isoToday(),summary=WestgardViewModel.summarizeTestStatus({views:wg.views,verdicts:wg.byPoint,today}),last=summary.lastPoints.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||pointRunNo(a)-pointRunNo(b)).slice(-1)[0],alert=summary.alerts.slice().sort((a,b)=>String(b.point&&b.point.date||'').localeCompare(String(a.point&&a.point.date||'')))[0];let status=summary.status,reason='Westgard đạt';
  if(status==='none'){status='unknown';reason='Chưa có điểm QC cho lô đang vận hành.';}
  else if(summary.todayCount<(wg.views||[]).length){if(status==='ok')status='warn';reason=`Thiếu QC hôm nay: ${summary.todayCount}/${(wg.views||[]).length} mức.`;}
  else if(status==='rej')reason='Westgard loại: '+((alert&&alert.rules||[]).join(', ')||'không rõ luật');
  else if(status==='warn')reason='Westgard cảnh báo: '+((alert&&alert.rules||[]).join(', ')||'cần duyệt');
  return{qclabTestId:String(t.id),status,asOf:now.toISOString(),reason,instrumentId:String(t.instrumentId||t.machine||''),evidenceDate:String(last&&last.date||''),evidencePointId:String(last&&last.id||''),rules:[...new Set((summary.alerts||[]).flatMap(x=>x.rules||[]))]};
}
/* HÀNG CHỜ LÀ NGUỒN SỰ THẬT, XÓA SAU KHI GỬI THÀNH CÔNG.
   Bản đầu gọi pendingIds.clear() NGAY TRƯỚC lisGatewaySync(); nếu lần gửi trước còn đang
   chạy thì sync trả {busy:true} tức khắc và những id vừa xóa mất luôn, không retry. Cộng
   với việc gửi tuần tự từng xét nghiệm (timeout 5s × 50 xét nghiệm = tới 250s treo) và cửa
   sổ hết hạn 12 giờ, một trạng thái `rej` không gửi được đồng nghĩa gateway tiếp tục trả
   `accepted` cho kết quả bệnh nhân suốt nửa ngày.
   Nay: nhận phần đang chờ ra rồi mới xóa; THẤT BẠI thì trả lại hàng chờ và hẹn thử lại
   theo backoff. Việc thêm mới trong lúc đang gửi tự nhiên được giữ, vì chúng được thêm
   sau thời điểm xóa. Bận thì không đụng gì tới hàng chờ cả. */
function lisGatewayClaimPending(){const claim={all:lisGatewayRuntime.syncAll,ids:[...lisGatewayRuntime.pendingIds]};lisGatewayRuntime.syncAll=false;lisGatewayRuntime.pendingIds.clear();return claim;}
function lisGatewayReturnPending(claim){if(!claim)return;if(claim.all)lisGatewayRuntime.syncAll=true;(claim.ids||[]).forEach(id=>lisGatewayRuntime.pendingIds.add(id));}
function lisGatewayHasPending(){return lisGatewayRuntime.syncAll||lisGatewayRuntime.pendingIds.size>0;}
function lisGatewayScheduleRetry(){
  lisGatewayRuntime.retryMs=Math.min(lisGatewayRuntime.retryMs?lisGatewayRuntime.retryMs*2:LIS_RETRY_BASE_MS,LIS_RETRY_MAX_MS);
  clearTimeout(lisGatewayRuntime.syncT);
  lisGatewayRuntime.syncT=setTimeout(()=>{lisGatewayRuntime.syncT=null;lisGatewayRunPending();},lisGatewayRuntime.retryMs);
  return lisGatewayRuntime.retryMs;
}
function lisGatewayRunPending(){const claim=lisGatewayClaimPending();return lisGatewaySync(claim.all?null:claim.ids,{claim});}
async function lisGatewaySync(testIds=null,opts={}){
  const cfg=lisGatewayConfig();if(!cfg.enabled)return{ok:false,skipped:true,count:0};
  /* Bận thì KHÔNG nuốt yêu cầu: trả lại phần đã nhận (nếu có) và hẹn chạy lại. */
  if(lisGatewayRuntime.running){lisGatewayReturnPending(opts.claim);if(!lisGatewayRuntime.syncT)lisGatewayScheduleRetry();return{ok:false,busy:true,count:0};}
  lisGatewayRuntime.running=true;lisGatewaySetStatus('syncing','Đang gửi trạng thái QC');
  try{
    await lisGatewayHealth();
    const wanted=testIds&&testIds.length?new Set(testIds.map(String)):null,tests=operationalTests().filter(t=>!wanted||wanted.has(String(t.id))),now=new Date();
    const items=tests.map(t=>lisQcSnapshotForTest(t,now));
    /* MỘT request cho cả lô — gateway chuẩn hóa hết rồi mới ghi, nên không có trạng thái
       ghi được nửa chừng để app phải đoán. */
    if(items.length)await lisGatewayFetch('/api/v1/qc-status',{method:'PUT',body:JSON.stringify({items})});
    lisGatewayRuntime.lastSync=now.toISOString();lisGatewayRuntime.retryMs=0;lisGatewayRuntime.lastError='';
    lisGatewaySetStatus('ok',`${items.length} xét nghiệm`);
    return{ok:true,count:items.length};
  }catch(error){
    lisGatewayReturnPending(opts.claim);
    const detail=error&&error.name==='AbortError'?'Gateway không phản hồi':(error&&error.message||'Lỗi không xác định');
    lisGatewayRuntime.lastError=detail;
    const wait=lisGatewayScheduleRetry();
    lisGatewaySetStatus('error',`${detail} · thử lại sau ${Math.round(wait/1000)}s`);
    if(opts.manual)await infoDialog('Không đồng bộ được LIS Gateway:\n'+detail);
    return{ok:false,error:detail,count:0,retryMs:wait};
  }finally{lisGatewayRuntime.running=false;}
}
function scheduleLisQcSync(opts={}){
  const cfg=lisGatewayConfig();if(!cfg.enabled||typeof currentUser==='undefined'||!currentUser||opts.clearDerived===false)return;
  const ids=Array.isArray(opts.testIds)?opts.testIds:(opts.testId?[opts.testId]:[]);
  if(ids.length)ids.forEach(id=>lisGatewayRuntime.pendingIds.add(String(id)));else lisGatewayRuntime.syncAll=true;
  clearTimeout(lisGatewayRuntime.syncT);
  lisGatewayRuntime.syncT=setTimeout(()=>{lisGatewayRuntime.syncT=null;lisGatewayRunPending();},1200);
}
/* Nhịp định kỳ: gateway chỉ tin trạng thái trong 90 phút rồi chuyển sang GIỮ kết quả.
   Không có nhịp này thì một ngày làm việc không nhập gì sẽ bị coi là mất liên lạc. */
function lisGatewayStart(){
  clearInterval(lisGatewayRuntime.heartbeatT);lisGatewayRuntime.heartbeatT=null;
  const cfg=lisGatewayConfig();if(!cfg.enabled){lisGatewaySetStatus('off','Chưa bật tự động');return;}
  scheduleLisQcSync({});
  lisGatewayRuntime.heartbeatT=setInterval(()=>{if(!lisGatewayHasPending())lisGatewayRuntime.syncAll=true;if(!lisGatewayRuntime.syncT)lisGatewayRunPending();},LIS_HEARTBEAT_MS);
}
async function lisGatewaySaveSettings(){if(!requireAdmin('Chỉ quản trị mới được cấu hình LIS Gateway.'))return;const enabled=!!document.getElementById('lisGatewayEnabled').checked,url=lisNormalizeGatewayUrl(document.getElementById('lisGatewayUrl').value),tokenEl=document.getElementById('lisGatewayToken'),token=String(tokenEl&&tokenEl.value||'').trim()||lisGatewayConfig().token;if(!url){await infoDialog('Prototype chỉ cho phép http://127.0.0.1:8787 hoặc http://localhost:8787.');return;}if(enabled&&!token){await infoDialog('Cần dán Bearer token của Gateway. Token được in ra khi chạy npm run lis:gateway.');return;}try{localStorage.setItem(LIS_GATEWAY_STORAGE_KEY,JSON.stringify({enabled,url,token}));}catch(e){await infoDialog('Không lưu được cấu hình LIS Gateway trên máy này.');return;}if(tokenEl)tokenEl.value='';if(!enabled){clearInterval(lisGatewayRuntime.heartbeatT);lisGatewayRuntime.heartbeatT=null;lisGatewaySetStatus('off','Đã tắt');await infoDialog('Đã tắt đồng bộ LIS Gateway trên máy này.',{type:'success'});return;}lisGatewayStart();const result=await lisGatewaySync(null,{manual:true});if(result.ok)await infoDialog(`Đã kết nối và gửi ${result.count} trạng thái QC.`,{type:'success'});}
async function lisGatewaySyncNow(){if(!lisGatewayConfig().enabled){await infoDialog('Hãy bật LIS Gateway và lưu cấu hình trước khi đồng bộ.',{type:'warning'});return;}const result=await lisGatewaySync(null,{manual:true});if(result.ok)await infoDialog(`Đã gửi ${result.count} trạng thái QC sang LIS Gateway.`,{type:'success'});}

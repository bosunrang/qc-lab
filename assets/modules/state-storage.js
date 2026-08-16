/* ===== LOCAL STORAGE — pipeline bền vững dữ liệu cục bộ =====
   HỢP ĐỒNG BỀ MẶT (ai được gọi gì):
   - app.js (boot): await loadBootState() trước khi ensureAdmin/showLogin, SAU ĐÓ
     phải await storageHydrationPromise rồi mới initFirebase/showStartupRecovery.
   - users-auth.js: await storageHydrationPromise trước khi cho người dùng vào app.
   - Mọi module nghiệp vụ: save(opts) sau mỗi thay đổi state — opts:
     {testId|testIds} ghi tăng dần đúng các test đó; {sigmaTestId} kèm nháp Sigma
     đồng bộ bắc cầu reload; {clearDerived:false} giữ cache dẫn xuất; {cloud:false}
     chỉ lưu cục bộ, không đẩy Firebase.
   - firebase-sync.js: persistLocalSnapshot({changed:true,quiet:true}) sau khi
     merge từ cloud; clearSigmaDraftThrough(stamp) khi cloud đã ack;
     mirrorIndexedDb(raw) ở đường legacy.
   - Trang tự gọi: lsFlush() qua beforeunload/pagehide/visibilitychange.
   BOOT HAI PHA (hợp đồng quan trọng): loadBootState() có thể trả true khi mới
   đọc được boot shell — state.data đang RỖNG, localLoadStatus='partition-shell',
   dữ liệu thật nạp nền qua storageHydrationPromise. Trong cửa sổ đó mọi lần ghi
   bị HOÃN (persistLocalSnapshot tự giữ lsDirty và hẹn lại) để không cắt manifest
   của slot đang hoạt động; hydrate xong tự xả các lần ghi dồn. Người gọi chỉ cần
   await storageHydrationPromise, không cần xử lý gì thêm.
   BẢO ĐẢM: mọi state nạp từ ngoài đều qua adoptValidatedState() (validate →
   sanitize → ensureShape → invariant); ghi thất bại luôn tự retry backoff mũ
   (chặn 30s) tới khi thành công; ghi tăng dần bị gián đoạn bị readPartitionSlot()
   loại bỏ nhờ lệch savedAt manifest, quay về slot an toàn. Các biến ls*,
   partitionWrite, localLoadStatus cố ý là global để test sandbox kiểm soát trực
   tiếp — không gói vào namespace. */
let localLoadStatus='missing';
let storageHydrationPromise=Promise.resolve(true),partitionSlot='';
const SIGMA_DRAFT_KEY='qclab_sigma_draft';
function sigmaDraftRecord(){return globalThis.sigmaDraftService?globalThis.sigmaDraftService.read():(()=>{try{const v=JSON.parse(localStorage.getItem(SIGMA_DRAFT_KEY)||'null');return v&&typeof v==='object'&&v.branches&&typeof v.branches==='object'?v:null;}catch(e){return null;}})();}
function sigmaDraftStamp(){return globalThis.sigmaDraftService?globalThis.sigmaDraftService.stamp():Number((sigmaDraftRecord()||{}).savedAt||0);}
function persistSigmaDraft(testId){
  if(globalThis.sigmaDraftService)return globalThis.sigmaDraftService.persist(testId,state.sigmaData,typeof fbDataPath==='function'?fbDataPath():'');
  if(!testId)return false;
  try{
    const persistedAt=Number(localStorage.getItem('qclab_saved_at')||0),previous=sigmaDraftRecord(),branches=previous&&Number(previous.savedAt||0)>persistedAt?{...previous.branches}:{};
    branches[String(testId)]=JSON.parse(JSON.stringify(state.sigmaData&&state.sigmaData[testId]||[]));
    const savedAt=Math.max(Date.now(),Number(previous&&previous.savedAt||0)+1),path=typeof fbDataPath==='function'?fbDataPath():'';
    localStorage.setItem(SIGMA_DRAFT_KEY,JSON.stringify({savedAt,path,branches}));return true;
  }catch(e){return false;}
}
function clearSigmaDraftThrough(stamp){
  if(globalThis.sigmaDraftService)return globalThis.sigmaDraftService.clearThrough(stamp);
  try{const current=sigmaDraftRecord();if(current&&Number(current.savedAt||0)<=Number(stamp||0))localStorage.removeItem(SIGMA_DRAFT_KEY);}catch(e){}
}
function sigmaDraftNeedsCloud(){try{const cfg=typeof getFbCfg==='function'?getFbCfg():null;return!!(cfg&&cfg.config);}catch(e){return false;}}
function recoverPendingSigmaDraft(){
  const draft=sigmaDraftRecord();if(!draft)return false;
  const savedAt=Number(draft.savedAt||0);
  if(!savedAt)return false;
  try{
    const merged={...(state.sigmaData||{}),...draft.branches},clean=QCCore.sanitizeBackup({tests:state.tests||[],data:{},sigmaData:merged},{owned:true});
    state.sigmaData=clean.sigmaData||{};reconcileSigmaLevelsWithLotGroups();
    lsRevision++;lsDirty=true;lsFullDirty=true;
    if(typeof fb!=='undefined'&&(!draft.path||typeof fbDataPath!=='function'||draft.path===fbDataPath()))fb.dirty=true;
    return true;
  }catch(e){return false;}
}
function quarantineCorruptLocal(raw,error){
  if(globalThis.corruptLocalQuarantine){try{localStorage.setItem('qclab_corrupt',JSON.stringify(globalThis.corruptLocalQuarantine(raw,error)));}catch(e){try{localStorage.setItem('qclab_corrupt',JSON.stringify({capturedAt:new Date().toISOString(),source:'localStorage:qclab',message:'KhÃ´ng Ä‘á»§ dung lÆ°á»£ng Ä‘á»ƒ lÆ°u toÃ n bá»™ dá»¯ liá»‡u há»ng.'}));}catch(ignore){}}return;}
  try{
    const record={capturedAt:new Date().toISOString(),source:'localStorage:qclab',message:error&&error.message?error.message:'Dữ liệu cục bộ không hợp lệ.',raw:String(raw||'')};
    localStorage.setItem('qclab_corrupt',JSON.stringify(record));
  }catch(e){
    try{localStorage.setItem('qclab_corrupt',JSON.stringify({capturedAt:new Date().toISOString(),source:'localStorage:qclab',message:'Không đủ dung lượng để lưu toàn bộ dữ liệu hỏng.'}));}catch(ignore){}
  }
}
/* Phễu chuẩn hóa MỌI state nạp từ ngoài (localStorage/IndexedDB/boot shell):
   validate → sanitize → ensureShape → kiểm invariant, ném Error khi không qua.
   Gán thẳng vào `state` toàn cục — caller tự chịu mem/partitionSlot/
   localLoadStatus/startupProblem theo ngữ cảnh của mình. */
function adoptValidatedState(parsed){
  return globalThis.storageLifecycleService.adopt(parsed);
}
function load(){return globalThis.storageLifecycleService.load();}
async function hydratePartitionedState(){return globalThis.storageLifecycleService.hydratePartitioned();}
async function restoreFromIndexedDb(){return globalThis.storageLifecycleService.restoreFromIndexedDb();}
async function loadBootState(){return globalThis.storageLifecycleService.loadBootState();}
function mirrorIndexedDb(raw){
  return globalThis.indexedDbMirrorService.mirror(raw,state);
}
let lsSaveT=null,lsIdleHandle=null,lsDirty=false,lsFullDirty=false,lsDirtyTestIds=new Set(),lsRevision=0,lsSerializedRevision=-1,lsSerialized='',lsLastBytes=0,lsLastSerializeMs=0,lsSerializeCount=0,lsSaveFailures=0;
/** @type {Promise<any>} */
let partitionWrite=Promise.resolve();
/* Ghi tăng dần (incremental) chỉ đè shell + các test đổi NGAY TRÊN slot đang hoạt
   động — khác với ghi đầy đủ (xoay sang slot còn lại, slot cũ giữ nguyên làm lưới
   an toàn). Nếu một lần ghi tăng dần bị gián đoạn giữa lúc ghi xong dữ liệu và lúc
   cập nhật manifest, readPartitionSlot() phát hiện lệch savedAt và bỏ NGUYÊN CẢ
   SLOT — quay về slot kia từ lần xoay vòng đầy đủ gần nhất, tức mất luôn MỌI lần
   ghi tăng dần đã thành công kể từ đó (không chỉ lần đang dở), vì bản thân việc
   ghi tăng dần đã ghi đè mất nội dung shell/partition cũ. Một ngày làm việc bình
   thường (lưu theo từng xét nghiệm) có thể toàn ghi tăng dần nhiều ngày liền không
   có lần xoay vòng đầy đủ nào — nếu đúng lúc đó app tắt đột ngột, cửa sổ mất dữ
   liệu không còn là "1 lần lưu" mà là "từ lần xoay vòng đầy đủ gần nhất tới giờ".
   Giảm nhẹ: ép một lần ghi ĐẦY ĐỦ định kỳ (xoay slot) sau một số lần ghi tăng dần
   liên tiếp hoặc sau một khoảng thời gian, để giới hạn cửa sổ rủi ro thay vì để
   không giới hạn. Không xóa được rủi ro (ghi tăng dần vẫn có thể bị gián đoạn),
   chỉ giới hạn thiệt hại tối đa. Khai báo `let` (không phải `const`) để test có
   thể chỉnh ngưỡng thấp mà không cần chờ thật. */
let lsIncrementalStreak=0,lsLastFullSaveAt=(typeof Date!=='undefined'?Date.now():0);
let LS_FULL_ROTATE_MAX_INCREMENTALS=25,LS_FULL_ROTATE_MAX_MS=10*60*1000;
function lsClock(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
function serializeStateForStorage(){
  if(globalThis.storageSerializePolicy){const raw=globalThis.storageSerializePolicy.serialize(state,lsRevision),s=globalThis.storageSerializePolicy.stats();lsLastSerializeMs=s.ms;lsLastBytes=s.bytes;lsSerializeCount=s.count;lsSerialized=raw;lsSerializedRevision=lsRevision;return raw;}
  if(lsSerializedRevision===lsRevision&&lsSerialized)return lsSerialized;
  const started=lsClock(),raw=JSON.stringify(state);
  lsLastSerializeMs=lsClock()-started;lsLastBytes=raw.length;lsSerializeCount++;
  lsSerialized=raw;lsSerializedRevision=lsRevision;return raw;
}
function lsSaveDelay(){return globalThis.storageSerializePolicy?globalThis.storageSerializePolicy.delay():lsLastBytes>8*1024*1024||lsLastSerializeMs>30?1200:lsLastBytes>2*1024*1024||lsLastSerializeMs>10?700:400;}
function cancelLocalSaveSchedule(){
  if(globalThis.localSaveScheduler)globalThis.localSaveScheduler.cancel();
  clearTimeout(lsSaveT);lsSaveT=null;
  if(lsIdleHandle!==null&&typeof cancelIdleCallback==='function')cancelIdleCallback(lsIdleHandle);
  lsIdleHandle=null;
}
function scheduleLocalSave(){
  cancelLocalSaveSchedule();
  if(globalThis.localSaveScheduler){globalThis.localSaveScheduler.schedule(lsSaveDelay(),()=>{if(typeof requestIdleCallback==='function')lsIdleHandle=requestIdleCallback(()=>{lsIdleHandle=null;lsFlush();},{timeout:1000});else lsFlush();});return;}
  lsSaveT=setTimeout(()=>{
    lsSaveT=null;
    if(typeof requestIdleCallback==='function')lsIdleHandle=requestIdleCallback(()=>{lsIdleHandle=null;lsFlush();},{timeout:1000});
    else lsFlush();
  },lsSaveDelay());
}
/* Ghi thất bại (IDB tạm lỗi, hết quota...) được hẹn thử lại với backoff mũ chặn
   ở 30s, thay vì treo lsDirty tới tận thao tác kế tiếp của người dùng. Ghi
   thành công reset lsSaveFailures về 0. */
function scheduleLocalRetry(){
  cancelLocalSaveSchedule();
  const delay=globalThis.storageRetryDelay?globalThis.storageRetryDelay(lsSaveFailures):Math.min(30000,1000*Math.pow(2,Math.min(lsSaveFailures,5)));
  lsSaveT=setTimeout(()=>{lsSaveT=null;lsFlush();},delay);
}
/* Một lần serialize dùng chung cho localStorage và IndexedDB. Snapshot lớn được
   debounce lâu hơn và ưu tiên idle time; pagehide/beforeunload vẫn xả ngay. */
function persistLocalSnapshot(opts={}){
  return globalThis.storageSnapshotService.persist(opts);
}
function lsFlush(){return persistLocalSnapshot();}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('beforeunload',lsFlush);
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pagehide',lsFlush);
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')lsFlush();});
function invalidateDerivedForSave(opts={}){
  const ids=globalThis.saveCommandPolicy?globalThis.saveCommandPolicy(opts).derivedTestIds:(globalThis.saveDerivedTestIds?globalThis.saveDerivedTestIds(opts):(opts.clearDerived===false?null:(Array.isArray(opts.testIds)?opts.testIds:(opts.testId?[opts.testId]:[]))));
  if(ids===null)return;
  if(ids.length)[...new Set(ids.filter(Boolean))].forEach(clearDerivedForTest);else clearDerived();
}
function save(opts={}){
  return globalThis.saveService.save(opts);
}

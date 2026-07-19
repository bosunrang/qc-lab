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
function sigmaDraftRecord(){try{const v=JSON.parse(localStorage.getItem(SIGMA_DRAFT_KEY)||'null');return v&&typeof v==='object'&&v.branches&&typeof v.branches==='object'?v:null;}catch(e){return null;}}
function sigmaDraftStamp(){const v=sigmaDraftRecord();return Number(v&&v.savedAt||0);}
function persistSigmaDraft(testId){
  if(!testId)return false;
  try{
    const persistedAt=Number(localStorage.getItem('qclab_saved_at')||0),previous=sigmaDraftRecord(),branches=previous&&Number(previous.savedAt||0)>persistedAt?{...previous.branches}:{};
    branches[String(testId)]=JSON.parse(JSON.stringify(state.sigmaData&&state.sigmaData[testId]||[]));
    const savedAt=Math.max(Date.now(),Number(previous&&previous.savedAt||0)+1),path=typeof fbDataPath==='function'?fbDataPath():'';
    localStorage.setItem(SIGMA_DRAFT_KEY,JSON.stringify({savedAt,path,branches}));return true;
  }catch(e){return false;}
}
function clearSigmaDraftThrough(stamp){
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
  const errors=QCCore.validateBackup(parsed);if(errors.length)throw new Error(errors.join('\n'));
  state=QCCore.sanitizeBackup(parsed,{owned:true});ensureShape({sanitized:true});
  const invariantErrors=QCCore.validateStateInvariants(state,{sanitized:true});if(invariantErrors.length)throw new Error(invariantErrors.join('\n'));
}
function load(){
  let raw;
  if(typeof LocalStore!=='undefined'&&LocalStore.supported()){
    try{
      const bootRaw=localStorage.getItem('qclab_boot');
      if(bootRaw){
        const boot=JSON.parse(bootRaw),shell=boot&&boot.shell;
        if(!shell||!['a','b'].includes(boot.slot))throw new Error('Partition boot record không hợp lệ.');
        adoptValidatedState(shell);
        partitionSlot=boot.slot;localLoadStatus='partition-shell';storageHydrationPromise=hydratePartitionedState();return true;
      }
    }catch(e){try{localStorage.removeItem('qclab_boot');}catch(ignore){}}
  }
  try{raw=localStorage.getItem('qclab');}
  catch(e){startupProblem={raw:'',message:'Trình duyệt không cho phép đọc vùng lưu trữ cục bộ.'};return false;}
  if(!raw){localLoadStatus='missing';if(mem)state=mem;ensureShape();const emptyErrors=QCCore.validateStateInvariants(state);if(emptyErrors.length){startupProblem={raw:'',message:emptyErrors.join('\n')};return false;}return true;}
  localLoadStatus='local';
  try{
    adoptValidatedState(JSON.parse(raw));return true;
  }catch(e){
    localLoadStatus='invalid';quarantineCorruptLocal(raw,e);startupProblem={raw,message:e&&e.message?e.message:'Dữ liệu cục bộ không hợp lệ.'};
    return false;
  }
}
async function hydratePartitionedState(){
  try{
    const record=await LocalStore.readPartitioned();if(!record||!record.state)throw new Error('Không tìm thấy các phân vùng dữ liệu QC.');
    /* recoverPendingSigmaDraft() chạy SAU adoptValidatedState (invariant đã qua) —
       cùng thứ tự với đường 'local' của loadBootState(); bản thân recover đã
       sanitize nhánh sigmaData được merge vào. */
    adoptValidatedState(record.state);recoverPendingSigmaDraft();
    mem=state;partitionSlot=record.slot;localLoadStatus='partitioned';clearDerived();startupProblem=null;if(lsDirty)scheduleLocalSave();return true; /* xả ngay các lần ghi bị hoãn trong lúc hydrate */
  }catch(e){startupProblem={raw:'',message:e&&e.message?e.message:'Không thể tải các phân vùng dữ liệu QC.'};return false;}
}
async function restoreFromIndexedDb(){
  if(typeof LocalStore==='undefined'||!LocalStore.supported())return false;
  try{
    const partitioned=typeof LocalStore.readPartitioned==='function'?await LocalStore.readPartitioned():null;
    if(partitioned&&partitioned.state){
      adoptValidatedState(partitioned.state);
      mem=state;partitionSlot=partitioned.slot;localLoadStatus='partitioned';startupProblem=null;
      try{localStorage.setItem('qclab_boot',JSON.stringify({format:1,slot:partitioned.slot,savedAt:partitioned.savedAt,shell:{...state,data:{}}}));}catch(e){}
      return true;
    }
  }catch(e){startupProblem={raw:'',message:e&&e.message?e.message:'Dữ liệu phân vùng IndexedDB không hợp lệ.'};return false;}
  let record;try{record=await LocalStore.read();}catch(e){return false;}
  let parsed=record&&record.state;
  if(!parsed&&record&&record.json){try{parsed=JSON.parse(record.json);}catch(e){startupProblem={raw:String(record.json),message:e&&e.message?e.message:'Dữ liệu IndexedDB không hợp lệ.'};return false;}}
  if(!parsed)return false;
  try{
    adoptValidatedState(parsed);
    mem=state;localLoadStatus='indexeddb';startupProblem=null;
    try{localStorage.setItem('qclab',JSON.stringify(state));}catch(e){}
    return true;
  }catch(e){startupProblem={raw:JSON.stringify(parsed),message:e&&e.message?e.message:'Dữ liệu IndexedDB không hợp lệ.'};return false;}
}
async function loadBootState(){
  const localOk=load();
  /* Đường partition-shell: hydratePartitionedState() tự recover draft khi nạp
     xong — gọi lại ở đây chỉ merge lặp và bump lsRevision/lsDirty thừa. */
  if(localOk&&localLoadStatus!=='partition-shell')recoverPendingSigmaDraft();
  if(localLoadStatus==='local'||localLoadStatus==='partition-shell'||typeof LocalStore==='undefined'||!LocalStore.supported())return localOk;
  const restored=await restoreFromIndexedDb();
  if(restored)recoverPendingSigmaDraft();
  return restored||localOk;
}
function mirrorIndexedDb(raw){
  if(typeof LocalStore==='undefined'||!LocalStore.supported())return false;
  const write=typeof LocalStore.writeSerialized==='function'?LocalStore.writeSerialized(raw):LocalStore.write(state);
  write.catch(()=>{lsDirty=true;lsSaveFailures++;scheduleLocalRetry();});return true;
}
let lsSaveT=null,lsIdleHandle=null,lsDirty=false,lsFullDirty=false,lsDirtyTestIds=new Set(),lsRevision=0,lsSerializedRevision=-1,lsSerialized='',lsLastBytes=0,lsLastSerializeMs=0,lsSerializeCount=0,lsSaveFailures=0;
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
  if(lsSerializedRevision===lsRevision&&lsSerialized)return lsSerialized;
  const started=lsClock(),raw=JSON.stringify(state);
  lsLastSerializeMs=lsClock()-started;lsLastBytes=raw.length;lsSerializeCount++;
  lsSerialized=raw;lsSerializedRevision=lsRevision;return raw;
}
function lsSaveDelay(){return lsLastBytes>8*1024*1024||lsLastSerializeMs>30?1200:lsLastBytes>2*1024*1024||lsLastSerializeMs>10?700:400;}
function cancelLocalSaveSchedule(){
  clearTimeout(lsSaveT);lsSaveT=null;
  if(lsIdleHandle!==null&&typeof cancelIdleCallback==='function')cancelIdleCallback(lsIdleHandle);
  lsIdleHandle=null;
}
function scheduleLocalSave(){
  cancelLocalSaveSchedule();
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
  const delay=Math.min(30000,1000*Math.pow(2,Math.min(lsSaveFailures,5)));
  lsSaveT=setTimeout(()=>{lsSaveT=null;lsFlush();},delay);
}
/* Một lần serialize dùng chung cho localStorage và IndexedDB. Snapshot lớn được
   debounce lâu hơn và ưu tiên idle time; pagehide/beforeunload vẫn xả ngay. */
function persistLocalSnapshot(opts={}){
  if(opts.changed){lsRevision++;lsDirty=true;lsFullDirty=true;}
  if(!lsDirty)return false;
  cancelLocalSaveSchedule();lsDirty=false;
  const localDraftStamp=sigmaDraftStamp();
  if(typeof LocalStore!=='undefined'&&LocalStore.supported()&&typeof LocalStore.writePartitioned==='function'){
    /* Boot shell chưa hydrate xong: state.data đang rỗng — ghi lúc này sẽ cắt
       manifest của slot đang hoạt động về danh sách test rỗng, mất toàn bộ
       điểm QC của slot. Hoãn ghi (giữ lsDirty, hẹn lại) tới khi hydrate xong. */
    if(localLoadStatus==='partition-shell'){lsDirty=true;scheduleLocalSave();return false;}
    const now=Date.now();
    if(!lsFullDirty&&(lsIncrementalStreak>=LS_FULL_ROTATE_MAX_INCREMENTALS||now-lsLastFullSaveAt>=LS_FULL_ROTATE_MAX_MS))lsFullDirty=true;
    const dirtyTestIds=lsFullDirty?null:[...lsDirtyTestIds];
    if(dirtyTestIds===null){lsIncrementalStreak=0;lsLastFullSaveAt=now;}else lsIncrementalStreak++;
    lsFullDirty=false;lsDirtyTestIds.clear();
    partitionWrite=partitionWrite.catch(()=>false).then(()=>LocalStore.writePartitioned(state,partitionSlot,{dirtyTestIds})).then(result=>{
      if(!result)throw new Error('Không thể ghi snapshot phân vùng.');
      partitionSlot=result.slot;lsSaveFailures=0;
      try{localStorage.setItem('qclab_boot',JSON.stringify({format:1,slot:result.slot,savedAt:result.savedAt,shell:result.shell}));localStorage.setItem('qclab_saved_at',String(result.savedAt));localStorage.removeItem('qclab');}catch(e){}
      if(!sigmaDraftNeedsCloud())clearSigmaDraftThrough(localDraftStamp);
      if(!opts.quiet)markSaved('đã lưu cục bộ','IndexedDB phân vùng · Lúc '+saveTime());return true;
    }).catch(()=>{lsDirty=true;lsFullDirty=true;lsSaveFailures++;scheduleLocalRetry();if(!opts.quiet)markSaved('lỗi lưu cục bộ','Không thể ghi IndexedDB phân vùng');return false;});
    return true;
  }
  let raw;try{raw=serializeStateForStorage();}catch(e){lsDirty=true;if(!opts.quiet)markSaved('lỗi lưu cục bộ','Không thể tạo snapshot');return false;}
  let localSaved=false,savedAt=Date.now();
  try{localStorage.setItem('qclab',raw);localStorage.setItem('qclab_saved_at',String(savedAt));localSaved=true;if(!opts.quiet)markSaved('đã lưu cục bộ','Lúc '+saveTime());}
  catch(e){try{localStorage.removeItem('qclab');localStorage.removeItem('qclab_saved_at');}catch(ignore){}if(!opts.quiet)markSaved('lỗi lưu cục bộ','Kiểm tra dung lượng trình duyệt');}
  const mirrored=mirrorIndexedDb(raw);
  if((localSaved||mirrored)&&!sigmaDraftNeedsCloud())clearSigmaDraftThrough(localDraftStamp);
  if(localSaved||mirrored)lsSaveFailures=0;
  if(!localSaved&&!mirrored){lsDirty=true;lsSaveFailures++;scheduleLocalRetry();}
  if(!localSaved&&mirrored&&!opts.quiet)markSaved('đã lưu dự phòng','IndexedDB');
  return localSaved||mirrored;
}
function lsFlush(){return persistLocalSnapshot();}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('beforeunload',lsFlush);
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pagehide',lsFlush);
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')lsFlush();});
function invalidateDerivedForSave(opts={}){
  if(opts.clearDerived===false)return;
  const ids=Array.isArray(opts.testIds)?opts.testIds:(opts.testId?[opts.testId]:[]);
  if(ids.length)[...new Set(ids.filter(Boolean))].forEach(clearDerivedForTest);else clearDerived();
}
function save(opts={}){
  invalidateDerivedForSave(opts);
  mem=state;
  if(opts.cloud!==false){state._ts=Date.now();state._client=fb.clientId;}
  const storageIds=Array.isArray(opts.testIds)?opts.testIds:(opts.testId?[opts.testId]:(opts.sigmaTestId?[opts.sigmaTestId]:[]));
  if(storageIds.length)storageIds.filter(Boolean).forEach(id=>lsDirtyTestIds.add(String(id)));
  else if(opts.clearDerived!==false)lsFullDirty=true;
  if(opts.sigmaTestId)persistSigmaDraft(opts.sigmaTestId);
  lsRevision++;lsDirty=true;markSaved('đang lưu','...');
  scheduleLocalSave();
  if(opts.cloud!==false){fb.dirty=true;scheduleFbPush();}
}

/* ===== FIREBASE ===== */
let fb={ready:false,initialized:false,ref:null,dirty:false,clientId:'c_'+uid(),authUser:null,pendingRenderT:null,pullT:null,seenSig:null,synced:null,retryT:null,retryMs:1000},fbSaveT=null;
function fbClone(v){return globalThis.syncValueCodec.clone(v);}
function fbCanWrite(){return globalThis.firebaseConnectionGate.canWrite(fb);}
function fbNetworkOnline(){return globalThis.firebaseConnectionGate.networkOnline(typeof navigator==='undefined'?undefined:navigator.onLine);}
function fbResetRetry(){const next=globalThis.syncRetryScheduler.reset({timer:fb.retryT,delay:fb.retryMs});fb.retryT=next.timer;fb.retryMs=next.delay;}
function fbScheduleRetry(){const next=globalThis.syncRetryScheduler.schedule({dirty:fb.dirty,writable:fbCanWrite(),online:fbNetworkOnline(),retry:{timer:fb.retryT,delay:fb.retryMs},retryFn:()=>{fb.retryT=null;fbFlushPush();}});fb.retryT=next.timer;fb.retryMs=next.delay;}
function fbSetReady(){Object.assign(fb,globalThis.firebaseReadyState(fb));}
function fbStoreLocal(){globalThis.firebaseLocalStoreService.store(state);}
/* Có dữ liệu đáng để bảo vệ trước khi để cloud ghi đè hoàn toàn (lần nhận đầu tiên sau
   khi kết nối/đổi phòng — xem initFirebase()). Cố ý tính cả các danh mục cấu hình
   (instruments/qcPanels/lotGroups/qcLots/assayGroups), không chỉ tests/data/actions —
   máy mới cấu hình xong danh mục nhưng chưa kịp nhập QC vẫn có dữ liệu cần hỏi trước khi
   mất, dù merger TypeScript đã hạ thấp rủi ro so với trước rất nhiều. */
function hasLocalQcContent(s){return globalThis.syncHasContent(s);}
/* Dạng chuẩn để so khớp cục bộ với cloud: sắp xếp khóa, coi rỗng/null ≡ thiếu. RTDB
   không lưu mảng/đối tượng rỗng và không giữ thứ tự khóa, nên cùng một dữ liệu vẫn ra
   hai CHUỖI JSON khác nhau sau một vòng đẩy lên - tải về. */
function fbCanon(v){return globalThis.syncCanon(v);}
/* So sánh cục bộ với cloud để biết có THẬT SỰ khác nhau hay chỉ là bản đã đồng bộ tải
   lại. Chỉ so các nhánh nghiệp vụ được đồng bộ: activity/activityAnchor không dùng để
   bật hộp thoại phá hủy vì đăng nhập/đăng xuất luôn thêm audit cục bộ trước khi snapshot
   Firebase đầu tiên tới. Audit lệch được merge và đẩy hội tụ sau khi kết nối, không bị
   bỏ. Các field còn lại
   của state là cục bộ thuần (schemaVersion, teaRegistryVersion, _ts/_client...) và
   fbFlushPush() không bao giờ đẩy chúng lên, nên cloud không có. Trước đây hàm này so
   JSON.stringify TOÀN BỘ state nên luôn lệch ít nhất ở schemaVersion -> hộp thoại
   "dữ liệu cục bộ khác dữ liệu trung tâm" bật lên MỖI lần đăng nhập dù hai bên đã
   đồng bộ y hệt. Đừng đổi lại thành so cả state. */
function fbSyncedShape(s){return globalThis.syncedShape(s,globalThis.syncCompareKeys);}
function statesLikelyEqual(a,b){return globalThis.syncedStatesEqual(a,b,globalThis.syncCompareKeys);}
function fbSyncedSnapKeys(s){return globalThis.syncUpdateBuilder.baseSnapshot(s);}
/* So sánh state hiện tại với baseline thô (fb.synced) để chỉ đẩy đúng các nhánh đã
   thay đổi. Việc đẩy lên cloud vẫn theo cấp xét nghiệm (data/{testId} nguyên khối) —
   chỉ phần TRỘN khi nhận dữ liệu về (fbMerge) mới đi sâu tới từng điểm. */
function fbBuildUpdate(cur){return globalThis.syncUpdateBuilder.build(cur,fb.synced);}
function fbHasLocalChanges(){return globalThis.syncUpdateBuilder.hasChanges(state,fb.synced);}
function fbMerge(local,remote,base){
  return globalThis.syncStateMerge(local,remote,base);
}
/* Lần kết nối đầu tiên với một phòng đã có dữ liệu (base=null — gồm cả MỖI lần tải lại
   trang, vì fb.synced chỉ nằm trong RAM): GỘP hai bên thay vì để cloud đè toàn bộ.
   - Các nhánh danh sách: hợp nhất theo từng phần tử (fbMerge với base=null -> không có
     gì bị coi là "đã xóa", hai bên cộng dồn; trùng id thì cục bộ thắng như quy ước chung).
   - Các nhánh không phải danh sách (lab, westgardRules, configMigrationVersion): lấy
     theo cloud — không thể gộp từng phần, và cloud là gốc chung của phòng.
   - Tài khoản trùng username sau khi gộp: giữ bản trên cloud (đăng nhập thống nhất giữa
     các máy), bỏ bản trùng cục bộ.
   Phần chỉ có ở máy này sẽ được đẩy lên ngay sau đó (fbHasLocalChanges -> scheduleFbPush
   trong fbHandleValue) để các máy khác cùng nhận. */
function fbFirstConnectMerge(local,remote){
  return globalThis.syncFirstConnectMerge(local,remote);
}
let saveLabel='Cục bộ',saveDetail='';
function getDeployFbCfg(){
  return globalThis.firebaseConfigSourceService.deploy();
}
function getStoredFbCfg(){return globalThis.firebaseConfigSourceService.stored();}
function getFbCfg(){return globalThis.firebaseConfigSelection.select(getDeployFbCfg(),getStoredFbCfg());}
function fbConfigSig(cfg){return globalThis.firebaseConfigSelection.signature(cfg);}
async function ensureFirebaseApp(cfg){
  return globalThis.firebaseAppService.ensure(cfg);
}
function setCloudStatus(t,on){
  globalThis.firebaseCloudStatusPresentation.set(t,on);
}
function saveTime(){return new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});}
function updateSaveStatus(){
  const el=document.getElementById('saveStatus');if(el)el.innerHTML=`Lưu trữ: <b>${saveLabel}</b>${saveDetail?`<br>${saveDetail}`:''}`;
}
function markSaved(label,detail){globalThis.firebaseSaveStatusService.mark(label,detail||'');}
function fbDataPath(){return globalThis.firebaseIdentity.dataPath(getFbCfg()||{});}
function fbStatusLabel(){return globalThis.firebaseIdentity.statusLabel(getFbCfg()||{},fb.authUser||{});}
function fbSnapshotSig(v){return globalThis.syncSnapshotSignature(v);}
function fbAuditIntegrity(snapshot){return globalThis.firebaseAuditGate(snapshot);}
function fbRejectBrokenAudit(source,result){
  return globalThis.firebaseAuditRejectionService.reject(source,result);
}
function fbAuditMaySync(snapshot,source){const result=fbAuditIntegrity(snapshot);return result.ok||fbRejectBrokenAudit(source,result);}
function fbStopPull(){fb.pullT=globalThis.firebasePollingService.stop(fb.pullT);}
function fbStartPull(){fb.pullT=globalThis.firebasePollingService.start(fb.pullT,fbPullOnce,8000);}
/* Điểm dừng chung mỗi khi ngắt/đổi kết nối Firebase (hủy đồng bộ, đổi phòng, mất xác
   thực, lỗi đọc...): dừng poll, gỡ listener cũ, và reset toàn bộ cờ vòng đời để lần
   kết nối sau (nếu có) bắt đầu từ trạng thái sạch, không kế thừa fb.ref/fb.initialized
   còn sót lại từ phiên trước. */
function fbDisconnect(clearAuthUser){return globalThis.firebaseDisconnectService.disconnect(!!clearAuthUser);}
async function fbPullOnce(){
  return globalThis.firebasePullService.pull(fb);
}
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('focus',fbPullOnce);
  window.addEventListener('online',()=>{if(fb.dirty)scheduleFbPush();else fbPullOnce();});
  window.addEventListener('offline',()=>{if(fb.dirty)markSaved('cục bộ','Mạng ngoại tuyến · sẽ tự đồng bộ khi có mạng');});
}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')fbPullOnce();});
let fbConflictDialogOpen=false;
async function fbHandleValue(v,opts={}){
  const sig=fbSnapshotSig(v);
  const gate=globalThis.firebaseSnapshotGate(fb.seenSig,sig);if(!gate.handle)return;fb.seenSig=gate.seenSignature;
  if(!v){
    return globalThis.firebaseEmptySnapshotService.handle({initialized:fb.initialized,dirty:fb.dirty,hasLocalContent:hasLocalQcContent(state),silent:!!opts.silent});
  }
  const remoteSnapshot=globalThis.firebaseRemoteSnapshot(v),cloudErrors=remoteSnapshot.errors;
  if(cloudErrors.length){
    return globalThis.firebaseInvalidSnapshotService.handle(cloudErrors[0]);
  }
  const remote=remoteSnapshot.remote,base=fb.synced;
  /* Xac minh TUNG chuoi goc truoc khi merge/relink. Neu relink truoc, mot payload
     da bi sua co the duoc bam lai thanh chuoi "hop le" va mat dau vet hong ban dau. */
  if(!fbAuditMaySync(remote,'Nhật ký trên đám mây'))return;
  if(!fbAuditMaySync(state,'Nhật ký cục bộ'))return;
  // Bỏ qua chính bản ghi do máy này vừa đẩy lên (chống tự dội: mất focus/nháy màn hình),
  // nhưng vẫn đánh dấu snapshot đầu tiên đã tải để các lần lưu sau mới được push.
  if(globalThis.firebaseOwnSnapshotPlan(v,fb.clientId).own){
    return globalThis.firebaseOwnSnapshotService.handle(remote,!!opts.silent);
  }
  const hadLocalChanges=fb.dirty;
  const firstConnectPlan=globalThis.firebaseFirstConnectPlan(base,hadLocalChanges,hasLocalQcContent(state),statesLikelyEqual(state,remote));
  let mergeFirstConnect=firstConnectPlan.mergeFirstConnect;
  // Lần nhận đầu tiên sau khi kết nối/đổi phòng (base=null): nếu máy đang có dữ
  // liệu nghiệp vụ khác trung tâm thì hỏi trước khi thay thế, kể cả dữ liệu đó
  // đến từ localStorage sau reload chứ không phải thay đổi mới trong phiên này.
  // Mô hình MỘT DỮ LIỆU TRUNG TÂM: máy đầu tiên kết nối vào phòng trống seed dữ
  // liệu của nó làm gốc (nhánh `!v` phía trên); mọi máy sau kết nối vào phòng đã
  // có dữ liệu đều lấy NGUYÊN trung tâm — không gộp mục riêng của máy phụ vào
  // trung tâm, để tránh dữ liệu cũ/thử nghiệm của một máy âm thầm lẫn vào kho
  // chung. OK = thay thế toàn bộ dữ liệu cục bộ bằng trung tâm (mục chỉ có ở máy
  // này sẽ mất); Hủy = ngắt đồng bộ, giữ nguyên dữ liệu cục bộ (dùng khi nghi kết
  // nối nhầm mã phòng). Sau khi đã đồng bộ lần đầu, các lần sau vẫn là trộn 3
  // chiều hai máy như bình thường (base != null, xem nhánh fbMerge bên dưới).
  if(firstConnectPlan.confirmConflict){
    // Một hộp thoại xung đột tại một thời điểm: nếu snapshot mới tới trong lúc
    // hộp thoại trước đang chờ người dùng trả lời thì bỏ qua, không mở chồng.
    if(fbConflictDialogOpen)return;
    fbConflictDialogOpen=true;
    const proceed=await globalThis.firebaseConflictDialogService.ask((getFbCfg()||{}).labCode||'default');
    fbConflictDialogOpen=false;
    if(!proceed){
      fbDisconnect();
      setCloudStatus('Đã hủy kết nối để bảo vệ dữ liệu cục bộ',false);
      markSaved('cục bộ','Đã hủy đồng bộ — dữ liệu cục bộ được giữ nguyên');
      return;
    }
    if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);
    mergeFirstConnect=false; // trung tâm thắng hoàn toàn — không gộp mục riêng của máy này
  }
  fb.dirty=false;
  return globalThis.firebaseMergeCommitService.commit({base,mergeFirstConnect,remote,hadLocalChanges});
}
async function initFirebase(){
  const cfg=getFbCfg();
  if(!cfg||!cfg.config){setCloudStatus('Đang chạy cục bộ',false);return;}
  if(typeof firebase==='undefined'||typeof firebase.auth!=='function'){setCloudStatus('Thiếu Firebase Authentication',false);return;}
  return globalThis.firebaseSessionStartService.start(cfg);
}
/* Không vẽ lại toàn trang khi người dùng đang thao tác dở (đang mở modal hoặc đang gõ trong ô nhập),
   để dữ liệu đồng bộ từ máy khác không xóa mất nội dung đang nhập. Hoãn lại rồi tự áp dụng sau. */
function remoteRenderUnsafe(){
  return globalThis.firebaseRemoteRenderSafetyService.unsafe();
}
function applyRemoteRender(){
  globalThis.firebaseRemoteRenderService.apply();
}
/* Đẩy TOÀN BỘ khi thiết lập lần đầu: nếu cloud chưa có dữ liệu,
   tạo bản cloud từ dữ liệu hiện tại của máy này. */
async function syncNow(){
  return globalThis.firebaseFullSyncService.sync(fb);
}
/* Đẩy NỀN theo từng nhánh (dùng cho mọi lần lưu tự động): chỉ gửi nhánh đã đổi
   -> nhẹ hơn (không kéo lại logo/toàn bộ nhật ký) và không đè nhánh máy khác đang sửa. */
function scheduleFbPush(){
  fbSaveT=globalThis.firebasePushScheduler.schedule(fb,fbSaveT);
}
async function fbFlushPush(){
  fbSaveT=null;return globalThis.firebasePushService.flush(fb);
}

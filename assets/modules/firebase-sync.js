/* ===== FIREBASE ===== */
let fb={ready:false,initialized:false,ref:null,dirty:false,clientId:'c_'+uid(),authUser:null,pendingRenderT:null,pullT:null,seenSig:null,synced:null,retryT:null,retryMs:1000},fbSaveT=null;
/* Các nhánh dữ liệu cấp cao nhất được đồng bộ độc lập với nhau. Trong đó, các nhánh
   là DANH SÁCH (FB_LIST_KEYS) — gồm cả 'data'/'sigmaData' (tách thêm theo từng mã xét
   nghiệm) — được trộn theo TỪNG PHẦN TỬ (khóa `id`, hoặc theo nội dung nếu không có id)
   qua mergePointArray(), nên hai máy cùng thêm/sửa các phần tử KHÁC nhau trong cùng một
   danh sách (VD: 2 máy cùng thêm 2 máy xét nghiệm khác nhau) không còn ghi đè lẫn nhau.
   Các nhánh còn lại (object đơn như 'lab', dict như 'westgardRules', số như
   'configMigrationVersion') vẫn trộn theo kiểu "cả khối": bên nào đổi so với base thì
   lấy nguyên bên đó. fb.synced lưu nguyên state thô của lần đồng bộ gần nhất (không chỉ
   chuỗi snapshot) để có đủ dữ liệu gốc cho việc so khớp theo điểm. */
const FB_TOP=['lab','machines','instruments','assayGroups','qcPanels','lotTransitions','lotGroups','qcLots','tests','actions','activity','users','reagentTests','reagentOperators','reagentSampleTypes','periodLocks','teaRefs','westgardRules','configMigrationVersion'];
/* Các nhánh FB_TOP có dạng danh sách (mảng đối tượng có `id`, hoặc mảng chuỗi/giá trị
   đơn) — trộn theo từng phần tử thay vì "cả khối". Không gồm 'lab' (object đơn),
   'westgardRules' (dict cờ bật/tắt) và 'configMigrationVersion' (số) vì không phải danh
   sách các phần tử độc lập. */
const FB_LIST_KEYS=['machines','instruments','assayGroups','qcPanels','lotTransitions','lotGroups','qcLots','tests','actions','activity','users','reagentTests','reagentOperators','reagentSampleTypes','periodLocks','teaRefs'];
const FB_LIST_SET=new Set(FB_LIST_KEYS);
const FB_LOCAL_CONTENT_KEYS=['tests','actions','instruments','qcPanels','lotGroups','qcLots','assayGroups'];
function fbClone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function fbCloudValue(v){return v===undefined?null:fbClone(v);}
function fbJson(v){return JSON.stringify(v===undefined?null:v);}
function fbCanWrite(){return !!(fb.ready&&fb.initialized&&fb.ref);}
function fbNetworkOnline(){return typeof navigator==='undefined'||navigator.onLine!==false;}
function fbResetRetry(){if(fb.retryT!==null){clearTimeout(fb.retryT);fb.retryT=null;}fb.retryMs=1000;}
function fbScheduleRetry(){
  if(!fb.dirty||!fbCanWrite()||!fbNetworkOnline()||fb.retryT!==null)return;
  const delay=fb.retryMs;fb.retryMs=Math.min(30000,fb.retryMs*2);
  fb.retryT=setTimeout(()=>{fb.retryT=null;fbFlushPush();},delay);
}
function fbSetReady(){fb.initialized=true;fb.ready=true;}
function fbStoreLocal(){if(typeof persistLocalSnapshot==='function'){persistLocalSnapshot({changed:true,quiet:true});return;}try{localStorage.setItem('qclab',JSON.stringify(state));}catch(e){}if(typeof mirrorIndexedDb==='function')mirrorIndexedDb(JSON.stringify(state));}
/* Có dữ liệu đáng để bảo vệ trước khi để cloud ghi đè hoàn toàn (lần nhận đầu tiên sau
   khi kết nối/đổi phòng — xem initFirebase()). Cố ý tính cả các danh mục cấu hình
   (instruments/qcPanels/lotGroups/qcLots/assayGroups), không chỉ tests/data/actions —
   máy mới cấu hình xong danh mục nhưng chưa kịp nhập QC vẫn có dữ liệu cần hỏi trước khi
   mất, dù mergePointArray đã hạ thấp rủi ro so với trước rất nhiều. */
function hasLocalQcContent(s){
  if(!s)return false;
  if(Object.values(s.data||{}).some(arr=>Array.isArray(arr)&&arr.length))return true;
  return FB_LOCAL_CONTENT_KEYS.some(k=>(s[k]||[]).length);
}
/* Dạng chuẩn để so khớp cục bộ với cloud: sắp xếp khóa, coi rỗng/null ≡ thiếu. RTDB
   không lưu mảng/đối tượng rỗng và không giữ thứ tự khóa, nên cùng một dữ liệu vẫn ra
   hai CHUỖI JSON khác nhau sau một vòng đẩy lên - tải về. */
function fbCanon(v){
  if(v===undefined||v===null)return null;
  if(Array.isArray(v)){const a=v.map(fbCanon);while(a.length&&a[a.length-1]===null)a.pop();return a.length?a:null;}
  if(typeof v!=='object')return v;
  const out={};Object.keys(v).sort().forEach(k=>{const c=fbCanon(v[k]);if(c!==null)out[k]=c;});
  return Object.keys(out).length?out:null;
}
/* So sánh cục bộ với cloud để biết có THẬT SỰ khác nhau hay chỉ là bản đã đồng bộ tải
   lại. Chỉ so đúng các nhánh được đồng bộ (FB_TOP + data/sigmaData): các field còn lại
   của state là cục bộ thuần (schemaVersion, teaRegistryVersion, _ts/_client...) và
   fbFlushPush() không bao giờ đẩy chúng lên, nên cloud không có. Trước đây hàm này so
   JSON.stringify TOÀN BỘ state nên luôn lệch ít nhất ở schemaVersion -> hộp thoại
   "dữ liệu cục bộ khác dữ liệu trung tâm" bật lên MỖI lần đăng nhập dù hai bên đã
   đồng bộ y hệt. Đừng đổi lại thành so cả state. */
const FB_COMPARE_KEYS=FB_TOP.concat(['data','sigmaData']);
function fbSyncedShape(s){const out={};FB_COMPARE_KEYS.forEach(k=>{const c=fbCanon(s&&s[k]);if(c!==null)out[k]=c;});return out;}
function statesLikelyEqual(a,b){return JSON.stringify(fbSyncedShape(a))===JSON.stringify(fbSyncedShape(b));}
function fbMapJson(o){const out={};Object.keys(o||{}).forEach(id=>out[id]=JSON.stringify(o[id]));return out;}
function fbSnapKeys(s){
  s=s||{};
  const keys={};FB_TOP.forEach(k=>keys[k]=fbJson(s[k]));
  return{keys,data:fbMapJson(s.data),sigma:fbMapJson(s.sigmaData)};
}
/* fb.synced chỉ bị GÁN LẠI chứ không bao giờ mutate tại chỗ (null/remote/fbClone/
   payload/cur), nên snapshot-khóa của baseline được cache theo identity — mỗi lần
   đẩy trước đây stringify lại TOÀN BỘ baseline (hàng chục MB với phòng nhiều điểm
   QC) dù nó không đổi giữa hai lần đồng bộ. */
let fbSyncedSnapRef=null,fbSyncedSnapCache=null;
function fbSyncedSnapKeys(s){
  if(s===fbSyncedSnapRef&&fbSyncedSnapCache)return fbSyncedSnapCache;
  const snap=fbSnapKeys(s);fbSyncedSnapRef=s;fbSyncedSnapCache=snap;return snap;
}
function fbAddChildUpdates(payload,snapBranch,baseBranch,curBranch,path){
  Object.keys(snapBranch).forEach(id=>{if(snapBranch[id]!==baseBranch[id])payload[path+'/'+id]=curBranch[id];});
  Object.keys(baseBranch).forEach(id=>{if(!(id in snapBranch))payload[path+'/'+id]=null;});
}
/* So sánh state hiện tại với baseline thô (fb.synced) để chỉ đẩy đúng các nhánh đã
   thay đổi. Việc đẩy lên cloud vẫn theo cấp xét nghiệm (data/{testId} nguyên khối) —
   chỉ phần TRỘN khi nhận dữ liệu về (fbMerge) mới đi sâu tới từng điểm. */
function fbBuildUpdate(cur){
  const snap=fbSnapKeys(cur),base=fbSyncedSnapKeys(fb.synced),payload={};
  FB_TOP.forEach(k=>{if(snap.keys[k]!==base.keys[k])payload[k]=cur[k]===undefined?null:cur[k];});
  fbAddChildUpdates(payload,snap.data,base.data,cur.data||{},'data');
  fbAddChildUpdates(payload,snap.sigma,base.sigma,cur.sigmaData||{},'sigmaData');
  return{payload};
}
function fbHasLocalChanges(){return Object.keys(fbBuildUpdate(state).payload).length>0;}
/* Khóa nhận dạng một phần tử (điểm QC/kỳ Sigma, hoặc phần tử của một nhánh FB_LIST_KEYS
   như instruments/qcPanels/actions...) khi merge: dùng id nếu có; phần tử không có id
   (mảng chuỗi như machines/reagentOperators, hoặc bản ghi cũ/hỏng hiếm khi thiếu id) thì
   tự tạo khóa theo nội dung để không bị gộp nhầm vào nhau — với các phần tử này, SỬA
   được xem như xóa-cũ-thêm-mới (khóa nội dung đổi theo), không phải "sửa tại chỗ". */
function fbPointKey(p){return p&&p.id!=null?'#'+String(p.id):'~'+JSON.stringify(p);}
/* Trộn 3 chiều một mảng (data/{testId}, sigmaData/{testId}, hoặc bất kỳ nhánh nào trong
   FB_LIST_KEYS) theo TỪNG PHẦN TỬ, không theo toàn bộ mảng: hai máy cùng sửa một nhánh
   nhưng KHÁC phần tử nhau (thêm phần tử mới, sửa phần tử khác) sẽ giữ lại cả hai bên
   thay vì một bên ghi đè toàn bộ bên kia. Quy ước xung đột: nếu CÙNG một phần tử (cùng
   id) bị đổi khác nhau ở cả hai bên, bên cục bộ (local) thắng — nhất quán với cách các
   nhánh "cả khối" còn lại xử lý xung đột (xem fbMerge). Với data/{testId}: điểm bị hủy
   (voided) vẫn chỉ là một điểm bị SỬA (không bị xóa khỏi mảng) nên được xử lý như mọi
   thay đổi khác, không cần logic riêng; normalizePointLots() chỉ xử lý runId trùng do
   merge offline, không đánh lại runId lịch sử chỉ vì một điểm bị hủy. */
function mergePointArray(localArr,remoteArr,baseArr,opts){
  // Chế độ xóa (opts.deletes — bật cho các nhánh FB_LIST_KEYS): phần tử có trong base
  // nhưng biến mất ở một bên là BỊ XÓA THẬT (nút Xóa trong danh mục máy/panel/lô/người
  // dùng...) và phải lan sang máy khác — nếu không, máy khác đang giữ bản cũ sẽ "hồi
  // sinh" mục vừa xóa ở lần đồng bộ kế tiếp. Ngoại lệ: bên còn lại đã SỬA phần tử đó so
  // với base thì bản sửa thắng lệnh xóa (không mất thay đổi thật).
  // data/{testId}/sigmaData KHÔNG bật chế độ này: một điểm QC vắng mặt trong mảng không
  // phải tín hiệu xóa tin cậy (autosave ghi nguyên mảng, máy chưa cập nhật có thể thiếu
  // điểm máy khác vừa thêm) — hủy điểm QC thật được biểu diễn bằng field `voided`;
  // xóa nguyên nhánh data/{testId} xử lý ở fbMerge().
  const respectDeletes=!!(opts&&opts.deletes);
  const lMap=new Map(),rMap=new Map(),bMap=new Map();
  (localArr||[]).forEach(p=>lMap.set(fbPointKey(p),p));
  (remoteArr||[]).forEach(p=>rMap.set(fbPointKey(p),p));
  (baseArr||[]).forEach(p=>bMap.set(fbPointKey(p),p));
  const ser=(m,k)=>m.has(k)?JSON.stringify(m.get(k)):null;
  const order=[],seen=new Set();
  (remoteArr||[]).forEach(p=>{const k=fbPointKey(p);if(!seen.has(k)){seen.add(k);order.push(k);}});
  (localArr||[]).forEach(p=>{const k=fbPointKey(p);if(!seen.has(k)){seen.add(k);order.push(k);}});
  const out=[];
  order.forEach(k=>{
    const bS=ser(bMap,k),lS=ser(lMap,k),rS=ser(rMap,k);
    if(respectDeletes&&bS!=null){
      if(lS==null)return;          // máy này đã xóa -> quyết định xóa thắng (quy ước cục bộ thắng)
      if(rS==null&&lS===bS)return; // máy khác xóa, máy này không sửa -> chấp nhận xóa
    }
    const winner=lS!=null&&lS!==bS?lMap.get(k):(rS!=null&&rS!==bS?rMap.get(k):(rMap.get(k)||lMap.get(k)));
    if(winner)out.push(fbClone(winner));
  });
  return out;
}
/* Trộn một nhánh dạng { [testId]: điểm[] } (data hoặc sigmaData) theo từng xét nghiệm rồi
   theo từng điểm bên trong (mergePointArray). data và sigmaData merge giống hệt nhau, chỉ
   khác tên khóa, nên dùng chung một hàm thay vì lặp lại hai lần trong fbMerge(). */
function fbMergeDataBranch(local,remote,base,key){
  const localBranch=local[key]||{},remoteBranch=remote[key]||{},baseBranch=(base&&base[key])||{};
  const out={};
  new Set([...Object.keys(localBranch),...Object.keys(remoteBranch),...Object.keys(baseBranch)]).forEach(id=>{
    if(id in baseBranch&&!(id in localBranch))return;
    const merged=mergePointArray(localBranch[id],remoteBranch[id],baseBranch[id]);
    if(merged.length)out[id]=merged;
  });
  return out;
}
/* Trộn dữ liệu từ xa vào cục bộ: các nhánh trong FB_LIST_KEYS (kể cả data/{testId} và
   sigmaData/{testId} bên dưới) trộn theo từng phần tử (mergePointArray) -> hai máy thêm/
   sửa các phần tử KHÁC nhau trong cùng một danh sách không còn xóa mất dữ liệu của nhau.
   Các nhánh còn lại ('lab', 'westgardRules', 'configMigrationVersion' — object đơn/dict/
   số, không phải danh sách) vẫn trộn theo kiểu "cả khối": bên nào đổi so với base thì
   lấy nguyên bên đó. */
function fbMerge(local,remote,base){
  const out=fbClone(remote),lSnap=fbSnapKeys(local),bk=fbSnapKeys(base).keys;
  FB_TOP.forEach(k=>{
    if(FB_LIST_SET.has(k)){out[k]=mergePointArray(local[k],remote[k],(base||{})[k],{deletes:true});}
    else if(lSnap.keys[k]!==bk[k]){out[k]=fbCloudValue(local[k]);}
  });
  out.data=fbMergeDataBranch(local,remote,base,'data');
  out.sigmaData=fbMergeDataBranch(local,remote,base,'sigmaData');
  return out;
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
  const out=fbMerge(local,remote,null);
  FB_TOP.forEach(k=>{if(!FB_LIST_SET.has(k))out[k]=fbCloudValue(remote[k]);});
  const seenUsers=new Set();
  out.users=(out.users||[]).filter(u=>{const k=String(u&&u.username||'').toLowerCase();if(!k)return true;if(seenUsers.has(k))return false;seenUsers.add(k);return true;});
  return out;
}
let saveLabel='Cục bộ',saveDetail='';
function getDeployFbCfg(){
  const c=window.QCLAB_CLOUD;
  if(c&&c.config)return{labCode:c.labCode||'khoaXN',email:c.email||(c.anonymous?'anonymous':''),anonymous:c.anonymous!==false,config:c.config,deploy:true,locked:c.locked===true};
  return null;
}
function getStoredFbCfg(){try{const c=JSON.parse(localStorage.getItem('qclab_fb')||'null');if(!c||typeof c!=='object')return null;return{...c,anonymous:c.anonymous===true};}catch(e){return null;}}
function getFbCfg(){const deploy=getDeployFbCfg(),stored=getStoredFbCfg();if(deploy&&deploy.locked)return deploy;return stored||deploy;}
function fbConfigSig(cfg){const keys=['apiKey','authDomain','databaseURL','projectId','appId'];return JSON.stringify(Object.fromEntries(keys.map(k=>[k,String(cfg&&cfg[k]||'')])));}
async function ensureFirebaseApp(cfg){
  if(typeof firebase==='undefined'||typeof firebase.initializeApp!=='function')throw new Error('Chưa tải được Firebase.');
  const desired=fbConfigSig(cfg),apps=firebase.apps||[];
  if(apps.length){
    const app=typeof firebase.app==='function'?firebase.app():apps[0],current=fbConfigSig(app&&app.options||{});
    if(current===desired)return app;
    await Promise.all(apps.slice().map(x=>x&&typeof x.delete==='function'?x.delete():Promise.resolve()));
  }
  return firebase.initializeApp(cfg);
}
function setCloudStatus(t,on){
  const el=document.getElementById('cloudStatus');if(!el)return;
  const safe=String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  el.className='cloud '+(on?'connected':'offline');
  el.innerHTML=on?`<b>Đang kết nối</b><small>${safe}</small>`:safe;
}
function saveTime(){return new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});}
function updateSaveStatus(){
  const el=document.getElementById('saveStatus');if(el)el.innerHTML=`Lưu trữ: <b>${saveLabel}</b>${saveDetail?`<br>${saveDetail}`:''}`;
}
function markSaved(label,detail){saveLabel=label;saveDetail=detail||'';updateSaveStatus();}
function fbDataPath(){
  const cfg=getFbCfg()||{};
  return 'qclab-shared/'+((cfg.labCode||'default').replace(/[.#$/\[\]]/g,'_'));
}
function fbStatusLabel(){
  const cfg=getFbCfg()||{},u=fb.authUser||{};
  return (u.email||(u.isAnonymous?'ẩn danh':'đã xác thực'))+' · '+(cfg.labCode||'default')+' · '+fbDataPath();
}
function fbSnapshotSig(v){
  if(!v)return'empty';
  const s=JSON.stringify(v);let h=0;
  for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return s.length+':'+h.toString(36);
}
function fbStopPull(){if(fb.pullT)clearInterval(fb.pullT);fb.pullT=null;}
function fbStartPull(){fbStopPull();fb.pullT=setInterval(fbPullOnce,8000);}
/* Điểm dừng chung mỗi khi ngắt/đổi kết nối Firebase (hủy đồng bộ, đổi phòng, mất xác
   thực, lỗi đọc...): dừng poll, gỡ listener cũ, và reset toàn bộ cờ vòng đời để lần
   kết nối sau (nếu có) bắt đầu từ trạng thái sạch, không kế thừa fb.ref/fb.initialized
   còn sót lại từ phiên trước. */
function fbDisconnect(clearAuthUser){
  fbStopPull();
  if(fbSaveT){clearTimeout(fbSaveT);fbSaveT=null;}
  fbResetRetry();
  if(fb.ref)fb.ref.off();
  fb.ready=false;fb.initialized=false;fb.ref=null;fb.synced=null;fb.seenSig=null;
  if(clearAuthUser)fb.authUser=null;
}
async function fbPullOnce(){
  if(!(fb.ref&&fb.authUser))return;
  try{const snap=await fb.ref.once('value');fbHandleValue(snap.val(),{silent:true});}
  catch(e){}
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
  if(sig&&sig===fb.seenSig)return;
  fb.seenSig=sig;
  if(!v){
    const firstSnapshot=!fb.initialized;
    fbSetReady();fb.synced=null;
    setCloudStatus(fbStatusLabel(),true);
    // Phòng trống mà máy này đang có dữ liệu (lần kết nối đầu): đẩy toàn bộ lên làm bản
    // gốc cho phòng ngay — trước đây dữ liệu cục bộ "nằm im" chờ tới lần sửa kế tiếp
    // (fb.dirty) mới được đẩy, máy khác kết nối vào thấy phòng trống, tưởng không đồng bộ.
    if(fb.dirty||(firstSnapshot&&hasLocalQcContent(state)))scheduleFbPush();
    else if(!opts.silent)markSaved('đám mây','Sẵn sàng đồng bộ · '+fbDataPath());
    return;
  }
  const cloudErrors=QCCore.validateBackup(v);
  if(cloudErrors.length){
    // Dữ liệu cloud hỏng không được chặn máy này tiếp tục đồng bộ mãi mãi — vẫn coi
    // như đã "khởi tạo" để các lần lưu sau còn được đẩy lên (có thể tự sửa dữ liệu hỏng).
    fbSetReady();
    markSaved('dữ liệu đám mây không hợp lệ',cloudErrors[0]+' · '+fbDataPath());
    return;
  }
  const remote=QCCore.sanitizeBackup(v),base=fb.synced;
  // Bỏ qua chính bản ghi do máy này vừa đẩy lên (chống tự dội: mất focus/nháy màn hình),
  // nhưng vẫn đánh dấu snapshot đầu tiên đã tải để các lần lưu sau mới được push.
  if(v._client&&v._client===fb.clientId){
    fbSetReady();fb.synced=remote;fb.dirty=false;fbResetRetry();
    setCloudStatus(fbStatusLabel(),true);if(!opts.silent)markSaved('đã đồng bộ','Lúc '+saveTime());
    return;
  }
  const hadLocalChanges=fb.dirty;
  let mergeFirstConnect=hadLocalChanges;
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
  if(!base&&!hadLocalChanges&&hasLocalQcContent(state)&&!statesLikelyEqual(state,remote)){
    // Một hộp thoại xung đột tại một thời điểm: nếu snapshot mới tới trong lúc
    // hộp thoại trước đang chờ người dùng trả lời thì bỏ qua, không mở chồng.
    if(fbConflictDialogOpen)return;
    fbConflictDialogOpen=true;
    const proceed=await confirmDialog({
      kicker:'Thao tác không thể hoàn tác',
      title:'Dữ liệu cục bộ khác dữ liệu trung tâm',
      message:`Phòng "${(getFbCfg()||{}).labCode||'default'}" đã có một bộ dữ liệu khác trên đám mây.`,
      detail:'Dùng dữ liệu trung tâm sẽ thay thế dữ liệu trên máy này; các mục chỉ có cục bộ (máy XN, panel, lô, điểm QC...) sẽ không được giữ lại. Chọn Giữ dữ liệu cục bộ để ngắt đồng bộ và bảo vệ dữ liệu trên máy này.',
      confirmLabel:'Dùng dữ liệu trung tâm',
      cancelLabel:'Giữ dữ liệu cục bộ',
      danger:true
    });
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
  // Lần nhận đầu tiên: nếu đang có thay đổi mới chờ đẩy (chưa qua hộp thoại xung
  // đột ở trên, vd sửa gõ dở khi snapshot đầu tiên tới) thì gộp hai bên để không
  // mất thao tác vừa làm; nếu local rỗng/giống cloud, hoặc người dùng vừa xác
  // nhận thay thế bằng trung tâm ở trên, thì lấy nguyên cloud làm gốc.
  // Các lần sau: trộn 3 chiều theo từng phần tử với base = bản đồng bộ gần nhất.
  const previousState=state;
  state=base?fbMerge(state,remote,base):(mergeFirstConnect?fbFirstConnectMerge(state,remote):remote);
  /* mergePointArray() (fbMerge/fbFirstConnectMerge) ghép activity theo từng phần tử,
     không theo đúng thứ tự chuỗi hash logic của từng máy — hai dòng liền kề trong
     chuỗi hash gốc của MỘT máy có thể bị chen dòng của máy kia vào giữa sau khi
     ghép. Nối lại chuỗi hash theo đúng thứ tự mảng SAU khi ghép để auditVerifyChain()
     không báo "bị sửa" sai chỉ vì thứ tự đổi — xem auditRelinkChain() ở audit.js. */
  if(typeof auditRelinkChain==='function'&&Array.isArray(state.activity))state.activity=auditRelinkChain(state.activity);
  clearDerived();
  ensureShape();
  const invariantErrors=QCCore.validateStateInvariants(state);
  /* Rollback khi state sau merge không qua được invariant: khôi phục cả cờ dirty
     theo trạng thái trước merge — nếu không, các thay đổi cục bộ đang chờ đẩy
     (fb.dirty đã bị xóa phía trên) bị bỏ rơi, không bao giờ được đẩy lại tới
     tận khi có thao tác lưu mới. */
  if(invariantErrors.length){state=previousState;clearDerived();fb.dirty=hadLocalChanges;fbSetReady();markSaved('dữ liệu đồng bộ không hợp lệ',invariantErrors[0]);return;}
  mem=state;
  fb.synced=fbClone(remote); // cloud hiện đang là 'remote' (giữ nguyên state để lần trộn sau so khớp theo điểm)
  fbStoreLocal();
  if(typeof currentUser!=='undefined'&&currentUser){
    const u=(state.users||[]).find(x=>x.id===currentUser.id)||(state.users||[]).find(x=>x.username===currentUser.username);
    if(u)currentUser=u;
  }
  if(!state.users.length)ensureAdmin();try{renderBrand();}catch(e){}
  fbSetReady();setCloudStatus(fbStatusLabel(),true);
  applyRemoteRender();
  // Nếu vừa giữ lại thay đổi cục bộ (nhánh máy này sửa mà cloud chưa có), đẩy lên để hội tụ.
  if(mergeFirstConnect&&fbHasLocalChanges())scheduleFbPush();
}
async function initFirebase(){
  const cfg=getFbCfg();
  if(!cfg||!cfg.config){setCloudStatus('Đang chạy cục bộ',false);return;}
  if(typeof firebase==='undefined'||typeof firebase.auth!=='function'){setCloudStatus('Thiếu Firebase Authentication',false);return;}
  try{
    await ensureFirebaseApp(cfg.config);
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    let authUser=await new Promise(resolve=>{let off=null;off=firebase.auth().onAuthStateChanged(user=>{if(off)off();resolve(user||null);},()=>resolve(null));});
    if(!authUser&&cfg.anonymous&&typeof firebase.auth().signInAnonymously==='function'){
      const cred=await firebase.auth().signInAnonymously();
      authUser=cred&&cred.user||firebase.auth().currentUser||null;
    }
    if(!authUser){fbDisconnect(true);setCloudStatus('Cần đăng nhập Firebase',false);markSaved('cục bộ','Firebase chưa xác thực');return;}
    fb.authUser=authUser;
    const code=(cfg.labCode||'default').replace(/[.#$/\[\]]/g,'_');
    fbDisconnect();
    fb.ref=firebase.database().ref('qclab-shared/'+code);
    fb.ref.on('value',snap=>{
      fbHandleValue(snap.val());
    },err=>{
      // Ngắt hẳn (gỡ fb.ref) thay vì chỉ dừng poll: nếu không, các listener
      // focus/visibilitychange (đăng ký một lần, không gỡ được) sẽ âm thầm gọi lại
      // fb.ref.once('value') vô thời hạn trên một ref đã biết là lỗi.
      fbDisconnect();
      setCloudStatus(err&&err.message&&err.message.indexOf('permission_denied')>=0?'Chưa được cấp quyền Firebase':'Lỗi đọc Firebase',false);
      markSaved('lỗi kết nối',err&&err.message?err.message:'Firebase');
    });
    fbStartPull();
    setCloudStatus('Đang tải dữ liệu Firebase · '+fbDataPath(),true);markSaved('đang tải dữ liệu','Firebase');
  }catch(e){fbDisconnect();setCloudStatus('Lỗi xác thực/kết nối Firebase',false);markSaved('lỗi kết nối',e&&e.message?e.message:'Firebase');}
}
/* Không vẽ lại toàn trang khi người dùng đang thao tác dở (đang mở modal hoặc đang gõ trong ô nhập),
   để dữ liệu đồng bộ từ máy khác không xóa mất nội dung đang nhập. Hoãn lại rồi tự áp dụng sau. */
function remoteRenderUnsafe(){
  const mr=document.getElementById('modalRoot');
  if(mr&&mr.children&&mr.children.length)return true;
  const a=document.activeElement,main=document.getElementById('main');
  if(a&&main&&main.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return true;
  return false;
}
function applyRemoteRender(){
  if(typeof currentUser==='undefined'||!currentUser){markSaved('đã nhận đồng bộ','Lúc '+saveTime());if(typeof focusLoginField==='function'){try{focusLoginField();}catch(e){}}return;}
  if(remoteRenderUnsafe()){
    markSaved('có dữ liệu mới','Sẽ hiển thị khi bạn xong thao tác');
    clearTimeout(fb.pendingRenderT);fb.pendingRenderT=setTimeout(applyRemoteRender,1500);
    return;
  }
  clearTimeout(fb.pendingRenderT);
  markSaved('đã nhận đồng bộ','Lúc '+saveTime());
  rerender();
}
/* Đẩy TOÀN BỘ khi thiết lập lần đầu: nếu cloud chưa có dữ liệu,
   tạo bản cloud từ dữ liệu hiện tại của máy này. */
async function syncNow(){
  if(!fbCanWrite())return false;
  mem=state;state._ts=Date.now();state._client=fb.clientId;markSaved('đang đồng bộ','Firebase');
  const payload=fbClone(state),draftStamp=typeof sigmaDraftStamp==='function'?sigmaDraftStamp():0;
  try{
    await fb.ref.set(payload);
    fb.synced=payload;fb.dirty=false;markSaved('đã đồng bộ','Lúc '+saveTime());
    if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(draftStamp);
    fbStoreLocal();
    return true;
  }catch(e){markSaved('lỗi đồng bộ','Dữ liệu cục bộ vẫn còn');throw e;}
}
/* Đẩy NỀN theo từng nhánh (dùng cho mọi lần lưu tự động): chỉ gửi nhánh đã đổi
   -> nhẹ hơn (không kéo lại logo/toàn bộ nhật ký) và không đè nhánh máy khác đang sửa. */
function scheduleFbPush(){
  if(!fbCanWrite())return;
  if(!fbNetworkOnline()){markSaved('cục bộ','Mạng ngoại tuyến · sẽ tự đồng bộ khi có mạng');return;}
  fbResetRetry();
  clearTimeout(fbSaveT);markSaved('chờ đồng bộ','Firebase');
  fbSaveT=setTimeout(fbFlushPush,500);
}
async function fbFlushPush(){
  fbSaveT=null;
  if(!fbCanWrite()||!fbNetworkOnline())return;
  state._ts=Date.now();state._client=fb.clientId;
  const cur=fbClone(state),{payload}=fbBuildUpdate(cur),draftStamp=typeof sigmaDraftStamp==='function'?sigmaDraftStamp():0;
  if(!Object.keys(payload).length){fb.dirty=false;fbResetRetry();if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(draftStamp);markSaved('đã đồng bộ','Lúc '+saveTime());return;}
  payload._ts=cur._ts;payload._client=cur._client;markSaved('đang đồng bộ','Firebase');
  try{
    await fb.ref.update(payload);
    fb.synced=cur;fb.dirty=false;fbResetRetry();markSaved('đã đồng bộ','Lúc '+saveTime());
    if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(draftStamp);
    fbStoreLocal();
  /* Đánh dấu lại dirty khi đẩy lỗi: có đường vào fbFlushPush với fb.dirty=false
     (seed phòng trống lần đầu kết nối, đẩy hội tụ sau merge) — nếu không set lại,
     fbScheduleRetry thoát ngay ở !fb.dirty và lần đẩy đó không bao giờ được thử
     lại tới tận khi người dùng có thao tác lưu mới. */
  }catch(e){fb.dirty=true;markSaved('lỗi đồng bộ','Dữ liệu cục bộ vẫn còn · sẽ tự thử lại');fbScheduleRetry();}
}

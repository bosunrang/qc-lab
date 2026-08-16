/* ===== STATS / WESTGARD ===== */
function stats(vals){return QCCore.stats(vals);}
/* Thống kê in báo cáo cho một dải điểm QC (mean thực/SD/CV + Bias%/TE%/Sigma so
   với Mean mục tiêu và TEa) — dùng chung cho lô hiện hành lẫn lô cũ trong
   reports.js/data-io.js để công thức chỉ cần sửa một chỗ. */
function reportLevelStats(pts,mean,teaVal){return globalThis.reportLevelStatsService(pts,mean,teaVal);}
function wgOn(rule){return globalThis.westgardRuleSettings?globalThis.westgardRuleSettings.enabled(rule):QCCore.ruleEnabled(state.westgardRules,rule);}
function wgSet(rule,on){if(globalThis.westgardRuleSettings)return globalThis.westgardRuleSettings.set(rule,on);if(!requireWrite())return;state.westgardRules=state.westgardRules||{...WG_DEFAULT};state.westgardRules[rule]=!!on;save();rerender();}
function wgReset(){if(globalThis.westgardRuleSettings)return globalThis.westgardRuleSettings.reset();if(!requireWrite())return;state.westgardRules={...WG_DEFAULT};save();rerender();}
/* Bảng hành động + phạm vi nằm ở core.js (NGUỒN DUY NHẤT, dùng chung với
   workers/westgard-worker.js — xem chú thích ở đó). Ở đây chỉ nối state vào:
   bật/tắt toàn cục, ghi đè theo từng xét nghiệm và số mức đang vận hành. */
function testLevelCount(t){return globalThis.westgardRulePolicy?globalThis.westgardRulePolicy.levelCount(t):operationalLevels(t).length||(t&&t.levels||[]).length;}
function defaultRuleAction(rule){return QCCore.defaultRuleAction(rule,wgOn(rule));}
function testRuleAction(t,rule){return globalThis.westgardRulePolicy?globalThis.westgardRulePolicy.action(t,rule):QCCore.resolveRuleAction(rule,wgOn(rule),t&&t.ruleActions&&t.ruleActions[rule]);}
/* Alias cũ dùng cho các báo cáo một mức; mặc định phải tôn trọng phạm vi within. */
function testRuleOn(t,rule){return testRuleOnWithin(t,rule);}
function defaultRuleScope(t,rule){return QCCore.defaultRuleScope(rule,testLevelCount(t));}
function testRuleScope(t,rule){return globalThis.westgardRulePolicy?globalThis.westgardRulePolicy.scope(t,rule):QCCore.resolveRuleScope(rule,testLevelCount(t),t&&t.ruleScopes&&t.ruleScopes[rule]);}
function testRuleOnIn(t,rule,channel){return globalThis.westgardRulePolicy?globalThis.westgardRulePolicy.onIn(t,rule,channel):QCCore.ruleOnInScope(rule,testLevelCount(t),t&&t.ruleScopes&&t.ruleScopes[rule],testRuleAction(t,rule),channel);}
function testRuleOnWithin(t,rule){return testRuleOnIn(t,rule,'within');}
function testRuleOnAcross(t,rule){return testRuleOnIn(t,rule,'across');}
function testRuleSet(t,channel){return globalThis.westgardRulePolicy?globalThis.westgardRulePolicy.set(t,channel):new Set(WG_RULES.filter(rule=>testRuleOnIn(t,rule,channel)));}
function ruleResultLevel(t,rules){return globalThis.westgardRulePolicy?globalThis.westgardRulePolicy.verdict(t,rules):QCCore.ruleVerdictLevel(rules,r=>testRuleAction(t,r));}
function westgard(points,mean,sd){return QCCore.westgard(points,mean,sd,wgOn);}
function westgardMulti(levelSets){return QCCore.westgardMulti(levelSets,wgOn);}
function westgardByPoint(points,mean,sd){return QCCore.westgardByPoint(points,mean,sd,wgOn);}
function westgardMultiByPoint(levelSets){return QCCore.westgardMultiByPoint(levelSets,wgOn);}
/* Phân loại sai số nằm ở core.js (thuần, test được); ở đây chỉ re-export để giữ
   nguyên tên global cho phần UI/route đang gọi. */
const WG_RULE_DESCRIPTIONS=QCCore.WG_RULE_DESCRIPTIONS;
function primaryErrorRule(rules){return QCCore.primaryErrorRule(rules);}
function errorType(rules){return QCCore.errorType(rules);}
function fixHint(rules){return QCCore.fixHint(rules);}
function errorTypeDetailParts(rules){return globalThis.qcErrorDetail(rules);}

/* ===== WESTGARD BACKGROUND WORKER ===== */
let wgWorker=null,wgWorkerGeneration=0,wgWorkerRevisions=new Map(),wgWorkerPending=new Map(),wgWorkerFailed=false,wgWorkerRenderT=null;
const WG_WORKER_POINT_THRESHOLD=3000;
function westgardWorkerRevision(testId){return globalThis.westgardWorkerRevisionService.revision(wgWorkerRevisions,testId);}
function invalidateWestgardWorker(testId){
  if(testId){globalThis.westgardWorkerRevisionService.invalidateTest(wgWorkerRevisions,wgWorkerPending,testId);return;}
  wgWorkerGeneration=globalThis.westgardWorkerRevisionService.invalidateAll(wgWorkerRevisions,wgWorkerPending,wgWorkerGeneration);clearTimeout(wgWorkerRenderT);wgWorkerRenderT=null;
  if(wgWorker){try{wgWorker.terminate();}catch(e){}wgWorker=null;}
}
function westgardWorkerWorthwhile(tests){
  return globalThis.westgardWorkerPrewarmPlanner.worthwhile(typeof Worker==='function',wgWorkerFailed,tests,t=>(state.data[t.id]||[]).length);
}
function westgardWorkerJob(t,generation,revision=westgardWorkerRevision(t&&t.id)){
  return globalThis.westgardWorkerJobBuilder(t,generation,revision);
}
function hydrateWestgardWorkerResult(message){
  if(!message||message.generation!==wgWorkerGeneration||(message.revision||0)!==westgardWorkerRevision(message.testId))return false;
  return globalThis.westgardWorkerHydrate(message,{test:id=>(state.tests||[]).find(test=>test.id===id),levels:test=>operationalLevels(test),points:(test,level)=>operationalLotPoints(test,level),verdict:(test,rules)=>ruleResultLevel(test,rules),setMemo:(id,value)=>wgMemo.set(id,value)});
}
function westgardWorkerReadyToRender(){return operationalTests().every(t=>wgMemo.has(t.id));}
function westgardWorkerMessage(event){
  const message=event&&event.data;if(!message||message.generation!==wgWorkerGeneration)return;
  const revision=message.revision||0;if(revision!==westgardWorkerRevision(message.testId))return;
  globalThis.westgardWorkerRevisionService.settle(wgWorkerPending,message.testId,revision);
  if(message.type==='result')hydrateWestgardWorkerResult(message);
  else if(message.type==='error')wgWorkerFailed=true;
  if(typeof page!=='undefined'&&page==='dash'&&(wgWorkerFailed||westgardWorkerReadyToRender())){
    clearTimeout(wgWorkerRenderT);wgWorkerRenderT=setTimeout(()=>{wgWorkerRenderT=null;rerender();},0);
  }
}
function ensureWestgardWorker(){
  if(wgWorker)return wgWorker;if(typeof Worker!=='function'||wgWorkerFailed)return null;
  try{
    wgWorker=new Worker('assets/workers/westgard-worker.js?v=rule-table-single-source-20260801-1');
    wgWorker.onmessage=westgardWorkerMessage;
    wgWorker.onerror=()=>{wgWorkerFailed=true;wgWorkerPending.clear();if(wgWorker){try{wgWorker.terminate();}catch(e){}wgWorker=null;}if(typeof page!=='undefined'&&page==='dash')setTimeout(()=>rerender(),0);};
    return wgWorker;
  }catch(e){wgWorkerFailed=true;wgWorker=null;return null;}
}
function scheduleWestgardPrewarm(tests){
  const missing=globalThis.westgardWorkerPrewarmPlanner.missing(tests,wgMemo);
  if(!missing.length||!westgardWorkerWorthwhile(missing))return false;
  const worker=ensureWestgardWorker();if(!worker)return false;
  const generation=wgWorkerGeneration;
  missing.forEach(t=>{const revision=westgardWorkerRevision(t.id);if(!globalThis.westgardWorkerRevisionService.markPending(wgWorkerPending,t.id,revision))return;worker.postMessage(westgardWorkerJob(t,generation,revision));});
  return true;
}

/* ===== HELPERS ===== */
function normalizePointLots(){return globalThis.qcNormalizePointLots(state);}
/* runId là dấu vết của lần chạy và không được đổi chỉ vì một điểm bị hủy.
   Chỉ xử lý trường hợp trùng runId do hai máy offline cùng tạo điểm, để bảng nhập
   vẫn nhóm đúng các mức trong cùng lần chạy sau khi merge Firebase. */
function normalizeDuplicateRunIds(){return globalThis.qcNormalizeDuplicateRunIds(state);}
/* Chữ ký TỰ KIỂM CHỨNG cho derivedIndex — cùng kỹ thuật đã dùng cho cache của
   action-workflow-service.js: so THAM CHIẾU + ĐỘ DÀI của đúng những lát state mà
   derived() đọc tới, cộng các trường vô hướng nó lọc theo (active/status/toLotId…).
   Trước 2026-08-01 derived() chỉ là memo thuần (`if(derivedIndex)return derivedIndex`),
   nên nó đúng CHỈ KHI mọi đường ghi cấu hình đều nhớ gọi clearDerived(). Quên một
   chỗ thì màn hình hiện panel/nhóm lô/mức vận hành cũ mà KHÔNG có gì báo — lớp lỗi
   không thể tự phát hiện. Chữ ký chỉ so tham chiếu và số, KHÔNG dựng chuỗi và
   KHÔNG duyệt state.data, để đường warm vẫn rẻ; ngân sách warmDomainMaxColdRatio
   trong performance-budget.json canh đúng chỗ này.
   MỘT hàm duy nhất lo cả dựng lẫn đối chiếu (`prev=null` là dựng), để hai chiều
   không thể lệch thứ tự duyệt. Đường warm — cấu hình không đổi, chạy vài nghìn
   lần mỗi lần vẽ — KHÔNG cấp phát mảng: nó so tại chỗ theo con trỏ và dừng ngay
   ở phần tử lệch đầu tiên. Dựng mảng ở đường warm từng làm derived() chậm 29 lần
   (2,7 µs so với 0,095 µs mỗi lần gọi, đo ở cỡ 50 xét nghiệm × 3 mức). */
function derived(){return globalThis.qcDerivedIndex(state);}
function pointsOf(testId,level){return globalThis.qcPointCache.points(testId,level);}
function pointsWithIndex(testId,level){return globalThis.qcPointCache.points(testId,level,true);}
function lvlCfg(t,level){return globalThis.qcLevelConfig(t,level);}
function pointsForLot(testId,level,lot,withIndex=false){return globalThis.qcPointCache.lot(testId,level,lot,withIndex);}
function activeLotPoints(t,level,withIndex=false){const l=lvlCfg(t,level);return l?pointsForLot(t.id,level,l.lot||'',withIndex):[];}
function operationalPanelForTest(t){return t?derived().testPanel.get(t.id):null;}
function operationalTestOrder(t){return t&&derived().testOrder.has(t.id)?derived().testOrder.get(t.id):999999;}
function isOperationalLotGroup(g){return globalThis.qcLotGroupOperational(g);}
function operationalLotGroupForLevel(l){return l&&l.qcLotId?derived().lotGroupByLotId.get(l.qcLotId)||null:null;}
/* Sự thật "nhóm lô này có đang thật sự được xét nghiệm nào dùng không" — tính từ dữ liệu
   (có level nào của test nào đang qcLotId trỏ vào 1 lô của nhóm), KHÔNG dựa vào g.status
   (chỉ là nhãn "Đã dừng"/"Dự kiến" do người dùng/luồng kích hoạt gán). Dùng để hiện đúng
   "Đang hoạt động" ở manageLots() thay vì suy đoán mặc định — tránh 2 nhóm cùng hiện "Đang
   hoạt động" khi một nhóm thực ra không còn xét nghiệm nào dùng nữa. */
function lotGroupInUse(g){return globalThis.qcOperationalAccess.lotGroupInUse(g,state.tests||[]);}
function operationalLotGroupForTest(t){
  if(!t)return null;
  const idx=derived(),cached=idx.groups.get(t.id);
  if(cached!==undefined)return cached;
  const levels=(t.levels||[]).filter(l=>l.qcLotId),groups=levels.map(operationalLotGroupForLevel).filter(Boolean);
  if(groups.length){const g=groups[0],out={key:'grp:'+g.id,name:g.name,lotIds:[...(g.lotIds||[])]};idx.groups.set(t.id,out);return out;}
  idx.groups.set(t.id,null);
  return null;
}
function operationalLevels(t){
  if(!t)return[];
  const idx=derived(),cached=idx.levels.get(t.id);
  if(cached)return cached;
  const levels=(t.levels||[]).filter(l=>l.qcLotId&&operationalLotGroupForLevel(l));
  idx.levels.set(t.id,levels);
  return levels;
}
/* Mức đang vận hành nhưng thiếu Mean/SD hợp lệ: engine Westgard (core) trả "ok"
   cho MỌI điểm khi sd<=0 hoặc mean không hợp lệ (guard ở westgard()) — nếu không
   báo riêng, mức này hiển thị "Đạt" giả trên dashboard/trang Westgard. */
function levelTargetOk(l){return globalThis.qcLevelTargetValid(l);}
function levelsMissingTarget(t){return operationalLevels(t).filter(l=>!levelTargetOk(l));}
function isOperationalTest(t){return!!(t&&t.active!==false&&operationalPanelForTest(t)&&operationalLotGroupForTest(t)&&operationalLevels(t).length);}
function canEnterQcForLevel(t,level){return globalThis.qcOperationalAccess.canEnter(t,level);}
function operationalTests(){
  const idx=derived();
  if(idx.operationalTests)return idx.operationalTests;
  idx.operationalTests=(state.tests||[]).filter(isOperationalTest).sort((a,b)=>operationalTestOrder(a)-operationalTestOrder(b));
  return idx.operationalTests;
}
function operationalLotPoints(t,level,withIndex=false){return globalThis.qcOperationalAccess.lotPoints(t,level,withIndex);}
/* Dòng đời lô: lần theo hồ sơ chuyển tiếp đã chấp nhận (fromLot→toLot)
   để trả về danh sách lô từ CŨ NHẤT → HIỆN HÀNH cho lô đang dùng. */
function lotLineage(currentLotId){
  return globalThis.qcLotLineage(derived(),currentLotId);
}
function lotPointsByNo(testId,level,lotNo){return pointsForLot(testId,level,lotNo||'');}
function lotMeanSdFor(t,level,lotNo){
  const l=lvlCfg(t,level),pts=(state.data[t.id]||[]).filter(p=>+p.level===+level);return globalThis.qcLotMeanSd(l,lotNo,pts);
}
/* Mean/SD/giới hạn đã từng cấu hình cho MỘT LÔ CỤ THỂ (theo qcLotId, không phải
   "lô đang dùng hiện hành" của mức) — tra ở cấu hình hiện hành trước, rồi tới
   meanSdHistory. Dùng ở màn hình "Mean/SD theo nhóm lô QC" để mỗi lô hiển thị
   đúng giá trị của chính nó khi chuyển qua lại giữa các nhóm lô song song, thay
   vì hiện nhầm giá trị của lô đang thực sự gắn với mức (xem applyTargetPick). */
function lotTargetSnapshot(t,level,lotId,lotNo){
  return globalThis.qcLotTargetSnapshot(lvlCfg(t,level),lotId,lotNo);
}
/* ===== CHẠY SONG SONG 2 LÔ (lot-to-lot verification) =====
   Khi hồ sơ chuyển tiếp ở trạng thái 'active', lô mới được chạy song song với lô
   đang dùng để thu thập dữ liệu riêng trước khi quyết định chấp nhận.
   Ranh giới cố ý: lô ĐANG DÙNG vẫn là lô duy nhất quyết định nhận/loại kết quả
   bệnh nhân (activeWestgard không hề đọc lô song song); lô song song chỉ được
   đánh giá riêng cho chính nó. Trả null nếu lô mới chưa có Mean/SD riêng —
   không bao giờ mượn Mean/SD của lô cũ (xem applyAcceptedLotTransitionToConfig). */
function parallelLotForLevel(t,level){
  return globalThis.qcParallelLotLookup(t,level);
}
/* Cột nhập QC = cặp (mức, lô). Bình thường mỗi mức đúng 1 cột; mức nào đang có
   lô chạy song song thì có thêm cột thứ hai cho lô mới. `key` là định danh cột
   dùng xuyên suốt bảng nhập (thay cho `level` trước đây, vốn giả định 1 lô/mức). */
function entryColumns(t){
  return globalThis.qcEntryColumns(t);
}
function entryColumnPoints(t,col,withIndex=false){
  if(!t||!col)return[];
  return globalThis.qcEntryColumnPoints(col,()=>operationalLotPoints(t,col.level,withIndex),()=>pointsForLot(t.id,col.level,col.lot||'',withIndex));
}
/* Westgard cho lô chạy song song: chỉ xét trong nội bộ lô đó (luật within-run),
   không ghép chuỗi với lô đang dùng và không chạy luật chéo mức — lô đang đánh
   giá không được làm đổi kết luận của lô đang vận hành, và ngược lại. */
function parallelWestgard(t,col){
  const pts=entryColumnPoints(t,col,true);return globalThis.qcParallelWestgard(pts,col,rule=>testRuleOnWithin(t,rule),rules=>ruleResultLevel(t,rules));
}
/* Kết luận Westgard của MỘT điểm bất kỳ, dùng khi hủy điểm (confirmVoidQcPoint) cần
   ghi đúng rule/qcVerdict lên hồ sơ NCE. Điểm thuộc lô đang chạy song song không nằm
   trong activeWestgard() (chỉ phủ lô đang vận hành) nên phải tra bảng riêng của lô đó
   qua parallelWestgard(), dùng lại Mean/SD đã chụp lúc nhập (p.qcMean/p.qcSd) — thiếu
   nhánh này thì hủy một điểm vi phạm ở lô song song sẽ ghi "Không có luật Westgard". */
function pointVoidVerdict(t,p){
  return globalThis.qcPointVoidVerdict(t,p);
}
/* Mean/SD đã lưu "Dự kiến" (chưa áp dụng) cho một lô cụ thể chưa phải lô đang
   gắn với mức — xem applyPlannedTarget()/saveTargetMatrix() trong manage-tests-actions.js. */
function plannedTargetFor(t,lot){
  return globalThis.qcPlannedTarget(lvlCfg(t,lot.level),lot);
}
/* Các lô cũ (đã chuyển tiếp) của một mức, kèm điểm QC — chỉ đọc, giữ tách theo lô. */
function previousLotSeries(t,level){
  const l=lvlCfg(t,level);if(!l)return[];
  return globalThis.qcPreviousLotHistory(l,lotLineage(l.qcLotId),no=>lotMeanSdFor(t,level,no),no=>lotPointsByNo(t.id,level,no));
}
/* Mọi mức QC (của mọi xét nghiệm) từng dùng một lô thuộc "nhóm lô" cho trước —
   kể cả nhóm đã lưu trữ (ngừng dùng). Khác với previousLotSeries (đi theo dòng đời
   của MỘT xét nghiệm/mức đang vận hành), hàm này cho phép bắt đầu từ chính nhóm lô
   cũ để xem lại đã từng gắn với những xét nghiệm/mức nào, kể cả khi xét nghiệm đó
   nay không còn "đang vận hành". */
function levelsForLotGroup(group){
  return globalThis.qcLotGroupLevels(group,state.tests||[],derived().lotById);
}
function pointRunNo(p){return globalThis.qcPointRunNumber(p);}
/* activeWestgard: HỢP NHẤT hai lượt đánh giá — (1) tuần tự trong từng mức
   (westgardByPoint) và (2) chéo mức trong/giữa lần chạy (westgardMultiByPoint).
   Kết quả NHẠY HƠN cách đánh giá kinh điển chỉ theo N vật liệu QC — chủ đích
   tăng độ nhạy phát hiện sai số hệ thống, đánh đổi là tỉ lệ báo động giả cao
   hơn so với đánh giá thuần theo N mức. */
function activeWestgard(t){
  const memoKey=t&&t.id;
  if(memoKey&&globalThis.westgardMemoCache){const cached=globalThis.westgardMemoCache.get(memoKey);if(cached)return cached;}if(memoKey&&wgMemo.has(memoKey))return wgMemo.get(memoKey);
  const withinRules=testRuleSet(t,'within'),acrossRules=testRuleSet(t,'across'),result=globalThis.qcActiveWestgard(operationalLevels(t).map(l=>({l,pts:operationalLotPoints(t,l.level)})),withinRules,acrossRules,rules=>ruleResultLevel(t,rules));
  if(memoKey){wgMemo.set(memoKey,result);if(globalThis.westgardMemoCache)globalThis.westgardMemoCache.set(memoKey,result);}
  return result;
}
function testCusumConfig(t){return globalThis.qcCusumConfig(t);}
/* Chỉ là biểu đồ xu hướng tham khảo (không đổi trạng thái đạt/loại QC — Westgard
   qua activeWestgard() vẫn là nguồn quyết định duy nhất), nên tách cache riêng
   thay vì nhét vào wgMemo. */
function cusumSeries(t,l){
  if(!t||!l)return{cPos:[],cNeg:[],flags:[],ma:[],k:0.5,h:4};
  const memoKey=t.id+'|'+l.level;
  if(globalThis.qcCusumMemoCache){const cached=globalThis.qcCusumMemoCache.get(memoKey);if(cached)return cached;}if(cusumMemo.has(memoKey))return cusumMemo.get(memoKey);
  const cfg=testCusumConfig(t),pts=operationalLotPoints(t,l.level),result=globalThis.qcCusumSeries(pts,l,cfg);
  cusumMemo.set(memoKey,result);if(globalThis.qcCusumMemoCache)globalThis.qcCusumMemoCache.set(memoKey,result);
  return result;
}
function acceptedLotPoints(t,level,withIndex=false){
  const memoKey=t&&t.id?t.id+'|'+level+'|'+(withIndex?1:0):'';
  try{if(memoKey&&globalThis.qcAcceptedMemoCache){const cached=globalThis.qcAcceptedMemoCache.get(memoKey);if(cached!==undefined)return cached;}}catch(e){}
  if(memoKey&&acceptedMemo.has(memoKey))return acceptedMemo.get(memoKey);
  const l=lvlCfg(t,level),pts=operationalLotPoints(t,level,withIndex),withinRules=testRuleSet(t,'within'),rejectRules=new Set(WG_RULES.filter(rule=>testRuleAction(t,rule)==='reject')),out=globalThis.qcAcceptedLotPoints(pts,l,withinRules,rejectRules);
  if(memoKey){acceptedMemo.set(memoKey,out);try{if(globalThis.qcAcceptedMemoCache)globalThis.qcAcceptedMemoCache.set(memoKey,out);}catch(e){}}
  return out;
}
function testSelectLabel(t,list=state.tests){return globalThis.qcOperationalAccess.selectLabel(t,list);}
function searchText(s){if(globalThis.normalizeSearchText)return globalThis.normalizeSearchText(s);return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();}

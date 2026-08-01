/* ===== STATS / WESTGARD ===== */
function stats(vals){return QCCore.stats(vals);}
/* Thống kê in báo cáo cho một dải điểm QC (mean thực/SD/CV + Bias%/TE%/Sigma so
   với Mean mục tiêu và TEa) — dùng chung cho lô hiện hành lẫn lô cũ trong
   reports.js/data-io.js để công thức chỉ cần sửa một chỗ. */
function reportLevelStats(pts,mean,teaVal){
  const st=stats(pts.map(p=>p.val)),den=Math.abs(Number(mean)),bias=den?Math.abs(st.m-mean)/den*100:0,te=bias+1.65*st.cv,sigma=st.cv>0&&teaVal?(teaVal-bias)/st.cv:null;
  return{st,bias,te,sigma};
}
function wgOn(rule){return QCCore.ruleEnabled(state.westgardRules,rule);}
function wgSet(rule,on){if(!requireWrite())return;state.westgardRules=state.westgardRules||{...WG_DEFAULT};state.westgardRules[rule]=!!on;save();rerender();}
function wgReset(){if(!requireWrite())return;state.westgardRules={...WG_DEFAULT};save();rerender();}
/* Bảng hành động + phạm vi nằm ở core.js (NGUỒN DUY NHẤT, dùng chung với
   workers/westgard-worker.js — xem chú thích ở đó). Ở đây chỉ nối state vào:
   bật/tắt toàn cục, ghi đè theo từng xét nghiệm và số mức đang vận hành. */
function testLevelCount(t){return operationalLevels(t).length||(t&&t.levels||[]).length;}
function defaultRuleAction(rule){return QCCore.defaultRuleAction(rule,wgOn(rule));}
function testRuleAction(t,rule){return QCCore.resolveRuleAction(rule,wgOn(rule),t&&t.ruleActions&&t.ruleActions[rule]);}
/* Alias cũ dùng cho các báo cáo một mức; mặc định phải tôn trọng phạm vi within. */
function testRuleOn(t,rule){return testRuleOnWithin(t,rule);}
function defaultRuleScope(t,rule){return QCCore.defaultRuleScope(rule,testLevelCount(t));}
function testRuleScope(t,rule){return QCCore.resolveRuleScope(rule,testLevelCount(t),t&&t.ruleScopes&&t.ruleScopes[rule]);}
function testRuleOnIn(t,rule,channel){return QCCore.ruleOnInScope(rule,testLevelCount(t),t&&t.ruleScopes&&t.ruleScopes[rule],testRuleAction(t,rule),channel);}
function testRuleOnWithin(t,rule){return testRuleOnIn(t,rule,'within');}
function testRuleOnAcross(t,rule){return testRuleOnIn(t,rule,'across');}
function testRuleSet(t,channel){return new Set(WG_RULES.filter(rule=>testRuleOnIn(t,rule,channel)));}
function ruleResultLevel(t,rules){return QCCore.ruleVerdictLevel(rules,r=>testRuleAction(t,r));}
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
function errorTypeDetailParts(rules){const type=errorType(rules);if(type==='—')return{type,desc:''};const rule=primaryErrorRule(rules);return{type,desc:WG_RULE_DESCRIPTIONS[rule]||''};}

/* ===== WESTGARD BACKGROUND WORKER ===== */
let wgWorker=null,wgWorkerGeneration=0,wgWorkerRevisions=new Map(),wgWorkerPending=new Map(),wgWorkerFailed=false,wgWorkerRenderT=null;
const WG_WORKER_POINT_THRESHOLD=3000;
function westgardWorkerRevision(testId){return wgWorkerRevisions.get(String(testId||''))||0;}
function invalidateWestgardWorker(testId){
  if(testId){const id=String(testId);wgWorkerRevisions.set(id,westgardWorkerRevision(id)+1);wgWorkerPending.delete(id);return;}
  wgWorkerGeneration++;wgWorkerRevisions.clear();wgWorkerPending.clear();clearTimeout(wgWorkerRenderT);wgWorkerRenderT=null;
  if(wgWorker){try{wgWorker.terminate();}catch(e){}wgWorker=null;}
}
function westgardWorkerWorthwhile(tests){
  if(typeof Worker!=='function'||wgWorkerFailed)return false;
  let count=0;for(const t of tests||[]){count+=(state.data[t.id]||[]).length;if(count>=WG_WORKER_POINT_THRESHOLD)return true;}
  return false;
}
function westgardWorkerJob(t,generation,revision=westgardWorkerRevision(t&&t.id)){
  return{type:'compute',generation,revision,testId:t.id,ruleActions:{...(t.ruleActions||{})},ruleScopes:{...(t.ruleScopes||{})},globalRules:{...(state.westgardRules||{})},
    levels:operationalLevels(t).map(l=>({level:l.level,mean:l.mean,sd:l.sd,lot:l.lot||''})),
    points:(state.data[t.id]||[]).filter(p=>!p.voided).map(p=>({id:p.id,val:p.val,qcMean:p.qcMean,qcSd:p.qcSd,date:p.date,runId:p.runId,level:p.level,lot:p.lot||''}))};
}
function hydrateWestgardWorkerResult(message){
  if(!message||message.generation!==wgWorkerGeneration||(message.revision||0)!==westgardWorkerRevision(message.testId))return false;
  const t=(state.tests||[]).find(test=>test.id===message.testId);if(!t)return false;
  /** @type {any} */
  const cross=new Map();
  const resultLevels=new Map((message.levels||[]).map(level=>[String(level.level),level])),views=[],crossSupport=new Map(),byPoint=new Map();
  for(const l of operationalLevels(t)){
    const pts=operationalLotPoints(t,l.level),source=resultLevels.get(String(l.level));
    if(!source||source.points.length!==pts.length)return false;
    const rows=new Map(source.points.map(row=>[row.id,row])),F=[],zs=[];
    for(const p of pts){
      const row=rows.get(p.id);if(!row)return false;
      const singleRules=row.singleRules||[],crossRules=row.crossRules||[],singleSupportRules=row.singleSupportRules||[],crossSupportRules=row.crossSupportRules||[];
      F.push({level:ruleResultLevel(t,singleRules),rules:singleRules,supportRules:singleSupportRules});zs.push(row.z);
      if(crossRules.length)cross.set(p,crossRules);
      if(crossSupportRules.length)crossSupport.set(p,crossSupportRules);
      byPoint.set(p.id,{level:row.level,rules:row.rules||[],supportRules:row.supportRules||[],z:row.z});
    }
    views.push({l,pts,single:{F,zs}});
  }
  cross.support=crossSupport;wgMemo.set(t.id,{views,cross,byPoint});return true;
}
function westgardWorkerReadyToRender(){return operationalTests().every(t=>wgMemo.has(t.id));}
function westgardWorkerMessage(event){
  const message=event&&event.data;if(!message||message.generation!==wgWorkerGeneration)return;
  const revision=message.revision||0;if(revision!==westgardWorkerRevision(message.testId))return;
  if(wgWorkerPending.get(message.testId)===revision)wgWorkerPending.delete(message.testId);
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
  const missing=(tests||[]).filter(t=>!wgMemo.has(t.id));
  if(!missing.length||!westgardWorkerWorthwhile(missing))return false;
  const worker=ensureWestgardWorker();if(!worker)return false;
  const generation=wgWorkerGeneration;
  missing.forEach(t=>{const revision=westgardWorkerRevision(t.id);if(wgWorkerPending.get(t.id)===revision)return;wgWorkerPending.set(t.id,revision);worker.postMessage(westgardWorkerJob(t,generation,revision));});
  return true;
}

/* ===== HELPERS ===== */
function normalizePointLots(){(state.tests||[]).forEach(t=>(state.data[t.id]||[]).forEach(p=>{const l=(t.levels||[]).find(x=>x.level===p.level);if(!l)return;if(!p.id)p.id=uid();if(p.lot==null)p.lot=l.lot||'';if(p.qcMean==null)p.qcMean=l.mean;if(p.qcSd==null)p.qcSd=l.sd;if(!p.runId)p.runId=(p.date||isoToday())+'-1';}));normalizeDuplicateRunIds();}
/* runId là dấu vết của lần chạy và không được đổi chỉ vì một điểm bị hủy.
   Chỉ xử lý trường hợp trùng runId do hai máy offline cùng tạo điểm, để bảng nhập
   vẫn nhóm đúng các mức trong cùng lần chạy sau khi merge Firebase. */
function normalizeDuplicateRunIds(){
  (state.tests||[]).forEach(t=>{
    const rows=state.data[t.id]||[],seenRuns=new Set(),conflicts=new Set();
    rows.forEach(p=>{
      if(p.voided)return;
      const key=[p.date||'',p.level,p.lot||''].join('|');
      const runKey=key+'\u0000'+(p.runId||'');if(seenRuns.has(runKey))conflicts.add(key);else seenRuns.add(runKey);
    });
    if(!conflicts.size)return;
    const groups=new Map([...conflicts].map(key=>[key,[]]));
    rows.forEach((p,idx)=>{if(p.voided)return;const key=[p.date||'',p.level,p.lot||''].join('|');if(groups.has(key))groups.get(key).push(idx);});
    groups.forEach(g=>{
      g.sort((a,b)=>pointRunNo(rows[a])-pointRunNo(rows[b])||a-b).forEach((idx,i)=>{
        const p=rows[idx];if(p.date)p.runId=`${p.date}-${i+1}`;
      });
    });
  });
}
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
function derivedStampWalk(prev){
  const panels=state.qcPanels||[],lots=state.qcLots||[],groups=state.lotGroups||[],trans=state.lotTransitions||[],tests=state.tests||[];
  const build=!prev,out=build?[]:null;let i=0,ok=true;
  const put=v=>{if(build)out.push(v);else if(ok&&prev[i++]!==v)ok=false;};
  put(state);put(panels);put(panels.length);put(lots);put(lots.length);
  put(groups);put(groups.length);put(trans);put(trans.length);put(tests);put(tests.length);
  if(!build&&!ok)return false;
  for(let k=0;k<panels.length;k++){const p=panels[k],ids=p&&p.testIds;put(p);put(p&&p.active);put(ids);put(ids?ids.length:-1);}
  for(let k=0;k<groups.length;k++){const g=groups[k],ids=g&&g.lotIds;put(g);put(g&&g.active);put(g&&g.status);put(ids);put(ids?ids.length:-1);}
  for(let k=0;k<trans.length;k++){const tr=trans[k];put(tr);put(tr&&tr.fromLotId);put(tr&&tr.toLotId);put(tr&&tr.status);}
  for(let k=0;k<lots.length;k++){const l=lots[k];put(l);put(l&&l.id);}
  for(let k=0;k<tests.length;k++){const t=tests[k],lv=t&&t.levels;put(t);put(lv);put(lv?lv.length:-1);}
  return build?out:(ok&&i===prev.length);
}
function derived(){
  if(derivedIndex&&derivedStampWalk(derivedIndex.stamp)===true)return derivedIndex;
  const stamp=derivedStampWalk(null);
  const panels=(state.qcPanels||[]).filter(p=>p.active!==false),testPanel=new Map(),testOrder=new Map();
  panels.forEach((p,pi)=>(p.testIds||[]).forEach((id,ti)=>{
    if(!testPanel.has(id))testPanel.set(id,p);
    const ord=pi*10000+ti;
    if(!testOrder.has(id)||ord<testOrder.get(id))testOrder.set(id,ord);
  }));
  const lotById=new Map((state.qcLots||[]).map(l=>[l.id,l])),lotGroupByLotId=new Map();
  (state.lotGroups||[]).filter(isOperationalLotGroup).forEach(g=>(g.lotIds||[]).forEach(id=>{if(!lotGroupByLotId.has(id))lotGroupByLotId.set(id,g);}));
  const acceptedTransitionToLot=new Map();
  (state.lotTransitions||[]).filter(transitionSwitchesLot).forEach(tr=>{if(!acceptedTransitionToLot.has(tr.toLotId))acceptedTransitionToLot.set(tr.toLotId,tr);});
  derivedIndex={stamp,panels,testPanel,testOrder,lotById,lotGroupByLotId,acceptedTransitionToLot,operationalTests:null,levels:new Map(),groups:new Map()};
  return derivedIndex;
}
function pointsOf(testId,level){
  const key=testId+'|'+level;
  if(pointsCache.has(key))return pointsCache.get(key);
  const arr=(state.data[testId]||[]).filter(p=>+p.level===+level&&!p.voided).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||pointRunNo(a)-pointRunNo(b));
  pointsCache.set(key,arr);
  return arr;
}
function pointsWithIndex(testId,level){
  const key=testId+'|'+level;
  if(pointsIndexCache.has(key))return pointsIndexCache.get(key);
  const arr=(state.data[testId]||[]).map((p,idx)=>({...p,_idx:idx})).filter(p=>+p.level===+level&&!p.voided).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||pointRunNo(a)-pointRunNo(b)||a._idx-b._idx);
  pointsIndexCache.set(key,arr);
  return arr;
}
function lvlCfg(t,level){return t.levels.find(l=>l.level===level);}
function pointsForLot(testId,level,lot,withIndex=false){
  const key=testId+'|'+level+'|'+(lot||'')+'|'+(withIndex?1:0);
  if(pointsLotCache.has(key))return pointsLotCache.get(key);
  const arr=(withIndex?pointsWithIndex(testId,level):pointsOf(testId,level)).filter(p=>(p.lot||'')===(lot||''));
  pointsLotCache.set(key,arr);
  return arr;
}
function activeLotPoints(t,level,withIndex=false){const l=lvlCfg(t,level);return l?pointsForLot(t.id,level,l.lot||'',withIndex):[];}
function operationalPanelForTest(t){return t?derived().testPanel.get(t.id):null;}
function operationalTestOrder(t){return t&&derived().testOrder.has(t.id)?derived().testOrder.get(t.id):999999;}
function isOperationalLotGroup(g){return!!(g&&g.active!==false&&g.status!=='stopped'&&g.status!=='planned');}
function operationalLotGroupForLevel(l){return l&&l.qcLotId?derived().lotGroupByLotId.get(l.qcLotId)||null:null;}
/* Sự thật "nhóm lô này có đang thật sự được xét nghiệm nào dùng không" — tính từ dữ liệu
   (có level nào của test nào đang qcLotId trỏ vào 1 lô của nhóm), KHÔNG dựa vào g.status
   (chỉ là nhãn "Đã dừng"/"Dự kiến" do người dùng/luồng kích hoạt gán). Dùng để hiện đúng
   "Đang hoạt động" ở manageLots() thay vì suy đoán mặc định — tránh 2 nhóm cùng hiện "Đang
   hoạt động" khi một nhóm thực ra không còn xét nghiệm nào dùng nữa. */
function lotGroupInUse(g){return !!(g&&(state.tests||[]).some(t=>(t.levels||[]).some(l=>l.qcLotId&&(g.lotIds||[]).includes(l.qcLotId))));}
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
function levelTargetOk(l){return!!l&&Number.isFinite(+l.mean)&&Number.isFinite(+l.sd)&&+l.sd>0;}
function levelsMissingTarget(t){return operationalLevels(t).filter(l=>!levelTargetOk(l));}
function isOperationalTest(t){return!!(t&&t.active!==false&&operationalPanelForTest(t)&&operationalLotGroupForTest(t)&&operationalLevels(t).length);}
function canEnterQcForLevel(t,level){
  const cfg=t&&lvlCfg(t,+level);
  return!!(cfg&&isOperationalTest(t)&&operationalLevels(t).includes(cfg));
}
function operationalTests(){
  const idx=derived();
  if(idx.operationalTests)return idx.operationalTests;
  idx.operationalTests=(state.tests||[]).filter(isOperationalTest).sort((a,b)=>operationalTestOrder(a)-operationalTestOrder(b));
  return idx.operationalTests;
}
function operationalLotPoints(t,level,withIndex=false){const l=lvlCfg(t,level);if(!l||!operationalPanelForTest(t)||!operationalLotGroupForLevel(l))return[];return activeLotPoints(t,level,withIndex);}
/* Dòng đời lô: lần theo hồ sơ chuyển tiếp đã chấp nhận (fromLot→toLot)
   để trả về danh sách lô từ CŨ NHẤT → HIỆN HÀNH cho lô đang dùng. */
function lotLineage(currentLotId){
  const idx=derived(),chain=[],seen=new Set();let cur=idx.lotById.get(currentLotId);
  while(cur&&!seen.has(cur.id)){chain.unshift(cur);seen.add(cur.id);const tr=idx.acceptedTransitionToLot.get(cur.id);cur=tr?idx.lotById.get(tr.fromLotId):null;}
  return chain;
}
function lotPointsByNo(testId,level,lotNo){return pointsForLot(testId,level,lotNo||'');}
function lotMeanSdFor(t,level,lotNo){
  const l=lvlCfg(t,level);
  if(l&&(l.lot||'')===(lotNo||'')&&Number.isFinite(+l.mean)&&Number.isFinite(+l.sd))return{mean:+l.mean,sd:+l.sd};
  const h=((l&&l.meanSdHistory)||[]).slice().reverse().find(e=>(e.lot||'')===(lotNo||'')&&Number.isFinite(+e.mean)&&Number.isFinite(+e.sd));
  if(h)return{mean:+h.mean,sd:+h.sd};
  const p=(state.data[t.id]||[]).find(p=>+p.level===+level&&(p.lot||'')===(lotNo||'')&&Number.isFinite(+p.qcMean)&&Number.isFinite(+p.qcSd));
  return p?{mean:+p.qcMean,sd:+p.qcSd}:null;
}
/* Mean/SD/giới hạn đã từng cấu hình cho MỘT LÔ CỤ THỂ (theo qcLotId, không phải
   "lô đang dùng hiện hành" của mức) — tra ở cấu hình hiện hành trước, rồi tới
   meanSdHistory. Dùng ở màn hình "Mean/SD theo nhóm lô QC" để mỗi lô hiển thị
   đúng giá trị của chính nó khi chuyển qua lại giữa các nhóm lô song song, thay
   vì hiện nhầm giá trị của lô đang thực sự gắn với mức (xem applyTargetPick). */
function lotTargetSnapshot(t,level,lotId,lotNo){
  const l=lvlCfg(t,level);if(!l)return null;
  if(l.qcLotId===lotId&&Number.isFinite(+l.mean)&&Number.isFinite(+l.sd))return{mean:+l.mean,sd:+l.sd,low:l.low==null?null:+l.low,high:l.high==null?null:+l.high};
  const h=(l.meanSdHistory||[]).slice().reverse().find(e=>(e.qcLotId?e.qcLotId===lotId:(e.lot||'')===(lotNo||''))&&Number.isFinite(+e.mean)&&Number.isFinite(+e.sd));
  return h?{mean:+h.mean,sd:+h.sd,low:h.low==null?null:+h.low,high:h.high==null?null:+h.high}:null;
}
/* ===== CHẠY SONG SONG 2 LÔ (lot-to-lot verification) =====
   Khi hồ sơ chuyển tiếp ở trạng thái 'active', lô mới được chạy song song với lô
   đang dùng để thu thập dữ liệu riêng trước khi quyết định chấp nhận.
   Ranh giới cố ý: lô ĐANG DÙNG vẫn là lô duy nhất quyết định nhận/loại kết quả
   bệnh nhân (activeWestgard không hề đọc lô song song); lô song song chỉ được
   đánh giá riêng cho chính nó. Trả null nếu lô mới chưa có Mean/SD riêng —
   không bao giờ mượn Mean/SD của lô cũ (xem applyAcceptedLotTransitionToConfig). */
function parallelLotForLevel(t,level){
  const l=lvlCfg(t,+level);if(!l||!l.qcLotId)return null;
  const panel=operationalPanelForTest(t);if(!panel)return null;
  const tr=(state.lotTransitions||[]).find(x=>x&&x.status==='active'&&x.panelId===panel.id&&x.fromLotId===l.qcLotId);
  if(!tr)return null;
  const lot=(state.qcLots||[]).find(x=>x.id===tr.toLotId);if(!lot||+lot.level!==+l.level)return null;
  const snap=lotTargetSnapshot(t,l.level,lot.id,lot.lotNo);
  if(!snap||!Number.isFinite(+snap.mean)||!(+snap.sd>0))return null;
  return{tr,lot,lotNo:lot.lotNo||'',mean:+snap.mean,sd:+snap.sd,low:snap.low,high:snap.high,exp:lot.exp||''};
}
/* Cột nhập QC = cặp (mức, lô). Bình thường mỗi mức đúng 1 cột; mức nào đang có
   lô chạy song song thì có thêm cột thứ hai cho lô mới. `key` là định danh cột
   dùng xuyên suốt bảng nhập (thay cho `level` trước đây, vốn giả định 1 lô/mức). */
function entryColumns(t){
  const out=[];
  operationalLevels(t).forEach(l=>{
    out.push({key:String(l.level),level:l.level,lot:l.lot||'',mean:l.mean,sd:l.sd,exp:l.exp,applied:l.applied,parallel:false});
    const par=parallelLotForLevel(t,l.level);
    if(par)out.push({key:l.level+'|'+par.lotNo,level:l.level,lot:par.lotNo,mean:par.mean,sd:par.sd,exp:par.exp,applied:'mfg',parallel:true});
  });
  return out;
}
function entryColumnPoints(t,col,withIndex=false){
  if(!t||!col)return[];
  return col.parallel?pointsForLot(t.id,col.level,col.lot||'',withIndex):operationalLotPoints(t,col.level,withIndex);
}
/* Westgard cho lô chạy song song: chỉ xét trong nội bộ lô đó (luật within-run),
   không ghép chuỗi với lô đang dùng và không chạy luật chéo mức — lô đang đánh
   giá không được làm đổi kết luận của lô đang vận hành, và ngược lại. */
function parallelWestgard(t,col){
  const pts=entryColumnPoints(t,col,true),byPoint=new Map();
  if(!pts.length)return{pts,byPoint};
  const wg=QCCore.westgardByPoint(pts,col.mean,col.sd,rule=>testRuleOnWithin(t,rule));
  pts.forEach((p,i)=>{const f=wg.F[i]||{},rules=[...new Set(f.rules||[])];byPoint.set(p.id,{level:ruleResultLevel(t,rules),rules,supportRules:[...new Set(f.supportRules||[])],z:wg.zs[i]});});
  return{pts,byPoint};
}
/* Mean/SD đã lưu "Dự kiến" (chưa áp dụng) cho một lô cụ thể chưa phải lô đang
   gắn với mức — xem applyPlannedTarget()/saveTargetMatrix() trong entry-tests-actions.js. */
function plannedTargetFor(t,lot){
  const l=lvlCfg(t,lot.level);if(!l||l.qcLotId===lot.id)return null;
  return (l.meanSdHistory||[]).find(h=>h.qcLotId===lot.id&&h.planned)||null;
}
/* Các lô cũ (đã chuyển tiếp) của một mức, kèm điểm QC — chỉ đọc, giữ tách theo lô. */
function previousLotSeries(t,level){
  const l=lvlCfg(t,level);if(!l)return[];
  return lotLineage(l.qcLotId).filter(lot=>(lot.lotNo||'')!==(l.lot||'')).map(lot=>{const ms=lotMeanSdFor(t,level,lot.lotNo),pts=lotPointsByNo(t.id,level,lot.lotNo);return ms&&pts.length?{lot:lot.lotNo,mean:ms.mean,sd:ms.sd,pts}:null;}).filter(Boolean);
}
/* Mọi mức QC (của mọi xét nghiệm) từng dùng một lô thuộc "nhóm lô" cho trước —
   kể cả nhóm đã lưu trữ (ngừng dùng). Khác với previousLotSeries (đi theo dòng đời
   của MỘT xét nghiệm/mức đang vận hành), hàm này cho phép bắt đầu từ chính nhóm lô
   cũ để xem lại đã từng gắn với những xét nghiệm/mức nào, kể cả khi xét nghiệm đó
   nay không còn "đang vận hành". */
function levelsForLotGroup(group){
  const lotIds=new Set((group&&group.lotIds)||[]),idx=derived(),out=[];
  (state.tests||[]).forEach(t=>{
    (t.levels||[]).forEach(l=>{
      let lot=null,mean=NaN,sd=NaN;
      if(lotIds.has(l.qcLotId)){lot=idx.lotById.get(l.qcLotId);mean=+l.mean;sd=+l.sd;}
      else{
        const h=(l.meanSdHistory||[]).slice().reverse().find(h=>lotIds.has(h.qcLotId));
        if(h){lot=idx.lotById.get(h.qcLotId);mean=+h.mean;sd=+h.sd;}
      }
      if(lot&&Number.isFinite(mean)&&Number.isFinite(sd)&&sd>0)out.push({t,l,lot,mean,sd});
    });
  });
  return out.sort((a,b)=>String(a.t.name||'').localeCompare(String(b.t.name||''),'vi')||a.l.level-b.l.level);
}
function pointRunNo(p){const m=/-(\d+)$/.exec(String(p&&p.runId||''));return m?parseInt(m[1]):1;}
/* activeWestgard: HỢP NHẤT hai lượt đánh giá — (1) tuần tự trong từng mức
   (westgardByPoint) và (2) chéo mức trong/giữa lần chạy (westgardMultiByPoint).
   Kết quả NHẠY HƠN cách đánh giá kinh điển chỉ theo N vật liệu QC — chủ đích
   tăng độ nhạy phát hiện sai số hệ thống, đánh đổi là tỉ lệ báo động giả cao
   hơn so với đánh giá thuần theo N mức. */
function activeWestgard(t){
  const memoKey=t&&t.id;
  if(memoKey&&wgMemo.has(memoKey))return wgMemo.get(memoKey);
  const withinRules=testRuleSet(t,'within'),acrossRules=testRuleSet(t,'across'),within=rule=>withinRules.has(rule),across=rule=>acrossRules.has(rule);
  const views=operationalLevels(t).map(l=>{const pts=operationalLotPoints(t,l.level),single=pts.length?QCCore.westgardByPoint(pts,l.mean,l.sd,within):{F:[],zs:[]};return{l,pts,single};}),cross=QCCore.westgardMultiByPoint(views.map(v=>({level:v.l.level,pts:v.pts,mean:v.l.mean,sd:v.l.sd})),across),byPoint=new Map();
  views.forEach(v=>v.pts.forEach((p,i)=>{const extra=cross.get(p)||[],single=v.single.F[i]||{},rules=[...new Set([...(single.rules||[]),...extra])],supportRules=[...new Set([...(single.supportRules||[]),...((cross.support&&cross.support.get(p))||[])])].filter(r=>!rules.includes(r)),level=ruleResultLevel(t,rules);byPoint.set(p.id,{level,rules,supportRules,z:v.single.zs[i]});}));
  const result={views,cross,byPoint};
  if(memoKey)wgMemo.set(memoKey,result);
  return result;
}
function testCusumConfig(t){const c=t&&t.cusum;return{on:!!(c&&c.on),k:Number.isFinite(+(c&&c.k))&&+(c&&c.k)>0?+c.k:0.5,h:Number.isFinite(+(c&&c.h))&&+(c&&c.h)>0?+c.h:4};}
/* Chỉ là biểu đồ xu hướng tham khảo (không đổi trạng thái đạt/loại QC — Westgard
   qua activeWestgard() vẫn là nguồn quyết định duy nhất), nên tách cache riêng
   thay vì nhét vào wgMemo. */
function cusumSeries(t,l){
  if(!t||!l)return{cPos:[],cNeg:[],flags:[],ma:[],k:0.5,h:4};
  const memoKey=t.id+'|'+l.level;
  if(cusumMemo.has(memoKey))return cusumMemo.get(memoKey);
  const cfg=testCusumConfig(t),pts=operationalLotPoints(t,l.level),
    c=pts.length?QCCore.cusum(pts,l.mean,l.sd,cfg.k,cfg.h):{cPos:[],cNeg:[],flags:[],k:cfg.k,h:cfg.h},
    ma=pts.length?QCCore.movingAverage(pts,l.mean,l.sd):[],
    result={...c,ma};
  cusumMemo.set(memoKey,result);
  return result;
}
const ACCEPTED_WG_LOOKBACK=11; // 12x is the widest single-level rule: candidate + 11 prior accepted points.
function acceptedPointOkFromTail(l,acceptedPointTail,candidate,withinRules,rejectRules){
  const z=QCCore.pointZ(candidate,l.mean,l.sd),rules=QCCore.westgardLatestRules([...acceptedPointTail,candidate],l.mean,l.sd,rule=>withinRules.has(rule));
  return{ok:!rules.some(rule=>rejectRules.has(rule)),z};
}
function acceptedLotPoints(t,level,withIndex=false){
  const memoKey=t&&t.id?t.id+'|'+level+'|'+(withIndex?1:0):'';
  if(memoKey&&acceptedMemo.has(memoKey))return acceptedMemo.get(memoKey);
  const l=lvlCfg(t,level),pts=operationalLotPoints(t,level,withIndex),accepted=[],tail=[],withinRules=testRuleSet(t,'within'),rejectRules=new Set(WG_RULES.filter(rule=>testRuleAction(t,rule)==='reject'));
  pts.forEach(p=>{const verdict=acceptedPointOkFromTail(l,tail,p,withinRules,rejectRules);if(!verdict.ok)return;accepted.push(p);tail.push(p);if(tail.length>ACCEPTED_WG_LOOKBACK)tail.shift();});
  const out=accepted.filter(Boolean);
  if(memoKey)acceptedMemo.set(memoKey,out);
  return out;
}
function testSelectLabel(t,list=state.tests){const lvls=isOperationalTest(t)?operationalLevels(t):(t.levels||[]),lots=[...new Set(lvls.map(l=>l.lot).filter(Boolean))],same=(list||[]).filter(x=>String(x.name||'').trim().toLowerCase()===String(t.name||'').trim().toLowerCase()).length>1;return`${testDisplayName(t)}${lots.length?' · LOT '+lots.join('/'):''}${same&&t.machine?' · '+t.machine:''}`;}
function searchText(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();}

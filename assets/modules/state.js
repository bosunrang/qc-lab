/* ===== STATE ===== */
const teaAnalyteKey=v=>String(v==null?'':v).trim().toLowerCase();
const REFTESTS=Object.freeze(TEA_ANALYTE_CATALOG.map(row=>Object.freeze([row.name,row.unit,row.tea.clia,row.tea.ricos,row.section])));
const TEA_ANALYTE_META=Object.freeze(Object.fromEntries(TEA_ANALYTE_CATALOG.map(row=>{const aliases=[row.name,row.abbreviation].filter(Boolean),displayName=row.abbreviation&&teaAnalyteKey(row.abbreviation)!==teaAnalyteKey(row.name)?`${row.name} (${row.abbreviation})`:row.name;return[teaAnalyteKey(row.name),Object.freeze({analyteId:row.analyteId,displayName,standardName:row.name,abbreviation:row.abbreviation||'',aliases:Object.freeze(aliases),matrix:row.matrix})];})));
const TEA_ANALYTE_META_BY_ID=Object.freeze(Object.fromEntries(Object.values(TEA_ANALYTE_META).map(m=>[m.analyteId,m])));
function teaAnalyteBuiltInMeta(value){const key=teaAnalyteKey(value);return TEA_ANALYTE_META[key]||Object.values(TEA_ANALYTE_META).find(m=>m.aliases.some(a=>teaAnalyteKey(a)===key))||{};}
function teaAnalyteMeta(name,record){const custom=record&&typeof record==='object'?record:{},base=custom.analyteId&&TEA_ANALYTE_META_BY_ID[custom.analyteId]||teaAnalyteBuiltInMeta(name),aliases=[name,base.displayName,base.standardName,base.abbreviation,...(base.aliases||[]),custom.displayName,custom.standardName,custom.abbreviation,...(custom.aliases||[])].filter(Boolean);return{analyteId:custom.analyteId||base.analyteId||'',displayName:custom.displayName||base.displayName||name||'',standardName:custom.standardName||base.standardName||name||'',abbreviation:custom.abbreviation||base.abbreviation||'',aliases:[...new Set(aliases)],matrix:custom.matrix||base.matrix||''};}
function teaAnalyteDisplay(name,record){return teaAnalyteMeta(name,record).displayName||name||'';}
const TEA_REFERENCE_SCHEMA_VERSION=2;
const TEA_SOURCE_REGISTRY=Object.freeze({
  clia:Object.freeze({id:'clia-cms-3355-f-2024',label:'CLIA PT (CMS-3355-F)',version:'CMS-3355-F / 42 CFR §§493.931, 493.941',document:'CLIA Proficiency Testing — Analytes and Acceptable Performance Criteria',url:'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-493/subpart-I',effectiveDate:'2024-07-11',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'reference',note:'Tiêu chí chấp nhận PT được dùng làm mục tiêu TEa tham khảo; không phải tuyên bố tuân thủ CLIA của đơn vị.'}),
  ricos:Object.freeze({id:'ricos-bv-2014',label:'Ricos / Westgard BV',version:'2014',document:'Desirable Specifications for Total Error derived from Biological Variation — Ricos et al.',url:'https://westgard.com/clia-and-quality-regulation-requirements/quality-requirements/biodatabase1.html',effectiveDate:'',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'retired',note:'Bộ dữ liệu legacy, cập nhật lần cuối năm 2014; EFLM hiện quản lý cơ sở dữ liệu biological variation mới.'}),
  eflm:Object.freeze({id:'eflm-bv-live',label:'EFLM Biological Variation Database',version:'Live database',document:'EFLM Biological Variation Database',url:'https://biologicalvariation.eu/',effectiveDate:'',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'dynamic',note:'Giá trị thay đổi theo database; phải lưu analyte, mức APS, ngày tra cứu và tài liệu/link tại thời điểm áp dụng.'})
});
const WG_RULES=QCCore.WG_RULES;
const WG_DEFAULT=Object.fromEntries(WG_RULES.map(r=>[r,QCCore.WG_DEFAULT_ON.has(r)]));
const STATE_SCHEMA_VERSION=QCCore.STATE_SCHEMA_VERSION;
let state={lab:{name:'',dept:'',address:''},tests:[],machines:["Máy A"],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT},configMigrationVersion:1,schemaVersion:STATE_SCHEMA_VERSION};
let mem=null,pointsCache=new Map(),pointsIndexCache=new Map(),pointsLotCache=new Map(),wgMemo=new Map(),acceptedMemo=new Map(),cusumMemo=new Map(),derivedIndex=null,startupProblem=null;
function ensureShape(opts={}){const previousSchema=Number(state&&state.schemaVersion||1),merged={lab:{name:'',dept:'',address:''},tests:[],machines:["Máy A"],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT},...(state||{})};state=opts.sanitized?merged:QCCore.sanitizeBackup(merged);
  if(previousSchema<2){state.periodLocks=Array.isArray(state.periodLocks)?state.periodLocks:[];}
  if(previousSchema<3||!state.teaRegistryVersion||state.teaRegistryVersion<TEA_REFERENCE_SCHEMA_VERSION)state.teaRegistryVersion=TEA_REFERENCE_SCHEMA_VERSION;
  state.schemaVersion=STATE_SCHEMA_VERSION;
  if(!state.westgardProfileVersion){state.westgardRules={...WG_DEFAULT};state.westgardProfileVersion=2;}
  ensureLabBrandShape();
  ensureConfigurationShape();
  reconcileSigmaLevelsWithLotGroups();
  /* sigma.js load sau state.js nên chưa định nghĩa lúc parse — nhưng ensureShape()
     chỉ thực sự CHẠY lúc boot()/merge Firebase/nhập backup, tức sau khi mọi
     script đã nạp xong, nên gọi an toàn. Guard typeof phòng khi sandbox test chỉ
     nạp state.js một mình (không có sigma.js). Đồng bộ TEa Sigma tại ĐÂY (mọi
     cổng load/merge/import) thay vì để pageSigma() tự làm lúc render — xem
     sgReconcileAllTeaSnapshots() trong sigma.js. */
  if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();
  normalizePointLots();
  state.tests.forEach(t=>t.levels.forEach(l=>{if(l.mfgMean==null){l.mfgMean=l.mean;l.mfgSd=l.sd;l.applied='mfg';}}));}
function uid(){return Math.random().toString(36).slice(2,9);}
/* Đồng bộ mức Sigma với quan hệ lô ↔ nhóm lô. Nhóm "Đã dừng/Dự kiến" vẫn được tính
   là còn quan hệ để giữ lịch sử; chỉ mức có lô đã bị tháo khỏi MỌI nhóm mới bị gỡ.
   Khi xét nghiệm vẫn còn mức hợp lệ trong nhóm, xóa luôn mọi khóa Sigma mồ côi khác
   (kể cả dữ liệu cũ mà qcLotId đã bị xóa từ một phiên bản trước). */
function reconcileSigmaLevelsWithLotGroups(){
  const lotsById=new Map((state.qcLots||[]).filter(Boolean).map(l=>[String(l.id),l])),groupedLotIds=new Set();
  (state.lotGroups||[]).filter(g=>g&&g.active!==false).forEach(g=>(g.lotIds||[]).forEach(id=>{const lot=lotsById.get(String(id));if(lot&&(!lot.groupId||String(lot.groupId)===String(g.id||'')))groupedLotIds.add(String(id));}));
  let unlinked=0,pruned=0,tests=0;
  (state.tests||[]).forEach(t=>{
    const levels=Array.isArray(t.levels)?t.levels:[],valid=new Set(),orphaned=new Set();
    levels.forEach(l=>{const key=String(+l.level);if(l.qcLotId&&groupedLotIds.has(l.qcLotId))valid.add(key);else if(l.qcLotId){orphaned.add(key);l.qcLotId='';l.lot='';l.exp='';unlinked++;}});
    const pruneAllOutsideValid=valid.size>0;if(!pruneAllOutsideValid&&!orphaned.size)return;let changed=false;
    const periods=state.sigmaData&&Array.isArray(state.sigmaData[t.id])?state.sigmaData[t.id]:[];periods.forEach(e=>{if(!e||!e.lv||typeof e.lv!=='object')return;Object.keys(e.lv).forEach(key=>{if((pruneAllOutsideValid&&!valid.has(String(+key)))||orphaned.has(String(+key))){delete e.lv[key];pruned++;changed=true;}});});
    if(changed||orphaned.size)tests++;
  });
  return{unlinked,pruned,tests};
}
function ensureConfigurationShape(){
  const migrateLegacyLots=!state.configMigrationVersion;
  state.instruments=state.instruments||[];state.assayGroups=state.assayGroups||[];state.qcPanels=state.qcPanels||[];state.lotTransitions=state.lotTransitions||[];state.lotGroups=state.lotGroups||[];state.qcLots=state.qcLots||[];
  (state.teaRefs||[]).forEach(r=>{if(!r.analyteId){const builtIn=teaAnalyteBuiltInMeta(r.name);r.analyteId=builtIn.analyteId||('custom-'+String(r.id||uid()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,72));}const built=TEA_ANALYTE_META_BY_ID[r.analyteId];if(built){r.name=built.standardName;r.displayName=built.displayName;r.standardName=built.standardName;r.abbreviation=built.abbreviation;r.aliases=[...built.aliases];r.matrix=built.matrix;}});
  (state.machines||[]).forEach(name=>{if(name&&!state.instruments.some(x=>searchText(x.name)===searchText(name)))state.instruments.push({id:uid(),name,manufacturer:'',model:'',serial:'',section:'',active:true});});
  if(!state.instruments.length)state.instruments.push({id:uid(),name:'Máy A',manufacturer:'',model:'',serial:'',section:'',active:true});
  state.machines=[...new Set(state.instruments.map(x=>x.name).filter(Boolean))];
  state.tests.forEach(t=>{
    let inst=state.instruments.find(x=>x.id===t.instrumentId)||state.instruments.find(x=>searchText(x.name)===searchText(t.machine));
    if(!inst){inst={id:uid(),name:t.machine||'Máy A',manufacturer:'',model:'',serial:'',section:'',active:true};state.instruments.push(inst);}
      t.instrumentId=inst.id;t.machine=inst.name;if(!t.section)t.section=inst.section||'';if(t.active==null)t.active=true;t.ruleActions=t.ruleActions||{};t.ruleScopes=t.ruleScopes||{};t.cusum=t.cusum||{on:false,k:0.5,h:4};
    const ref=(state.teaRefs||[]).find(r=>t.analyteId&&r.analyteId===t.analyteId)||(state.teaRefs||[]).find(r=>teaAnalyteKey(r.name)===teaAnalyteKey(t.name)),naming=teaAnalyteMeta(t.name,ref);t.analyteId=t.analyteId||naming.analyteId||('local-'+String(t.id||uid()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,73));const built=TEA_ANALYTE_META_BY_ID[t.analyteId];if(built){t.name=built.standardName;t.displayName=built.displayName;t.standardName=built.standardName;t.abbreviation=built.abbreviation;t.aliases=[...built.aliases];t.matrix=built.matrix;}else if(naming.standardName){t.displayName=t.displayName||naming.displayName;t.standardName=t.standardName||naming.standardName;t.abbreviation=t.abbreviation||naming.abbreviation;t.aliases=Array.isArray(t.aliases)&&t.aliases.length?t.aliases:naming.aliases;t.matrix=t.matrix||naming.matrix;}
    t.levels.forEach(l=>{
      let lot=state.qcLots.find(x=>x.id===l.qcLotId);
      if(migrateLegacyLots&&!lot&&l.lot){
        let group=state.lotGroups.find(g=>searchText(g.name)===searchText(t.name+' QC'));
        if(!group){group={id:uid(),name:t.name+' QC',lotIds:[],manufacturer:'',material:'',catalog:'',note:'Tự động chuyển từ dữ liệu cũ',active:true};state.lotGroups.push(group);}
        lot=state.qcLots.find(x=>x.groupId===group.id&&x.lotNo===l.lot&&+x.level===+l.level);
        if(!lot){lot={id:uid(),groupId:group.id,lotNo:l.lot,level:l.level,exp:l.exp||'',opened:'',active:true,note:''};state.qcLots.push(lot);}
        if(lot&&!group.lotIds.includes(lot.id))group.lotIds.push(lot.id);
      }
      if(lot){l.qcLotId=lot.id;l.lot=lot.lotNo;l.exp=lot.exp;}
      l.meanSdHistory=Array.isArray(l.meanSdHistory)?l.meanSdHistory:[];
      if(!l.meanSdHistory.length&&Number.isFinite(+l.mean)&&Number.isFinite(+l.sd)&&+l.sd>0)l.meanSdHistory.push({id:uid(),qcLotId:l.qcLotId||'',lot:l.lot||'',mean:+l.mean,sd:+l.sd,low:l.low==null?null:+l.low,high:l.high==null?null:+l.high,effectiveFrom:'',effectiveTo:l.exp||'',source:l.applied==='lab'?'lab':'mfg',note:'Tự động chuyển từ cấu hình hiện hành'});
      dedupeLotTargetHistory(l);
    });
  });
  if(!state.qcPanels.length&&state.assayGroups.length){
    state.assayGroups.forEach(g=>{const first=state.tests.find(t=>(g.testIds||[]).includes(t.id));state.qcPanels.push({id:g.id||uid(),name:g.name||'Panel QC',instrumentId:first&&first.instrumentId||state.instruments[0].id,testIds:[...(g.testIds||[])],note:g.note||'Chuyển từ nhóm xét nghiệm cũ',active:g.active!==false});});
  }
  state.lotGroups.forEach(g=>{g.lotIds=Array.isArray(g.lotIds)?[...new Set(g.lotIds)].filter(id=>state.qcLots.some(l=>l.id===id)):[];});
  state.qcLots.forEach(l=>{if(l.groupId){const g=state.lotGroups.find(x=>x.id===l.groupId);if(g&&!g.lotIds.includes(l.id))g.lotIds.push(l.id);}});
  state.lotGroups.forEach(g=>{g.lotIds=[...new Set(g.lotIds||[])].filter(id=>state.qcLots.some(l=>l.id===id));});
  state.qcLots.forEach(l=>{const g=state.lotGroups.find(x=>(x.lotIds||[]).includes(l.id));l.groupId=g?g.id:'';});
  state.assayGroups.forEach(g=>{g.testIds=Array.isArray(g.testIds)?g.testIds.filter(id=>state.tests.some(t=>t.id===id)):[];});
  state.qcPanels.forEach(p=>{if(!state.instruments.some(i=>i.id===p.instrumentId))p.instrumentId=state.instruments[0]&&state.instruments[0].id||'';p.testIds=Array.isArray(p.testIds)?p.testIds.filter(id=>state.tests.some(t=>t.id===id)):[];if(p.active==null)p.active=true;});
  state.lotTransitions=state.lotTransitions.filter(x=>state.qcLots.some(l=>l.id===x.fromLotId)&&state.qcLots.some(l=>l.id===x.toLotId)&&(!x.panelId||state.qcPanels.some(p=>p.id===x.panelId)));
  state.lotTransitions.filter(transitionSwitchesLot).forEach(applyAcceptedLotTransitionToConfig);
  normalizeLotGroups();
  syncLotDepletionFromTransitions();
  state.configMigrationVersion=1;
}
/* Lô "đã hết QC" được suy ra từ hồ sơ chuyển tiếp đã "Chấp nhận lô mới".
   Các trạng thái dự kiến/chạy song song chỉ để theo dõi, chưa khóa lô cũ. */
function transitionSwitchesLot(tr){return !!(tr&&tr.fromLotId&&tr.toLotId&&tr.status==='accepted');}
function syncLotDepletionFromTransitions(){
  const retired=new Set((state.lotTransitions||[]).filter(transitionSwitchesLot).map(x=>x.fromLotId));
  (state.qcLots||[]).forEach(l=>{l.depleted=retired.has(l.id);});
}
function dedupeLotTargetHistory(target){
  const rows=Array.isArray(target&&target.meanSdHistory)?target.meanSdHistory:[],out=[],indexes=new Map();
  rows.forEach(h=>{const key=h&&h.qcLotId?'id:'+h.qcLotId:h&&h.lot?'lot:'+h.lot:'';if(!key){out.push(h);return;}if(indexes.has(key))out[indexes.get(key)]=h;else{indexes.set(key,out.length);out.push(h);}});
  if(target)target.meanSdHistory=out;return out;
}
/* Mỗi xét nghiệm/mức/lô chỉ có một cấu hình Mean/SD chuẩn trong lịch sử. Điểm QC
   đã tự giữ snapshot qcMean/qcSd lúc nhập, nên không cần nhân đôi cùng một lô chỉ
   để nhớ các lần sửa form; làm vậy còn khiến bảng lịch sử đếm cùng điểm QC nhiều lần. */
function upsertLotTargetHistory(target,lot,values){
  target.meanSdHistory=Array.isArray(target.meanSdHistory)?target.meanSdHistory:[];
  const matches=h=>h&&(h.qcLotId?h.qcLotId===lot.id:(h.lot||'')===(lot.lotNo||'')),existing=target.meanSdHistory.slice().reverse().find(matches);
  const entry={...(existing||{}),...values,id:existing&&existing.id||uid(),qcLotId:lot.id,lot:lot.lotNo};
  target.meanSdHistory=target.meanSdHistory.filter(h=>!matches(h));target.meanSdHistory.push(entry);return entry;
}
function inspectAcceptedLotTransition(tr){
  const from=state.qcLots.find(l=>l.id===tr.fromLotId),to=state.qcLots.find(l=>l.id===tr.toLotId),panel=state.qcPanels.find(p=>p.id===tr.panelId);
  if(!transitionSwitchesLot(tr)||!from||!to||!panel||+from.level!==+to.level)return{from,to,panel,rows:[],missing:[],valid:false};
  const rows=(panel.testIds||[]).map(id=>state.tests.find(t=>t.id===id)).filter(Boolean).map(t=>({t,cfg:(t.levels||[]).find(l=>l.qcLotId===from.id)})).filter(x=>x.cfg).map(x=>({...x,nextHist:(x.cfg.meanSdHistory||[]).slice().reverse().find(h=>(h.qcLotId===to.id||(!h.qcLotId&&(h.lot||'')===to.lotNo))&&Number.isFinite(+h.mean)&&Number.isFinite(+h.sd)&&+h.sd>0)}));
  return{from,to,panel,rows,missing:rows.filter(x=>!x.nextHist),valid:true};
}
function applyAcceptedLotTransitionToConfig(tr){
  const check=inspectAcceptedLotTransition(tr),{from,to,panel,rows,missing}=check;
  /* Chuyển lô là thao tác nguyên tử: không đổi nhóm/lô và tuyệt đối không mượn
     Mean/SD lô cũ nếu bất kỳ xét nghiệm liên quan nào chưa có target riêng lô mới. */
  if(!check.valid||!rows.length||missing.length)return 0;
  const groupKey=ids=>[...new Set(ids||[])].filter(id=>state.qcLots.some(l=>l.id===id)).sort().join('|');
  const groupName=ids=>(ids||[]).map(id=>(state.qcLots.find(l=>l.id===id)||{}).lotNo).filter(Boolean).join('/');
  const removeGroups=new Set();
  state.lotGroups.forEach(g=>{
    if(g.active===false)return;
    if(!(g.lotIds||[]).includes(from.id))return;
    const oldIds=[...new Set(g.lotIds||[])];
    const nextIds=[...new Set((g.lotIds||[]).map(id=>id===from.id?to.id:id))];
    const oldKey=groupKey(oldIds);
    const archived=state.lotGroups.find(x=>x.id!==g.id&&x.active===false&&x.stoppedByTransitionId===tr.id)||state.lotGroups.find(x=>x.active===false&&groupKey(x.lotIds)===oldKey);
    if(!archived){
      state.lotGroups.push({
        id:uid(),
        name:groupName(oldIds)||g.name,
        lotIds:oldIds,
        note:`Đã dừng khi chuyển tiếp lô ${from.lotNo} sang ${to.lotNo}`,
        active:false,
        status:'stopped',
        stoppedAt:tr.startDate||isoToday(),
        stoppedByTransitionId:tr.id
      });
    }
    const nextKey=groupKey(nextIds);
    const existing=state.lotGroups.find(x=>x.id!==g.id&&x.active!==false&&groupKey(x.lotIds)===nextKey);
    if(existing){
      removeGroups.add(g.id);
      try{if(typeof manageTargetGroup!=='undefined'&&manageTargetGroup===g.id)manageTargetGroup=existing.id;}catch(e){}
    }else{
      g.lotIds=nextIds;
      g.name=groupName(nextIds)||g.name;
    }
  });
  if(removeGroups.size)state.lotGroups=state.lotGroups.filter(g=>!removeGroups.has(g.id));
  normalizeLotGroups();
  let count=0;
  rows.forEach(({cfg,nextHist})=>{
    if(Number.isFinite(+cfg.mean)&&Number.isFinite(+cfg.sd)&&+cfg.sd>0)upsertLotTargetHistory(cfg,from,{mean:+cfg.mean,sd:+cfg.sd,low:cfg.low==null?null:+cfg.low,high:cfg.high==null?null:+cfg.high,effectiveFrom:(cfg.meanSdHistory||[]).find(h=>h.qcLotId===from.id)?.effectiveFrom||'',effectiveTo:tr.startDate||from.exp||'',source:cfg.applied||'mfg',planned:false,note:'Trước chuyển tiếp lô'});
    const next=upsertLotTargetHistory(cfg,to,{mean:+nextHist.mean,sd:+nextHist.sd,low:nextHist.low==null?null:+nextHist.low,high:nextHist.high==null?null:+nextHist.high,effectiveFrom:tr.startDate||isoToday(),effectiveTo:to.exp||'',source:nextHist.source||'mfg',planned:false,note:nextHist.note||`Chuyển tiếp từ lô ${from.lotNo}`});
    Object.assign(cfg,{level:to.level,qcLotId:to.id,lot:to.lotNo,exp:to.exp,mean:+next.mean,sd:+next.sd,low:next.low==null?null:+next.low,high:next.high==null?null:+next.high,rangeK:2,mfgMean:+next.mean,mfgSd:+next.sd,applied:next.source||'mfg'});
    count++;
  });
  return count;
}
function normalizeLotGroups(){
  const seen=new Map(),drop=new Set();
  (state.lotGroups||[]).forEach(g=>{
    g.lotIds=[...new Set(g.lotIds||[])].filter(id=>state.qcLots.some(l=>l.id===id));
    if(!g.lotIds.length)return;
    const name=g.lotIds.map(id=>(state.qcLots.find(l=>l.id===id)||{}).lotNo).filter(Boolean).join('/');
    if(name&&g.active!==false)g.name=name;
    const key=(g.active===false?'stopped':'active')+'|'+[...g.lotIds].sort().join('|');
    if(seen.has(key)){
      const keep=seen.get(key);
      try{if(typeof manageTargetGroup!=='undefined'&&manageTargetGroup===g.id)manageTargetGroup=keep;}catch(e){}
      drop.add(g.id);
    }else seen.set(key,g.id);
  });
  if(drop.size)state.lotGroups=state.lotGroups.filter(g=>!drop.has(g.id));
}
function clearDerived(){pointsCache.clear();pointsIndexCache.clear();pointsLotCache.clear();wgMemo.clear();acceptedMemo.clear();cusumMemo.clear();derivedIndex=null;try{statusMemo=new Map();}catch(e){}try{invalidateWestgardWorker();}catch(e){}}
function clearDerivedForTest(testId){
  const prefix=String(testId||'')+'|';
  [pointsCache,pointsIndexCache,pointsLotCache,cusumMemo].forEach(cache=>[...cache.keys()].forEach(k=>{if(String(k).startsWith(prefix))cache.delete(k);}));
  wgMemo.delete(testId);
  [...acceptedMemo.keys()].forEach(k=>{if(String(k).startsWith(prefix))acceptedMemo.delete(k);});
  try{if(statusMemo&&statusMemo.delete)statusMemo.delete(testId);}catch(e){}
  try{invalidateWestgardWorker(testId);}catch(e){}
}
function userName(){return currentUser?(currentUser.name||currentUser.username||'Người dùng'):'Hệ thống';}
function staffInitials(name){return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').split(/[^A-Za-z0-9]+/).filter(Boolean).map(x=>x.charAt(0)).join('').toUpperCase().slice(0,8)||'—';}
function currentStaff(){const name=userName();return{operatorId:currentUser&&currentUser.id||'',operatorUsername:currentUser&&currentUser.username||'',operatorName:name,operatorCode:currentUser&&currentUser.initials||staffInitials(name)};}
function pointStaff(p){const name=String(p&&p.operatorName||'').trim(),code=String(p&&p.operatorCode||'').trim().toUpperCase()||(name?staffInitials(name):'');return{name,code};}
function dateObj(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));return m?new Date(+m[1],+m[2]-1,+m[3]):new Date(s);}
function daysToExp(exp){if(!exp)return null;return Math.round((dateObj(exp)-new Date())/86400000);}
function fmt(x,d=2){return(x==null||isNaN(x))?'—':Number(x).toFixed(d);}
function isoDate(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function isoToday(){return isoDate();}
function isoMonth(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function periodOfDate(date){const m=/^(\d{4})-(\d{2})-\d{2}/.exec(String(date||''));return m?m[1]+'-'+m[2]:'';}
function periodLock(ym){return(state.periodLocks||[]).find(x=>x.ym===ym)||null;}
function isPeriodLocked(ym){return!!periodLock(ym);}
function periodLockText(ym){const l=periodLock(ym);return l?`Kỳ ${monthVN(ym)} đã chốt bởi ${l.lockedBy||'hệ thống'}${l.lockedAt?' lúc '+formatDateTimeVN(l.lockedAt):''}.`:'';}
async function requireUnlockedPeriod(date,action='sửa dữ liệu QC'){const ym=periodOfDate(date);if(!ym||!isPeriodLocked(ym))return true;await infoDialog(`Không thể ${action}: ${periodLockText(ym)} Muốn thay đổi cần admin mở khóa kỳ và ghi lý do.`);return false;}
function vnDate(s){if(!s)return '';s=String(s);const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?m[3]+'/'+m[2]+'/'+m[1]:s;}
function vnMonth(s){if(!s)return '';s=String(s).trim();let m=/^(\d{4})-(\d{2})/.exec(s);if(m)return'Tháng '+m[2]+'/'+m[1];m=/^(\d{1,2})\/(\d{4})$/.exec(s);return m?'Tháng '+m[1].padStart(2,'0')+'/'+m[2]:s;}
function vnPeriod(s){if(!s)return '';s=String(s).trim();let m=/^(\d{4})-(\d{2})/.exec(s);if(m)return'Kỳ '+m[2]+'/'+m[1];m=/^(\d{1,2})\/(\d{4})$/.exec(s);return m?'Kỳ '+m[1].padStart(2,'0')+'/'+m[2]:s;}
function monthVN(s){const m=/^(\d{4})-(\d{2})/.exec(String(s||''));return m?m[2]+'/'+m[1]:(s||'');}
function parseVNMonth(s){if(!s)return '';s=String(s).trim();let m=/^(\d{1,2})[\/.-](\d{4})$/.exec(s);if(m)return m[2]+'-'+m[1].padStart(2,'0');if(/^\d{4}-\d{2}$/.test(s))return s;return '';}
function formatDateTimeVN(s){const d=new Date(s);return isNaN(d)?'':d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})+' '+d.toLocaleDateString('vi-VN');}
function safeName(s){return String(s||'file').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.-]+/g,'_').replace(/^_+|_+$/g,'')||'file';}

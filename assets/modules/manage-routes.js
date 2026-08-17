/* ===== MANAGEMENT PAGE ROUTES ===== */
function manageSearchSet(v){
  manageQ=v;
  scheduleSearchRender(manageSearchSet,renderManageBody,'manageSearch');
}
function manageMatch(values){return globalThis.manageSearchMatchPresentation(values,manageQ,searchText);}
function manageSearchPlaceholder(){return globalThis.manageSearchPlaceholderPresentation(manageTab);}
function groupsOfLot(id){return globalThis.groupsOfLotPresentation(state.lotGroups,id);}
function lotGroupLabels(id){return globalThis.manageLotGroupLabelsPresentation(state.lotGroups,id);}
function instrumentName(id,fallback=''){return globalThis.manageInstrumentNamePresentation(state.instruments,id,fallback);}
function panelName(id){return globalThis.managePanelNamePresentation(state.qcPanels,id);}
function lotLabel(id){return globalThis.manageLotLabelPresentation(state.qcLots,id);}
function lotTransitionToNo(lotId){return globalThis.lotTransitionTargetNumberPresentation(state.lotTransitions||[],state.qcLots,lotId,transitionSwitchesLot);}
function lotStatus(l){return globalThis.manageLotStatusPresentation(l,lotTransitionToNo(l.id));}
function manageShell(body){
  const histCount=state.tests.reduce((n,t)=>n+(t.levels||[]).reduce((m,l)=>m+Math.max(1,(l.meanSdHistory||[]).length),0),0);
  const items=[['instruments','Máy xét nghiệm'],['assays','Danh mục xét nghiệm'],['panels','Panel QC'],['lots','Lô & Nhóm QC'],['targets','Mean/SD'],['transitions','Chuyển tiếp lô'],['history','Lịch sử dữ liệu'],['tearefs','Bảng TEa tham chiếu']],counts={lots:state.qcLots.length+' / '+state.lotGroups.length,panels:state.qcPanels.length,targets:state.tests.reduce((n,t)=>n+t.levels.filter(l=>l.qcLotId).length,0),history:histCount,transitions:state.lotTransitions.length,assays:state.tests.length,instruments:state.instruments.length,tearefs:effectiveTeaRefs().length};
  return globalThis.manageShellPresentation(items.map(x=>({id:x[0],label:x[1],count:counts[x[0]]||''})),manageTab,body);
}
function manageToolbar(title,sub,action,label){
  const ph=manageSearchPlaceholder();
  return globalThis.manageToolbarPresentation({title,subtitle:sub,placeholder:ph,query:manageQ,action,actionLabel:label});
}
function manageLots(){
  const rows=state.qcLots.filter(l=>manageMatch([l.lotNo,l.description,l.supplier,l.program,lotGroupLabels(l.id),l.level,l.exp])).map(l=>{const used=state.tests.reduce((n,t)=>n+t.levels.filter(x=>x.qcLotId===l.id).length,0),s=lotStatus(l),model={id:l.id,lotNo:l.lotNo,description:l.description,program:l.program,level:l.level,expiry:l.exp?vnDate(l.exp):'',status:s,used};return globalThis.manageLotRowPresentation(model);}).join('');
  const groupRows=state.lotGroups.filter(g=>manageMatch([g.name,g.note,...(g.lotIds||[]).map(id=>(state.qcLots.find(l=>l.id===id)||{}).lotNo)])).map(g=>{
    const lots=(g.lotIds||[]).map(id=>state.qcLots.find(l=>l.id===id)).filter(Boolean),archived=g.active===false;
    /* archived (g.active===false): nhóm đã lưu trữ. stopped/planned: giữ liên kết lô để
       xem lịch sử hoặc kích hoạt lại nhưng bị khóa khỏi Nhập QC. lotGroupInUse() chỉ cho
       biết nhóm còn được cấu hình Mean/SD tham chiếu hay không; trạng thái vận hành thật
       được isOperationalLotGroup() quyết định. */
    const inUse=lotGroupInUse(g);
    const statusTag=globalThis.lotGroupStatusPresentation(archived,g.status,inUse);
    const toggle=globalThis.lotGroupToggleActionPresentation(archived,g.status,inUse),toggleBtn=toggle?btn(toggle.label,toggle.command==='activate'?`activateLotGroup('${g.id}')`:`toggleLotGroupStatus('${g.id}')`,toggle.variant):'';
    const lotsHtml=globalThis.lotGroupLotPillsHtml(lots.map(l=>({lotNo:esc(l.lotNo),level:l.level}))),actionsHtml=btn('Sửa nhóm',`openConfigGroup('${g.id}')`,'ghost sm')+btn('Mean/SD',`openTargetMatrix('','${g.id}')`,'ghost sm')+toggleBtn+btn('Xóa',`deleteConfigGroup('${g.id}')`,'danger sm'),model={archived,name:g.name,note:g.note,status:statusTag,lotsHtml,actionsHtml};return globalThis.manageLotGroupCardPresentation(model);}).join('');
  return manageToolbar('Lô & Nhóm QC','Quản lý từng lô và nhóm lô QC.')+globalThis.manageLotConfigLayoutPresentation({lotAddButtonHtml:btn('Thêm lô QC','openConfigLot()','teal sm'),lotRowsHtml:rows,lotEmptyHtml:emptyState('Chưa có lô QC','Tạo từng lô QC độc lập, sau đó nhập Mean/SD cho Panel QC.'),groupAddButtonHtml:btn('Thêm nhóm lô','openConfigGroup()','teal sm'),groupRowsHtml:groupRows,groupEmptyHtml:emptyState('Chưa có nhóm lô','Chọn các lô QC đã tạo để ghép thành một nhóm, ví dụ 1101/1102.')});
}
function manageInstruments(){
  const rows=state.instruments.filter(i=>manageMatch([i.name,i.manufacturer,i.model,i.serial,i.section])).map(i=>{const n=state.tests.filter(t=>t.instrumentId===i.id).length;const model={id:i.id,name:i.name,section:i.section,manufacturer:i.manufacturer,serial:i.serial,assayCount:n,active:!!i.active};return globalThis.manageInstrumentRowPresentation(model);}).join('');
  return manageToolbar('Máy xét nghiệm','Quản lý máy xét nghiệm, hãng và số sê-ri.',"openConfigInstrument()",'Thêm máy xét nghiệm')+globalThis.manageInstrumentTablePresentation({rowsHtml:rows,emptyHtml:emptyState('Chưa có máy xét nghiệm','Thêm máy trước khi cấu hình xét nghiệm.')});
}
function managePanels(){
  const rows=state.qcPanels.filter(p=>manageMatch([p.name,p.note,instrumentName(p.instrumentId),...(p.testIds||[]).map(id=>(state.tests.find(t=>t.id===id)||{}).name)])).map(p=>{const tests=(p.testIds||[]).map(id=>state.tests.find(t=>t.id===id)).filter(Boolean),testsHtml=tests.map(t=>`<span class="pill">${esc(testDisplayName(t))}</span>`).join(''),model={id:p.id,name:p.name,instrument:instrumentName(p.instrumentId),testsHtml,testCount:tests.length,active:p.active!==false};return globalThis.managePanelRowPresentation(model);}).join('');
  return manageToolbar('Panel QC','Nhóm các xét nghiệm theo từng máy để thiết lập và quản lý QC.',"openConfigPanel()",'Thêm Panel QC')+globalThis.managePanelTablePresentation({rowsHtml:rows,emptyHtml:emptyState('Chưa có Panel QC','Tạo Panel QC trước, sau đó nhập Mean/SD theo nhóm lô trong thẻ Mean/SD.')});
}
function manageTransitionsV2(){
  const rows=state.lotTransitions.filter(tr=>manageMatch([panelName(tr.panelId),lotLabel(tr.fromLotId),lotLabel(tr.toLotId),tr.startDate,tr.status,tr.approvedBy])).map(tr=>{const s=globalThis.manageTransitionStatusPresentation(tr.status),to=state.qcLots.find(l=>l.id===tr.toLotId),details=globalThis.manageTransitionDetailsPresentation({movedLotNo:transitionSwitchesLot(tr)&&to?esc(to.lotNo):'',approvalText:tr.approvedBy?esc(tr.approvedBy)+(tr.approvedAt?' · '+formatDateTimeVN(tr.approvedAt):''):''}),model={id:tr.id,panel:panelName(tr.panelId),fromLot:lotLabel(tr.fromLotId),toLot:lotLabel(tr.toLotId),startDate:tr.startDate?vnDate(tr.startDate):'',status:s,movedHtml:details.movedHtml,approvalHtml:details.approvalHtml};return globalThis.manageTransitionRowPresentation(model);}).join('');
  return manageToolbar('Chuyển tiếp lô QC','Theo dõi lô cũ, lô mới và trạng thái khi thay lô.',"openLotTransitionV2()",'Thêm hồ sơ chuyển lô')+globalThis.manageTransitionTablePresentation({rowsHtml:rows,emptyHtml:emptyState('Chưa có hồ sơ chuyển lô','Tạo hồ sơ để theo dõi chuyển từ lô cũ sang lô mới.')});
}
function targetGroupLots(group){return globalThis.targetGroupLotsPresentation(state.qcLots,group);}
function targetGroupOptions(){
  const groups=state.lotGroups.filter(g=>g.active!==false);
  return globalThis.targetGroupOptionsPresentation(groups,manageTargetGroup,targetGroupLots,globalThis.targetGroupLabelPresentation,globalThis.targetGroupStatusSuffixPresentation,esc);
}
function ensureTargetSelection(){
  const picked=globalThis.targetSelectionPresentation(state.qcPanels,state.lotGroups,manageTargetPanel,manageTargetGroup,targetGroupLots);manageTargetPanel=picked.panelId;manageTargetGroup=picked.groupId;
}
function manageTargets(){
  ensureTargetSelection();
  const prerequisite=globalThis.targetPrerequisitePresentation({tests:state.tests.length,panels:state.qcPanels.length,lots:state.qcLots.length,groups:state.lotGroups.length});
  if(prerequisite==='tests')return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC để nhập Mean/SD hàng loạt.',"setManageTab('assays')",'Thêm xét nghiệm')+globalThis.manageEmptyPanelPresentation(emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó quay lại nhập Mean/SD theo nhóm lô.'));
  if(prerequisite==='panels')return manageToolbar('Mean/SD theo nhóm lô QC','Chỉ dùng Panel QC để nhập Mean/SD hàng loạt.',"setManageTab('panels')",'Thêm Panel QC')+globalThis.manageEmptyPanelPresentation(emptyState('Chưa có Panel QC','Tạo Panel QC và chọn các xét nghiệm thành viên trước, sau đó quay lại nhập Mean/SD theo nhóm lô.'));
  if(prerequisite==='lots')return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.',"setManageTab('lots')",'Thêm lô QC')+globalThis.manageEmptyPanelPresentation(emptyState('Chưa có lô QC','Tạo lô QC trước, gom vào nhóm lô rồi quay lại nhập Mean/SD theo nhóm.'));
  if(prerequisite==='groups')return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.',"setManageTab('lots')",'Thêm nhóm lô')+globalThis.manageEmptyPanelPresentation(emptyState('Chưa có nhóm lô QC','Tạo nhóm lô từ các lô QC trước, sau đó quay lại nhập Mean/SD theo nhóm.'));
  const group=state.lotGroups.find(x=>x.id===manageTargetGroup),groupLots=targetGroupLots(group),targetLevelPick=globalThis.targetLevelSelectionPresentation(groupLots,manageTargetLevel),targetLevels=targetLevelPick.levels;
  manageTargetLevel=targetLevelPick.level;
  const selectedLevel=Number(manageTargetLevel),levelLotPick=globalThis.targetLevelLotsPresentation(groupLots,selectedLevel),levelLots=levelLotPick.levelLots,levelDepletedLots=levelLotPick.depletedLots,q=searchText(manageQ),allTests=globalThis.targetPanelTestsPresentation(state.qcPanels,state.tests,manageTargetPanel),tests=allTests.filter(t=>!q||globalThis.targetSearchValuesPresentation(t,group&&group.name,levelLots,testDisplayName,instrumentName).some(v=>searchText(v).includes(q)));
  if(!group||!groupLots.length)return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.')+globalThis.manageEmptyPanelPresentation(emptyState('Nhóm lô chưa có lô QC','Sửa nhóm lô và chọn các lô QC cần dùng trước.'));
  const rowItems=globalThis.targetMatrixItemsPresentation(tests,levelLots,targetConfigAssigned,plannedTargetFor,lotTargetSnapshot);
  const targetStats=globalThis.targetMatrixStatsPresentation(rowItems);
  const rows=rowItems.map(({t,lot,linked,same,assigned,planned,cfg})=>{const draft=targetRangeDraft(cfg||{}),rowState=globalThis.targetRowStatePresentation(linked,assigned,planned,lot.depleted),locked=rowState.locked,retiredTo=locked?lotTransitionToNo(lot.id):'',checked=rowState.checked,disabled=rowState.disabled;return globalThis.targetMatrixRowPresentation({testId:t.id,lotId:lot.id,locked,checked,disabled,name:testDisplayName(t),unit:t.unit,mean:targetNumberText(draft.mean,t),low:targetNumberText(draft.low,t),high:targetNumberText(draft.high,t),sd:targetNumberText(draft.sd,t,'stat'),status:rowState.status,retiredTo,otherLot:same&&same.lot},esc,escAttr);}).join('');
  const targetLevelTabs=globalThis.targetLevelTabsPresentation(targetLevels,manageTargetLevel),targetLevelToolbar=globalThis.targetLevelToolbarPresentation(manageTargetLevel,levelLots.map(l=>l.lotNo),targetLevelTabs,esc),targetContent=rowItems.length?targetLevelToolbar+globalThis.targetMatrixTablePresentation(rows)+globalThis.targetMatrixActionsPresentation(btn('Bỏ chọn tất cả','targetCheckAll(false)','ghost'),btn('Chọn tất cả','targetCheckAll(true)','ghost'),btn('Lưu Mean/SD mức này','saveTargetMatrix()','teal')):(()=>{const empty=globalThis.targetEmptyStatePresentation(allTests.length,levelLots.map(l=>l.lotNo),levelDepletedLots.map(l=>l.lotNo),manageTargetLevel);return emptyState(empty.title,empty.description);})();
  return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô, app tự đưa các xét nghiệm trong panel vào bảng Mean/SD.')+
  globalThis.targetMatrixPanelPresentation({selectorHtml:globalThis.targetSelectorPresentation(globalThis.targetPanelOptionsPresentation(state.qcPanels,manageTargetPanel,instrumentName,esc),targetGroupOptions()),summaryHtml:rowItems.length?globalThis.targetSummaryPresentation(targetStats):'',contentHtml:targetContent});
}
function manageAssays(){
  const matched=state.tests.filter(t=>manageMatch([t.name,testDisplayName(t),t.unit,t.method,t.reagent,instrumentName(t.instrumentId,t.machine),t.section,t.tea]));
  const rows=matched.map((t,idx)=>{const model={index:idx+1,id:t.id,name:testDisplayName(t),method:t.method,unit:t.unit,instrument:instrumentName(t.instrumentId,t.machine),section:t.section,reagent:t.reagent,tea:t.tea,closed:!!t.closed};return globalThis.manageAssayRowPresentation(model);}).join('');
  return manageToolbar('Danh mục xét nghiệm','Quản lý xét nghiệm, máy, đơn vị, phương pháp và TEa.',"openConfigAssay()",'Thêm xét nghiệm')+globalThis.manageAssayTablePresentation({rowsHtml:rows,emptyHtml:emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó gán lô và Mean/SD ở các thẻ cấu hình tương ứng.')});
}
function manageHistorySearchValues(t){
  return globalThis.historySearchValuesPresentation(t,state.qcLots,testDisplayName);
}
function manageHistory(){
  const q=searchText(manageQ),matches=state.tests.filter(t=>!q||manageHistorySearchValues(t).some(v=>searchText(v).includes(q)));
  if(!state.tests.length)return manageToolbar('Lịch sử dữ liệu QC','Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.')+globalThis.manageEmptyPanelPresentation(emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó cấu hình lô và Mean/SD.'));
  if(!matches.length)return manageToolbar('Lịch sử dữ liệu QC','Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.')+globalThis.manageEmptyPanelPresentation(emptyState('Không tìm thấy xét nghiệm','Thử tìm theo tên xét nghiệm.'));
  const historyPick=globalThis.historyAssaySelectionPresentation(matches,manageHistoryTest);
  manageHistoryTest=historyPick.selectedId;
  const t=historyPick.assay;
  const opts=globalThis.historyAssayOptionsPresentation(matches,t.id,testDisplayName,esc);
  const rows=globalThis.historyRowsPresentation(t,state.qcLots,state.data[t.id]||[],lotGroupLabels);
  const visibleRows=globalThis.historyVisibleRowsPresentation(rows,t.name,q,searchText);
  const html=globalThis.historyRowSortPresentation(visibleRows).map(r=>{
    const period=globalThis.historyPeriodLabelPresentation(r.h.effectiveFrom,r.h.effectiveTo,vnDate);
    const model={testId:r.t.id,level:r.l.level,lot:r.lotNo||'',group:r.group,mean:fmtTestValue(r.t,r.h.mean),low:r.h.low!=null?fmtTestValue(r.t,r.h.low):'—',high:r.h.high!=null?fmtTestValue(r.t,r.h.high):'—',sd:fmtTestValue(r.t,r.h.sd),period,source:r.h.source,pointCount:r.pts.length};return globalThis.manageHistoryRowPresentation(model);
  }).join('');
  const historyTotals=globalThis.historySummaryPresentation(visibleRows);
  return manageToolbar('Lịch sử dữ liệu QC','Chọn một xét nghiệm để xem các lô/Mean-SD đã từng dùng.')+
  globalThis.historyPanelPresentation({selectorHtml:globalThis.historySelectorPresentation(opts,historyTotals.rowCount,historyTotals.pointCount),tableHtml:globalThis.historyTablePresentation(html,q?emptyState('Không tìm thấy mốc phù hợp','Thử tìm theo tên xét nghiệm, mức hoặc lô QC.'):emptyState('Chưa có lịch sử lô','Xét nghiệm này chưa được gán lô/Mean-SD.'))});
}
/* ===== Bảng TEa tham chiếu (CLIA/Ricos/chuẩn hóa PXN) sửa được trong app ===== */
const TEA_LAB_BASIS_SOURCES=[['regulation','Quy định pháp lý / CLIA / quốc gia'],['pt','Chương trình ngoại kiểm / PT'],['eflm','EFLM Biological Variation'],['ricos','Ricos / Westgard BV (nguồn cũ)'],['professional','Hiệp hội / ủy ban chuyên môn'],['other','Nguồn khác đã thẩm định']];
function teaRefFind(refKey){return globalThis.TeaReferenceService.find(state,refKey);}
function teaRefNumOrNull(v){return globalThis.TeaReferenceService.numberOrNull(v);}
function teaRefExternalChanged(row,refKey){return globalThis.TeaReferenceService.externalChanged(row,refKey);}
function teaRefEnsure(refKey){return globalThis.TeaReferenceService.ensure(state,refKey).record;}
/* Sửa/xóa/thêm dòng TEa tham chiếu có thể ảnh hưởng TEa% của NHIỀU xét nghiệm
   đang track Sigma cùng lúc (không chỉ xét nghiệm đang mở) — đồng bộ lại snapshot
   kỳ hiện tại của tất cả trước khi lưu, để Sigma không hiển thị TEa cũ cho tới
   khi ai đó tình cờ mở lại trang đó. */
function teaRefEdit(name,field,val){if(!requireAdmin())return;const {record:e,before}=globalThis.TeaReferenceService.edit(state,name,field,val);logAct('Cập nhật TEa tham chiếu',`${e.name} · ${field.toUpperCase()}: ${before??'—'} → ${e[field]??'—'} · ${e.sources[field].version||'không phiên bản'}`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});rerender();}
function teaRefRemove(refKey){if(!requireAdmin())return;const row=teaRefFind(refKey),isDefault=teaRefIsDefault(refKey);globalThis.TeaReferenceService.restoreOrRemove(state,refKey,isDefault);logAct(isDefault?'Khôi phục TEa mặc định':'Xóa TEa tự thêm',row&&row.name||refKey,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});rerender();}
function teaSourceRegistryHtml(){const items=globalThis.teaSourceRegistryItemsPresentation(TEA_SOURCE_REGISTRY,vnDate);return globalThis.teaSourceRegistryPresentation(items);}
function teaRefOpenAdd(){
  if(!requireAdmin())return;
  openModal(globalThis.teaReferenceAddModalPresentation({cancelButtonHtml:btn('Hủy','closeModal()','ghost'),submitButtonHtml:btn('Thêm xét nghiệm','teaRefAddSubmit()','teal')}));
  setTimeout(()=>{const el=document.getElementById('trAddName');if(el)el.focus();},0);
}
async function teaRefAddSubmit(){
  if(!requireAdmin())return;
  const name=QCCore.cleanText(document.getElementById('trAddName').value,120).trim();
  if(!name){await infoDialog('Nhập tên xét nghiệm.');return;}
  const input={name,abbreviation:QCCore.cleanText(document.getElementById('trAddAbbreviation').value,40).trim(),matrix:QCCore.cleanText(document.getElementById('trAddMatrix').value,80).trim(),unit:QCCore.cleanText(document.getElementById('trAddUnit').value,40),section:QCCore.cleanText(document.getElementById('trAddSection').value,80),clia:document.getElementById('trAddClia').value,ricos:document.getElementById('trAddRicos').value},e=globalThis.TeaReferenceService.addCustomReference(state,input).record;
  logAct('Thêm TEa tham chiếu',`${e.name} · CLIA ${e.clia??'—'} · Ricos ${e.ricos??'—'}`,'Bảng TEa');
  if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save();closeModal();rerender();
}
function teaLabProfileOpen(refKey){
  if(!requireAdmin())return;const ref=effectiveTeaRefs().find(r=>r[6]===refKey||teaRefName(r[0])===teaRefName(refKey));if(!ref)return;const row=teaRefFind(refKey),meta=row&&row.sources&&row.sources.lab||{},source=row&&row.labSource||'',sourceOpts=['<option value="">— Chọn nguồn chính —</option>',...TEA_LAB_BASIS_SOURCES.map(([v,label])=>`<option value="${v}" ${source===v?'selected':''}>${esc(label)}</option>`)].join(''),effective=meta.effectiveDate||isoToday(),approvedDate=meta.reviewedDate||isoToday(),prepared=row&&row.labPreparedBy||userName(),approved=meta.reviewedBy||userName(),nextReview=row&&row.labNextReviewDate||'';
  const body=globalThis.teaReferenceLabProfileBodyPresentation({labValue:row&&row.lab!=null?row.lab:'',sourceOptionsHtml:sourceOpts,referenceValue:escAttr(meta.document||''),reasonHtml:esc(meta.note||''),effectiveDateHtml:dateBox('teaLabEffectiveDate',effective,'manage-date','aria-label="Ngày hiệu lực TEa chuẩn hóa"'),nextReviewDateHtml:dateBox('teaLabNextReviewDate',nextReview,'manage-date','aria-label="Ngày xem xét lại TEa chuẩn hóa"'),preparedValue:escAttr(prepared),approvedValue:escAttr(approved),approvedDateHtml:dateBox('teaLabApprovedDate',approvedDate,'manage-date','aria-label="Ngày phê duyệt TEa chuẩn hóa"')});
  const hasProfile=row&&row.lab!=null,remove=hasProfile?btn('Xóa TEa chuẩn hóa',`teaLabProfileRemove('${escAttr(refKey)}')`,'danger'):'';
  openModal(globalThis.teaReferenceLabProfileModalHtml({title:hasProfile?'Sửa hồ sơ TEa chuẩn hóa':'Thêm hồ sơ TEa chuẩn hóa',bodyHtml:body,removeButtonHtml:remove,cancelButtonHtml:btn('Hủy','closeModal()','ghost'),saveButtonHtml:btn(hasProfile?'Lưu thay đổi':'Thêm hồ sơ TEa',`teaLabProfileSave('${escAttr(refKey)}')`,'teal')}));
  setTimeout(()=>{const e=document.getElementById('teaLabValue');if(e)e.focus();},0);
}
async function teaLabProfileSave(refKey){
  if(!requireAdmin())return;const get=id=>String(document.getElementById(id)&&document.getElementById(id).value||'').trim(),value=teaRefNumOrNull(get('teaLabValue')),source=get('teaLabSource'),reference=QCCore.cleanText(get('teaLabReference'),500),reason=QCCore.cleanText(get('teaLabReason'),4000),effective=parseVN(get('teaLabEffectiveDate'))||'',nextReview=parseVN(get('teaLabNextReviewDate'))||'',prepared=QCCore.cleanText(get('teaLabPreparedBy'),120),approved=QCCore.cleanText(get('teaLabApprovedBy'),120),approvedDate=parseVN(get('teaLabApprovedDate'))||'';
  const basisLabel=globalThis.teaLabBasisLabelPresentation(TEA_LAB_BASIS_SOURCES,source);if(value==null){await infoDialog('Nhập TEa chuẩn hóa lớn hơn 0%.');return;}if(!basisLabel){await infoDialog('Chọn nguồn chính của TEa chuẩn hóa.');return;}if(reference.length<3){await infoDialog('Nhập tài liệu, phiên bản hoặc đường dẫn tham chiếu.');return;}if(reason.length<10){await infoDialog('Lý do lựa chọn cần ít nhất 10 ký tự.');return;}if(!effective||!approvedDate){await infoDialog('Nhập ngày hiệu lực và ngày phê duyệt hợp lệ.');return;}if(approvedDate>effective){await infoDialog('Ngày phê duyệt không được sau ngày hiệu lực.');return;}if(nextReview&&nextReview<effective){await infoDialog('Ngày xem xét lại không được trước ngày hiệu lực.');return;}if(!prepared||!approved){await infoDialog('Nhập người xây dựng và người phê duyệt.');return;}
  const profile={value,source,sourceLabel:basisLabel,reference,reason,effective,nextReview,prepared,approved,approvedDate},{record:row,before}=globalThis.TeaReferenceService.saveLabProfile(state,refKey,profile);
  logAct(before==null?'Thiết lập TEa chuẩn hóa':'Cập nhật TEa chuẩn hóa',`${row.name} · ${before??'—'}% → ${value}% · ${basisLabel} · ${reference} · Hiệu lực ${vnDate(effective)} · Xây dựng: ${prepared} · Phê duyệt: ${approved} (${vnDate(approvedDate)})${nextReview?' · Xem xét lại '+vnDate(nextReview):''} · Lý do: ${reason}`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});closeModal();rerender();
}
async function teaLabProfileRemove(refKey){
  if(!requireAdmin())return;const row=teaRefFind(refKey);if(!row||row.lab==null)return;const ok=await confirmDialog({kicker:'TEa chuẩn hóa',title:'Xóa TEa chuẩn hóa?',message:`${teaAnalyteDisplay(row.name,row)} · ${row.lab}%`,detail:'Các kỳ Sigma cũ vẫn giữ ảnh chụp TEa đã sử dụng. Kỳ hiện tại sẽ không còn dùng nguồn TEa chuẩn hóa này.',confirmLabel:'Xóa TEa',cancelLabel:'Hủy',danger:true});if(!ok)return;const isDefault=teaRefIsDefault(refKey),{before}=globalThis.TeaReferenceService.removeLabProfile(state,refKey,isDefault);logAct('Xóa TEa chuẩn hóa',`${row.name} · ${before}%`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});closeModal();rerender();
}
function manageTeaRefs(){
  const canManage=role()==='admin',ro=canManage?'':'disabled';
  const overMap=new Map((state.teaRefs||[]).map(r=>[r.analyteId||teaAnalyteMeta(r.name,r).analyteId||teaRefName(r.name),r]));
  const rows=effectiveTeaRefs()
    .map(([name,unit,clia,ricos,section,,analyteId,lab])=>{const isDef=teaRefIsDefault(analyteId),record=overMap.get(analyteId),naming=teaAnalyteMeta(name,record),externalChanged=teaRefExternalChanged(record,analyteId),kind=globalThis.teaReferenceKindPresentation(isDef,externalChanged,!!(record&&record.lab!=null));return{name,unit,clia,ricos,lab,section,analyteId,record,...naming,kind};})
    .filter(r=>manageMatch([r.name,r.displayName,r.standardName,r.abbreviation,...r.aliases,r.matrix,r.unit,r.section]));
  globalThis.teaReferenceSortPresentation(rows);
  const teaStatus=kind=>globalThis.teaReferenceStatusPresentation(kind);
  const body=rows.map(r=>{
    const rowActions=globalThis.teaReferenceRowActionsPresentation(r.kind,canManage,r.lab!=null),act=rowActions.action==='restore'?btn('Khôi phục',`teaRefRemove('${escAttr(r.analyteId)}')`,'ghost sm','Khôi phục giá trị mặc định'):rowActions.action==='remove'?`<button class="x" onclick="teaRefRemove('${escAttr(r.analyteId)}')" title="Xóa xét nghiệm tự thêm">✕</button>`:'';
    const namingTitle=globalThis.teaReferenceNamingTitlePresentation(r);
    const labButton=rowActions.labProfile==='none'?'':btn(rowActions.labProfile==='add'?'Thêm hồ sơ':'Xem hồ sơ',`teaLabProfileOpen('${escAttr(r.analyteId)}')`,'ghost sm',rowActions.labProfile==='add'?'Lập hồ sơ TEa chuẩn hóa':'Xem hoặc cập nhật nguồn và lý do lựa chọn');
    return globalThis.teaReferenceRowPresentation({namingTitle:escAttr(namingTitle),displayName:esc(r.displayName||r.name),unit:esc(r.unit||'—'),section:esc(r.section||'—'),disabled:ro,cliaValue:globalThis.teaReferenceInputValuePresentation(r.clia),ricosValue:globalThis.teaReferenceInputValuePresentation(r.ricos),cliaChangeAction:`teaRefEdit('${escAttr(r.analyteId)}','clia',this.value)`,ricosChangeAction:`teaRefEdit('${escAttr(r.analyteId)}','ricos',this.value)`,labCellHtml:globalThis.teaReferenceLabValuePresentation(r.lab,fmt)+labButton,statusHtml:teaStatus(r.kind),actionHtml:act});
  }).join('');
  const empty=globalThis.teaReferenceEmptyStatePresentation(!!searchText(manageQ));
  return manageToolbar('Bảng TEa tham chiếu','Tổng hợp TEa từ các nguồn tham chiếu, dùng thống nhất khi tính Sigma.',canManage?'teaRefOpenAdd()':'','Thêm xét nghiệm')+teaSourceRegistryHtml()+globalThis.teaReferenceTablePresentation({rowsHtml:body,emptyHtml:emptyState(empty.title,empty.description)});
}
function manageView(){
  const views={lots:manageLots,panels:managePanels,targets:manageTargets,history:manageHistory,transitions:manageTransitionsV2,assays:manageAssays,instruments:manageInstruments,tearefs:manageTeaRefs};
  if(!views[manageTab])manageTab='instruments';return views[manageTab]();
}
function renderManageBody(){
  const el=document.querySelector('.config-shell-main');
  if(page!=='manage'||!el){rerender();return;}
  el.innerHTML=manageView();
}
function pageManage(){
  const head=headOnly('Cấu hình chung','Quản lý máy, Panel QC, lô QC, Mean/SD và luật QC'),shell=manageShell(manageView());
  return globalThis.managePageHtml(head,shell);
}

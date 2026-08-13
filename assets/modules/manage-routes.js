/* ===== MANAGEMENT PAGE ROUTES ===== */
function manageSearchSet(v){
  manageQ=v;
  scheduleSearchRender(manageSearchSet,renderManageBody,'manageSearch');
}
function manageMatch(values){return globalThis.manageSearchMatchPresentation(values,manageQ,searchText);}
function manageSearchPlaceholder(){return globalThis.manageSearchPlaceholderPresentation(manageTab);}
function sameText(a,b){return globalThis.sameNormalizedTextPresentation(a,b);}
function sameIdSet(a,b){return globalThis.sameIdSetPresentation(a,b);}
function groupsOfLot(id){return globalThis.groupsOfLotPresentation(state.lotGroups,id);}
function lotGroupLabels(id){return globalThis.manageLotGroupLabelsPresentation(state.lotGroups,id);}
function instrumentName(id,fallback=''){return globalThis.manageInstrumentNamePresentation(state.instruments,id,fallback);}
function panelName(id){return globalThis.managePanelNamePresentation(state.qcPanels,id);}
function lotLabel(id){return globalThis.manageLotLabelPresentation(state.qcLots,id);}
function lotTransitionToNo(lotId){return globalThis.lotTransitionTargetNumberPresentation(state.lotTransitions||[],state.qcLots,lotId,transitionSwitchesLot);}
function lotStatus(l){return globalThis.manageLotStatusPresentation(l,lotTransitionToNo(l.id));}
function transitionStatusLabelV2(s){return globalThis.manageTransitionStatusPresentation(s);}
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
    const statusTag=archived?{cls:'rej',text:'Đã lưu trữ'}:g.status==='stopped'?{cls:'rej',text:'Đã dừng'}:g.status==='planned'?{cls:'warn',text:'Dự kiến'}:inUse?{cls:'ok',text:'Đang hoạt động'}:{cls:'none',text:'Chưa dùng'};
    const toggleBtn=archived?'':(g.status==='stopped'||g.status==='planned'||!inUse)
      ?btn('Kích hoạt',`activateLotGroup('${g.id}')`,'teal sm')
      :btn('Dừng',`toggleLotGroupStatus('${g.id}')`,'ghost sm btn-stop-tint');
    const lotsHtml=lots.map(l=>`<span class="pill">${esc(l.lotNo)} · M${l.level}</span>`).join(''),actionsHtml=btn('Sửa nhóm',`openConfigGroup('${g.id}')`,'ghost sm')+btn('Mean/SD',`openTargetMatrix('','${g.id}')`,'ghost sm')+toggleBtn+btn('Xóa',`deleteConfigGroup('${g.id}')`,'danger sm'),model={archived,name:g.name,note:g.note,status:statusTag,lotsHtml,actionsHtml};return globalThis.manageLotGroupCardPresentation(model);}).join('');
  return manageToolbar('Lô & Nhóm QC','Quản lý từng lô và nhóm lô QC.')+
  `<div class="lot-config-grid">
    <div class="panel rcfg-list lot-config-left">
      <div class="rcfg-panel-h"><h3>Lô QC</h3>${btn('Thêm lô QC','openConfigLot()','teal sm')}</div>
      ${rows?`<table class="lot-table"><thead><tr><th>Số lô</th><th>Mức</th><th>Hạn dùng</th><th>Trạng thái</th><th class="num">Gán</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có lô QC','Tạo từng lô QC độc lập, sau đó nhập Mean/SD cho Panel QC.')}
    </div>
    <div class="panel rcfg-list lot-config-right">
      <div class="rcfg-panel-h"><h3>Nhóm lô QC</h3>${btn('Thêm nhóm lô','openConfigGroup()','teal sm')}</div>
      ${groupRows?`<div class="lot-group-list">${groupRows}</div>`:emptyState('Chưa có nhóm lô','Chọn các lô QC đã tạo để ghép thành một nhóm, ví dụ 1101/1102.')}
    </div>
  </div>`;
}
function manageInstruments(){
  const rows=state.instruments.filter(i=>manageMatch([i.name,i.manufacturer,i.model,i.serial,i.section])).map(i=>{const n=state.tests.filter(t=>t.instrumentId===i.id).length;const model={id:i.id,name:i.name,section:i.section,manufacturer:i.manufacturer,serial:i.serial,assayCount:n,active:!!i.active};return globalThis.manageInstrumentRowPresentation(model);}).join('');
  return manageToolbar('Máy xét nghiệm','Quản lý máy xét nghiệm, hãng và số sê-ri.',"openConfigInstrument()",'Thêm máy xét nghiệm')+`<div class="panel rcfg-list">${rows?`<table class="instrument-table"><thead><tr><th>Máy xét nghiệm</th><th>Nhà sản xuất</th><th>Số sê-ri</th><th class="num">Xét nghiệm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có máy xét nghiệm','Thêm máy trước khi cấu hình xét nghiệm.')}</div>`;
}
function managePanels(){
  const rows=state.qcPanels.filter(p=>manageMatch([p.name,p.note,instrumentName(p.instrumentId),...(p.testIds||[]).map(id=>(state.tests.find(t=>t.id===id)||{}).name)])).map(p=>{const tests=(p.testIds||[]).map(id=>state.tests.find(t=>t.id===id)).filter(Boolean),testsHtml=tests.map(t=>`<span class="pill">${esc(testDisplayName(t))}</span>`).join(''),model={id:p.id,name:p.name,instrument:instrumentName(p.instrumentId),testsHtml,testCount:tests.length,active:p.active!==false};return globalThis.managePanelRowPresentation(model);}).join('');
  return manageToolbar('Panel QC','Nhóm các xét nghiệm theo từng máy để thiết lập và quản lý QC.',"openConfigPanel()",'Thêm Panel QC')+`<div class="panel rcfg-list">${rows?`<table class="panel-qc-table"><thead><tr><th>Tên panel</th><th>Máy xét nghiệm</th><th>Xét nghiệm trong panel</th><th class="num">Số vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có Panel QC','Tạo Panel QC trước, sau đó nhập Mean/SD theo nhóm lô trong thẻ Mean/SD.')}</div>`;
}
function targetPanelOptions(){return globalThis.targetPanelOptionsPresentation(state.qcPanels,manageTargetPanel,instrumentName,esc);}
function manageTransitionsV2(){
  const rows=state.lotTransitions.filter(tr=>manageMatch([panelName(tr.panelId),lotLabel(tr.fromLotId),lotLabel(tr.toLotId),tr.startDate,tr.status,tr.approvedBy])).map(tr=>{const s=transitionStatusLabelV2(tr.status),to=state.qcLots.find(l=>l.id===tr.toLotId),moved=transitionSwitchesLot(tr)&&to?`<div class="hint">Đã chuyển tiếp qua lô ${esc(to.lotNo)}</div>`:'',approval=tr.approvedBy?`<div class="hint">Duyệt: ${esc(tr.approvedBy)}${tr.approvedAt?' · '+formatDateTimeVN(tr.approvedAt):''}</div>`:'',model={id:tr.id,panel:panelName(tr.panelId),fromLot:lotLabel(tr.fromLotId),toLot:lotLabel(tr.toLotId),startDate:tr.startDate?vnDate(tr.startDate):'',status:s,movedHtml:moved,approvalHtml:approval};return globalThis.manageTransitionRowPresentation(model);}).join('');
  return manageToolbar('Chuyển tiếp lô QC','Theo dõi lô cũ, lô mới và trạng thái khi thay lô.',"openLotTransitionV2()",'Thêm hồ sơ chuyển lô')+`<div class="panel rcfg-list transition-list">${rows?`<table class="transition-table"><thead><tr><th>Panel QC</th><th>Chuyển lô</th><th>Bắt đầu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có hồ sơ chuyển lô','Tạo hồ sơ để theo dõi chuyển từ lô cũ sang lô mới.')}</div>`;
}
function targetPanelTests(){return globalThis.targetPanelTestsPresentation(state.qcPanels,state.tests,manageTargetPanel);}
function targetPanelLabel(){return globalThis.targetPanelLabelPresentation(state.qcPanels,manageTargetPanel);}
function targetGroupLots(group){return globalThis.targetGroupLotsPresentation(state.qcLots,group);}
function targetGroupLabel(group){return globalThis.targetGroupLabelPresentation(group);}
function groupStatusSuffix(g){return globalThis.targetGroupStatusSuffixPresentation(g);}
function targetGroupOptions(){
  const groups=state.lotGroups.filter(g=>g.active!==false);
  return globalThis.targetGroupOptionsPresentation(groups,manageTargetGroup,targetGroupLots,targetGroupLabel,groupStatusSuffix,esc);
}
function ensureTargetSelection(){
  const picked=globalThis.targetSelectionPresentation(state.qcPanels,state.lotGroups,manageTargetPanel,manageTargetGroup,targetGroupLots);manageTargetPanel=picked.panelId;manageTargetGroup=picked.groupId;
}
function manageTargets(){
  ensureTargetSelection();
  const prerequisite=globalThis.targetPrerequisitePresentation({tests:state.tests.length,panels:state.qcPanels.length,lots:state.qcLots.length,groups:state.lotGroups.length});
  if(prerequisite==='tests')return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC để nhập Mean/SD hàng loạt.',"setManageTab('assays')",'Thêm xét nghiệm')+`<div class="panel">${emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó quay lại nhập Mean/SD theo nhóm lô.')}</div>`;
  if(prerequisite==='panels')return manageToolbar('Mean/SD theo nhóm lô QC','Chỉ dùng Panel QC để nhập Mean/SD hàng loạt.',"setManageTab('panels')",'Thêm Panel QC')+`<div class="panel">${emptyState('Chưa có Panel QC','Tạo Panel QC và chọn các xét nghiệm thành viên trước, sau đó quay lại nhập Mean/SD theo nhóm lô.')}</div>`;
  if(prerequisite==='lots')return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.',"setManageTab('lots')",'Thêm lô QC')+`<div class="panel">${emptyState('Chưa có lô QC','Tạo lô QC trước, gom vào nhóm lô rồi quay lại nhập Mean/SD theo nhóm.')}</div>`;
  if(prerequisite==='groups')return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.',"setManageTab('lots')",'Thêm nhóm lô')+`<div class="panel">${emptyState('Chưa có nhóm lô QC','Tạo nhóm lô từ các lô QC trước, sau đó quay lại nhập Mean/SD theo nhóm.')}</div>`;
  const group=state.lotGroups.find(x=>x.id===manageTargetGroup),groupLots=targetGroupLots(group),targetLevelPick=globalThis.targetLevelSelectionPresentation(groupLots,manageTargetLevel),targetLevels=targetLevelPick.levels;
  manageTargetLevel=targetLevelPick.level;
  const selectedLevel=Number(manageTargetLevel),levelLotPick=globalThis.targetLevelLotsPresentation(groupLots,selectedLevel),levelLots=levelLotPick.levelLots,levelDepletedLots=levelLotPick.depletedLots,q=searchText(manageQ),allTests=targetPanelTests(),tests=allTests.filter(t=>!q||globalThis.targetSearchValuesPresentation(t,group&&group.name,levelLots,testDisplayName,instrumentName).some(v=>searchText(v).includes(q)));
  if(!group||!groupLots.length)return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.')+`<div class="panel">${emptyState('Nhóm lô chưa có lô QC','Sửa nhóm lô và chọn các lô QC cần dùng trước.')}</div>`;
  const rowItems=globalThis.targetMatrixItemsPresentation(tests,levelLots,targetConfigAssigned,plannedTargetFor,lotTargetSnapshot);
  const targetStats=globalThis.targetMatrixStatsPresentation(rowItems);
  const rows=rowItems.map(({t,lot,linked,same,assigned,planned,cfg})=>{const draft=targetRangeDraft(cfg||{}),rowState=globalThis.targetRowStatePresentation(linked,assigned,planned,lot.depleted),locked=rowState.locked,retiredTo=locked?lotTransitionToNo(lot.id):'',checked=rowState.checked,disabled=rowState.disabled;return globalThis.targetMatrixRowPresentation({testId:t.id,lotId:lot.id,locked,checked,disabled,name:testDisplayName(t),unit:t.unit,mean:targetNumberText(draft.mean,t),low:targetNumberText(draft.low,t),high:targetNumberText(draft.high,t),sd:targetNumberText(draft.sd,t,'stat'),status:rowState.status,retiredTo,otherLot:same&&same.lot},esc,escAttr);}).join('');
  const targetLevelTabs=globalThis.targetLevelTabsPresentation(targetLevels,manageTargetLevel),targetLevelToolbar=globalThis.targetLevelToolbarPresentation(manageTargetLevel,levelLots.map(l=>l.lotNo),targetLevelTabs,esc);
  return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô, app tự đưa các xét nghiệm trong panel vào bảng Mean/SD.')+
  `<div class="panel target-matrix-panel">
    ${globalThis.targetSelectorPresentation(targetPanelOptions(),targetGroupOptions())}
    ${rowItems.length?globalThis.targetSummaryPresentation(targetStats):''}
    ${rowItems.length?targetLevelToolbar+`
    ${globalThis.targetMatrixTablePresentation(rows)}
    ${globalThis.targetMatrixActionsPresentation(btn('Bỏ chọn tất cả','targetCheckAll(false)','ghost'),btn('Chọn tất cả','targetCheckAll(true)','ghost'),btn('Lưu Mean/SD mức này','saveTargetMatrix()','teal'))}`:(()=>{const empty=globalThis.targetEmptyStatePresentation(allTests.length,levelLots.map(l=>l.lotNo),levelDepletedLots.map(l=>l.lotNo),manageTargetLevel);return emptyState(empty.title,empty.description);})()}</div>`;
}
function manageAssays(){
  const matched=state.tests.filter(t=>manageMatch([t.name,testDisplayName(t),t.unit,t.method,t.reagent,instrumentName(t.instrumentId,t.machine),t.section,t.tea]));
  const rows=matched.map((t,idx)=>{const model={index:idx+1,id:t.id,name:testDisplayName(t),method:t.method,unit:t.unit,instrument:instrumentName(t.instrumentId,t.machine),section:t.section,reagent:t.reagent,tea:t.tea,closed:!!t.closed};return globalThis.manageAssayRowPresentation(model);}).join('');
  return manageToolbar('Danh mục xét nghiệm','Quản lý xét nghiệm, máy, đơn vị, phương pháp và TEa.',"openConfigAssay()",'Thêm xét nghiệm')+`<div class="panel rcfg-list">${rows?`<table class="assay-table"><thead><tr><th class="num">STT</th><th>Tên xét nghiệm</th><th>Máy xét nghiệm</th><th>Hóa chất</th><th>TEa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó gán lô và Mean/SD ở các thẻ cấu hình tương ứng.')}</div>`;
}
function manageHistorySearchValues(t){
  if(globalThis.historySearchValuesPresentation)return globalThis.historySearchValuesPresentation(t,state.qcLots,testDisplayName);
  const values=[t.name,testDisplayName(t)];
  (t.levels||[]).forEach(l=>{
    const hist=l.meanSdHistory&&l.meanSdHistory.length?l.meanSdHistory:[{qcLotId:l.qcLotId,lot:l.lot,effectiveFrom:'',effectiveTo:l.exp,source:l.applied||'mfg'}];
    hist.forEach(h=>{
      if(h.planned)return; // "Dự kiến" chưa áp dụng — không phải lịch sử thật, xem ở màn Mean/SD/Lô & Nhóm QC
      const lotObj=state.qcLots.find(x=>x.id===(h.qcLotId||l.qcLotId))||state.qcLots.find(x=>x.lotNo===(h.lot||l.lot)&&+x.level===+l.level);
      values.push(l.level,`M${l.level}`,`Mức ${l.level}`,h.lot,l.lot,lotObj&&lotObj.lotNo);
    });
  });
  return values;
}
function manageHistory(){
  const q=searchText(manageQ),matches=state.tests.filter(t=>!q||manageHistorySearchValues(t).some(v=>searchText(v).includes(q)));
  if(!state.tests.length)return manageToolbar('Lịch sử dữ liệu QC','Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.')+`<div class="panel">${emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó cấu hình lô và Mean/SD.')}</div>`;
  if(!matches.length)return manageToolbar('Lịch sử dữ liệu QC','Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.')+`<div class="panel">${emptyState('Không tìm thấy xét nghiệm','Thử tìm theo tên xét nghiệm.')}</div>`;
  const historyPick=globalThis.historyAssaySelectionPresentation(matches,manageHistoryTest);
  manageHistoryTest=historyPick.selectedId;
  const t=historyPick.assay;
  const opts=globalThis.historyAssayOptionsPresentation(matches,t.id,testDisplayName,esc);
  const rows=globalThis.historyRowsPresentation?globalThis.historyRowsPresentation(t,state.qcLots,state.data[t.id]||[],lotGroupLabels):(()=>{const rows=[];
  (t.levels||[]).forEach(l=>{
    const hist=(l.meanSdHistory&&l.meanSdHistory.length?l.meanSdHistory:[{qcLotId:l.qcLotId,lot:l.lot,mean:l.mean,sd:l.sd,low:l.low,high:l.high,effectiveFrom:'',effectiveTo:l.exp,source:l.applied||'mfg'}]);
    hist.forEach(h=>{
      if(h.planned)return; // "Dự kiến" chưa áp dụng — không hiện ở lịch sử dữ liệu thật
      const lotObj=state.qcLots.find(x=>x.id===(h.qcLotId||l.qcLotId))||state.qcLots.find(x=>x.lotNo===(h.lot||l.lot)&&+x.level===+l.level);
      const lotNo=h.lot||l.lot||(lotObj&&lotObj.lotNo)||'',group=lotObj?lotGroupLabels(lotObj.id):'Chưa thuộc nhóm',pts=(state.data[t.id]||[]).filter(p=>+p.level===+l.level&&(p.lot||'')===(lotNo||''));
      rows.push({t,l,h,lotObj,lotNo,group,pts});
  });
  });return rows;})();
  const visibleRows=globalThis.historyVisibleRowsPresentation(rows,t.name,q,searchText);
  const html=(globalThis.historyRowSortPresentation?globalThis.historyRowSortPresentation(visibleRows):visibleRows.sort((a,b)=>(+a.l.level)-(+b.l.level)||(a.lotNo||'').localeCompare(b.lotNo||'','vi')||String(a.h.effectiveFrom||'').localeCompare(String(b.h.effectiveFrom||'')))).map(r=>{
    const period=globalThis.historyPeriodLabelPresentation(r.h.effectiveFrom,r.h.effectiveTo,vnDate);
    const model={testId:r.t.id,level:r.l.level,lot:r.lotNo||'',group:r.group,mean:fmtTestValue(r.t,r.h.mean),low:r.h.low!=null?fmtTestValue(r.t,r.h.low):'—',high:r.h.high!=null?fmtTestValue(r.t,r.h.high):'—',sd:fmtTestValue(r.t,r.h.sd),period,source:r.h.source,pointCount:r.pts.length};return globalThis.manageHistoryRowPresentation(model);
  }).join('');
  const historyTotals=globalThis.historySummaryPresentation(visibleRows);
  return manageToolbar('Lịch sử dữ liệu QC','Chọn một xét nghiệm để xem các lô/Mean-SD đã từng dùng.')+
  `<div class="panel target-matrix-panel">
    ${globalThis.historySelectorPresentation?globalThis.historySelectorPresentation(opts,historyTotals.rowCount,historyTotals.pointCount):`<div class="target-selector history-selector">
      <div><label>Xét nghiệm</label><select onchange="setHistoryTest(this.value)">${opts}</select></div>
      <div class="target-lot-info"><b>${historyTotals.rowCount}</b><span>mốc lô/Mean-SD</span></div>
      <div class="target-lot-info"><b>${historyTotals.pointCount}</b><span>điểm QC đã nhập</span></div>
    </div>`}
    ${globalThis.historyTablePresentation?globalThis.historyTablePresentation(html,q?emptyState('Không tìm thấy mốc phù hợp','Thử tìm theo tên xét nghiệm, mức hoặc lô QC.'):emptyState('Chưa có lịch sử lô','Xét nghiệm này chưa được gán lô/Mean-SD.')):`<div class="rcfg-list">${html?`<table class="history-table"><thead><tr><th>Mức</th><th>Lô QC / Nhóm lô</th><th class="num">Mean</th><th class="num">Giới hạn dưới</th><th class="num">Giới hạn trên</th><th class="num">SD</th><th>Hiệu lực</th><th>Nguồn</th><th class="num">Điểm QC</th><th></th></tr></thead><tbody>${html}</tbody></table>`:(q?emptyState('Không tìm thấy mốc phù hợp','Thử tìm theo tên xét nghiệm, mức hoặc lô QC.'):emptyState('Chưa có lịch sử lô','Xét nghiệm này chưa được gán lô/Mean-SD.'))}</div>`}
  </div>`;
}
/* ===== Bảng TEa tham chiếu (CLIA/Ricos/chuẩn hóa PXN) sửa được trong app ===== */
const TEA_LAB_BASIS_SOURCES=[['regulation','Quy định pháp lý / CLIA / quốc gia'],['pt','Chương trình ngoại kiểm / PT'],['eflm','EFLM Biological Variation'],['ricos','Ricos / Westgard BV (nguồn cũ)'],['professional','Hiệp hội / ủy ban chuyên môn'],['other','Nguồn khác đã thẩm định']];
function teaLabBasisLabel(src){return globalThis.teaLabBasisLabelPresentation(TEA_LAB_BASIS_SOURCES,src);}
function teaRefFind(refKey){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.find(state,refKey);const k=teaRefName(refKey);return (state.teaRefs||[]).find(r=>r.analyteId===refKey)||(state.teaRefs||[]).find(r=>teaRefName(r.name)===k);}
function teaRefNumOrNull(v){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.numberOrNull(v);return globalThis.teaPositiveNumberPresentation(v);}
function teaRefExternalChanged(row,refKey){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.externalChanged(row,refKey);const base=REFTESTS.find(r=>teaAnalyteMeta(r[0]).analyteId===refKey);return globalThis.teaReferenceExternalChangedPresentation(row,base);}
function teaRefSourceMeta(name,src){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.sourceMeta(state,name,src);const base=TEA_SOURCE_REGISTRY[src]||{},row=teaRefFind(name),custom=row&&row.sources&&row.sources[src]||{};return{...base,...Object.fromEntries(Object.entries(custom).filter(([,v])=>String(v??'').trim()!==''))};}
function teaRefStampSource(row,src){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.stampSource(state,row,src);const base=teaRefSourceMeta(row.name,src);row.sources=row.sources||{};row.sources[src]={...base,status:'reviewed',reviewedDate:isoToday(),reviewedBy:userName()};}
function teaRefEnsure(refKey){
  if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.ensure(state,refKey).record;
  let e=teaRefFind(refKey);
  if(!e){const src=effectiveTeaRefs().find(r=>r[6]===refKey||teaRefName(r[0])===teaRefName(refKey)),id=uid(),naming=teaAnalyteMeta(src?src[0]:refKey);e={id,analyteId:src&&src[6]||naming.analyteId||('custom-'+id),name:src?src[0]:refKey,displayName:naming.displayName,standardName:naming.standardName,abbreviation:naming.abbreviation,aliases:naming.aliases,matrix:naming.matrix,unit:src?src[1]:'',clia:src?src[2]:null,ricos:src?src[3]:null,lab:src?src[7]:null,section:src?src[4]:'',sources:{}};
    state.teaRefs=state.teaRefs||[];state.teaRefs.push(e);}
  return e;
}
/* Sửa/xóa/thêm dòng TEa tham chiếu có thể ảnh hưởng TEa% của NHIỀU xét nghiệm
   đang track Sigma cùng lúc (không chỉ xét nghiệm đang mở) — đồng bộ lại snapshot
   kỳ hiện tại của tất cả trước khi lưu, để Sigma không hiển thị TEa cũ cho tới
   khi ai đó tình cờ mở lại trang đó. */
function teaRefEdit(name,field,val){if(!requireAdmin())return;const edited=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.edit(state,name,field,val),e=edited&&edited.record||teaRefEnsure(name),before=edited?edited.before:e[field];if(!edited){e[field]=teaRefNumOrNull(val);teaRefStampSource(e,field);}logAct('Cập nhật TEa tham chiếu',`${e.name} · ${field.toUpperCase()}: ${before??'—'} → ${e[field]??'—'} · ${e.sources[field].version||'không phiên bản'}`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});rerender();}
function teaRefRemove(refKey){if(!requireAdmin())return;const row=teaRefFind(refKey),isDefault=teaRefIsDefault(refKey),removed=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.restoreOrRemove(state,refKey,isDefault);if(!removed){if(isDefault&&row&&row.lab!=null){const base=REFTESTS.find(r=>teaAnalyteMeta(r[0]).analyteId===refKey);if(base){row.name=base[0];row.unit=base[1];row.clia=base[2];row.ricos=base[3];row.section=base[4];row.sources={lab:row.sources&&row.sources.lab||{}};['cliaRule','cliaAbsolute','cliaAbsoluteUnit'].forEach(k=>delete row[k]);}}else state.teaRefs=(state.teaRefs||[]).filter(r=>r.analyteId!==refKey&&teaRefName(r.name)!==teaRefName(refKey));}logAct(isDefault?'Khôi phục TEa mặc định':'Xóa TEa tự thêm',row&&row.name||refKey,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});rerender();}
function teaSourceRegistryHtml(){const items=globalThis.teaSourceRegistryItemsPresentation(TEA_SOURCE_REGISTRY,vnDate);return globalThis.teaSourceRegistryPresentation(items);}
function teaRefOpenAdd(){
  if(!requireAdmin())return;
  openModal(`<div class="modal"><div class="modal-h"><h3>Thêm xét nghiệm tham chiếu</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="grid2"><div><label>Tên quốc tế <span class="req">*</span></label><input id="trAddName" placeholder="VD: Creatine kinase-MB"></div><div><label>Viết tắt</label><input id="trAddAbbreviation" placeholder="VD: CK-MB"></div></div>
      <div class="grid2"><div><label>Loại mẫu (matrix)</label><input id="trAddMatrix" placeholder="VD: Serum/Plasma"></div><div></div></div>
      <div class="grid2"><div><label>Đơn vị</label><input id="trAddUnit" placeholder="U/L"></div><div><label>Nhóm</label><input id="trAddSection" placeholder="Hóa sinh"></div></div>
      <div class="grid2"><div><label>TEa CLIA %</label><input id="trAddClia" type="number" step="any"></div><div><label>TEa Ricos %</label><input id="trAddRicos" type="number" step="any"></div></div>
      <div class="hint flow-item">Mỗi xét nghiệm dùng một tên quốc tế duy nhất; viết tắt được hiển thị trong ngoặc. TEa chuẩn hóa được lập thành hồ sơ riêng sau khi thêm dòng.</div></div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Thêm xét nghiệm','teaRefAddSubmit()','teal')}</div></div>`);
  setTimeout(()=>{const el=document.getElementById('trAddName');if(el)el.focus();},0);
}
async function teaRefAddSubmit(){
  if(!requireAdmin())return;
  const name=QCCore.cleanText(document.getElementById('trAddName').value,120).trim();
  if(!name){await infoDialog('Nhập tên xét nghiệm.');return;}
  const input={name,abbreviation:QCCore.cleanText(document.getElementById('trAddAbbreviation').value,40).trim(),matrix:QCCore.cleanText(document.getElementById('trAddMatrix').value,80).trim(),unit:QCCore.cleanText(document.getElementById('trAddUnit').value,40),section:QCCore.cleanText(document.getElementById('trAddSection').value,80),clia:document.getElementById('trAddClia').value,ricos:document.getElementById('trAddRicos').value},added=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.addCustomReference(state,input),e=added&&added.record||teaRefEnsure(name);if(!added){e.name=name;
    e.abbreviation=input.abbreviation;
    e.standardName=name;e.displayName=e.abbreviation&&teaRefName(e.abbreviation)!==teaRefName(name)?`${name} (${e.abbreviation})`:name;e.aliases=e.abbreviation?[e.abbreviation]:[];
    e.matrix=input.matrix;
    e.unit=input.unit;
    e.section=input.section;
    e.clia=teaRefNumOrNull(input.clia);
    e.ricos=teaRefNumOrNull(input.ricos);
    if(e.clia!=null)teaRefStampSource(e,'clia');if(e.ricos!=null)teaRefStampSource(e,'ricos');}
  logAct('Thêm TEa tham chiếu',`${e.name} · CLIA ${e.clia??'—'} · Ricos ${e.ricos??'—'}`,'Bảng TEa');
  if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save();closeModal();rerender();
}
function teaLabProfileOpen(refKey){
  if(!requireAdmin())return;const ref=effectiveTeaRefs().find(r=>r[6]===refKey||teaRefName(r[0])===teaRefName(refKey));if(!ref)return;const row=teaRefFind(refKey),meta=row&&row.sources&&row.sources.lab||{},source=row&&row.labSource||'',sourceOpts=['<option value="">— Chọn nguồn chính —</option>',...TEA_LAB_BASIS_SOURCES.map(([v,label])=>`<option value="${v}" ${source===v?'selected':''}>${esc(label)}</option>`)].join(''),effective=meta.effectiveDate||isoToday(),approvedDate=meta.reviewedDate||isoToday(),prepared=row&&row.labPreparedBy||userName(),approved=meta.reviewedBy||userName(),nextReview=row&&row.labNextReviewDate||'';
  const body=`<div class="grid2"><div><label>TEa chuẩn hóa % <span class="req">*</span></label><input id="teaLabValue" type="number" step="any" min="0" aria-label="TEa chuẩn hóa phần trăm" value="${row&&row.lab!=null?row.lab:''}"></div><div><label>Nguồn chính <span class="req">*</span></label><select id="teaLabSource" aria-label="Nguồn chính của TEa chuẩn hóa">${sourceOpts}</select></div></div>
    <div><label>Tài liệu / phiên bản / đường dẫn tham chiếu <span class="req">*</span></label><input id="teaLabReference" aria-label="Tài liệu tham chiếu TEa chuẩn hóa" value="${escAttr(meta.document||'')}" placeholder="VD: 42 CFR §493.931, hiệu lực 11/07/2024"></div>
    <div><label>Lý do lựa chọn <span class="req">*</span></label><textarea id="teaLabReason" class="tea-lab-reason" aria-label="Lý do lựa chọn TEa chuẩn hóa" rows="1" placeholder="Nêu lý do chọn nguồn và mức TEa này cho mục đích sử dụng của xét nghiệm...">${esc(meta.note||'')}</textarea></div>
    <div class="tea-lab-meta-grid tea-lab-meta-primary"><div><label>Ngày hiệu lực <span class="req">*</span></label>${dateBox('teaLabEffectiveDate',effective,'manage-date','aria-label="Ngày hiệu lực TEa chuẩn hóa"')}</div><div><label>Ngày xem xét lại</label>${dateBox('teaLabNextReviewDate',nextReview,'manage-date','aria-label="Ngày xem xét lại TEa chuẩn hóa"')}</div><div><label>Người xây dựng <span class="req">*</span></label><input id="teaLabPreparedBy" aria-label="Người xây dựng TEa chuẩn hóa" value="${escAttr(prepared)}"></div></div>
    <div class="tea-lab-meta-grid tea-lab-meta-approval"><div><label>Người phê duyệt <span class="req">*</span></label><input id="teaLabApprovedBy" aria-label="Người phê duyệt TEa chuẩn hóa" value="${escAttr(approved)}"></div><div><label>Ngày phê duyệt <span class="req">*</span></label>${dateBox('teaLabApprovedDate',approvedDate,'manage-date','aria-label="Ngày phê duyệt TEa chuẩn hóa"')}</div></div>`;
  const hasProfile=row&&row.lab!=null,remove=hasProfile?btn('Xóa TEa chuẩn hóa',`teaLabProfileRemove('${escAttr(refKey)}')`,'danger'):'';
  openModal(modalTemplate({title:hasProfile?'Sửa hồ sơ TEa chuẩn hóa':'Thêm hồ sơ TEa chuẩn hóa',body,footer:remove+btn('Hủy','closeModal()','ghost')+btn(hasProfile?'Lưu thay đổi':'Thêm hồ sơ TEa',`teaLabProfileSave('${escAttr(refKey)}')`,'teal'),cls:'tea-lab-profile-modal'}));
  setTimeout(()=>{const e=document.getElementById('teaLabValue');if(e)e.focus();},0);
}
async function teaLabProfileSave(refKey){
  if(!requireAdmin())return;const get=id=>String(document.getElementById(id)&&document.getElementById(id).value||'').trim(),value=teaRefNumOrNull(get('teaLabValue')),source=get('teaLabSource'),reference=QCCore.cleanText(get('teaLabReference'),500),reason=QCCore.cleanText(get('teaLabReason'),4000),effective=parseVN(get('teaLabEffectiveDate'))||'',nextReview=parseVN(get('teaLabNextReviewDate'))||'',prepared=QCCore.cleanText(get('teaLabPreparedBy'),120),approved=QCCore.cleanText(get('teaLabApprovedBy'),120),approvedDate=parseVN(get('teaLabApprovedDate'))||'';
  if(value==null){await infoDialog('Nhập TEa chuẩn hóa lớn hơn 0%.');return;}if(!teaLabBasisLabel(source)){await infoDialog('Chọn nguồn chính của TEa chuẩn hóa.');return;}if(reference.length<3){await infoDialog('Nhập tài liệu, phiên bản hoặc đường dẫn tham chiếu.');return;}if(reason.length<10){await infoDialog('Lý do lựa chọn cần ít nhất 10 ký tự.');return;}if(!effective||!approvedDate){await infoDialog('Nhập ngày hiệu lực và ngày phê duyệt hợp lệ.');return;}if(approvedDate>effective){await infoDialog('Ngày phê duyệt không được sau ngày hiệu lực.');return;}if(nextReview&&nextReview<effective){await infoDialog('Ngày xem xét lại không được trước ngày hiệu lực.');return;}if(!prepared||!approved){await infoDialog('Nhập người xây dựng và người phê duyệt.');return;}
  const profile={value,source,sourceLabel:teaLabBasisLabel(source),reference,reason,effective,nextReview,prepared,approved,approvedDate},saved=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.saveLabProfile(state,refKey,profile),row=saved&&saved.record||teaRefEnsure(refKey),before=saved?saved.before:row.lab;if(!saved){row.lab=value;row.labSource=source;row.labPreparedBy=prepared;row.labNextReviewDate=nextReview;row.sources=row.sources||{};row.sources.lab={...TEA_SOURCE_REGISTRY.lab,id:'lab-'+row.analyteId,version:teaLabBasisLabel(source),document:reference,effectiveDate:effective,reviewedDate:approvedDate,reviewedBy:approved,status:'reviewed',note:reason};}
  logAct(before==null?'Thiết lập TEa chuẩn hóa':'Cập nhật TEa chuẩn hóa',`${row.name} · ${before??'—'}% → ${value}% · ${teaLabBasisLabel(source)} · ${reference} · Hiệu lực ${vnDate(effective)} · Xây dựng: ${prepared} · Phê duyệt: ${approved} (${vnDate(approvedDate)})${nextReview?' · Xem xét lại '+vnDate(nextReview):''} · Lý do: ${reason}`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});closeModal();rerender();
}
async function teaLabProfileRemove(refKey){
  if(!requireAdmin())return;const row=teaRefFind(refKey);if(!row||row.lab==null)return;const ok=await confirmDialog({kicker:'TEa chuẩn hóa',title:'Xóa TEa chuẩn hóa?',message:`${teaAnalyteDisplay(row.name,row)} · ${row.lab}%`,detail:'Các kỳ Sigma cũ vẫn giữ ảnh chụp TEa đã sử dụng. Kỳ hiện tại sẽ không còn dùng nguồn TEa chuẩn hóa này.',confirmLabel:'Xóa TEa',cancelLabel:'Hủy',danger:true});if(!ok)return;const isDefault=teaRefIsDefault(refKey),removed=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.removeLabProfile(state,refKey,isDefault),before=removed?removed.before:row.lab;if(!removed){['lab','labSource','labPreparedBy','labNextReviewDate'].forEach(k=>delete row[k]);if(row.sources)delete row.sources.lab;if(teaRefIsDefault(refKey)&&!teaRefExternalChanged(row,refKey))state.teaRefs=(state.teaRefs||[]).filter(r=>r!==row);}logAct('Xóa TEa chuẩn hóa',`${row.name} · ${before}%`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});closeModal();rerender();
}
function manageTeaRefs(){
  const canManage=role()==='admin',ro=canManage?'':'disabled';
  const overMap=new Map((state.teaRefs||[]).map(r=>[r.analyteId||teaAnalyteMeta(r.name,r).analyteId||teaRefName(r.name),r]));
  const rows=effectiveTeaRefs()
    .map(([name,unit,clia,ricos,section,,analyteId,lab])=>{const isDef=teaRefIsDefault(analyteId),record=overMap.get(analyteId),naming=teaAnalyteMeta(name,record),externalChanged=teaRefExternalChanged(record,analyteId),kind=globalThis.teaReferenceKindPresentation(isDef,externalChanged,!!(record&&record.lab!=null));return{name,unit,clia,ricos,lab,section,analyteId,record,...naming,kind};})
    .filter(r=>manageMatch([r.name,r.displayName,r.standardName,r.abbreviation,...r.aliases,r.matrix,r.unit,r.section]))
    .sort(globalThis.teaReferenceSortPresentation);
  const teaStatus=kind=>globalThis.teaReferenceStatusPresentation(kind);
  const body=rows.map(r=>{
    const rowActions=globalThis.teaReferenceRowActionsPresentation(r.kind,canManage,r.lab!=null),act=rowActions.action==='restore'?btn('Khôi phục',`teaRefRemove('${escAttr(r.analyteId)}')`,'ghost sm','Khôi phục giá trị mặc định'):rowActions.action==='remove'?`<button class="x" onclick="teaRefRemove('${escAttr(r.analyteId)}')" title="Xóa xét nghiệm tự thêm">✕</button>`:'';
    const namingTitle=globalThis.teaReferenceNamingTitlePresentation(r);
    const labButton=rowActions.labProfile==='none'?'':btn(rowActions.labProfile==='add'?'Thêm hồ sơ':'Xem hồ sơ',`teaLabProfileOpen('${escAttr(r.analyteId)}')`,'ghost sm',rowActions.labProfile==='add'?'Lập hồ sơ TEa chuẩn hóa':'Xem hoặc cập nhật nguồn và lý do lựa chọn');
    return `<tr><td><b title="${escAttr(namingTitle)}">${esc(r.displayName||r.name)}</b></td><td>${esc(r.unit||'—')}</td><td>${esc(r.section||'—')}</td>
      <td><input class="tea-ref-value" ${ro} type="number" step="any" value="${globalThis.teaReferenceInputValuePresentation(r.clia)}" onchange="teaRefEdit('${escAttr(r.analyteId)}','clia',this.value)"></td>
      <td><input class="tea-ref-value" ${ro} type="number" step="any" value="${globalThis.teaReferenceInputValuePresentation(r.ricos)}" onchange="teaRefEdit('${escAttr(r.analyteId)}','ricos',this.value)"></td>
      <td><div class="tea-lab-cell">${globalThis.teaReferenceLabValuePresentation(r.lab,fmt)}${labButton}</div></td>
      <td><div class="tea-ref-status">${teaStatus(r.kind)}${act}</div></td></tr>`;
  }).join('');
  return manageToolbar('Bảng TEa tham chiếu','Tổng hợp TEa từ các nguồn tham chiếu, dùng thống nhất khi tính Sigma.',canManage?'teaRefOpenAdd()':'','Thêm xét nghiệm')+teaSourceRegistryHtml()+
    `<div class="panel rcfg-list tea-ref-panel">${rows.length?`<table class="tea-ref-table"><thead><tr><th>Xét nghiệm</th><th>Đơn vị</th><th>Nhóm</th><th>TEa CLIA %</th><th>TEa Ricos %</th><th>TEa chuẩn hóa %</th><th>Trạng thái</th></tr></thead><tbody>${body}</tbody></table>`:(()=>{const empty=globalThis.teaReferenceEmptyStatePresentation(!!searchText(manageQ));return emptyState(empty.title,empty.description);})()}</div>`;
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

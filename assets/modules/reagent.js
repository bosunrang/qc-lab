/* ===== REAGENT LOT COMPARISON ===== */
const RC_MIN_PAIRS=5;
/* palette khớp design token trong app.css; dùng cho SVG/báo cáo (in ở document riêng, không đọc được var()) */
const RCC={teal:'#0c6f78',tealDeep:'#0a5d65',ink:'#172833',muted:'#667b89',line:'#d4dde3',grid:'#e9eff3',red:'#a43a33',amber:'#a36f15',green:'#087044',okBg:'#e3f3f0',okFg:'#0a5e67',midBg:'#fbf0db',midFg:'#a36f15',noBg:'#f7e4e2',noFg:'#a43a33'};
const RCPAD={l:54,r:18,t:18,b:46};
function rcLabel(d){return globalThis.reagentComparisonLabelPresentation.label(d.test,teaAnalyteDisplay);}
function rcAct(){return ReagentComparisonService.find(state,rcId);}
function rcSaveSoon(){clearTimeout(rcSaveT);rcSaveT=setTimeout(save,600);}
function rcPairCalc(r){return globalThis.reagentPairMath.pairCalc(r);}
function rcCalc(ds){return globalThis.reagentComparisonCalculator.calculate(ds,RC_MIN_PAIRS);}
/* charts */
function rcAxis(W,H,xmin,xmax,ymin,ymax,xlab,ylab){return globalThis.reagentChartAxis(W,H,xmin,xmax,ymin,ymax,xlab,ylab,RCC,RCPAD,esc);}
function rcPadr(min,max){return globalThis.reagentChartPresentation.range([min,max]);}
function rcToolIcon(type){return globalThis.reagentToolIconPresentation.icon(type);}
function rcMiniIcon(type){return globalThis.reagentToolIconPresentation.icon(type);}
function rcScatterSVG(R,t){return globalThis.reagentScatterSvg(R,t,rcPadr,rcAxis,RCC);}
function rcBlandSVG(R){return globalThis.reagentBlandSvg(R,rcPadr,rcAxis,RCC);}
/* page */
function rcSelectOptions(){return globalThis.reagentSelectOptionsHtml(state.reagentTests,rcId,escAttr,d=>esc(rcLabel(d)));}
function pageReagent(){
  if(!state.reagentTests.length)return globalThis.reagentEmptyPageHtml({headHtml:headOnly('So sánh 2 lô hóa chất',''),emptyStateHtml:emptyState('Chưa có phép so sánh','Tải lại dữ liệu hoặc tạo phép so sánh mới.','')});
  if(!rcId||!state.reagentTests.find(d=>d.id===rcId))rcId=state.reagentTests[0].id;
  const ds=rcAct(),t=ds.test,ro=!canWrite()?'disabled':'';
  const oldLotHead='Lô cũ'+(t.lotOld?`: ${esc(t.lotOld)}`:''),newLotHead='Lô mới'+(t.lotNew?`: ${esc(t.lotNew)}`:'');
  const rows=ds.rows.map((r,i)=>{const c=rcPairCalc(r);return globalThis.reagentPairRowHtml({index:i,row:r,readOnly:!canWrite(),pair:c,format:fmt,escAttr});}).join('');
  const toolbarHtml=globalThis.reagentToolbarHtml({selectOptionsHtml:rcSelectOptions(),primaryActionsHtml:canWrite()?btn('+ Thêm','openRcCreateModal()','teal rc-add-btn')+btn(rcToolIcon('trash')+' Xóa','rcDeleteCurrent()','danger rc-delete-btn'):'',secondaryActionsHtml:(canWrite()?btn(rcToolIcon('search')+' Tìm','openRcModal()','ghost rc-find-btn'):'')+btn(rcToolIcon('print')+' In hóa chất này','rcPrint()','teal rc-report-btn')+btn(rcToolIcon('report')+' Báo cáo tổng hợp','rcPrintSummary()','teal rc-report-main')});
  const pairPanelHtml=globalThis.reagentPairPanelHtml({oldLotHeadHtml:oldLotHead,newLotHeadHtml:newLotHead,rowsHtml:rows,actionsHtml:canWrite()?btn('+ Thêm mẫu','rcAddRow()','ghost sm')+' '+btn('Xóa dữ liệu','rcClearRows()','ghost sm'):'',minPairs:RC_MIN_PAIRS});
  const infoPanelHtml=globalThis.reagentInfoPanelHtml({disabledAttr:ro,reagentValueHtml:escAttr(t.reagent),unitValueHtml:escAttr(t.unit),lotOldValueHtml:escAttr(t.lotOld),lotNewValueHtml:escAttr(t.lotNew),dateInputHtml:dateBox('rcDate',t.date||'','',`${ro} onchange="rcMeta('date',this.value)"`),operatorValueHtml:escAttr(t.operator),sampleTypeValueHtml:escAttr(t.sampleType),biasTarget:t.biasTarget,alpha:t.alpha,coverageChecked:!!t.coverageConfirmed,canWrite:canWrite(),userIconHtml:rcMiniIcon('user'),sampleIconHtml:rcMiniIcon('sample')});
  const chartsPanelHtml=globalThis.reagentChartsPanelHtml();
  const resultsPanelsHtml=globalThis.reagentResultsPanelsHtml();
  return headOnly('So sánh 2 lô hóa chất','Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP')+
   toolbarHtml+`<div class="rc-entry-grid">${infoPanelHtml}
   ${pairPanelHtml}</div>
   ${resultsPanelsHtml}
   ${chartsPanelHtml}`;
}
function rcCompute(){
  const ds=rcAct();if(!ds)return;const R=rcCalc(ds);
  const f=rcFmt,ft=rcFmtT;
  const st=document.getElementById('rcStats'),cr=document.getElementById('rcCrit'),vd=document.getElementById('rcVerdict'),sc=document.getElementById('rcScatter'),bl=document.getElementById('rcBland');
  if(!st)return;
  const html=globalThis.reagentResultHtml(R,RC_MIN_PAIRS,f,ft);st.innerHTML=html.statsHtml;cr.innerHTML=html.criteriaHtml;vd.innerHTML=html.verdictHtml;if(!R){sc.innerHTML='';bl.innerHTML='';return;}sc.innerHTML=rcScatterSVG(R,ds.test);bl.innerHTML=rcBlandSVG(R);
}
const RC_META_LOG_LABEL={lotOld:'Số lô cũ',lotNew:'Số lô mới',biasTarget:'Bias mong muốn (%)',alpha:'Mức ý nghĩa (α)'};
function rcMetaFocus(k){rcMetaBefore=rcMetaBefore||{};const ds=rcAct();rcMetaBefore[k]=ds?ds.test[k]:undefined;}
function rcMetaLog(k){
  const ds=rcAct();if(!ds||!rcMetaBefore||!(k in rcMetaBefore))return;
  const before=rcMetaBefore[k],after=ds.test[k];delete rcMetaBefore[k];
  if(before===after)return;
  logAct('Cập nhật so sánh hóa chất',`${RC_META_LOG_LABEL[k]||k}: ${before??'—'} → ${after??'—'}`,rcLabel(ds));
}
function rcMeta(k,v){if(!requireWrite())return;const before=rcAct()&&rcAct().test[k];const result=ReagentComparisonService.updateMetadata(state,{id:rcId,key:k,value:k==='date'?(parseVN(v)||QCCore.cleanText(v,20)):v});if(result.error)return;const ds=result.comparison;rcSaveSoon();rcCompute();if(k==='coverageConfirmed'&&before!==result.value)logAct('Xác nhận bao phủ SOP',`${result.value?'Đã xác nhận':'Chưa xác nhận'} bao phủ khoảng đo/điểm quyết định lâm sàng`,rcLabel(ds));if(k==='reagent'||k==='lotOld'||k==='lotNew'){const d=document.getElementById('rcCmpDisp');if(d)d.textContent=rcLabel(rcAct());const s=document.getElementById('rcSel');if(s){const o=[...s.options].find(o=>o.value===rcId);if(o)o.textContent=rcLabel(rcAct());}const oh=document.getElementById('rcOldLotHead'),nh=document.getElementById('rcNewLotHead');if(oh)oh.textContent='Lô cũ'+(ds.test.lotOld?': '+ds.test.lotOld:'');if(nh)nh.textContent='Lô mới'+(ds.test.lotNew?': '+ds.test.lotNew:'');}}
function rcUpdateRowCalc(i){
  const row=document.querySelector(`[data-rc-row="${i}"]`),ds=rcAct();if(!row||!ds||!ds.rows[i])return;
  const c=rcPairCalc(ds.rows[i]),avg=row.querySelector('.rc-calc.avg'),dif=row.querySelector('.rc-calc.dif');
  if(avg)avg.textContent=c?fmt(c.avg,3):'–';
  if(dif){dif.textContent=c?fmt(c.dif,3):'–';dif.classList.toggle('neg',!!(c&&c.dif<0));}
}
function rcCell(i,w,v){if(!requireWrite())return;const result=ReagentComparisonService.updateCell(state,{id:rcId,rowIndex:i,column:w,value:v});if(result.error)return;rcSaveSoon();rcUpdateRowCalc(i);rcCompute();}
function rcAddRow(){if(!requireWrite())return;if(ReagentComparisonService.addRow(state,{id:rcId}).error)return;save({clearDerived:false});rerender();}
function rcRmRow(i){if(!requireWrite())return;if(ReagentComparisonService.removeRow(state,{id:rcId,rowIndex:i}).error)return;save({clearDerived:false});rerender();}
function rcClearRows(){if(!requireWrite())return;if(ReagentComparisonService.clearRows(state,{id:rcId}).error)return;save({clearDerived:false});rerender();}
function rcSwitch(id){rcId=id;rerender();}
async function rcDelete(id,keepModal=false){if(!requireAdmin())return;if(state.reagentTests.length<=1){await infoDialog('Phải còn ít nhất 1 phép so sánh.');return;}
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa phép so sánh',message:'Xóa phép so sánh này?',confirmLabel:'Xóa',cancelLabel:'Hủy'}))return;
  const result=globalThis.ReagentComparisonWorkflowCommand.remove({id});if(result.error)return;if(rcId===id)rcId=result.nextId;if(keepModal)renderRcModal();rerender();}
function rcDeleteCurrent(){rcDelete(rcId);}
function rcQuickLabel(type){return globalThis.reagentQuickLabelPresentation.label(type);}
function rcQuickList(type){
  const result=ReagentComparisonService.ensureQuickList(state,type);
  return result.error?[]:result.items;
}
function rcOpenQuick(type){if(!requireWrite())return;rcQuickType=type;rcRenderQuickModal();}
function rcRenderQuickModal(){
  const type=rcQuickType||'operator',items=rcQuickList(type),label=rcQuickLabel(type);
  const rows=globalThis.reagentQuickPickerRowsHtml({items,labelHtml:esc(label),esc,selectButtonHtml:i=>btn('Chọn',`rcPickQuick(${i})`,'teal sm')});
  openModal(globalThis.reagentQuickPickerModalPresentation({labelHtml:esc(label),rowsHtml:rows,placeholderHtml:escAttr(label),addButtonHtml:btn('Thêm','rcAddQuick()','teal sm'),closeButtonHtml:btn('Đóng','closeModal()','ghost')}));
  setTimeout(()=>{const e=document.getElementById('rcQuickNew');if(e)e.focus();},0);
}
function rcPickQuick(i){
  const result=ReagentComparisonService.pickQuick(state,{id:rcId,type:rcQuickType,index:i});if(result.error)return;
  save({clearDerived:false});closeModal();rerender();
}
function rcAddQuick(){
  const input=document.getElementById('rcQuickNew'),v=QCCore.cleanText(input&&input.value,120).trim();if(!v)return;
  const result=ReagentComparisonService.addQuick(state,{type:rcQuickType,value:v});if(result.error)return;
  save({clearDerived:false});rcRenderQuickModal();
}
async function rcDelQuick(i){
  const items=rcQuickList(rcQuickType),v=items[i];if(!v)return;
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa khỏi danh sách',message:`Xóa "${v}" khỏi danh sách?`,confirmLabel:'Xóa',cancelLabel:'Hủy'}))return;
  if(ReagentComparisonService.removeQuick(state,{type:rcQuickType,index:i}).error)return;save({clearDerived:false});rcRenderQuickModal();
}
function openRcModal(){rcModalQ='';renderRcModal();}
function rcModalSearchSet(v){
  rcModalQ=v;
  scheduleSearchRender(rcModalSearchSet,renderRcModal,'rcModalSearch');
}
function renderRcModal(){
  const q=searchText(rcModalQ);
  const hit=d=>!q||[rcLabel(d),d.test.reagent,d.test.lotOld,d.test.lotNew,d.test.unit,d.test.operator].some(v=>searchText(v).includes(q));
  const rows=globalThis.reagentPickerRowsHtml({items:state.reagentTests.filter(hit).map(d=>({id:d.id,labelHtml:esc(rcLabel(d)),unitHtml:esc(d.test.unit||''),rowCount:d.rows&&d.rows.length||0,selected:d.id===rcId})),canWrite:canWrite(),selectButtonHtml:(id,selected)=>btn(selected?'Đang chọn':'Chọn',`rcPick('${id}')`,(selected?'teal':'ghost')+' sm')});
  openModal(globalThis.reagentPickerModalPresentation({searchValueHtml:escAttr(rcModalQ),rowsHtml:rows,closeButtonHtml:btn('Đóng','closeModal()','ghost')}));
  setTimeout(()=>{const e=document.getElementById('rcModalSearch');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0);
}
function rcPick(id){rcId=id;closeModal();rerender();}
function rcDeleteFromModal(id){rcDelete(id,true);}
function openRcCreateModal(){rcCreateModalQ='';renderRcCreateModal();}
function rcCreateSearchSet(v){
  rcCreateModalQ=v;
  scheduleSearchRender(rcCreateSearchSet,renderRcCreateModal,'rcCreateSearch');
}
function renderRcCreateModal(){
  const q=rcCreateModalQ.trim(),ql=searchText(q);
  const cats={};REFTESTS.forEach(r=>{if(ql&&![r[0],r[1],r[4],teaAnalyteDisplay(r[0])].some(v=>searchText(v).includes(ql)))return;(cats[r[4]]=cats[r[4]]||[]).push(r);});
  const refs=globalThis.reagentCreateReferenceRowsHtml(Object.keys(cats).map(cat=>({nameHtml:esc(cat),rowsHtml:cats[cat].map(r=>`<button class="refrow" onclick="rcCreateFrom('${jsq(r[0])}','${jsq(r[1]||'')}')">${esc(teaAnalyteDisplay(r[0]))}</button>`).join('')})),'');
  const createTyped=globalThis.reagentCreateTypedRowHtml(q?esc(q):'',q?`rcCreateFrom('${jsq(q)}','')`:"rcCreateFrom('Hóa chất mới','')");
  openModal(globalThis.reagentCreateModalPresentation({searchValueHtml:escAttr(rcCreateModalQ),createTypedHtml:createTyped,referenceRowsHtml:refs,emptyReferenceHtml:'<div class="empty" style="padding:18px">Không tìm thấy trong danh mục chuẩn.</div>',closeButtonHtml:btn('Đóng','closeModal()','ghost')}));
  setTimeout(()=>{const e=document.getElementById('rcCreateSearch');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0);
}
function rcCreateFrom(name,unit){if(!requireWrite())return;const result=globalThis.ReagentComparisonWorkflowCommand.create({id:uid(),name,unit});if(result.error)return;rcId=result.comparison.id;closeModal();rerender();}
function rcFmt(x,k=4){return globalThis.reagentReportPresentation.formatNumber(x,k);}
function rcFmtT(x){return globalThis.reagentReportPresentation.formatTStatistic(x);}
function rcDateText(v){return v?esc(vnDate(v)):formatDateTimeVN(new Date().toISOString()).split(' ').slice(1).join(' ');}
function rcReportVerdict(R){return globalThis.reagentReportPresentation.verdict(R,RCC);}
function rcReportPill(R){
  return globalThis.reagentReportPresentation.pillHtml(rcReportVerdict(R),esc);
}
function rcReportHeader(title,sub){
  return reportHeader(title)+globalThis.reagentReportPresentation.subtitleHtml(esc(sub||''),RCC.muted);
}
function rcReportSummaryTable(items){
  return globalThis.reagentReportPresentation.summaryTableHtml(items,RCC,esc);
}
function rcReportDetail(ds,i=0,pagebreak=false){
  const R=rcCalc(ds),t=ds.test;
  const model=globalThis.reagentReportPresentation.detailModel(R,t,RC_MIN_PAIRS,rcDateText(t.date));
  let body=globalThis.reagentReportPresentation.detailMetaHtml(model.metadata,esc);
  if(!R)return globalThis.reagentReportDetailCardHtml({index:i+1,reagentHtml:esc(t.reagent||'Hóa chất mới'),pillHtml:rcReportPill(R),bodyHtml:body+globalThis.reagentReportPresentation.missingDataHtml(RC_MIN_PAIRS),pagebreak});
  body+=globalThis.reagentReportPresentation.pairTableHtml(model.pairs);
  body+=globalThis.reagentReportPresentation.metricsHtml(model.metrics);
  const note=model.conclusion;
  body+=globalThis.reagentReportPresentation.conclusionHtml(esc(note),RCC.muted);
  body+=globalThis.reagentReportChartGridHtml(rcScatterSVG(R,t),rcBlandSVG(R));
  return globalThis.reagentReportDetailCardHtml({index:i+1,reagentHtml:esc(t.reagent||'Hóa chất mới'),pillHtml:rcReportPill(R),bodyHtml:body,pagebreak});
}
function rcReportItems(){return globalThis.reagentReportItemPresentation.items(state.reagentTests,rcCalc);}
async function rcPrintSummary(){
  const items=rcReportItems();
  if(!items.length){await infoDialog('Chưa có phép so sánh hóa chất.');return;}
  const valid=items.filter(x=>x.R).length;
  if(!valid){await infoDialog(`Chưa đủ dữ liệu để tạo báo cáo tổng hợp (mỗi hóa chất cần tối thiểu ${RC_MIN_PAIRS} cặp giá trị hợp lệ).`);return;}
  let body=rcReportHeader('BÁO CÁO SO SÁNH 2 LÔ HÓA CHẤT',`Tổng hợp ${items.length} hóa chất · ${valid} phép đủ dữ liệu · Ngày xuất: ${formatDateTimeVN(new Date().toISOString())}`);
  body+=rcReportSummaryTable(items);
  items.forEach((it,i)=>body+=rcReportDetail(it.ds,i,i>0));
  body+=signBlock();
  await openPrint('Báo cáo so sánh hóa chất tổng hợp',body);
}
async function rcPrint(){const ds=rcAct(),R=rcCalc(ds);if(!R){await infoDialog(`Chưa đủ dữ liệu (tối thiểu ${RC_MIN_PAIRS} cặp).`);return;}
  let body=rcReportHeader('BÁO CÁO SO SÁNH 2 LÔ HÓA CHẤT','Tổng hợp 1 hóa chất · Ngày xuất: '+formatDateTimeVN(new Date().toISOString()));
  body+=rcReportSummaryTable([{ds,R}]);
  body+=rcReportDetail(ds,0,false);
  body+=signBlock();
  await openPrint('So sánh lô — '+(ds.test.reagent||''),body);
}

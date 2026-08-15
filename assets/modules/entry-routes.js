/* ===== ENTRY PAGE ROUTE ===== */
function entryWindowFor(testId,level,endOverride,startOverride){return EntryService.buildEntryWindow({points:pointsOf(testId,level),days:entryDays,start:startOverride,end:endOverride,today:isoToday()});}
function entryWindow(){return entryWindowFor(entrySel.testId,entrySel.level,entryEnd,entryStart);}
function entryRowsWindow(rows,key){return globalThis.entryRowsWindowTs(rows,entryExpandedTables.has(key),ENTRY_TABLE_INITIAL_ROWS);}
const ENTRY_TABLE_INITIAL_ROWS=180;
function entryToggleRows(key){const next=globalThis.entryExpandedTablesToggle(entryExpandedTables,key,24);entryExpandedTables.clear();next.forEach(value=>entryExpandedTables.add(value));entryRenderKeepScroll();}
function entryDetailToggled(key,open){if(open)entryDetailOpen.add(key);else entryDetailOpen.delete(key);}
function entryTreeIsCollapsed(){if(entryTreeCollapsed!==null)return!!entryTreeCollapsed;entryTreeCollapsed=globalThis.entryTreeCollapsePreference.read(()=>localStorage.getItem('qclab_entry_tree_collapsed'));return!!entryTreeCollapsed;}
function pageEntry(rightOnly=false){
  const today=isoToday();
  if(!state.tests.length)return globalThis.entryEmptyPageHtml({title:'Chưa có xét nghiệm',message:'Cần khai báo xét nghiệm và mức QC trước khi nhập kết quả.',actionHtml:role()==='admin'?btn('Thêm xét nghiệm',`go('manage')`,'teal'):''});
  const entryTests=operationalTests();
  if(!entryTests.length)return globalThis.entryEmptyPageHtml({title:'Chưa có xét nghiệm sẵn sàng nhập',message:'Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi nhập kết quả.',actionHtml:role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):''});
  if(!entrySheetMonth)entrySheetMonth=isoMonth();
  let selT=entrySel&&entryTests.find(t=>t.id===entrySel.testId);
  if(!selT||!operationalLevels(selT).some(l=>l.level===entrySel.level)){selT=entryTests[0];const l0=operationalLevels(selT)[0];entrySel={testId:selT.id,level:l0.level};entryAutoOpenKey=null;}
  const treeCollapsed=entryTreeIsCollapsed(),treePanelIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>';
  let tree='',treeHead='';
  if(!rightOnly){
    const byMAll=EntryService.groupByMachine(entryTests),machinesAll=[...byMAll.keys()],selM=selT.machine||'(Chưa gán máy)';
    if(entryMachine!=='all'&&!machinesAll.includes(entryMachine))entryMachine='all';
    // Tự mở một lần khi đổi test; sau đó để người dùng tự thu/mở cây.
    const selGroup=operationalLotGroupForTest(selT),autoKey=selM+'|'+selGroup.key+'|'+entrySel.testId;if(entryAutoOpenKey!==autoKey){treeOpen.add('m:'+selM);treeOpen.add('lg:'+selM+'|'+selGroup.key);entryAutoOpenKey=autoKey;}
    const byM=EntryService.groupByMachine(entryTests.filter(t=>entryMachine==='all'||(t.machine||'(Chưa gán máy)')===entryMachine)),machines=[...byM.keys()];
    const machineOpts=['<option value="all">Tất cả máy</option>'].concat(machinesAll.map(m=>`<option value="${escAttr(m)}" ${entryMachine===m?'selected':''}>${esc(m)}</option>`)).join('');
    /* h4/tree-tools nằm NGOÀI div role="tree" (chỉ bọc quanh các .tnode role="treeitem")
       — ARIA tree chỉ được phép chứa treeitem/group, aria-required-children sẽ báo lỗi
       nếu heading/input/select nằm trực tiếp trong đó. CSS `.tree h4`/`.tree-tools ...`
       vẫn là descendant selector nên không cần đổi gì ở CSS. */
    treeHead=globalThis.entryTreeHeaderHtml({collapseButtonHtml:btn(treePanelIcon,'toggleEntryTree()','ghost icon entry-tree-toggle','Ẩn danh mục nội kiểm',{attrs:{'aria-label':'Ẩn danh mục nội kiểm','aria-controls':'entryTreePanel','aria-expanded':'true'}}),query:entryQ,machineOptionsHtml:machineOpts});
    if(!machines.length)tree+=globalThis.entryTreeItemHtml.empty();
    machines.forEach(mc=>{const mk='m:'+mc,mo=treeOpen.has(mk);
    tree+=globalThis.entryTreeItemHtml.machine({key:mk,open:mo,label:mc,toggleKey:jsq(mk)});
    const groups=new Map();byM.get(mc).forEach(t=>{const g=operationalLotGroupForTest(t);if(!groups.has(g.key))groups.set(g.key,{name:g.name,tests:[],order:operationalTestOrder(t)});const grp=groups.get(g.key);grp.tests.push(t);grp.order=Math.min(grp.order,operationalTestOrder(t));});
    [...groups.entries()].sort((a,b)=>a[1].order-b[1].order||a[1].name.localeCompare(b[1].name,'vi')).forEach(([groupKey,grp])=>{
        const gk='lg:'+mc+'|'+groupKey,go=treeOpen.has(gk),ord={none:-1,ok:0,warn:1,rej:2};let groupWorst='none';
        const rows=grp.tests.sort((a,b)=>operationalTestOrder(a)-operationalTestOrder(b)).map(t=>{const levels=operationalLevels(t),on=entrySel.testId===t.id,preferred=levels.find(x=>entrySel.level===x.level)||levels[0],wg=activeWestgard(t);let worst='none';
          levels.forEach(l=>{const pts=pointsForLot(t.id,l.level,l.lot||''),lastPoint=pts[pts.length-1],last=lastPoint&&wg.byPoint.get(lastPoint.id)||null,lastLevel=last?last.level:'none';if(ord[lastLevel]>ord[worst])worst=lastLevel;});
          if(ord[worst]>ord[groupWorst])groupWorst=worst;
          const s=searchText([t.name,testDisplayName(t),t.machine,grp.name,...levels.map(l=>l.lot)].join(' '));
          return globalThis.entryTreeItemHtml.assay({testId:t.id,search:s,selected:on,visible:mo&&go,level:preferred?preferred.level:1,name:testDisplayName(t),stateClass:worst==='none'?'':worst,stateText:stateName(worst)});});
        tree+=globalThis.entryTreeItemHtml.group({key:gk,open:go,parentOpen:mo,search:searchText(grp.name+' '+grp.tests.map(t=>t.name).join(' ')),name:grp.name,stateClass:groupWorst==='none'?'':groupWorst,stateText:stateName(groupWorst),toggleKey:jsq(gk)});
        tree+=rows.join('');
      });
    });
  }
  // panel phải
  const t=selT,l=lvlCfg(t,entrySel.level),entryWG=activeWestgard(t),acceptedCache=new Map();
  /* Cột nhập = (mức, lô): mức đang chạy song song có 2 cột. Lô song song được
     đánh giá bằng bảng Westgard riêng của nó (parallelWestgard), tách hẳn khỏi
     entryWG của lô đang vận hành. */
  const entryCols=entryColumns(t),parWGByKey=new Map();
  entryCols.filter(c=>c.parallel).forEach(c=>parWGByKey.set(c.key,parallelWestgard(t,c)));
  const colVerdict=(col,p)=>((col&&col.parallel?(parWGByKey.get(col.key)||{byPoint:new Map()}).byPoint.get(p.id):entryWG.byPoint.get(p.id))||{level:'ok',rules:[]});
  const colPointsIdx=col=>entryColumnPoints(t,col,true);
  const acceptedForLevel=level=>{const key=String(level);if(!acceptedCache.has(key))acceptedCache.set(key,acceptedLotPoints(t,level));return acceptedCache.get(key);};
  const W0=entryWindow(),acceptedSelected=acceptedForLevel(entrySel.level);const W={...W0,all:acceptedSelected.filter(p=>(p.lot||'')===(l.lot||'')),pts:acceptedSelected.filter(p=>p.date>=W0.start&&p.date<=W0.end&&(p.lot||'')===(l.lot||''))};
  // thống kê toàn bộ + dải QC
  const allSt=stats(W.all.map(p=>p.val));const cand=rangeCandidate(t.id,l.level),candStats=cand&&cand.c;
  const eligible=cand&&cand.eligible;
  const rangeSummary=allSt?`N=${allSt.n} · Mean thực=${fmtTestValue(t,allSt.m)} · SD thực=${fmtTestStat(t,allSt.sd)} · CV=${fmt(allSt.cv)}%`:'Chưa có dữ liệu';
  const rangeSource=l.applied==='lab'?'PXN tự xây dựng':'Nhà sản xuất';
  const rangeBox=globalThis.entryRangeSummaryHtml({open:entryDetailOpen.has('range'),summary:rangeSummary,source:rangeSource,mean:fmtTestValue(t,l.mean),sd:fmtTestValue(t,l.sd),eligible,resultCount:candStats?candStats.n:0,dayCount:cand?cand.days:0,proposedMean:candStats?fmtTestValue(t,candStats.m):'—',proposedSd:candStats?fmtTestValue(t,candStats.sd):'—',proposedCv:candStats?fmt(candStats.cv):'—',actionsHtml:rangeActions(t.id,l.level,eligible,l.applied)});
  // Lô cũ (đã chuyển tiếp) chỉ gắn với cột lô đang dùng, không áp cho cột song song.
  const levelViews=entryCols.map(x=>{if(x.parallel)return{x,prevView:null};const prevSeries=previousLotSeries(t,x.level),prevLot=entryPrevOpen.get(t.id+'|'+x.level)||'';return{x,prevView:prevSeries.find(s=>(s.lot||'')===prevLot)};});
  const tableCards=levelViews.map(({x,prevView})=>{
    const lvlMean=prevView?prevView.mean:x.mean,lvlSd=prevView?prevView.sd:x.sd,lvlLot=prevView?prevView.lot:x.lot;
    const allIdx=prevView?prevView.pts:colPointsIdx(x),allPtsIdx=prevView?allIdx:allIdx.filter(p=>p.date>=W.start&&p.date<=W.end),tableKey=`${t.id}|${x.key}|${lvlLot||''}|${W.start}|${W.end}`,rowWindow=entryRowsWindow(allPtsIdx,tableKey),ptsIdx=rowWindow.rows,cumulativePts=prevView?allIdx:allIdx.filter(p=>p.date<=W.end),cumulativeSt=stats(cumulativePts.map(p=>p.val));
    const prevWg=prevView?QCCore.westgardByPoint(ptsIdx,lvlMean,lvlSd,rule=>testRuleOnWithin(t,rule)):null;
    const rows=ptsIdx.map((p,i)=>{const rawPrev=prevView&&prevWg.F[i],verdict=prevView?(rawPrev?{...rawPrev,level:ruleResultLevel(t,rawPrev.rules||[]),z:prevWg.zs[i]}:{level:'ok',rules:[]}):colVerdict(x,p),view=EntryService.buildPointView({point:p,verdict,mean:lvlMean,sd:lvlSd,previousLot:prevView?prevView.lot:undefined}),lv=qcVerdictLabel(view.level),voidBtn=canWrite()?btn('Hủy',`voidQcPoint('${t.id}','${p.id}')`,'danger sm','Hủy điểm QC có ghi lý do'):'',rulesHtml=[...new Set(view.rules)].map(r=>`<span class="pill">${r}</span>`).join('')||'—';
      return globalThis.entryPointTableRowHtml({rejected:view.level==='rej',warning:view.level==='warn',pointId:escAttr(p.id||''),dateText:vnDate(p.date),valueText:fmtPointValue(p,t),zText:`${view.z>=0?'+':''}${fmt(view.z)}s`,verdictLevel:view.level,verdictText:lv,rulesHtml,voidButtonHtml:voidBtn});}).join('');
    const cumulative=globalThis.entryCumulativeStatsHtml({endDateText:vnDate(W.end),count:cumulativeSt?cumulativeSt.n:0,mean:cumulativeSt?fmtTestValue(t,cumulativeSt.m):'—',sd:cumulativeSt?fmtTestStat(t,cumulativeSt.sd):'—',cv:cumulativeSt?fmt(cumulativeSt.cv)+'%':'—'});
    const rowControl=globalThis.entryTableWindowNoteHtml({limited:rowWindow.limited,expanded:rowWindow.expanded&&rowWindow.total>ENTRY_TABLE_INITIAL_ROWS,shown:rowWindow.rows.length,total:rowWindow.total,actionButtonHtml:btn(rowWindow.limited?'Hiện toàn bộ':'Thu gọn',`entryToggleRows('${jsq(tableKey)}')`,'ghost sm')});
    return globalThis.entryPointTableCardHtml({parallel:x.parallel,level:x.level,previousLot:!!prevView,lot:esc(lvlLot||'?'),pointCount:allPtsIdx.length,bodyHtml:`${cumulative}${ptsIdx.length?`<table><thead><tr><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>${rowControl}`:'<div class="empty qc-table-empty">Chưa có điểm nào trong khoảng này.</div>'}`});}).join('');
  const prevLotByLevel=new Map(levelViews.filter(v=>v.prevView).map(v=>[v.x.level,v.prevView.lot]));
  const voidedRows=(state.data[t.id]||[]).filter(p=>{if(!p.voided)return false;const pv=prevLotByLevel.get(p.level);return pv!=null?(p.lot||'')===pv:(p.date>=W.start&&p.date<=W.end);}).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||pointRunNo(a)-pointRunNo(b)).map(p=>globalThis.entryVoidedPointRowHtml({pointId:escAttr(p.id||''),dateText:vnDate(p.date),levelLotText:`Mức ${p.level} · Lô ${esc(p.lot||'?')}`,valueText:fmtPointValue(p,t),runId:esc(p.runId||'—'),voidedBy:esc(p.voidedBy||''),reason:esc(p.voidReason||'')})).join('');
  const voidedBox=globalThis.entryVoidedPointsHtml(voidedRows);
  const pointsInView=globalThis.entryPointsPanelHtml({open:entryDetailOpen.has('points'),endDateText:vnDate(W.end),startDateText:vnDate(W.start),tableCardsHtml:tableCards,voidedBoxHtml:voidedBox});
  const dayBtns=globalThis.entryDayPresetButtons(entryDays,!!entryStart);
  entryLjRenderCache={testId:t.id,start:W.start,end:W.end,levels:new Map()};
  const ljStack=entryCols.map(x=>{const on=x.level===entrySel.level&&!x.parallel,
      // Lô song song dùng chính điểm của nó (không qua acceptedLotPoints — helper đó
      // chọn 1 lần chạy lại/ngày cho lô đang vận hành, không áp dụng cho lô đang đánh giá).
      curPts=(x.parallel?entryColumnPoints(t,x):acceptedForLevel(x.level)).filter(p=>p.date>=W.start&&p.date<=W.end&&(p.lot||'')===(x.lot||'')),
      prevSeries=x.parallel?[]:previousLotSeries(t,x.level),prevLot=entryPrevOpen.get(t.id+'|'+x.level)||'',prevView=prevSeries.find(s=>(s.lot||'')===prevLot),targetCfg=prevView||entryColumnCfg(t,x.level,x.lot),chartPts=prevView?prevView.pts:curPts,chartLot=prevView?prevView.lot:x.lot,chartMean=targetCfg&&targetCfg.mean,chartSd=targetCfg&&targetCfg.sd,st=stats(chartPts.map(p=>p.val));
    entryLjRenderCache.levels.set(`${x.level}|${chartLot||''}`,chartPts);
    const metrics=[{label:'Mean thực',value:st?fmtTestValue(t,st.m):'—'},{label:'SD thực',value:st?fmtTestStat(t,st.sd):'—'},{label:'CV thực',value:st?fmt(st.cv)+'%':'—'},{label:'Mean mục tiêu',value:fmtTestValue(t,chartMean),control:true},{label:'SD mục tiêu',value:fmtTestStat(t,chartSd),control:true}];
    const prevBtn=x.parallel?'<span class="hint">Đang đánh giá</span>':prevSeries.length?(prevView?btn('Xem lô mới',`event.stopPropagation();entryShowCurrentLot(${x.level})`,'teal sm'):btn('Xem lô cũ',`event.stopPropagation();entryShowPrevLot(${x.level},'${jsq(prevSeries[0].lot||'')}')`,'ghost sm')):`<span class="hint">${x.applied==='lab'?'Dải PXN':'Dải NSX'}</span>`;
    return globalThis.entryLeveyJenningsMiniHtml({on,parallel:x.parallel,level:x.level,lot:chartLot||'',pointCount:chartPts.length,previousLot:!!prevView,metrics,actionHtml:prevBtn,testId:t.id,mean:chartMean,sd:chartSd,start:W.start,end:W.end});}).join('');
  const levelHead=globalThis.entrySheetLevelHeads(entryCols.map(x=>{const cfg=entryColumnCfg(t,x.level,x.lot),mean=Number(cfg&&cfg.mean),sd=Number(cfg&&cfg.sd),limits=Number.isFinite(mean)&&Number.isFinite(sd)?`${fmtTestValue(t,mean-2*sd)} – ${fmtTestValue(t,mean+2*sd)}`:'—',tooltip=`Mean ${Number.isFinite(mean)?fmtTestValue(t,mean):'—'} · SD ${Number.isFinite(sd)?fmtTestStat(t,sd):'—'} · ±2SD ${limits}`;return{level:x.level,lot:x.lot||'',parallel:x.parallel,tooltip};}));
  const sheetCalendar=EntryService.buildSheetCalendar(entrySheetMonth,isoToday()),activeSheetMonth=sheetCalendar.activeMonth;
  entrySheetMonth=activeSheetMonth;
  const sheetYear=sheetCalendar.year,sheetMonthNo=sheetCalendar.month,sheetStart=sheetCalendar.start,sheetEnd=sheetCalendar.end;
  const sheetMonthOptions=Array.from({length:12},(_,i)=>`<option value="${i+1}" ${sheetMonthNo===i+1?'selected':''}>Tháng ${i+1}</option>`).join('');
  const sheetYearOptions=Array.from({length:sheetCalendar.yearMax-sheetCalendar.yearMin+1},(_,i)=>sheetCalendar.yearMin+i).map(y=>`<option value="${y}" ${sheetYear===y?'selected':''}>${y}</option>`).join('');
  const prevPtsByLevel={},pointsByLevel={};
  entryCols.forEach(x=>{prevPtsByLevel[x.key]=x.parallel?[]:previousLotSeries(t,x.level).flatMap(s=>s.pts.map(p=>({...p,_prevLot:s.lot})));pointsByLevel[x.key]=colPointsIdx(x);});
  const sheetDays=sheetCalendar.days;
  const sheetRowsData=EntryService.buildSheetRowsData({levels:entryCols,sheetStart,sheetEnd,sheetDays,pointsByLevel,previousPointsByLevel:prevPtsByLevel,pointRunNo});
  const sheetRows=sheetRowsData.map(dayGroup=>{
    const firstRunNo=()=>EntryService.sheetFirstRunNo(dayGroup);
    const levelRuns=x=>EntryService.sheetLevelRuns(dayGroup,x.key);
    // Kết luận của NGÀY chỉ tính trên các lô đang vận hành: lô đang đánh giá song
    // song không được phép làm ngày đó thành "loại bỏ" cho kết quả bệnh nhân.
    const daySummary=EntryService.summarizeRunStatus(entryCols.filter(x=>!x.parallel).map(x=>dayGroup.runs.map(g=>g.levels[x.key]).filter(Boolean).sort((a,b)=>pointRunNo(a)-pointRunNo(b)||(a._idx||0)-(b._idx||0))),entryWG.byPoint);
    const {worst,rulesAll,warnRules,rejRules,hasPoint}=daySummary;
    const shouldShowEmptyRun=(x,g)=>{
      const runs=levelRuns(x);
      if(!runs.length)return g.runNo===firstRunNo();
      const prev=[...runs].reverse().find(r=>r.runNo<g.runNo);
      if(!prev)return false;
      if(g.runNo!==prev.runNo+1)return false;
      if(entryExtraRun.has(`${t.id}|${x.key}|${g.date}|${g.runNo}`))return true;
      const f=colVerdict(x,prev.levels[x.key]);
      return f.level==='rej';
    };
    const cells=entryCols.map((x,levelIdx)=>{let levelHasPoint=false,emptyShown=false;
      const levelRunNos=levelRuns(x).map(r=>r.runNo),nextLevelRunNo=levelRunNos.length?Math.max(...levelRunNos)+1:1,lotArg=jsq(x.parallel?x.lot||'':'');
       const runInputs=dayGroup.runs.map(g=>{const p=g.levels[x.key],runArg=jsq(g.runId||'');if(!p){if(!shouldShowEmptyRun(x,g))return '';emptyShown=true;return globalThis.entrySheetEmptyRunHtml({editable:canWrite(),title:'Dùng phím mũi tên để chuyển ô',ariaLabel:`Nhập QC ngày ${vnDate(g.date)}, mức ${x.level}, lô ${escAttr(x.lot||'')}, lần ${g.runNo}`,date:escAttr(g.date),runNo:g.runNo,levelIndex:levelIdx,changeAction:`entryInlineSave('${t.id}',${x.level},'${g.date}',this.value,'${runArg}','${lotArg}')`});}levelHasPoint=true;
        const isPrev=!!p._prevLot,pMean=isPrev&&Number.isFinite(+p.qcMean)?+p.qcMean:x.mean,pSd=isPrev&&Number.isFinite(+p.qcSd)?+p.qcSd:x.sd;
        const verdict=isPrev?{level:'ok',rules:[]}:colVerdict(x,p),view=EntryService.buildPointView({point:p,verdict,mean:pMean,sd:pSd,previousLot:isPrev?p._prevLot:undefined}),lv=qcVerdictLabel(view.level);
        return globalThis.entrySheetSavedRunHtml({previousLot:isPrev,previousLotName:esc(p._prevLot||''),valueClass:view.valueClass,title:isPrev?'Lô cũ '+escAttr(p._prevLot)+' · đã chuyển tiếp · chỉ đọc':'Đã lưu, không sửa trực tiếp',valueText:fmtPointValue(p,t),zText:`${view.z>=0?'+':''}${fmt(view.z)}s`,verdictText:lv});}).join('');
      const addRunBtn=globalThis.entrySheetAddRunHtml({visible:canWrite()&&levelHasPoint&&!emptyShown,action:`entryUnlockExtraRun('${t.id}','${jsq(x.key)}','${dayGroup.date}',${levelIdx},${nextLevelRunNo})`});
      return globalThis.entrySheetCellHtml({parallel:x.parallel,hasAddButton:!!addRunBtn,runInputsHtml:runInputs,addRunButtonHtml:addRunBtn});}).join('');
    const staff=[...new Map(dayGroup.runs.flatMap(g=>Object.values(g.levels)).map(p=>pointStaff(p)).filter(x=>x.code).map(x=>[x.code,x])).values()];
    const staffCell=globalThis.entrySheetDaySummaryHtml.staff(staff);
    const status=globalThis.entrySheetDaySummaryHtml.status(hasPoint,worst);
    const autoNote=rulesAll.length?(worst==='rej'?errorType([...new Set(rejRules.length?rejRules:rulesAll)]):'Theo dõi / cảnh báo'):'';
    const datePoints=dayGroup.runs.flatMap(g=>Object.values(g.levels)).filter(Boolean);
    const manualNote=(datePoints.find(p=>String(p.note||'').trim())||{}).note||'';
    const note=globalThis.entrySheetNoteHtml({hasPoint,writable:canWrite(),placeholder:escAttr(autoNote||'Nhập ghi chú...'),changeAction:`entryDateNoteSave('${t.id}','${dayGroup.date}',this.value)`,manualNote:esc(manualNote),autoNote});
    const liveCols=entryCols.filter(x=>!x.parallel),doneLevels=liveCols.filter(x=>dayGroup.runs.some(g=>g.levels[x.key])).length,rowCls=[dayGroup.date===today?'today':'',dayGroup.date<=today&&doneLevels<liveCols.length?'missing':'',hasPoint?'has-data':''].filter(Boolean).join(' ');
    return globalThis.entrySheetDayRowHtml({rowClass:rowCls,date:dayGroup.date,dayOfMonth:dateObj(dayGroup.date).getDate(),today:dayGroup.date===today,cellsHtml:cells,staffHtml:staffCell,warningRules:[...new Set(warnRules)].join(', '),rejectRules:[...new Set(rejRules)].join(', '),statusHtml:status,noteHtml:note});}).join('');
  const worksheet=globalThis.entryWorksheetHtml({testName:esc(testDisplayName(t)),lotLabel:esc(globalThis.entryLotLabelsTs(entryCols)),monthOptionsHtml:sheetMonthOptions,yearOptionsHtml:sheetYearOptions,currentMonthButtonHtml:btn('Tháng hiện tại','entrySetSheetMonth(isoMonth())','ghost sm qc-current-month'),todayButtonHtml:btn('Tới hôm nay','entryGoToday()','teal sm qc-today-jump'),levelHeadHtml:levelHead,rowsHtml:sheetRows,columnCount:entryCols.length,messageHtml:entryLastMsg});
  const right=`${worksheet}${globalThis.entryLeveyPanelHtml({startDateHtml:dateBox('entryStartDate',W.start,'','onchange="entrySetStart(this.value)"'),endDateHtml:dateBox('entryEndDate',W.end,'','onchange="entrySetEnd(this.value)"'),dayButtonsHtml:dayBtns,rangeText:`${vnDate(W.start)} – ${vnDate(W.end)} · ${operationalLevels(t).length} mức QC`,stackHtml:ljStack})}${pointsInView}${rangeBox}`;
  entryPartialRenderCache={testId:t.id,right};
  if(rightOnly)return right;
  return globalThis.entryPageLayoutHtml({pageHeadHtml:headOnly('Nhập QC','Ghi nhận kết quả theo ngày, mức QC và lô đang vận hành'),treeCollapsed,expandButtonHtml:btn(treePanelIcon,'toggleEntryTree()','teal icon entry-tree-expand','Hiện danh mục nội kiểm',{attrs:{'aria-label':'Hiện danh mục nội kiểm','aria-controls':'entryTreePanel','aria-expanded':'false'}}),treeHeadHtml:treeHead,treeHtml:tree,rightHtml:right});
}
function jsq(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/&/g,'\\u0026').replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
/* Mở/thu nhánh ngay trên DOM, không vẽ lại toàn trang: khung cây có scroll riêng nên
   thay cả `.tree` sẽ đưa scrollTop về 0 và làm người dùng mất vị trí ở danh sách dài. */
function treeToggle(k){if(treeOpen.has(k))treeOpen.delete(k);else treeOpen.add(k);const open=treeOpen.has(k),node=[...document.querySelectorAll('.tree .tnode')].find(el=>el.dataset.key===String(k));if(node){node.setAttribute('aria-expanded',String(open));node.classList.toggle('open',open);const caret=node.querySelector('.caret');if(caret)caret.textContent=open?'−':'+';}entryFilter(entryQ);}
function toggleEntryTree(){entryTreeCollapsed=!entryTreeIsCollapsed();try{localStorage.setItem('qclab_entry_tree_collapsed',globalThis.entryTreeCollapsePreference.write(entryTreeCollapsed));}catch(e){}const grid=document.querySelector('.entrygrid');if(!grid){rerender();return;}grid.classList.toggle('tree-collapsed',entryTreeCollapsed);const target=grid.querySelector(entryTreeCollapsed?'.entry-tree-expand':'.entry-tree-toggle');requestAnimationFrame(()=>{if(target)target.focus({preventScroll:true});});}
function entryTreeKey(event){
  const item=event.currentTarget,key=event.key;
  const command=globalThis.entryTreeKeyCommand(key,item.getAttribute('aria-expanded'));
  if(command==='toggle'){event.preventDefault();item.click();return;}
  if(command!=='navigate')return;
  const items=[...document.querySelectorAll('.tree .tnode[tabindex="0"]')].filter(el=>el.offsetParent!==null),index=items.indexOf(item);if(index<0||!items.length)return;
  event.preventDefault();globalThis.entryTreeNavigation.target(items,item,key).focus();
}
function entryFilter(v){entryQ=v;const q=searchText(entryQ),nodes=[...document.querySelectorAll('.tree .tnode')],visible=globalThis.entryTreeVisibility(nodes.map(el=>({role:el.dataset.treeRole,key:el.dataset.key,search:el.dataset.search})),q,treeOpen);nodes.forEach((el,index)=>el.style.display=visible[index]?'':'none');}
function entryPick(tid,level){const next=globalThis.entrySelectionState.pick(tid,level);entrySel=next.selection;entryStart=next.start;entryEnd=next.end;entryLastMsg=next.message;document.querySelectorAll('.tree .tn-config').forEach(row=>{const on=row.dataset.testId===String(tid);row.classList.toggle('on',on);row.setAttribute('aria-current',String(on));});entryRenderKeepScroll();}
function entryFocusLevel(level){const next=globalThis.entrySelectionState.focus(entrySel,level);if(!next)return;entrySel=next;entryRenderKeepScroll();}
function entryShowPrevLot(level,lot){const key=globalThis.entrySelectionState.previousLotKey(entrySel,level);if(!key)return;entryPrevOpen.set(key,lot);entryRenderKeepScroll();}
function entryShowCurrentLot(level){const key=globalThis.entrySelectionState.previousLotKey(entrySel,level);if(!key)return;entryPrevOpen.delete(key);entryRenderKeepScroll();}
function entryFocusPendingSheet(){
  if(!entryPendingSheetFocus)return;
  const [date,level]=entryPendingSheetFocus.split('|');
  const cands=[...document.querySelectorAll('.qc-sheet .qc-inline-input')].filter(x=>x.dataset.focusDate===date&&x.dataset.focusLevel===level);
  // Prefer the still-empty slot for this date+level (a run just saved may have
  // shifted its run-id, so match on date+level rather than the old full key).
  const el=globalThis.entrySheetFocus(cands);
  if(el){el.focus();el.select();entryPendingSheetFocus='';}
}
function entrySheetInputs(){return globalThis.entrySheetInputOrder([...document.querySelectorAll('.qc-sheet .qc-inline-input')].filter(el=>!el.disabled&&el.offsetParent!==null));}
function entrySheetTarget(inputs,current,key,shiftKey=false){return globalThis.entrySheetNavigation.target(inputs,current,key,shiftKey);}
function entrySheetKey(event){
  if(event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
  const supported=['Enter','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];if(!supported.includes(event.key))return;
  const cur=event.currentTarget,next=entrySheetTarget(entrySheetInputs(),cur,event.key,event.shiftKey);if(!next)return;
  event.preventDefault();
  entryPendingSheetFocus=`${next.dataset.focusDate}|${next.dataset.focusLevel}`;
  cur.blur();
  setTimeout(entryFocusPendingSheet,0);
}
function entryLatestTreeState(t){return globalThis.entryTreeState(t);}
function entrySyncTreeState(testId){
  const row=[...document.querySelectorAll('.tree .tn-config[data-test-id]')].find(el=>el.dataset.testId===String(testId||''));if(!row)return;
  const apply=(el,value)=>{const badge=el&&el.querySelector('.state');if(!badge)return;badge.className='state'+(value==='none'?'':' '+value);badge.textContent=stateName(value);};
  apply(row,entryLatestTreeState(state.tests.find(t=>t.id===testId)));
  let group=row.previousElementSibling;while(group&&group.dataset.treeRole!=='group')group=group.previousElementSibling;if(!group)return;
  const states=[];
  for(let item=group.nextElementSibling;item&&item.dataset.treeRole==='assay';item=item.nextElementSibling){const badge=item.querySelector('.state'),value=badge&&['ok','warn','rej'].find(x=>badge.classList.contains(x))||'none';states.push(value);}
  const worst=globalThis.entryTreeGroupState(states);
  apply(group,worst);
}
function entryRenderKeepScroll(){
  const pageX=window.scrollX,pageY=window.scrollY,wrap=document.querySelector('.qc-sheet-wrap'),sheetTop=wrap?wrap.scrollTop:0,sheetLeft=wrap?wrap.scrollLeft:0;
  const current=document.querySelector('.entry-main');
  if(page==='entry'&&current){
    statusMemo=new Map();pageEntry(true);
    if(entryPartialRenderCache&&entryPartialRenderCache.testId===entrySel.testId){
      current.innerHTML=entryPartialRenderCache.right;
      entrySyncTreeState(entrySel.testId);
      afterRender();
    }else rerender();
  }else rerender();
  requestAnimationFrame(()=>{
    window.scrollTo(pageX,pageY);
    const nextWrap=document.querySelector('.qc-sheet-wrap');
    if(nextWrap){nextWrap.scrollTop=sheetTop;nextWrap.scrollLeft=sheetLeft;}
    entryFocusPendingSheet();
  });
}
function entrySetLastMsg(html){
  entryLastMsg=html||'';
  const el=document.getElementById('entryMsg');
  if(el)el.innerHTML=entryLastMsg;
}
function entryUnlockExtraRun(tid,colKey,date,levelIdx,runNo){
  if(!requireWrite())return;
  const request=globalThis.entryExtraRunRequest(tid,colKey,date,levelIdx,runNo);
  entryExtraRun.add(request.key);
  entryPendingSheetFocus=request.focus;
  entryRenderKeepScroll();
}
async function entryDateNoteSave(tid,date,value){
  if(!requireWrite())return;
  if(!await requireUnlockedPeriod(date,'ghi chú QC'))return;
  const result=EntryService.updateDateNoteCommand(state,{testId:tid,date,value,formatDate:vnDate});
  if(!result.ok){const message=globalThis.entryDateNoteErrorMessage(result.error);if(message)entrySetLastMsg('<div class="alert warn">'+esc(message)+'</div>');return;}
  const note=result.note;
  logAct(result.effects.audit.action,result.effects.audit.detail,result.effects.audit.target);
  save(result.effects.save);
  const feedback=globalThis.entryDateNoteFeedback(note,vnDate(date));
  entrySetLastMsg(feedback?`<div class="alert ${feedback.cls}">${esc(feedback.message)}</div>`:note?`<div class="alert ok">✓ Đã lưu ghi chú ngày ${vnDate(date)}.</div>`:`<div class="alert ok">✓ Đã xóa ghi chú ngày ${vnDate(date)}.</div>`);
}
/* cfg dùng khi ghi điểm. Mặc định là cấu hình sống của mức; nếu lotNo trỏ đúng lô
   đang chạy song song thì trả cfg tổng hợp của lô đó (Mean/SD riêng của nó).
   Cố ý không kèm meanSdHistory của mức: cảnh báo "ngày thuộc giai đoạn lô khác"
   trong qcPointWarnings sẽ báo nhầm, vì chạy song song vốn dĩ trùng giai đoạn
   với lô đang dùng. */
function entryColumnCfg(t,level,lotNo){return globalThis.entryColumnConfig(t,level,lotNo);}
async function entryInlineSave(tid,level,date,value,runIdHint='',lotNo=''){
  if(!requireWrite())return;
  const t=state.tests.find(x=>x.id===tid),cfg=entryColumnCfg(t,level,lotNo);
  if(!t||!cfg||!canEnterQcForLevel(t,level)){entrySetLastMsg('<div class="alert warn">Nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>');return;}
  if(value==null||String(value).trim()==='')return;
  if(!await requireUnlockedPeriod(date,'nhập điểm QC'))return;
  const prepared=EntryService.preparePointInput({tid,level,date,value,runId:runIdHint,cfg});
  if(!prepared.ok){entrySetLastMsg('<div class="alert warn">Nhập giá trị QC hợp lệ.</div>');return;}
  const {val,valueDecimals,runId}=prepared.point;
  const preIssues=qcPointWarnings(t,cfg,date,runId,val);
  if(preIssues.some(x=>x.includes('SD đang bằng 0'))){entrySetLastMsg('<div class="alert rej"><b>Không thể lưu.</b> '+esc(preIssues.join(' '))+'</div>');return;}
  if(preIssues.length){
    // Native confirm()/alert() dialogs leave the Electron renderer's input
    // unresponsive after close (until the window blurs/refocuses), so
    // unusual-data confirmation goes through the app's own modal instead.
    openModal(globalThis.entryPreSaveWarningModalHtml({issuesHtml:preIssues.map(x=>`<div class="alert warn">${esc(x)}</div>`).join(''),cancelButtonHtml:btn('Hủy','closeModal();entryRenderKeepScroll()','ghost'),saveButtonHtml:btn('Vẫn lưu',`closeModal();entryInlineSaveCommit('${jsq(tid)}',${level},'${jsq(date)}',${val},'${jsq(runId)}','${jsq(lotNo)}',${valueDecimals})`,'teal')}));
    return;
  }
  entryInlineSaveCommit(tid,level,date,val,runId,lotNo,valueDecimals);
}
function entryInlineSaveCommit(tid,level,date,val,runId,lotNo='',valueDecimals=qcValueDecimals(val)){
  const t=state.tests.find(x=>x.id===tid),cfg=entryColumnCfg(t,level,lotNo);
  // Kiểm tra lại tại thời điểm ghi vì nhóm lô có thể vừa bị dừng trong lúc hộp
  // thoại xác nhận dữ liệu bất thường đang mở hoặc vừa nhận đồng bộ từ máy khác.
  if(!t||!cfg||!canEnterQcForLevel(t,level)){entrySetLastMsg('<div class="alert warn">Không thể lưu: nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>');entryRenderKeepScroll();return;}
  const recorded=globalThis.EntryRecordCommand.execute({state,test:t,testId:tid,level,date,value:val,valueDecimals,runId,lotNo,cfg,staff:currentStaff(),id:uid(),activeLot:(lvlCfg(t,level)||{}).lot||''});
  if(!recorded.ok){
    if(recorded.error==='not-ready'){entrySetLastMsg('<div class="alert warn">Không thể lưu: nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>');entryRenderKeepScroll();return;}
    const message=globalThis.entryRecordErrorMessage(recorded.error);
    entrySetLastMsg('<div class="alert warn">'+message+'</div>');
    return;
  }
  const saved=recorded.point,parallel=recorded.parallel;
  logAct('Thêm điểm QC',`Ngày ${vnDate(date)}, M${level}${parallel?' · lô song song '+lotNo:''}, giá trị ${fmtPointValue(saved,t)}`,t.name);
  // Lô song song không nằm trong activeWestgard (chỉ phủ lô đang dùng) — tra bảng
  // đánh giá riêng của chính nó để báo đúng kết luận cho điểm vừa nhập.
  const f=recorded.verdict,rules=recorded.verdict.rules||[];
  save(recorded.effects.save);
  const feedback=globalThis.entrySaveFeedback({level,lotNo,parallel,verdict:f.level,rules,dateText:vnDate(date)}),tag=`Mức ${level}${parallel?' · lô song song '+esc(lotNo):''}`;
  entrySel=recorded.selection;entryLastMsg=feedback?`<div class="alert ${feedback.cls}">${feedback.emphasis?'<b>'+esc(feedback.message)+'</b>':esc(feedback.message)}</div>`:f.level==='rej'?`<div class="alert rej"><b>⚠ ${tag} vi phạm — ${rules.join(', ')}</b></div>`:f.level==='warn'?`<div class="alert warn"><b>${tag} cảnh báo — ${rules.join(', ')}</b></div>`:`<div class="alert ok">✓ Đã lưu ${tag} ngày ${vnDate(date)}.</div>`;
  entryRenderKeepScroll();
}
function syncVoidNceChoice(){
  const kind=(document.getElementById('voidKindInput')||{}).value,box=document.getElementById('voidOpenNce'),hint=document.getElementById('voidNceHint'),reasonBox=document.getElementById('voidReasonBox'),reasonErr=document.getElementById('voidReasonErr');
  if(!box)return;
  const choice=globalThis.entryVoidNceChoice(kind);
  box.checked=choice.openNce;box.disabled=choice.disabled;if(hint)hint.textContent=choice.hint;
  const label=document.getElementById('voidReasonLabel');
  if(label)label.textContent=choice.reasonLabel;
  if(reasonBox)reasonBox.hidden=false;
  if(reasonErr)reasonErr.style.display='none';
}
async function voidQcPoint(tid,pointId){
  if(!requireWrite())return;
  const t=state.tests.find(x=>x.id===tid),p=(state.data[tid]||[]).find(x=>x.id===pointId);
  if(!t||!p||p.voided)return;
  if(!await requireUnlockedPeriod(p.date,'hủy điểm QC'))return;
  openModal(globalThis.entryVoidModalHtml({pointInfoHtml:`Ngày ${vnDate(p.date)} · Mức ${p.level} · Giá trị ${fmtPointValue(p,t)}`,closeButtonHtml:'<button class="modal-close" onclick="closeModal()">×</button>',closeFooterButtonHtml:btn('Đóng','closeModal()','ghost'),confirmButtonHtml:btn('Xác nhận hủy',`confirmVoidQcPoint('${tid}','${pointId}')`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('voidKindInput');if(e)e.focus();},50);
}
async function confirmVoidQcPoint(tid,pointId){
  const t=state.tests.find(x=>x.id===tid),p=(state.data[tid]||[]).find(x=>x.id===pointId);
  if(!t||!p||p.voided){closeModal();return;}
  const input=document.getElementById('voidReasonInput'),kind=(document.getElementById('voidKindInput')||{}).value||'other',openNce=!!((document.getElementById('voidOpenNce')||{}).checked),clean=QCCore.cleanText(input?input.value:'',1000).trim(),verdict=pointVoidVerdict(t,p),rules=[...new Set(verdict.rules||[])],rule=rules.join(', ')||'Không có luật Westgard',qcVerdict=['warn','rej'].includes(verdict.level)?verdict.level:'invalid',qcErrorType=errorType(rules);
  if(!globalThis.entryVoidReasonValid(kind,clean)){
    const err=document.getElementById('voidReasonErr');
    if(err)err.style.display='';
    if(input)input.focus();
    return;
  }
  // confirmDialog() render vào #dialogRoot, tách khỏi #modalRoot đang giữ modal
  // "Hủy điểm QC" phía sau — nên Hủy ở đây không đụng gì tới modal đó, giữ nguyên
  // lý do người dùng đã gõ mà không cần dựng lại.
  const detail=openNce?'Điểm vẫn được giữ trong nhật ký; hồ sơ NCE sẽ được lập mới hoặc dùng lại, và yêu cầu QC chạy lại.':'Điểm vẫn được giữ trong nhật ký; thao tác này không tự mở hồ sơ NCE.';
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Hủy điểm QC',message:'Hủy điểm QC này khỏi tính toán Westgard/thống kê?',detail,confirmLabel:'Hủy điểm QC',cancelLabel:'Quay lại'}))return;
  closeModal();
  const result=globalThis.EntryVoidCommand.execute({state,tid,pointId,reason:clean,kind,openNce,rule,errorType:qcErrorType,qcVerdict,staff:currentStaff(),nowIso:new Date().toISOString(),today:isoToday(),id:uid(),nceId:nextNceId(isoToday()),dueDate:nceDueDate(7),formatDate:vnDate,formatNumber:fmt});
  if(result&&result.error==='period-locked'){entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể hủy điểm QC.</div>');return;}
  if(!result||!result.ok)return;
  logAct('Hủy điểm QC',`Ngày ${vnDate(result.point.date)}, M${result.point.level}, giá trị ${fmtPointValue(result.point,t)} · ${result.reason}`,t.name);
  const followup=result.openNce?(result.reusedAction?' Đã giữ liên kết với hồ sơ NCE đang mở.':` Đã mở hồ sơ ${esc(result.action&&result.action.nceId||'NCE')} để tiếp tục điều tra.`):' Không yêu cầu NCE/QC chạy lại.';
  save(result.effects.save);entryLastMsg=`<div class="alert warn">Đã hủy điểm QC ngày ${vnDate(result.point.date)}. Điểm không còn tham gia tính toán.${followup}</div>`;entryRenderKeepScroll();
}
function entrySetSheetMonth(v){const month=globalThis.entrySheetMonthValue(v);if(!month)return;entrySheetMonth=month;entryLastMsg='';rerender();}
function entryGoToday(){entrySheetMonth=isoMonth();entryJumpToday=true;entryLastMsg='';rerender();}
function entrySetSheetPart(part,value){entrySetSheetMonth(globalThis.entrySheetMonthPart(entrySheetMonth,isoMonth(),part==='year'?'year':'month',value));}
function entrySetDays(n){const range=globalThis.entryRangePreset(n);entryDays=range.days;entryStart=range.start;entryEnd=range.end;rerender();}
function entrySetStart(v){const next=globalThis.entryDateRangeInput({start:entryStart,end:entryEnd},'start',v);entryStart=next.start;entryEnd=next.end;rerender();}
function entrySetEnd(v){const next=globalThis.entryDateRangeInput({start:entryStart,end:entryEnd},'end',v);entryStart=next.start;entryEnd=next.end;rerender();}

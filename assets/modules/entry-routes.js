/* ===== ENTRY PAGE ROUTE ===== */
function entryWindowFor(testId,level,endOverride,startOverride){return EntryService.buildEntryWindow({points:pointsOf(testId,level),days:entryDays,start:startOverride,end:endOverride,today:isoToday()});}
function entryWindow(){return entryWindowFor(entrySel.testId,entrySel.level,entryEnd,entryStart);}
function entryLotLabels(levels){const lots=(levels||[]).map(x=>String(x.lot||'').trim()).filter(Boolean);return lots.join(' / ')||'Chưa gán lô';}
const ENTRY_TABLE_INITIAL_ROWS=180;
function entryRowsWindow(rows,key){const all=rows||[],expanded=entryExpandedTables.has(key),visible=expanded?all:all.slice(-ENTRY_TABLE_INITIAL_ROWS);return{rows:visible,total:all.length,limited:visible.length<all.length,expanded};}
function entryToggleRows(key){
  if(entryExpandedTables.has(key))entryExpandedTables.delete(key);
  else{
    entryExpandedTables.add(key);
    while(entryExpandedTables.size>24)entryExpandedTables.delete(entryExpandedTables.values().next().value);
  }
  entryRenderKeepScroll();
}
function entryDetailToggled(key,open){if(open)entryDetailOpen.add(key);else entryDetailOpen.delete(key);}
function entryTreeIsCollapsed(){if(entryTreeCollapsed!==null)return!!entryTreeCollapsed;try{entryTreeCollapsed=localStorage.getItem('qclab_entry_tree_collapsed')==='1';}catch(e){entryTreeCollapsed=false;}return!!entryTreeCollapsed;}
function pageEntry(rightOnly=false){
  const today=isoToday();
  if(!state.tests.length)return headOnly('Nhập QC','')+`<div class="panel">${emptyState('Chưa có xét nghiệm','Cần khai báo xét nghiệm và mức QC trước khi nhập kết quả.',role()==='admin'?btn('Thêm xét nghiệm',`go('manage')`,'teal'):'')}</div>`;
  const entryTests=operationalTests();
  if(!entryTests.length)return headOnly('Nhập QC','')+`<div class="panel">${emptyState('Chưa có xét nghiệm sẵn sàng nhập','Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi nhập kết quả.',role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):'')}</div>`;
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
    treeHead=`<div class="entry-tree-head"><h4 role="heading" aria-level="2">Danh mục nội kiểm</h4>${btn(treePanelIcon,'toggleEntryTree()','ghost icon entry-tree-toggle','Ẩn danh mục nội kiểm',{attrs:{'aria-label':'Ẩn danh mục nội kiểm','aria-controls':'entryTreePanel','aria-expanded':'true'}})}</div><div class="tree-tools"><input id="entrySearch" aria-label="Tìm xét nghiệm, máy hoặc lô" placeholder="Tìm test, máy hoặc lô..." value="${escAttr(entryQ)}" oninput="entryFilter(this.value)"><select aria-label="Lọc theo máy xét nghiệm" onchange="entrySetMachine(this.value)">${machineOpts}</select></div>`;
    if(!machines.length)tree+='<div class="tree-empty" role="presentation">Không có xét nghiệm phù hợp.</div>';
    machines.forEach(mc=>{const mk='m:'+mc,mo=treeOpen.has(mk);
    tree+=`<div class="tnode tn-machine" data-tree-role="machine" data-key="${escAttr(mk)}" role="treeitem" tabindex="0" aria-expanded="${mo}" onclick="treeToggle('${jsq(mk)}')" onkeydown="entryTreeKey(event)"><span class="caret" aria-hidden="true">${mo?'−':'+'}</span>${esc(mc)}</div>`;
    const groups=new Map();byM.get(mc).forEach(t=>{const g=operationalLotGroupForTest(t);if(!groups.has(g.key))groups.set(g.key,{name:g.name,tests:[],order:operationalTestOrder(t)});const grp=groups.get(g.key);grp.tests.push(t);grp.order=Math.min(grp.order,operationalTestOrder(t));});
    [...groups.entries()].sort((a,b)=>a[1].order-b[1].order||a[1].name.localeCompare(b[1].name,'vi')).forEach(([groupKey,grp])=>{
        const gk='lg:'+mc+'|'+groupKey,go=treeOpen.has(gk),ord={none:-1,ok:0,warn:1,rej:2};let groupWorst='none';
        const rows=grp.tests.sort((a,b)=>operationalTestOrder(a)-operationalTestOrder(b)).map(t=>{const levels=operationalLevels(t),on=entrySel.testId===t.id,preferred=levels.find(x=>entrySel.level===x.level)||levels[0],wg=activeWestgard(t);let worst='none';
          levels.forEach(l=>{const pts=pointsForLot(t.id,l.level,l.lot||''),lastPoint=pts[pts.length-1],last=lastPoint&&wg.byPoint.get(lastPoint.id)||null,lastLevel=last?last.level:'none';if(ord[lastLevel]>ord[worst])worst=lastLevel;});
          if(ord[worst]>ord[groupWorst])groupWorst=worst;
          const s=searchText([t.name,testDisplayName(t),t.machine,grp.name,...levels.map(l=>l.lot)].join(' '));
          return `<div class="tnode tn-config ${on?'on':''}" data-tree-role="assay" data-test-id="${escAttr(t.id)}" data-search="${escAttr(s)}" role="treeitem" tabindex="0" aria-current="${on?'true':'false'}" style="${mo&&go?'':'display:none'}" onclick="entryPick('${t.id}',${preferred?preferred.level:1})" onkeydown="entryTreeKey(event)"><span class="config-name">${esc(testDisplayName(t))}</span><span class="state ${worst==='none'?'':worst}">${stateName(worst)}</span></div>`;});
        tree+=`<div class="tnode tn-test ${go?'open':''}" data-tree-role="group" data-key="${escAttr(gk)}" data-search="${escAttr(searchText(grp.name+' '+grp.tests.map(t=>t.name).join(' ')))}" role="treeitem" tabindex="0" aria-expanded="${go}" style="${mo?'':'display:none'}" onclick="treeToggle('${jsq(gk)}')" onkeydown="entryTreeKey(event)"><span class="caret" aria-hidden="true">${go?'−':'+'}</span>${esc(grp.name)}<span class="state ${groupWorst==='none'?'':groupWorst}">${stateName(groupWorst)}</span></div>`;
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
  const rangeSummary=allSt?`n=${allSt.n} · Mean thực=${fmtTestValue(t,allSt.m)} · SD thực=${fmtTestStat(t,allSt.sd)} · CV=${fmt(allSt.cv)}%`:'Chưa có dữ liệu';
  const rangeSource=l.applied==='lab'?'PXN tự xây dựng':'Nhà sản xuất';
  const rangeBox=`<details class="panel entry-secondary-panel range-summary-panel" ${entryDetailOpen.has('range')?'open':''} ontoggle="entryDetailToggled('range',this.open)"><summary class="entry-secondary-summary"><span>Thống kê toàn bộ &amp; Dải kiểm soát</span><small>${rangeSummary}</small></summary>
     <div class="entry-secondary-body"><div class="range-band-note"><div class="range-band-label">Dải đang dùng:</div><div class="range-band-source">${rangeSource}</div><div class="range-band-body">· Mean=${fmtTestValue(t,l.mean)} SD=${fmtTestValue(t,l.sd)}.
       ${eligible?` Đủ điều kiện lập dải mới (${candStats?candStats.n:0} kết quả / ${cand.days} ngày độc lập). Dải đề xuất: Mean=${candStats?fmtTestValue(t,candStats.m):'—'} SD=${candStats?fmtTestValue(t,candStats.sd):'—'} CV=${candStats?fmt(candStats.cv):'—'}%.`:` Cần ≥20 kết quả trên ≥20 ngày độc lập, không có điểm vi phạm/cảnh báo chưa xử lý — hiện ${candStats?candStats.n:0} kết quả / ${cand?cand.days:0} ngày.`}</div></div>
     ${rangeActions(t.id,l.level,eligible,l.applied)}</div></details>`;
  // Lô cũ (đã chuyển tiếp) chỉ gắn với cột lô đang dùng, không áp cho cột song song.
  const levelViews=entryCols.map(x=>{if(x.parallel)return{x,prevView:null};const prevSeries=previousLotSeries(t,x.level),prevLot=entryPrevOpen.get(t.id+'|'+x.level)||'';return{x,prevView:prevSeries.find(s=>(s.lot||'')===prevLot)};});
  const tableCards=levelViews.map(({x,prevView})=>{
    const lvlMean=prevView?prevView.mean:x.mean,lvlSd=prevView?prevView.sd:x.sd,lvlLot=prevView?prevView.lot:x.lot;
    const allIdx=prevView?prevView.pts:colPointsIdx(x),allPtsIdx=prevView?allIdx:allIdx.filter(p=>p.date>=W.start&&p.date<=W.end),tableKey=`${t.id}|${x.key}|${lvlLot||''}|${W.start}|${W.end}`,rowWindow=entryRowsWindow(allPtsIdx,tableKey),ptsIdx=rowWindow.rows,cumulativePts=prevView?allIdx:allIdx.filter(p=>p.date<=W.end),cumulativeSt=stats(cumulativePts.map(p=>p.val));
    const prevWg=prevView?QCCore.westgardByPoint(ptsIdx,lvlMean,lvlSd,rule=>testRuleOnWithin(t,rule)):null;
    const rows=ptsIdx.map((p,i)=>{const rawPrev=prevView&&prevWg.F[i],verdict=prevView?(rawPrev?{...rawPrev,level:ruleResultLevel(t,rawPrev.rules||[]),z:prevWg.zs[i]}:{level:'ok',rules:[]}):colVerdict(x,p),view=EntryService.buildPointView({point:p,verdict,mean:lvlMean,sd:lvlSd,previousLot:prevView?prevView.lot:undefined}),lv=qcVerdictLabel(view.level),rowCls=view.level==='rej'?' class="qc-point-rej"':view.level==='warn'?' class="qc-point-warn"':'',voidBtn=canWrite()?btn('Hủy',`voidQcPoint('${t.id}','${p.id}')`,'danger sm','Hủy điểm QC có ghi lý do'):'',rulesHtml=[...new Set(view.rules)].map(r=>`<span class="pill">${r}</span>`).join('')||'—';
      return `<tr${rowCls} data-qc-point-id="${escAttr(p.id||'')}" tabindex="-1"><td>${vnDate(p.date)}</td><td class="num"><b>${fmtPointValue(p,t)}</b></td><td class="num">${view.z>=0?'+':''}${fmt(view.z)}s</td><td><span class="tag ${view.level}">${lv}</span></td><td>${rulesHtml}</td><td class="qc-row-actions">${voidBtn}</td></tr>`;}).join('');
    const cumulative=`<div class="qc-cumulative" title="Tính từ đầu LOT đến ${vnDate(W.end)}">
      <div><span>N tích lũy</span><b>${cumulativeSt?cumulativeSt.n:0}</b></div>
      <div><span>Mean tích lũy</span><b>${cumulativeSt?fmtTestValue(t,cumulativeSt.m):'—'}</b></div>
      <div><span>SD tích lũy</span><b>${cumulativeSt?fmtTestStat(t,cumulativeSt.sd):'—'}</b></div>
      <div><span>CV tích lũy</span><b>${cumulativeSt?fmt(cumulativeSt.cv)+'%':'—'}</b></div>
    </div>`;
    const rowControl=rowWindow.limited?`<div class="table-window-note">Đang hiển thị ${rowWindow.rows.length}/${rowWindow.total} điểm gần nhất. ${btn('Hiện toàn bộ',`entryToggleRows('${jsq(tableKey)}')`,'ghost sm')}</div>`:rowWindow.expanded&&rowWindow.total>ENTRY_TABLE_INITIAL_ROWS?`<div class="table-window-note">Đang hiển thị toàn bộ ${rowWindow.total} điểm. ${btn('Thu gọn',`entryToggleRows('${jsq(tableKey)}')`,'ghost sm')}</div>`:'';
    return `<div class="qc-table-card${x.parallel?' qc-parallel-card':''}" role="region" aria-label="Điểm QC mức ${x.level}, lô ${escAttr(lvlLot||'?')}${x.parallel?', lô chạy song song':''}" tabindex="0"><h4><span>Mức ${x.level} · ${prevView?'Lô cũ':'Lô'} ${esc(lvlLot||'?')}${x.parallel?' <span class="qc-parallel-label">Song song</span>':''}<span class="hint qc-table-count">${allPtsIdx.length} điểm trong khoảng</span></span></h4>${cumulative}${ptsIdx.length?`<table><thead><tr><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>${rowControl}`:'<div class="empty qc-table-empty">Chưa có điểm nào trong khoảng này.</div>'}</div>`;}).join('');
  const prevLotByLevel=new Map(levelViews.filter(v=>v.prevView).map(v=>[v.x.level,v.prevView.lot]));
  const voidedRows=(state.data[t.id]||[]).filter(p=>{if(!p.voided)return false;const pv=prevLotByLevel.get(p.level);return pv!=null?(p.lot||'')===pv:(p.date>=W.start&&p.date<=W.end);}).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||pointRunNo(a)-pointRunNo(b)).map(p=>`<tr data-qc-point-id="${escAttr(p.id||'')}" tabindex="-1"><td>${vnDate(p.date)}</td><td>Mức ${p.level} · Lô ${esc(p.lot||'?')}</td><td class="num">${fmtPointValue(p,t)}</td><td>${esc(p.runId||'—')}</td><td>${esc(p.voidedBy||'')}</td><td>${esc(p.voidReason||'')}</td></tr>`).join('');
  const voidedBox=voidedRows?`<div class="qc-voided-box"><h4>Điểm đã hủy trong khoảng</h4><table class="qc-voided-table"><thead><tr><th>Ngày</th><th>Mức / lô</th><th class="num">Giá trị</th><th>Lần chạy</th><th>Người hủy</th><th>Lý do</th></tr></thead><tbody>${voidedRows}</tbody></table></div>`:'';
  const pointsInView=`<details class="panel entry-secondary-panel qc-points-panel" ${entryDetailOpen.has('points')?'open':''} ontoggle="entryDetailToggled('points',this.open)"><summary class="entry-secondary-summary"><span>Điểm trong khoảng xem</span><small>Tra cứu chi tiết, luật vi phạm và điểm đã hủy</small></summary><div class="entry-secondary-body">
    <div class="hint qc-cumulative-note">Thống kê tích lũy tính từ đầu LOT đến ${vnDate(W.end)}; bảng bên dưới hiển thị từ ${vnDate(W.start)} đến ${vnDate(W.end)}.</div>
    <div class="qc-table-grid">${tableCards}</div>${voidedBox}</div></details>`;
  const dayBtn=n=>`<button class="${!entryStart&&entryDays===n?'on':''}" onclick="entrySetDays(${n})">${n} ngày</button>`;
  entryLjRenderCache={testId:t.id,start:W.start,end:W.end,levels:new Map()};
  const ljStack=entryCols.map(x=>{const on=x.level===entrySel.level&&!x.parallel,
      // Lô song song dùng chính điểm của nó (không qua acceptedLotPoints — helper đó
      // chọn 1 lần chạy lại/ngày cho lô đang vận hành, không áp dụng cho lô đang đánh giá).
      curPts=(x.parallel?entryColumnPoints(t,x):acceptedForLevel(x.level)).filter(p=>p.date>=W.start&&p.date<=W.end&&(p.lot||'')===(x.lot||'')),
      prevSeries=x.parallel?[]:previousLotSeries(t,x.level),prevLot=entryPrevOpen.get(t.id+'|'+x.level)||'',prevView=prevSeries.find(s=>(s.lot||'')===prevLot),targetCfg=prevView||entryColumnCfg(t,x.level,x.lot),chartPts=prevView?prevView.pts:curPts,chartLot=prevView?prevView.lot:x.lot,chartMean=targetCfg&&targetCfg.mean,chartSd=targetCfg&&targetCfg.sd,st=stats(chartPts.map(p=>p.val));
    entryLjRenderCache.levels.set(`${x.level}|${chartLot||''}`,chartPts);
    const metric=(k,v,control=false)=>`<div class="lj-qc-stat${control?' control':''}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    const strip=metric('Mean thực',st?fmtTestValue(t,st.m):'—')+metric('SD thực',st?fmtTestStat(t,st.sd):'—')+metric('CV thực',st?fmt(st.cv)+'%':'—')+metric('Mean mục tiêu',fmtTestValue(t,chartMean),true)+metric('SD mục tiêu',fmtTestStat(t,chartSd),true);
    const prevBtn=x.parallel?'<span class="hint">Đang đánh giá</span>':prevSeries.length?(prevView?btn('Xem lô mới',`event.stopPropagation();entryShowCurrentLot(${x.level})`,'teal sm'):btn('Xem lô cũ',`event.stopPropagation();entryShowPrevLot(${x.level},'${jsq(prevSeries[0].lot||'')}')`,'ghost sm')):`<span class="hint">${x.applied==='lab'?'Dải PXN':'Dải NSX'}</span>`;
    return `<div class="lj-mini ${on?'on':''}${x.parallel?' lj-mini-parallel':''}" onclick="entryFocusLevel(${x.level})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();entryFocusLevel(${x.level})}" role="button" tabindex="0" aria-label="Chọn mức ${x.level}, lô ${escAttr(chartLot||'?')}, ${chartPts.length} điểm${x.parallel?', lô chạy song song':''}"><div class="lj-mini-h"><b>Mức ${x.level} · ${prevView?'Lô cũ':'Lô'} ${esc(chartLot||'?')}${x.parallel?' <span class="qc-parallel-label">Song song</span>':''}<span class="lj-point-count">${chartPts.length} điểm</span></b>${prevBtn}</div><div class="lj-qc-strip" tabindex="0">${strip}</div><div class="chart-scroll" tabindex="0"><canvas class="entryLJStack" data-render-scale="2" data-test="${t.id}" data-level="${x.level}" data-lot="${escAttr(chartLot||'')}" data-mean="${escAttr(chartMean)}" data-sd="${escAttr(chartSd)}" data-start="${W.start}" data-end="${W.end}" width="1400" height="380"></canvas></div></div>`;}).join('');
  const levelHead=entryCols.map(x=>{const cfg=entryColumnCfg(t,x.level,x.lot),mean=Number(cfg&&cfg.mean),sd=Number(cfg&&cfg.sd),limits=Number.isFinite(mean)&&Number.isFinite(sd)?`${fmtTestValue(t,mean-2*sd)} – ${fmtTestValue(t,mean+2*sd)}`:'—',tip=`Mean ${Number.isFinite(mean)?fmtTestValue(t,mean):'—'} · SD ${Number.isFinite(sd)?fmtTestStat(t,sd):'—'} · ±2SD ${limits}`;return`<th class="qc-level-head" tabindex="0" data-qc-tooltip="${escAttr(tip)}" aria-label="Mức ${x.level}, lô ${escAttr(x.lot||'?')}. ${escAttr(tip)}">Mức ${x.level} · Lô ${esc(x.lot||'?')}${x.parallel?' <span class="qc-parallel-label">Song song</span>':''}</th>`;}).join('');
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
       const runInputs=dayGroup.runs.map(g=>{const p=g.levels[x.key],runArg=jsq(g.runId||'');if(!p){if(!shouldShowEmptyRun(x,g))return '';emptyShown=true;return canWrite()?`<div class="qc-run-slot"><input class="qc-inline-input empty" type="text" inputmode="decimal" autocomplete="off" placeholder="--" title="Dùng phím mũi tên để chuyển ô" aria-label="Nhập QC ngày ${vnDate(g.date)}, mức ${x.level}, lô ${escAttr(x.lot||'')}, lần ${g.runNo}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter" data-focus-date="${escAttr(g.date)}" data-focus-run="${g.runNo}" data-focus-level="${levelIdx}" onkeydown="entrySheetKey(event)" onchange="entryInlineSave('${t.id}',${x.level},'${g.date}',this.value,'${runArg}','${lotArg}')"></div>`:`<div class="qc-run-slot muted"><b>—</b></div>`;}levelHasPoint=true;
        const isPrev=!!p._prevLot,pMean=isPrev&&Number.isFinite(+p.qcMean)?+p.qcMean:x.mean,pSd=isPrev&&Number.isFinite(+p.qcSd)?+p.qcSd:x.sd;
        const verdict=isPrev?{level:'ok',rules:[]}:colVerdict(x,p),view=EntryService.buildPointView({point:p,verdict,mean:pMean,sd:pSd,previousLot:isPrev?p._prevLot:undefined}),lv=qcVerdictLabel(view.level);
        return `<div class="qc-run-slot${isPrev?' prev-lot-slot':''}"><b class="qc-value-chip ${view.valueClass}" title="${isPrev?'Lô cũ '+escAttr(p._prevLot)+' · đã chuyển tiếp · chỉ đọc':'Đã lưu, không sửa trực tiếp'}">${fmtPointValue(p,t)}</b><small>${view.z>=0?'+':''}${fmt(view.z)}s · ${isPrev?'Lô '+esc(p._prevLot):lv}</small></div>`;}).join('');
      const addRunBtn=canWrite()&&levelHasPoint&&!emptyShown?`<button type="button" class="qc-add-run-btn" title="Thêm lần chạy bổ sung" onclick="entryUnlockExtraRun('${t.id}','${jsq(x.key)}','${dayGroup.date}',${levelIdx},${nextLevelRunNo})"><span class="qc-add-run-icon">+</span><span class="qc-add-run-label">Thêm</span></button>`:'';
      return `<td class="num qc-run-cell${x.parallel?' qc-parallel-cell':''}"><div class="qc-run-grid${addRunBtn?' has-add-btn':''}">${runInputs}</div>${addRunBtn}</td>`;}).join('');
    const staff=[...new Map(dayGroup.runs.flatMap(g=>Object.values(g.levels)).map(p=>pointStaff(p)).filter(x=>x.code).map(x=>[x.code,x])).values()];
    const staffCell=staff.length?staff.map(x=>`<span class="qc-staff" title="${escAttr(x.name||x.code)}">${esc(x.code)}</span>`).join('<span class="qc-staff-sep">/</span>'):'—';
    const status=!hasPoint?'—':worst==='rej'?'<span class="tag rej">R</span>':worst==='warn'?'<span class="tag warn">W(A)</span>':'<span class="tag ok">A</span>';
    const autoNote=rulesAll.length?(worst==='rej'?errorType([...new Set(rejRules.length?rejRules:rulesAll)]):'Theo dõi / cảnh báo'):'';
    const datePoints=dayGroup.runs.flatMap(g=>Object.values(g.levels)).filter(Boolean);
    const manualNote=(datePoints.find(p=>String(p.note||'').trim())||{}).note||'';
    const note=hasPoint?(canWrite()?`<textarea class="qc-note-input" rows="1" placeholder="${escAttr(autoNote||'Nhập ghi chú...')}" onchange="entryDateNoteSave('${t.id}','${dayGroup.date}',this.value)">${esc(manualNote)}</textarea>`:(manualNote?esc(manualNote):(autoNote||'—'))):'—';
    const liveCols=entryCols.filter(x=>!x.parallel),doneLevels=liveCols.filter(x=>dayGroup.runs.some(g=>g.levels[x.key])).length,rowCls=[dayGroup.date===today?'today':'',dayGroup.date<=today&&doneLevels<liveCols.length?'missing':'',hasPoint?'has-data':''].filter(Boolean).join(' ');
    return `<tr class="${rowCls}" data-date="${dayGroup.date}"><td><span>${dateObj(dayGroup.date).getDate()}</span>${dayGroup.date===today?'<b>Hôm nay</b>':''}</td>${cells}<td class="qc-staff-cell">${staffCell}</td><td>${[...new Set(warnRules)].join(', ')||'—'}</td><td>${[...new Set(rejRules)].join(', ')||'—'}</td><td>${status}</td><td>${note}</td></tr>`;}).join('');
  const worksheet=`<div class="panel qc-sheet-panel"><div class="qc-sheet-heading">
      <div class="qc-sheet-title"><span>Bảng nhập QC</span><strong>${esc(testDisplayName(t))}</strong><small>Lô ${esc(entryLotLabels(entryCols))}</small></div>
      <div class="qc-month-area"><div class="qc-month-picker"><select aria-label="Chọn tháng" onchange="entrySetSheetPart('month',this.value)">${sheetMonthOptions}</select><select aria-label="Chọn năm" onchange="entrySetSheetPart('year',this.value)">${sheetYearOptions}</select>${btn('Tháng hiện tại','entrySetSheetMonth(isoMonth())','ghost sm qc-current-month')}${btn('Tới hôm nay','entryGoToday()','teal sm qc-today-jump')}</div></div></div>
      <div class="qc-sheet-wrap" role="region" aria-label="Bảng nhập QC theo tháng" tabindex="0"><table class="qc-sheet"><thead><tr><th>Ngày</th>${levelHead}<th>NV thực hiện</th><th>Vi phạm cảnh báo</th><th>Vi phạm loại bỏ</th><th>Chấp nhận</th><th>Ghi chú</th></tr></thead>
       <tbody>${sheetRows||`<tr><td colspan="${6+entryCols.length}" class="empty-cell">Chưa có điểm nào trong khoảng này.</td></tr>`}</tbody></table></div>
      <div id="entryMsg" role="status" aria-live="polite" style="margin:12px 16px 16px">${entryLastMsg}</div></div>`;
  const right=`${worksheet}
   <div class="panel"><div class="lj-toolbar">
        <h3>Biểu đồ Levey-Jennings</h3>
        <div class="lj-filter"><label class="lj-date-field"><span class="hint">Từ ngày</span>${dateBox('entryStartDate',W.start,'','onchange="entrySetStart(this.value)"')}</label><label class="lj-date-field"><span class="hint">Đến ngày</span>${dateBox('entryEndDate',W.end,'','onchange="entrySetEnd(this.value)"')}</label><div class="dayseg">${dayBtn(7)}${dayBtn(14)}${dayBtn(30)}${dayBtn(60)}${dayBtn(90)}</div></div></div>
      <div class="hint lj-range">Khoảng xem: ${vnDate(W.start)} – ${vnDate(W.end)} · ${operationalLevels(t).length} mức QC</div>
      <div class="lj-stack">${ljStack}</div>
      <div class="legend"><span><span class="dot" style="background:#0e8f8f"></span> Trong ±2SD</span><span><span class="dot" style="background:#dd8b1f"></span> Cảnh báo 2–3SD</span><span><span class="dot" style="background:#c5221f"></span> Loại bỏ ngoài 3SD</span></div></div>
   ${pointsInView}
   ${rangeBox}`;
  entryPartialRenderCache={testId:t.id,right};
  if(rightOnly)return right;
  return headOnly('Nhập QC','Ghi nhận kết quả theo ngày, mức QC và lô đang vận hành')+
   `<div class="entrygrid${treeCollapsed?' tree-collapsed':''}">${btn(treePanelIcon,'toggleEntryTree()','teal icon entry-tree-expand','Hiện danh mục nội kiểm',{attrs:{'aria-label':'Hiện danh mục nội kiểm','aria-controls':'entryTreePanel','aria-expanded':'false'}})}<div class="tree" id="entryTreePanel">${treeHead}<div role="tree" aria-label="Danh mục nội kiểm">${tree}</div></div><div class="entry-main">${right}</div></div>`;
}
function jsq(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/&/g,'\\u0026').replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
/* Mở/thu nhánh ngay trên DOM, không vẽ lại toàn trang: khung cây có scroll riêng nên
   thay cả `.tree` sẽ đưa scrollTop về 0 và làm người dùng mất vị trí ở danh sách dài. */
function treeToggle(k){if(treeOpen.has(k))treeOpen.delete(k);else treeOpen.add(k);const open=treeOpen.has(k),node=[...document.querySelectorAll('.tree .tnode')].find(el=>el.dataset.key===String(k));if(node){node.setAttribute('aria-expanded',String(open));node.classList.toggle('open',open);const caret=node.querySelector('.caret');if(caret)caret.textContent=open?'−':'+';}entryFilter(entryQ);}
function toggleEntryTree(){entryTreeCollapsed=!entryTreeIsCollapsed();try{localStorage.setItem('qclab_entry_tree_collapsed',entryTreeCollapsed?'1':'0');}catch(e){}const grid=document.querySelector('.entrygrid');if(!grid){rerender();return;}grid.classList.toggle('tree-collapsed',entryTreeCollapsed);const target=grid.querySelector(entryTreeCollapsed?'.entry-tree-expand':'.entry-tree-toggle');requestAnimationFrame(()=>{if(target)target.focus({preventScroll:true});});}
function entryTreeKey(event){
  const item=event.currentTarget,key=event.key;
  if(key==='Enter'||key===' '){event.preventDefault();item.click();return;}
  if((key==='ArrowRight'&&item.getAttribute('aria-expanded')==='false')||(key==='ArrowLeft'&&item.getAttribute('aria-expanded')==='true')){event.preventDefault();item.click();return;}
  if(key!=='ArrowDown'&&key!=='ArrowUp'&&key!=='Home'&&key!=='End')return;
  const items=[...document.querySelectorAll('.tree .tnode[tabindex="0"]')].filter(el=>el.offsetParent!==null),index=items.indexOf(item);if(index<0||!items.length)return;
  event.preventDefault();const next=key==='Home'?items[0]:key==='End'?items[items.length-1]:items[(index+(key==='ArrowDown'?1:-1)+items.length)%items.length];next.focus();
}
function entryFilter(v){
  entryQ=v;
  const q=searchText(entryQ),nodes=[...document.querySelectorAll('.tree .tnode')];
  if(!q){
    nodes.forEach(el=>el.style.display='');
    nodes.filter(el=>el.dataset.treeRole==='group'&&!treeOpen.has(el.dataset.key)).forEach(group=>{
      for(let n=group.nextElementSibling;n&&n.dataset.treeRole==='assay';n=n.nextElementSibling)n.style.display='none';
    });
    nodes.filter(el=>el.dataset.treeRole==='machine'&&!treeOpen.has(el.dataset.key)).forEach(machine=>{
      for(let n=machine.nextElementSibling;n&&n.dataset.treeRole!=='machine';n=n.nextElementSibling)n.style.display='none';
    });
    return;
  }
  nodes.forEach(el=>el.style.display='none');
  document.querySelectorAll('.tree .tn-config').forEach(row=>{
    if(!String(row.dataset.search||'').includes(q))return;
    row.style.display='';
    let group=row.previousElementSibling;
    while(group&&group.dataset.treeRole!=='group')group=group.previousElementSibling;
    if(group)group.style.display='';
    let machine=group&&group.previousElementSibling;
    while(machine&&machine.dataset.treeRole!=='machine')machine=machine.previousElementSibling;
    if(machine)machine.style.display='';
  });
}
function entrySetMachine(v){entryMachine=v;rerender();}
function entryPick(tid,level){entrySel={testId:tid,level};entryStart=null;entryEnd=null;entryLastMsg='';document.querySelectorAll('.tree .tn-config').forEach(row=>{const on=row.dataset.testId===String(tid);row.classList.toggle('on',on);row.setAttribute('aria-current',String(on));});entryRenderKeepScroll();}
function entryFocusLevel(level){if(!entrySel)return;entrySel={testId:entrySel.testId,level};entryRenderKeepScroll();}
function entryShowPrevLot(level,lot){if(!entrySel)return;entryPrevOpen.set(entrySel.testId+'|'+level,lot);entryRenderKeepScroll();}
function entryShowCurrentLot(level){if(!entrySel)return;entryPrevOpen.delete(entrySel.testId+'|'+level);entryRenderKeepScroll();}
function entryFocusPendingSheet(){
  if(!entryPendingSheetFocus)return;
  const [date,level]=entryPendingSheetFocus.split('|');
  const cands=[...document.querySelectorAll('.qc-sheet .qc-inline-input')].filter(x=>x.dataset.focusDate===date&&x.dataset.focusLevel===level);
  // Prefer the still-empty slot for this date+level (a run just saved may have
  // shifted its run-id, so match on date+level rather than the old full key).
  const el=cands.find(x=>x.classList.contains('empty'))||cands[0];
  if(el){el.focus();el.select();entryPendingSheetFocus='';}
}
function entrySheetInputs(){return[...document.querySelectorAll('.qc-sheet .qc-inline-input')]
  .filter(el=>!el.disabled&&el.offsetParent!==null)
  .sort((a,b)=>String(a.dataset.focusDate||'').localeCompare(String(b.dataset.focusDate||''),'vi',{numeric:true})||
    (Number(a.dataset.focusRun||0)-Number(b.dataset.focusRun||0))||
    (Number(a.dataset.focusLevel||0)-Number(b.dataset.focusLevel||0)));}
function entrySheetTarget(inputs,current,key,shiftKey=false){
  const available=inputs||[];if(!available.length||!available.includes(current))return null;
  if(key==='ArrowLeft'||key==='ArrowRight'||key==='Tab'){
    const row=available.filter(el=>el.dataset.focusDate===current.dataset.focusDate&&el.dataset.focusRun===current.dataset.focusRun),ri=row.indexOf(current),step=key==='ArrowLeft'||(key==='Tab'&&shiftKey)?-1:1;
    if(ri<0||row.length<2)return null;
    return key==='Tab'?row[(ri+step+row.length)%row.length]:(row[ri+step]||null);
  }
  if(key==='ArrowUp'||key==='ArrowDown'||key==='Enter'){
    const column=available.filter(el=>el.dataset.focusLevel===current.dataset.focusLevel),ci=column.indexOf(current),step=key==='ArrowUp'?-1:1;
    if(ci<0||column.length<2)return null;
    return key==='Enter'?column[(ci+1)%column.length]:(column[ci+step]||null);
  }
  return null;
}
function entrySheetKey(event){
  if(event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
  const supported=['Enter','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];if(!supported.includes(event.key))return;
  const cur=event.currentTarget,next=entrySheetTarget(entrySheetInputs(),cur,event.key,event.shiftKey);if(!next)return;
  event.preventDefault();
  entryPendingSheetFocus=`${next.dataset.focusDate}|${next.dataset.focusLevel}`;
  cur.blur();
  setTimeout(entryFocusPendingSheet,0);
}
function entryLatestTreeState(t){
  if(!t)return'none';
  const ord={none:-1,ok:0,warn:1,rej:2},wg=activeWestgard(t);let worst='none';
  operationalLevels(t).forEach(l=>{const pts=pointsForLot(t.id,l.level,l.lot||''),last=pts[pts.length-1],level=last&&(wg.byPoint.get(last.id)||{}).level||'none';if(ord[level]>ord[worst])worst=level;});
  return worst;
}
function entrySyncTreeState(testId){
  const row=[...document.querySelectorAll('.tree .tn-config[data-test-id]')].find(el=>el.dataset.testId===String(testId||''));if(!row)return;
  const apply=(el,value)=>{const badge=el&&el.querySelector('.state');if(!badge)return;badge.className='state'+(value==='none'?'':' '+value);badge.textContent=stateName(value);};
  apply(row,entryLatestTreeState(state.tests.find(t=>t.id===testId)));
  let group=row.previousElementSibling;while(group&&group.dataset.treeRole!=='group')group=group.previousElementSibling;if(!group)return;
  const ord={none:-1,ok:0,warn:1,rej:2};let worst='none';
  for(let item=group.nextElementSibling;item&&item.dataset.treeRole==='assay';item=item.nextElementSibling){const badge=item.querySelector('.state'),value=badge&&['ok','warn','rej'].find(x=>badge.classList.contains(x))||'none';if(ord[value]>ord[worst])worst=value;}
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
  entryExtraRun.add(`${tid}|${colKey}|${date}|${runNo}`);
  entryPendingSheetFocus=`${date}|${levelIdx}`;
  entryRenderKeepScroll();
}
async function entryDateNoteSave(tid,date,value){
  if(!requireWrite())return;
  if(!await requireUnlockedPeriod(date,'ghi chú QC'))return;
  const result=EntryService.updateDateNoteCommand(state,{testId:tid,date,value,formatDate:vnDate});
  if(!result.ok){if(result.error==='period-locked')entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể sửa ghi chú.</div>');return;}
  const note=result.note;
  logAct(result.effects.audit.action,result.effects.audit.detail,result.effects.audit.target);
  save(result.effects.save);
  entrySetLastMsg(note?`<div class="alert ok">✓ Đã lưu ghi chú ngày ${vnDate(date)}.</div>`:`<div class="alert ok">✓ Đã xóa ghi chú ngày ${vnDate(date)}.</div>`);
}
/* cfg dùng khi ghi điểm. Mặc định là cấu hình sống của mức; nếu lotNo trỏ đúng lô
   đang chạy song song thì trả cfg tổng hợp của lô đó (Mean/SD riêng của nó).
   Cố ý không kèm meanSdHistory của mức: cảnh báo "ngày thuộc giai đoạn lô khác"
   trong qcPointWarnings sẽ báo nhầm, vì chạy song song vốn dĩ trùng giai đoạn
   với lô đang dùng. */
function entryColumnCfg(t,level,lotNo){
  const cfg=t&&lvlCfg(t,+level);if(!cfg)return null;
  if(!lotNo||String(lotNo)===String(cfg.lot||''))return cfg;
  const par=parallelLotForLevel(t,+level);
  if(!par||String(par.lotNo)!==String(lotNo))return null;
  return{level:cfg.level,lot:par.lotNo,mean:par.mean,sd:par.sd,low:par.low,high:par.high,exp:par.exp,meanSdHistory:[],applied:'mfg'};
}
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
    openModal(`<div class="modal">
      <div class="modal-h"><h3>Cảnh báo dữ liệu bất thường</h3><button class="modal-close" onclick="closeModal();entryRenderKeepScroll()">×</button></div>
      <div class="modal-b">${preIssues.map(x=>`<div class="alert warn">${esc(x)}</div>`).join('')}<div class="hint">Bạn vẫn muốn lưu điểm QC này?</div></div>
      <div class="modal-f">${btn('Hủy','closeModal();entryRenderKeepScroll()','ghost')}${btn('Vẫn lưu',`closeModal();entryInlineSaveCommit('${jsq(tid)}',${level},'${jsq(date)}',${val},'${jsq(runId)}','${jsq(lotNo)}',${valueDecimals})`,'teal')}</div>
    </div>`);
    return;
  }
  entryInlineSaveCommit(tid,level,date,val,runId,lotNo,valueDecimals);
}
function entryInlineSaveCommit(tid,level,date,val,runId,lotNo='',valueDecimals=qcValueDecimals(val)){
  const t=state.tests.find(x=>x.id===tid),cfg=entryColumnCfg(t,level,lotNo);
  // Kiểm tra lại tại thời điểm ghi vì nhóm lô có thể vừa bị dừng trong lúc hộp
  // thoại xác nhận dữ liệu bất thường đang mở hoặc vừa nhận đồng bộ từ máy khác.
  if(!t||!cfg||!canEnterQcForLevel(t,level)){entrySetLastMsg('<div class="alert warn">Không thể lưu: nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>');entryRenderKeepScroll();return;}
  const recorded=EntryService.recordPoint(state,{tid,level,date,value:val,valueDecimals,runId,cfg,staff:currentStaff(),id:uid()});
  if(!recorded.ok){
    if(recorded.error==='period-locked')entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể nhập điểm QC.</div>');
    else entrySetLastMsg('<div class="alert warn">Không thể lưu điểm QC không hợp lệ.</div>');
    return;
  }
  const saved=recorded.point,parallel=!!(lotNo&&String(lotNo)!==String((lvlCfg(t,level)||{}).lot||''));
  logAct('Thêm điểm QC',`Ngày ${vnDate(date)}, M${level}${parallel?' · lô song song '+lotNo:''}, giá trị ${fmtPointValue(saved,t)}`,t.name);
  clearDerivedForTest(tid);
  // Lô song song không nằm trong activeWestgard (chỉ phủ lô đang dùng) — tra bảng
  // đánh giá riêng của chính nó để báo đúng kết luận cho điểm vừa nhập.
  const f=(parallel?parallelWestgard(t,{level:+level,lot:String(lotNo),mean:+cfg.mean,sd:+cfg.sd,parallel:true}).byPoint.get(saved.id):activeWestgard(t).byPoint.get(saved.id))||{level:'ok',rules:[]},rules=[...new Set(f.rules||[])];
  save({clearDerived:false,testId:tid});
  const tag=`Mức ${level}${parallel?' · lô song song '+esc(lotNo):''}`;
  entrySel={testId:tid,level};entryLastMsg=f.level==='rej'?`<div class="alert rej"><b>⚠ ${tag} vi phạm — ${rules.join(', ')}</b></div>`:f.level==='warn'?`<div class="alert warn"><b>${tag} cảnh báo — ${rules.join(', ')}</b></div>`:`<div class="alert ok">✓ Đã lưu ${tag} ngày ${vnDate(date)}.</div>`;
  entryRenderKeepScroll();
}
function syncVoidNceChoice(){
  const kind=(document.getElementById('voidKindInput')||{}).value,box=document.getElementById('voidOpenNce'),hint=document.getElementById('voidNceHint'),reasonBox=document.getElementById('voidReasonBox'),reasonErr=document.getElementById('voidReasonErr');
  if(!box)return;
  if(kind==='analytical'){box.checked=true;box.disabled=true;if(hint)hint.textContent='Hệ thống sẽ lập hồ sơ NCE mới, hoặc dùng lại hồ sơ đang mở của điểm này, rồi chờ một kết quả QC chạy lại được chấp nhận.';}
  else if(kind==='data-entry'){box.checked=false;box.disabled=true;if(hint)hint.textContent='Chỉ lưu dấu vết hủy; không mở NCE và không yêu cầu chạy lại QC.';}
  else{box.checked=false;box.disabled=false;if(hint)hint.textContent='Chọn mục này nếu sự việc cần điều tra và xác nhận QC chạy lại.';}
  const label=document.getElementById('voidReasonLabel');
  if(label)label.textContent=kind==='other'?'Lý do hủy (bắt buộc, tối thiểu 5 ký tự)':'Ghi chú / bằng chứng (khuyến nghị)';
  if(reasonBox)reasonBox.hidden=false;
  if(reasonErr)reasonErr.style.display='none';
}
async function voidQcPoint(tid,pointId){
  if(!requireWrite())return;
  const t=state.tests.find(x=>x.id===tid),p=(state.data[tid]||[]).find(x=>x.id===pointId);
  if(!t||!p||p.voided)return;
  if(!await requireUnlockedPeriod(p.date,'hủy điểm QC'))return;
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Hủy điểm QC</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <div class="hint">Ngày ${vnDate(p.date)} · Mức ${p.level} · Giá trị ${fmtPointValue(p,t)}</div>
      <label>Loại hủy</label>
      <select id="voidKindInput" aria-label="Loại hủy điểm QC" onchange="syncVoidNceChoice()">
        <option value="analytical">Kết quả QC thực tế không hợp lệ</option>
        <option value="data-entry">Nhập sai dữ liệu</option>
        <option value="other">Lý do khác</option>
      </select>
      <div class="void-nce-choice"><label><input id="voidOpenNce" type="checkbox" checked disabled> Lập hồ sơ NCE và yêu cầu chạy lại QC</label><div id="voidNceHint" class="hint">Hệ thống sẽ mở hoặc tái sử dụng hồ sơ NCE và chờ một kết quả QC chạy lại được chấp nhận.</div></div>
      <div id="voidReasonBox"><label id="voidReasonLabel">Ghi chú / bằng chứng (khuyến nghị)</label>
        <textarea id="voidReasonInput" aria-label="Ghi chú lý do hủy điểm QC" placeholder="VD: Máy báo lỗi hút mẫu lúc 08:15, đã ghi nhận trong sổ bảo trì..." oninput="document.getElementById('voidReasonErr').style.display='none'"></textarea>
        <div id="voidReasonErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần ghi lý do hủy tối thiểu 5 ký tự.</div>
      </div>
    </div>
    <div class="modal-f">${btn('Đóng','closeModal()','ghost')}${btn('Xác nhận hủy',`confirmVoidQcPoint('${tid}','${pointId}')`,'danger')}</div>
  </div>`);
  setTimeout(()=>{const e=document.getElementById('voidKindInput');if(e)e.focus();},50);
}
async function confirmVoidQcPoint(tid,pointId){
  const t=state.tests.find(x=>x.id===tid),p=(state.data[tid]||[]).find(x=>x.id===pointId);
  if(!t||!p||p.voided){closeModal();return;}
  const input=document.getElementById('voidReasonInput'),kind=(document.getElementById('voidKindInput')||{}).value||'other',openNce=!!((document.getElementById('voidOpenNce')||{}).checked),clean=QCCore.cleanText(input?input.value:'',1000).trim(),verdict=activeWestgard(t).byPoint.get(p.id)||{level:'ok',rules:[]},rules=[...new Set(verdict.rules||[])],rule=rules.join(', ')||'Không có luật Westgard',qcVerdict=['warn','rej'].includes(verdict.level)?verdict.level:'invalid',qcErrorType=errorType(rules);
  if(kind==='other'&&clean.length<5){
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
  const result=EntryService.voidPoint(state,{tid,pointId,reason:clean,kind,openNce,rule,errorType:qcErrorType,qcVerdict,staff:currentStaff(),nowIso:new Date().toISOString(),today:isoToday(),id:uid(),nceId:nextNceId(isoToday()),dueDate:nceDueDate(7),formatDate:vnDate,formatNumber:fmt});
  if(result&&result.error==='period-locked'){entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể hủy điểm QC.</div>');return;}
  if(!result||result.error)return;
  clearDerivedForTest(tid);
  logAct('Hủy điểm QC',`Ngày ${vnDate(result.point.date)}, M${result.point.level}, giá trị ${fmtPointValue(result.point,t)} · ${result.reason}`,t.name);
  const followup=result.openNce?(result.reusedAction?' Đã giữ liên kết với hồ sơ NCE đang mở.':` Đã mở hồ sơ ${esc(result.action&&result.action.nceId||'NCE')} để tiếp tục điều tra.`):' Không yêu cầu NCE/QC chạy lại.';
  save({clearDerived:false,testId:tid});entryLastMsg=`<div class="alert warn">Đã hủy điểm QC ngày ${vnDate(result.point.date)}. Điểm không còn tham gia tính toán.${followup}</div>`;entryRenderKeepScroll();
}
function entrySetSheetMonth(v){if(!/^\d{4}-\d{2}$/.test(v))return;entrySheetMonth=v;entryLastMsg='';rerender();}
function entryGoToday(){entrySheetMonth=isoMonth();entryJumpToday=true;entryLastMsg='';rerender();}
function entrySetSheetPart(part,value){const m=/^(\d{4})-(\d{2})$/.exec(entrySheetMonth||isoMonth());let year=+m[1],month=+m[2];if(part==='year')year=+value;else month=+value;entrySetSheetMonth(`${year}-${String(month).padStart(2,'0')}`);}
function entrySetDays(n){entryDays=Math.min(90,n);entryStart=null;entryEnd=null;rerender();}
function entrySetStart(v){entryStart=parseVN(v)||null;rerender();}
function entrySetEnd(v){entryEnd=parseVN(v)||null;rerender();}

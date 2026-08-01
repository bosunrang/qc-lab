/* ===== WESTGARD PAGE ROUTE ===== */
function wgMultiViews(t){
  const levels=operationalLevels(t).map(l=>({...l,pts:operationalLotPoints(t,l.level)}));
  const previousByLevel=new Map(levels.map(l=>[l.level,previousLotSeries(t,l.level)]));
  const openLevels=levels.filter(l=>wgPrevOpen.has(t.id+'|'+l.level)).map(l=>l.level);
  return WestgardViewModel.buildMultiViews({levels,previousByLevel,openLevels});
}
function wgTogglePrevLot(level){const k=selTest+'|'+level;if(wgPrevOpen.has(k))wgPrevOpen.delete(k);else wgPrevOpen.add(k);rerender();}
/* Nhóm lô "cũ" để xem lại Westgard: gồm cả nhóm lưu trữ THẬT (g.active===false, từ
   "Chấp nhận lô mới" ở Chuyển tiếp lô) lẫn nhóm chỉ bị đánh dấu "Đã dừng" thủ công/qua
   Kích hoạt nhóm khác (g.status==='stopped', vẫn active:true) — cả hai đều là nhóm không
   còn xét nghiệm nào đang dùng, người dùng cần xem lại chi tiết/biểu đồ như nhóm đang hoạt động. */
function wgArchivedGroups(){return(state.lotGroups||[]).filter(g=>g.active===false||g.status==='stopped').sort((a,b)=>String(b.stoppedAt||'').localeCompare(String(a.stoppedAt||''))||String(a.name||'').localeCompare(String(b.name||''),'vi'));}
function wgSetViewMode(mode){wgViewMode=mode==='archived'?'archived':'current';rerender();}
function wgSetChartMode(mode){wgChartMode=mode==='cusum'?'cusum':'lj';rerender();}
function wgChartModeTabs(){
  return `<div class="dayseg wg-view-mode"><button class="${wgChartMode==='lj'?'on':''}" onclick="wgSetChartMode('lj')">Levey-Jennings</button><button class="${wgChartMode==='cusum'?'on':''}" onclick="wgSetChartMode('cusum')">Xu hướng CUSUM</button></div>`;
}
/* Biểu đồ CUSUM chỉ tham khảo xu hướng (không đổi trạng thái đạt/loại QC —
   xem cusumSeries()/testCusumConfig() trong qc-domain.js), nên tách hẳn khỏi
   danh sách khối per-level của Levey-Jennings thay vì chèn xen kẽ, và chỉ vẽ
   cho các mức đã bật CUSUM riêng ở modal cấu hình xét nghiệm. */
function pageWestgardCusum(t){
  const cfg=testCusumConfig(t);
  if(!cfg.on)return `<div class="panel">${emptyState('Chưa bật CUSUM cho xét nghiệm này','Bật trong cấu hình xét nghiệm để xem biểu đồ xu hướng CUSUM.',canWrite()?btn('Mở cấu hình xét nghiệm',`openConfigAssay('${t.id}')`,'teal'):'')}</div>`;
  const levels=operationalLevels(t);
  if(!levels.length)return `<div class="panel">${emptyState('Chưa có mức QC đang vận hành','Cần Panel QC, Nhóm lô QC và Mean/SD hợp lệ trước khi vẽ CUSUM.')}</div>`;
  return levels.map(l=>{
    const pts=operationalLotPoints(t,l.level);
    const title=`<h3><span class="wg-level-title"><span>Mức ${l.level}</span><span class="wg-lot-name">Lô ${esc(l.lot||'?')}</span></span><span class="wg-level-meta"><span>Mean ${fmt(l.mean)}</span><span>SD ${fmt(l.sd,3)}</span><span>${pts.length} điểm</span><span>k=${fmt(cfg.k,2)} · h=${fmt(cfg.h,2)}</span></span></h3>`;
    if(!pts.length)return `<div class="panel">${title}${emptyState('Chưa có dữ liệu','LOT đang dùng chưa có điểm QC.')}</div>`;
    return `<div class="panel">${title}
      <div class="hint wg-panel-intro">Đường CUSUM+ (teal)/CUSUM− (xanh tím) cộng dồn độ lệch z-score qua từng điểm; vượt vạch đứt ±h là dấu hiệu trôi/shift kéo dài. Đường xám mờ là trung bình động 5 điểm, chỉ để tham khảo hình dạng xu hướng.</div>
      <div class="chart-scroll" tabindex="0"><canvas class="cusumChart" data-test="${t.id}" data-level="${l.level}" width="1400" height="430"></canvas></div></div>`;
  }).join('');
}
function wgSetArchivedGroup(id){wgArchivedGroupId=id;wgArchivedTestId='';rerender();}
function wgSetArchivedTest(id){wgArchivedTestId=id;rerender();}
function wgViewModeTabs(archivedGroups){
  return archivedGroups.length?`<div class="dayseg wg-view-mode"><button class="${wgViewMode==='current'?'on':''}" onclick="wgSetViewMode('current')">Xét nghiệm đang vận hành</button><button class="${wgViewMode==='archived'?'on':''}" onclick="wgSetViewMode('archived')">Nhóm lô đã dừng/lưu trữ (${archivedGroups.length})</button></div>`:'';
}
const WG_TABLE_INITIAL_ROWS=120;
function wgRowsWindow(rows,key){
  const all=rows||[],expanded=wgExpandedRows.has(key),visible=expanded?all:all.slice(-WG_TABLE_INITIAL_ROWS);
  return{rows:visible,total:all.length,expanded,limited:visible.length<all.length};
}
function wgToggleRows(key){if(wgExpandedRows.has(key))wgExpandedRows.delete(key);else wgExpandedRows.add(key);rerender();}
function wgRowsControl(view,key){
  if(view.total<=WG_TABLE_INITIAL_ROWS)return'';
  return `<div class="wg-row-window"><span>Đang hiển thị ${view.rows.length}/${view.total} điểm${view.expanded?'':' mới nhất'}</span>${btn(view.expanded?`Thu gọn còn ${WG_TABLE_INITIAL_ROWS} điểm`:`Xem toàn bộ ${view.total} điểm`,`wgToggleRows('${jsq(key)}')`,'ghost sm')}</div>`;
}
function wgPointRowsHtml(rows){return rows.map(row=>{const lv=qcVerdictLabel(row.level),err=row.rules.length?errorTypeDetailParts(row.rules):null,errHtml=err?`<div class="wg-error-type"><b>${esc(err.type)}</b>${err.desc?`<small>${esc(err.desc)}</small>`:''}</div>`:'—',support=(row.supportRules||[]).map(r=>`<span class="pill" title="Điểm lịch sử cấu thành quy tắc, không bị loại hồi tố">${icoRefArrow()} ${r}</span>`).join('');
  return `<tr><td>${row.index}</td><td>${vnDate(row.date)}</td><td class="num">${fmt(row.value)}</td><td class="num">${Number.isFinite(row.z)?(row.z>=0?'+':'')+fmt(row.z)+'s':'—'}</td><td><span class="tag ${row.level}">${lv}</span></td><td>${row.rules.map(r=>`<span class="pill">${r}</span>`).join('')||support||'—'}${row.rules.length&&support?`<div class="hint" style="margin-top:4px">Bằng chứng: ${support}</div>`:''}</td><td class="hint">${errHtml}</td></tr>`;}).join('');}
/* Một khối Westgard cho MỘT lô (đang dùng, đã chuyển tiếp, hoặc thuộc nhóm lô đã dừng/lưu
   trữ) — dùng chung cho cả "Xem lô cũ" (theo dòng đời của 1 xét nghiệm) và màn hình duyệt
   theo nhóm lô cũ. Chỉ bảng số liệu, không vẽ biểu đồ riêng từng mức — biểu đồ tổng hợp
   nhiều mức (Levey-Jennings) đã có riêng ở đầu trang (xem wgArchivedMultiViews()). */
function wgLotBlock(t,level,lotNo,mean,sd,pts,badge,titleMain,lotLabel,extraMeta=''){
  const title=`<h3><span class="wg-level-title"><span>${titleMain}</span><span class="wg-lot-name">${lotLabel}</span></span><span class="wg-level-meta"><span class="tag rej">${badge}</span><span>Mean ${fmt(mean)}</span><span>SD ${fmt(sd,3)}</span><span>${pts.length} điểm</span>${extraMeta}</span></h3>`;
  if(!pts.length)return `<div class="panel wg-prev-lot">${title}${emptyState('Chưa có dữ liệu','Không tìm thấy điểm QC nào cho lô này.')}</div>`;
  const wgP=QCCore.westgardByPoint(pts,mean,sd,rule=>testRuleOnWithin(t,rule));
  const rows=WestgardViewModel.buildPointRows({points:pts,verdicts:wgP.F.map(f=>({rules:f.rules,supportRules:f.supportRules,level:ruleResultLevel(t,f.rules)})),zs:wgP.zs,mean,sd}),key=`lot:${t.id}|${level}|${lotNo}`,view=wgRowsWindow(rows,key),rowsHtml=wgPointRowsHtml(view.rows);
  return `<div class="panel wg-prev-lot">${title}${wgRowsControl(view,key)}<table class="wg-table"><thead><tr><th>#</th><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}
/* Trang xem lại nhóm lô đã dừng/lưu trữ — cùng bố cục với pageWestgard() (mode "current"):
   chọn 1 nhóm lô rồi chọn 1 xét nghiệm trong nhóm đó, chỉ hiện các mức của xét nghiệm đang
   chọn (biểu đồ Levey-Jennings tổng hợp nếu có từ 2 mức trở lên, rồi từng khối wgLotBlock
   chỉ có bảng số liệu), thay vì dồn hết mọi xét nghiệm/mức của cả nhóm ra một lượt. */
/* Dữ liệu cho biểu đồ Levey-Jennings tổng hợp (nhiều mức quy về Z-score, canvas.wgLJMultiArchived
   ở after-render.js) của MỘT xét nghiệm trong nhóm lô đã dừng/lưu trữ — cùng dạng {level,lot,
   mean,sd,pts,label} như wgMultiViews() (dùng cho xét nghiệm đang vận hành) để tái dùng chung
   drawLJMultiZ(). */
function wgArchivedMultiViews(rows){
  return rows.map(r=>({level:r.l.level,lot:r.lot.lotNo,mean:r.mean,sd:r.sd,pts:lotPointsByNo(r.t.id,r.l.level,r.lot.lotNo),label:`M${r.l.level}·${r.lot.lotNo}`}));
}
/* Nhóm lô "khớp" ô Tìm nhanh: theo tên nhóm HOẶC số lô bên trong (để gõ số lô cũng nhảy
   được sang đúng nhóm), không chỉ khớp theo tên xét nghiệm như testEntries bên dưới. */
function wgArchivedGroupMatches(g,q){
  if(!q)return true;
  if(searchText(g.name).includes(q))return true;
  return (g.lotIds||[]).some(id=>{const l=state.qcLots.find(x=>x.id===id);return l&&searchText(l.lotNo).includes(q);});
}
function pageWestgardArchived(archivedGroups){
  const q=searchText(wgArchivedTestQ);
  const matchedGroups=archivedGroups.filter(g=>wgArchivedGroupMatches(g,q));
  const groupList=matchedGroups.length?matchedGroups:archivedGroups; // gõ tên xét nghiệm (không khớp nhóm nào) thì vẫn cho chọn đủ nhóm
  if(matchedGroups.length&&!matchedGroups.some(g=>g.id===wgArchivedGroupId)){wgArchivedGroupId=matchedGroups[0].id;wgArchivedTestId='';}
  else if(!wgArchivedGroupId||!archivedGroups.some(g=>g.id===wgArchivedGroupId))wgArchivedGroupId=archivedGroups[0].id;
  const group=archivedGroups.find(g=>g.id===wgArchivedGroupId);
  const groupOpts=groupList.map(g=>`<option value="${g.id}" ${g.id===wgArchivedGroupId?'selected':''}>${esc(g.name)}${g.active===false?' · đã lưu trữ':' · đã dừng'}${g.stoppedAt?' '+vnDate(g.stoppedAt):''}</option>`).join('');
  const badge=group.active===false?'Đã lưu trữ':'Đã dừng';
  const groupPicker=`<div><label>Nhóm lô đã dừng/lưu trữ <span class="hint">(${groupList.length}/${archivedGroups.length})</span></label><select onchange="wgSetArchivedGroup(this.value)">${groupOpts}</select></div>`;
  const searchBox=`<div><label>Tìm nhanh</label><input id="wgArchivedTestSearch" type="search" placeholder="Tên xét nghiệm, máy hoặc số lô..." value="${escAttr(wgArchivedTestQ)}" oninput="wgFilterArchivedTests(this.value)"></div>`;
  const rows=levelsForLotGroup(group);
  const byTest=new Map();
  rows.forEach(r=>{if(!byTest.has(r.t.id))byTest.set(r.t.id,{t:r.t,rows:[]});byTest.get(r.t.id).rows.push(r);});
  const testEntries=[...byTest.values()].sort((a,b)=>operationalTestOrder(a.t)-operationalTestOrder(b.t)||String(a.t.name||'').localeCompare(String(b.t.name||''),'vi'));
  if(!testEntries.length)return headOnly('Phân tích Westgard','Xem lại Westgard theo nhóm lô đã dừng/lưu trữ')+
    `<div class="panel"><h3 role="heading" aria-level="2">Thiết lập phân tích</h3>${wgViewModeTabs(archivedGroups)}<div class="wg-test-picker">${searchBox}${groupPicker}</div></div>
     <div class="panel">${emptyState('Không tìm thấy xét nghiệm nào','Nhóm lô này không gắn với xét nghiệm/mức nào có Mean/SD hợp lệ.')}</div>`;
  const matchedTests=testEntries.filter(e=>!q||searchText(e.t.name).includes(q)||searchText(testDisplayName(e.t)).includes(q)||searchText(instrumentName(e.t.instrumentId,e.t.machine)).includes(q));
  const testList=matchedTests.length?matchedTests:testEntries; // gõ số lô (không khớp tên xét nghiệm nào) thì vẫn cho chọn đủ xét nghiệm của nhóm vừa nhảy tới
  if(matchedTests.length&&!matchedTests.some(e=>e.t.id===wgArchivedTestId))wgArchivedTestId=matchedTests[0].t.id;
  else if(!testEntries.some(e=>e.t.id===wgArchivedTestId))wgArchivedTestId=testEntries[0].t.id;
  const testOpts=testList.map(e=>`<option value="${e.t.id}" ${e.t.id===wgArchivedTestId?'selected':''}>${esc(testDisplayName(e.t))}</option>`).join('');
  const testPicker=`<div><label>Chọn xét nghiệm <span class="hint">(${testList.length}/${testEntries.length})</span></label><select onchange="if(this.value){wgSetArchivedTest(this.value)}">${testOpts}</select></div>`;
  const entry=testEntries.find(e=>e.t.id===wgArchivedTestId)||testEntries[0];
  const sortedRows=entry.rows.slice().sort((a,b)=>a.l.level-b.l.level);
  const multiChart=sortedRows.length>=2?`<div class="panel"><h3>Levey-Jennings tổng hợp</h3>
    <div class="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm.</div>
    <div class="chart-scroll" tabindex="0"><canvas class="wgLJMultiArchived" data-group="${group.id}" data-test="${entry.t.id}" width="1400" height="430"></canvas></div></div>`:'';
  const blocks=sortedRows.map(({t,l,lot,mean,sd})=>wgLotBlock(t,l.level,lot.lotNo,mean,sd,lotPointsByNo(t.id,l.level,lot.lotNo),badge,`Mức ${l.level}`,`Lô ${esc(lot.lotNo)}`)).join('');
  return headOnly('Phân tích Westgard','Xem lại Westgard theo nhóm lô đã dừng/lưu trữ')+
   `<div class="panel"><h3 role="heading" aria-level="2">Thiết lập phân tích</h3>${wgViewModeTabs(archivedGroups)}
     <div class="wg-test-picker wg-test-picker-3">${searchBox}${testPicker}${groupPicker}</div>
     <div class="hint" style="margin-top:8px">Đánh giá dưới đây dùng bộ luật Westgard đang bật hiện nay, không phải cấu hình luật tại thời điểm nhóm lô này còn hoạt động.</div></div>${multiChart}${blocks}`;
}
function pageWestgard(){
  const tests=operationalTests(),archivedGroups=wgArchivedGroups();
  if(!tests.length&&!archivedGroups.length)return headOnly('Phân tích Westgard','')+`<div class="panel">${emptyState('Chưa có xét nghiệm đang vận hành','Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi phân tích Westgard.',role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):'')}</div>`;
  if(wgViewMode==='archived'&&!archivedGroups.length)wgViewMode='current';
  if(wgViewMode==='current'&&!tests.length&&archivedGroups.length)wgViewMode='archived';
  if(wgViewMode==='archived')return pageWestgardArchived(archivedGroups);
  if(!selTest||!tests.find(t=>t.id===selTest))selTest=tests[0].id;
  const t=tests.find(t=>t.id===selTest);
  const q=searchText(wgTestQ),matched=tests.filter(x=>!q||searchText(testSelectLabel(x)).includes(q)),opts=matched.length?matched.map(x=>`<option value="${x.id}" ${x.id===selTest?'selected':''}>${esc(testSelectLabel(x))}</option>`).join(''):'<option value="">Không tìm thấy xét nghiệm phù hợp</option>';
  const wg=activeWestgard(t),levelViews=wg.views.map(v=>({l:v.l,pts:v.pts,cfg:{mean:v.l.mean,sd:v.l.sd},single:v.single,lotPicker:`<span class="wg-lot-name">Lô ${esc(v.l.lot||'?')}</span>`}));
  const multiChart=wgMultiViews(t).length>=2?`<div class="panel"><h3>Levey-Jennings tổng hợp</h3>
    <div class="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm. Bật "Xem lô cũ" ở mức tương ứng để thêm đường của lô đã chuyển tiếp.</div>
    <div class="chart-scroll" tabindex="0"><canvas class="wgLJMulti" data-test="${t.id}" width="1400" height="430"></canvas></div></div>`:'';
  const blocks=levelViews.map(v=>{const{l,pts,cfg,lotPicker}=v;
    const prevSeries=previousLotSeries(t,l.level),hasPrev=prevSeries.length>0,prevOpen=wgPrevOpen.has(t.id+'|'+l.level);
    const prevBtn=hasPrev?btn(prevOpen?'Xem lô mới':'Xem lô cũ',`wgTogglePrevLot(${l.level})`,'ghost sm wg-prev-toggle'):'';
    if(prevOpen&&hasPrev){const s=prevSeries[0];return wgLotBlock(t,l.level,s.lot,s.mean,s.sd,s.pts,'Đã chuyển tiếp',`Mức ${l.level}`,`Lô cũ ${esc(s.lot)}`,prevBtn);}
    const title=`<h3><span class="wg-level-title"><span>Mức ${l.level}</span>${lotPicker}</span><span class="wg-level-meta"><span>Mean ${fmt(cfg.mean)}</span><span>SD ${fmt(cfg.sd,3)}</span><span>${pts.length} điểm</span>${prevBtn}</span></h3>`;
    if(!pts.length)return `<div class="panel">${title}${emptyState('Chưa có dữ liệu','LOT đang dùng chưa có điểm QC. Bạn có thể chọn LOT cũ hoặc nhập điểm mới.',btn('Nhập QC',`entrySel={testId:'${t.id}',level:${l.level}};entryStart=null;entryEnd=null;go('entry')`,'teal'))}</div>`;
    const{zs}=v.single,rows=WestgardViewModel.buildPointRows({points:pts,verdicts:wg.byPoint,zs,mean:cfg.mean,sd:cfg.sd}),key=`current:${t.id}|${l.level}|${l.lot||''}`,view=wgRowsWindow(rows,key);
    const targetOk=levelTargetOk(l),targetWarn=targetOk?'':`<div class="alert warn wg-target-warning">Mức này <b>chưa có Mean/SD hợp lệ</b> — các điểm QC không được đánh giá Westgard; bảng dưới chỉ liệt kê giá trị, không có kết luận Đạt/Cảnh báo/Loại bỏ. ${role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal sm'):''}</div>`;
    if(!targetOk)view.rows.forEach(r=>{r.level='none';r.rules=[];r.supportRules=[];});
    const rowsHtml=wgPointRowsHtml(view.rows);
    return `<div class="panel">${title}${targetWarn}${wgRowsControl(view,key)}<table class="wg-table"><thead><tr><th>#</th><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;}).join('');
  const ruleToggles=WG_RULES.map(r=>`<span class="wg-rule-item"><label><input type="checkbox" ${wgOn(r)?'checked':''} ${!canWrite()?'disabled':''} onchange="wgSet('${r}',this.checked)"> <span class="pill">${r}</span></label></span>`).join('')+(canWrite()?`<div class="wg-rule-reset">${btn('Khôi phục mặc định','wgReset()','ghost sm')}</div>`:'');
  /* Bảng hướng dẫn dựng từ WG_RULE_REGISTRY (core.js) — trước đây 13 dòng này gõ
     tay, nên mô tả và cột kết luận có thể lệch với engine mà không ai biết. Cột
     "Kết luận" là hành động MẶC ĐỊNH của luật; từng xét nghiệm vẫn ghi đè được. */
  const ruleGuideRows=WG_RULE_REGISTRY.map(r=>`<tr><td>${r.id}</td><td>${esc(r.desc)}</td><td>${r.alert?'<span class="warn">Cảnh báo</span>':'<span class="rej">Loại bỏ</span>'}</td><td>${esc(r.fix)}</td></tr>`).join('');
  const ruleGuide=`<details class="wg-guide"><summary>Hướng dẫn nhanh luật Westgard</summary><div class="alert info" style="margin:10px 12px 18px">Ký hiệu ${icoRefArrow()} trong bảng là điểm lịch sử cấu thành quy tắc. Điểm này chỉ là bằng chứng; trạng thái cảnh báo/loại được gắn cho lần chạy phát hiện hiện tại, không đổi hồi tố kết luận cũ.</div><div class="chart-scroll" tabindex="0"><table><thead><tr><th>Luật</th><th>Điều kiện</th><th>Kết luận</th><th>Gợi ý xử lý</th></tr></thead><tbody>${ruleGuideRows}</tbody></table></div></details>`;
  const exportActions=wgChartMode==='lj'?'<div><label>&nbsp;</label><div class="wg-export-actions">'+btn(icoDownload()+'Xuất Excel','exportWestgardXLSX()','teal wg-excel-btn','Xuất Excel biểu đồ Levey-Jennings, các vi phạm và điểm bằng chứng đang xem')+btn(icoPrint()+'In PDF','printWestgard()','teal wg-print-btn','Tạo bản in PDF/HTML biểu đồ Levey-Jennings và các vi phạm đang xem')+'</div></div>':'';
  return headOnly('Phân tích Westgard','Đối chiếu luật theo mức QC, lô và lần chạy')+
   `<div class="panel"><h3 role="heading" aria-level="2">Thiết lập phân tích</h3>${wgViewModeTabs(archivedGroups)}<div class="wg-test-picker${exportActions?' wg-test-picker-3':''}"><div><label>Tìm nhanh</label><input id="wgTestSearch" type="search" placeholder="Tên xét nghiệm, LOT hoặc máy..." value="${escAttr(wgTestQ)}" oninput="wgFilterTests(this.value)"></div><div><label>Chọn xét nghiệm <span id="wgTestCount" class="hint">(${matched.length}/${tests.length})</span></label><select id="wgTestSelect" aria-label="Chọn xét nghiệm" ${matched.length?'':'disabled'} onchange="if(this.value){selTest=this.value;rerender()}">${opts}</select></div>${exportActions}</div>
     <div class="wg-rules"><b style="font-size:12px">Cấu hình chung của luật</b><div style="margin-top:6px">${ruleToggles}</div></div>
     ${ruleGuide}${wgChartModeTabs()}</div>${wgChartMode==='cusum'?pageWestgardCusum(t):multiChart+blocks}`;
}
function wgFilterTests(v){
  wgTestQ=v;
  scheduleSearchRender(wgFilterTests,()=>{
    const q=searchText(wgTestQ),matches=operationalTests().filter(x=>!q||searchText(testSelectLabel(x)).includes(q));
    if(matches.length&&!matches.some(x=>x.id===selTest)){selTest=matches[0].id;rerender();return;}
    const select=document.getElementById('wgTestSelect'),count=document.getElementById('wgTestCount'),tests=operationalTests();
    replaceSelectItems(select,matches.map(x=>({value:x.id,label:testSelectLabel(x)})),'Không tìm thấy xét nghiệm phù hợp');
    if(select&&matches.some(x=>x.id===selTest))select.value=selTest;
    if(count)count.textContent=`(${matches.length}/${tests.length})`;
  },'wgTestSearch');
}


function wgFilterArchivedTests(v){
  wgArchivedTestQ=v;
  scheduleSearchRender(wgFilterArchivedTests,()=>{rerender();},'wgArchivedTestSearch');
}

/* ===== DASHBOARD PAGE ROUTE ===== */
function pageDash(){
  const tests=operationalTests(),missingWestgard=tests.filter(t=>!wgMemo.has(t.id));
  if(missingWestgard.length&&scheduleWestgardPrewarm(missingWestgard))return pageDashLoading(tests,missingWestgard.length);
  const today=isoToday();
  const urgent=[],watch=[],exp=[],noTarget=[];
  const dashItems=tests.map(t=>{
    const wg=activeWestgard(t);
    const summary=WestgardViewModel.summarizeTestStatus({views:wg.views,verdicts:wg.byPoint,today});
    const s=summary.status,todayCount=summary.todayCount,totalPoints=summary.totalPoints;
    const levelData=[],lastPoints=summary.lastPoints.slice();
    summary.alerts.forEach(alert=>{const item={t,l:alert.levelConfig,p:alert.point,rules:alert.rules};(alert.level==='rej'?urgent:watch).push(item);});
    wg.views.forEach(v=>{
      const l=v.l,pts=v.pts,todayLevel=pts.some(p=>p.date===today),st=stats(pts.map(p=>p.val));
      levelData.push({l,pts,st,todayLevel});
      const d=daysToExp(l.exp);if(d!=null&&d<=30)exp.push({t,l,d});
    });
    levelsMissingTarget(t).forEach(l=>noTarget.push({t,l}));
    const latest=lastPoints.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''),'vi',{numeric:true})||pointRunNo(a)-pointRunNo(b)).slice(-1)[0];
    const search=searchText([t.name,testDisplayName(t),t.machine,t.section,t.method,t.unit,...levelData.map(x=>`M${x.l.level} ${x.l.lot||''}`)].join(' '));
    statusMemo.set(t.id,s);
    return{t,s,levelData,todayCount,totalPoints,latest,search,missingToday:todayCount<levelData.length};
  });
  const totalPts=dashItems.reduce((n,x)=>n+x.totalPoints,0),todayPts=dashItems.reduce((n,x)=>n+x.todayCount,0);
  const rej=dashItems.filter(x=>x.s==='rej').length,warn=dashItems.filter(x=>x.s==='warn').length,missingTodayCount=dashItems.filter(x=>x.missingToday).length;
  /* Nhiều xét nghiệm có thể dùng chung 1 lô (VD panel điện giải) -> gộp theo
     lô+mức, chỉ hiện 1 dòng/lô kèm số xét nghiệm dùng chung, thay vì lặp lại
     dòng cảnh báo hết hạn cho từng xét nghiệm riêng lẻ. */
  const expByLot=new Map();
  exp.forEach(e=>{const key=e.l.qcLotId||(e.l.lot||'')+'|'+e.l.level;const cur=expByLot.get(key);if(!cur||e.d<cur.d)expByLot.set(key,{...e,count:(cur?cur.count:0)+1});else cur.count++;});
  const shiftItem=(o,cls)=>`<div class="shift-item ${cls}"><div><b>${esc(testDisplayName(o.t))} · M${o.l.level}</b><div class="meta">${vnDate(o.p.date)} · ${fmtPointValue(o.p,o.t)} ${esc(o.t.unit||'')} · ${o.rules.join(', ')||'—'}</div></div>${btn('Xem',`entrySel={testId:'${o.t.id}',level:${o.l.level}};entryStart=null;entryEnd=null;go('entry')`,'ghost sm')}</div>`;
  const urgentHtml=urgent.slice(0,5).map(o=>shiftItem(o,'rej')).join('');
  const watchHtml=watch.slice(0,4).map(o=>shiftItem(o,'warn')).join('');
  /* Hồ sơ NCE quá hạn: lọc thô theo dueDate trước rồi mới gọi actionOverdue() — hàm đó
     phải chạy actionWorkflowStatus()/actionRerunStatus() nên chỉ đáng trả giá cho vài
     hồ sơ thật sự đã qua hạn, không phải cho toàn bộ nhật ký ở mỗi lần vẽ dashboard. */
  const overdue=(state.actions||[]).map((a,idx)=>({a,idx}))
    .filter(({a})=>a.dueDate&&a.dueDate<today)
    .map(({a,idx})=>({a,idx,info:actionOverdue(a)}))
    .filter(x=>x.info.overdue)
    .sort((x,y)=>y.info.days-x.info.days);
  const overdueHtml=overdue.slice(0,4).map(({a,idx,info})=>{
    const t=state.tests.find(x=>x.id===a.testId);
    return `<div class="shift-item rej"><div><b>${esc(a.nceId||'Hồ sơ khắc phục')} · ${t?esc(testDisplayName(t)):esc(a.rule||'Sự cố')}</b><div class="meta">${esc(info.label)} · hạn ${vnDate(a.dueDate)} · phụ trách ${esc(a.by||'—')}</div></div>${btn('Tiếp tục hồ sơ',`go('actions');editAction(${idx})`,'ghost sm')}</div>`;
  }).join('');
  const noTargetHtml=noTarget.slice(0,4).map(o=>`<div class="shift-item warn"><div><b>${esc(testDisplayName(o.t))} · M${o.l.level}</b><div class="meta">Chưa có Mean/SD hợp lệ — điểm QC mức này không được đánh giá Westgard</div></div>${btn('Gán Mean/SD',`go('manage');setManageTab('targets')`,'ghost sm')}</div>`).join('');
  const followHtml=urgentHtml||overdueHtml||watchHtml||noTargetHtml?`<div class="dash-list">${urgentHtml}${overdueHtml}${noTargetHtml}${watchHtml}</div>`:'<div class="alert ok">Không có điểm bị loại/cảnh báo cần xử lý ngay.</div>';
  const expHtml=[...expByLot.values()].sort((a,b)=>a.d-b.d).slice(0,5).map(e=>`<div class="shift-item ${e.d<0?'rej':'warn'}"><div><b>Lô ${esc(e.l.lot||'?')} · M${e.l.level}</b><div class="meta">${e.count>1?e.count+' xét nghiệm · ':''}${e.d<0?'Hết hạn '+(-e.d)+' ngày':'Còn '+e.d+' ngày'}</div></div><span class="tag ${e.d<0?'rej':'warn'}">${e.d<0?'Hết hạn':'Sắp hết'}</span></div>`).join('')||'<div class="hint">Không có lô sắp hết hạn trong 30 ngày.</div>';
  const dashStatusMatch=(item,key=dashTestStatus)=>{
    if(key==='all')return true;
    if(key==='missing')return item.missingToday;
    return item.s===key;
  };
  const dashStatusTabs=[['all','Tất cả'],['missing','Chưa QC'],['rej','Loại bỏ'],['warn','Cảnh báo'],['ok','Đạt']].map(([key,label])=>{
    const count=key==='all'?dashItems.length:dashItems.filter(item=>dashStatusMatch(item,key)).length;
    return `<button class="${dashTestStatus===key?'on':''}" onclick="dashTestSetStatus('${key}')">${label}<b>${count}</b></button>`;
  }).join('');
  const statusItems=dashItems.filter(item=>dashStatusMatch(item));
  const testRows=statusItems.map(item=>{const {t,s,levelData,todayCount,totalPoints,latest,search}=item,lvls=levelData.map(x=>x.l);
    const statusTag=s==='rej'?'<span class="tag rej">Loại bỏ</span>':s==='warn'?'<span class="tag warn">Cảnh báo</span>':s==='ok'?'<span class="tag ok">Đạt</span>':'<span class="pill">chưa có</span>';
    const todayTag=todayCount>=lvls.length&&lvls.length?'<span class="tag ok">Đủ hôm nay</span>':todayCount?`<span class="tag warn">${todayCount}/${lvls.length} mức</span>`:'<span class="tag none">Chưa QC</span>';
    const levels=levelData.map(x=>{const ok=levelTargetOk(x.l);return `<span class="dash-level-pill ${x.todayLevel?'done':''}${ok?'':' missing-target'}"${ok?'':' title="Chưa có Mean/SD hợp lệ — không đánh giá Westgard"'}>M${x.l.level}${x.l.lot?` · ${esc(x.l.lot)}`:''}${x.st?` · CV ${fmt(x.st.cv)}%`:''}${ok?'':' · thiếu Mean/SD'}</span>`;}).join('');
    const latestText=latest?`${vnDate(latest.date)} · M${latest._level} · ${fmtPointValue(latest,t)}`:'Chưa có điểm';
    const rank=s==='rej'?0:s==='warn'?1:todayCount<lvls.length?2:s==='ok'?3:4;
    return{rank,name:t.name,html:`<tr class="${s}" data-search="${escAttr(search)}"><td><div class="dash-test-name">${esc(testDisplayName(t))}</div><div class="dash-test-sub">${esc(t.machine||'Chưa gán máy')}</div></td><td><div class="dash-level-list">${levels}</div></td><td>${todayTag}</td><td class="num"><b>${totalPoints}</b></td><td>${statusTag}</td><td><span class="dash-latest">${latestText}</span></td><td>${btn('Xem QC',`entrySel={testId:'${t.id}',level:${lvls[0].level}};entryStart=null;entryEnd=null;go('entry')`,'ghost sm')}</td></tr>`};
  }).sort((a,b)=>a.rank-b.rank||String(a.name||'').localeCompare(String(b.name||''),'vi')).map(x=>x.html).join('');
  const testListHtml=statusItems.length?`<div class="dash-test-list"><table><thead><tr><th>Xét nghiệm</th><th>Mức QC / lô</th><th>QC hôm nay</th><th class="num">Tổng điểm</th><th>Westgard</th><th>Gần nhất</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${testRows}</tbody></table></div><div id="dashTestEmpty" class="dash-test-empty" style="display:none">Không tìm thấy xét nghiệm phù hợp.</div>`:`<div class="dash-test-empty">Không tìm thấy xét nghiệm phù hợp.</div>`;
  const done=todayPts,doneTests=Math.max(0,tests.length-missingTodayCount),pct=tests.length?Math.round(doneTests/tests.length*100):0;
  const mood=rej?'Cần xử lý ngay':overdue.length?'Có hồ sơ NCE quá hạn':warn?'Có cảnh báo cần theo dõi':missingTodayCount?'Còn QC cần nhập':'Đang trong kiểm soát';
  const moodText=rej?'Có xét nghiệm đang bị loại, ưu tiên kiểm tra và ghi nhận khắc phục.':overdue.length?`${overdue.length} hồ sơ khắc phục đã qua hạn xử lý mà chưa khép vòng.`:warn?'Có tín hiệu cảnh báo, nên xem lại biểu đồ và xu hướng trước khi trả kết quả.':missingTodayCount?'Một số xét nghiệm chưa đủ QC hôm nay, nên hoàn tất trước giờ chạy mẫu.':'Không có cảnh báo trọng yếu trong dữ liệu hiện tại.';
  return `<div class="head"><div><h1>Bảng điều khiển</h1><p>${esc(state.lab.name||'Khoa Xét nghiệm')}${state.lab.dept?' · '+esc(state.lab.dept):''}</p></div>${topUserBox()}</div>
   <div class="dash-hero">
     <div class="dash-status"><div class="eyebrow">Trạng thái trực ca · ${vnDate(today)}</div><h2>${mood}</h2><p>${moodText}</p>
       <div class="dash-progress"><span style="width:${pct}%"></span></div><div class="hint flow-item">${doneTests}/${tests.length||0} xét nghiệm đã đủ QC hôm nay · ${pct}% hoàn tất</div></div>
     <div class="dash-kpis"><div class="dash-kpi"><div class="k">Xét nghiệm</div><div class="v">${tests.length}</div></div><div class="dash-kpi"><div class="k">Điểm QC</div><div class="v">${totalPts}</div></div>
       <div class="dash-kpi"><div class="k">Vi phạm</div><div class="v" style="color:var(--red)">${rej}</div></div><div class="dash-kpi"><div class="k">QC hôm nay</div><div class="v" style="color:var(--teal)">${done}</div></div></div>
   </div>
   <div class="dash-main">
     <div class="panel"><h2 class="panel-title">Cần xử lý / Theo dõi</h2>${followHtml}</div>
     <div class="panel"><h2 class="panel-title">Lô & hạn dùng</h2><div class="dash-list">${expHtml}</div></div>
   </div>
    <div class="panel">${tests.length?`<div class="dash-test-toolbar"><h2 class="panel-title">Danh sách xét nghiệm</h2></div><div class="dash-test-filterbar"><div class="dash-test-tabs">${dashStatusTabs}</div><div class="dash-test-search"><input id="dashTestSearch" type="search" placeholder="Tìm xét nghiệm, máy, lô..." value="${escAttr(dashTestQ)}" oninput="dashTestFilter(this.value)"><span id="dashTestCount">${statusItems.length}/${statusItems.length}</span></div></div>${testListHtml}`:emptyState('Chưa có xét nghiệm đang vận hành','Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi theo dõi.',role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):'')}</div>`;
}

function dashTestFilter(value){
  dashTestQ=value;
  liveRowFilter('.dash-test-list tbody tr',dashTestQ,{countId:'dashTestCount',emptyId:'dashTestEmpty'});
}
function dashTestSetStatus(value){
  dashTestStatus=['all','missing','rej','warn','ok'].includes(value)?value:'all';
  rerender();
}
function pageDashLoading(tests,pending){
  const points=(tests||[]).reduce((sum,t)=>sum+(state.data[t.id]||[]).length,0);
  return `<div class="head"><div><h1>Bảng điều khiển</h1><p>${esc(state.lab.name||'Khoa Xét nghiệm')}${state.lab.dept?' · '+esc(state.lab.dept):''}</p></div>${topUserBox()}</div>
    <div class="dash-hero dash-analysis-loading">
      <div class="dash-status"><div class="eyebrow">Đang chuẩn bị dữ liệu</div><h2>Phân tích Westgard chạy nền</h2><p>Bạn có thể tiếp tục sử dụng ứng dụng. Bảng điều khiển sẽ tự cập nhật khi phân tích hoàn tất.</p><div class="dash-loading-bar"><span></span></div></div>
      <div class="dash-kpis"><div class="dash-kpi"><div class="k">Xét nghiệm</div><div class="v">${tests.length}</div></div><div class="dash-kpi"><div class="k">Điểm QC</div><div class="v">${points}</div></div><div class="dash-kpi"><div class="k">Đang xử lý</div><div class="v">${pending}</div></div><div class="dash-kpi"><div class="k">Giao diện</div><div class="v dash-ready-mark">✓</div></div></div>
    </div>
    <div class="panel dash-loading-panel"><div class="dash-spinner"></div><div><h2 class="panel-title">Đang tính trạng thái kiểm soát chất lượng</h2><p class="hint">Công việc nặng đã được chuyển khỏi luồng giao diện để thao tác không bị đóng băng.</p></div></div>`;
}

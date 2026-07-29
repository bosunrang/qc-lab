/* ===== DASHBOARD PAGE ROUTE ===== */
const DASH_KPI_DEFAULTS=Object.freeze({qcRejectMax:2,capaEffectiveMin:90,closeDaysMax:7,onTimeMin:90});
function dashboardKpiTargets(){return{...DASH_KPI_DEFAULTS,...(state.lab&&state.lab.kpiTargets||{})};}
function dashboardKpiRange(today=isoToday()){
  const shift=(value,days)=>{const d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  if(dashKpiPeriod==='custom'&&dashKpiStart&&dashKpiEnd)return dashKpiStart<=dashKpiEnd?{start:dashKpiStart,end:dashKpiEnd}:{start:dashKpiEnd,end:dashKpiStart};
  const days=['30','90','180'].includes(String(dashKpiPeriod))?+dashKpiPeriod:30;
  return{start:shift(today,-days+1),end:today};
}
function dashboardKpiScopeItems(items){
  return(items||[]).filter(item=>{
    const t=item.t,instrumentKey=String(item.instrumentKey||t.instrumentId||t.machine||'__unassigned__'),instrumentMatch=dashKpiInstrument==='all'||instrumentKey===dashKpiInstrument;
    return instrumentMatch&&(dashKpiTest==='all'||t.id===dashKpiTest);
  });
}
function dashboardKpiSnapshot(items,actions,today,opts={}){
  const shift=(value,days)=>{const d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const dayDiff=(from,to)=>Math.max(0,Math.round((Date.parse(String(to).slice(0,10)+'T00:00:00Z')-Date.parse(String(from).slice(0,10)+'T00:00:00Z'))/86400000));
  const start=opts.start||shift(today,-29),end=opts.end||today,span=dayDiff(start,end)+1,priorEnd=shift(start,-1),priorStart=shift(priorEnd,-span+1),months=[];
  const td=new Date(end+'T00:00:00Z');
  for(let i=5;i>=0;i--){const d=new Date(Date.UTC(td.getUTCFullYear(),td.getUTCMonth()-i,1)),key=d.toISOString().slice(0,7);months.push({key,label:`T${d.getUTCMonth()+1}`,points:0,rejected:0,nce:0});}
  const monthMap=new Map(months.map(x=>[x.key,x])),quality={points:0,rejected:0,warnings:0},previous={points:0,rejected:0,nce:0},testMap=new Map(),pointDetails=[];
  (items||[]).forEach(item=>{
    const testStats={test:item.t,points:0,rejected:0,warnings:0};
    ((state.data&&state.data[item.t.id])||[]).forEach(p=>{
      if(p.voided||!p.date||p.date>end)return;
      const verdict=item.wg.byPoint.get(p.id)||{level:'ok'},month=monthMap.get(String(p.date).slice(0,7));
      if(month){month.points++;if(verdict.level==='rej')month.rejected++;}
      if(p.date>=priorStart&&p.date<=priorEnd){previous.points++;if(verdict.level==='rej')previous.rejected++;}
      if(p.date<start)return;
      quality.points++;testStats.points++;
      pointDetails.push({t:item.t,p,verdict});
      if(verdict.level==='rej'){quality.rejected++;testStats.rejected++;}
      else if(verdict.level==='warn'){quality.warnings++;testStats.warnings++;}
    });
    testMap.set(item.t.id,testStats);
  });
  const scopeIds=new Set((items||[]).map(x=>x.t.id)),real=(actions||[]).filter(a=>!actionCancelled(a)&&actionRecorded(a)&&(!opts.scopeRestricted||scopeIds.has(a.testId))),periodActions=[],open=[],closed=[],stageCounts={investigating:0,rerun:0,effectiveness:0,approval:0,closed:0},closeDays=[],onTime=[],evaluated=[];
  const causes=new Map(),actionDetails=[];
  real.forEach(a=>{
    const eventDate=actionEventDate(a),month=monthMap.get(String(eventDate||'').slice(0,7));
    if(month)month.nce++;
    if(eventDate>=priorStart&&eventDate<=priorEnd)previous.nce++;
    if(!eventDate||eventDate<start||eventDate>end)return;
    const wf=actionWorkflowStatus(a);
    periodActions.push(a);actionDetails.push({a,wf});
    if(wf.complete)closed.push(a);else open.push(a);
    const stage=wf.stage==='returned'?'investigating':wf.stage;
    if(stageCounts[stage]!=null)stageCounts[stage]++;
    if(a.effectivenessStatus==='effective'||a.effectivenessStatus==='ineffective')evaluated.push(a);
    if(a.causeCategory){
      const label=ACTION_LABELS.cause[a.causeCategory]||a.causeCategory;
      causes.set(label,(causes.get(label)||0)+1);
    }
    if(wf.complete){
      const closedAt=a.approvedAt||a.updatedAt||a.effectivenessDate||'';
      const openedAt=a.createdAt||eventDate||'';
      if(openedAt&&closedAt)closeDays.push(dayDiff(openedAt,closedAt));
      if(a.dueDate&&closedAt)onTime.push(String(closedAt).slice(0,10)<=a.dueDate);
    }
  });
  const overdue=open.filter(a=>actionOverdue(a).overdue),effective=evaluated.filter(a=>a.effectivenessStatus==='effective').length;
  const topTests=[...testMap.values()].filter(x=>x.rejected||x.warnings).sort((a,b)=>b.rejected-a.rejected||b.warnings-a.warnings||b.points-a.points).slice(0,5);
  const acceptedRate=quality.points?Math.round((quality.points-quality.rejected)/quality.points*1000)/10:0,rejectRate=quality.points?Math.round(quality.rejected/quality.points*1000)/10:0,previousRejectRate=previous.points?Math.round(previous.rejected/previous.points*1000)/10:null;
  return{
    period:{start,end,priorStart,priorEnd},
    quality:{...quality,acceptedRate,rejectRate,previousRejectRate,rejectRateDelta:previousRejectRate==null?null:Math.round((rejectRate-previousRejectRate)*10)/10},
    capa:{open:open.length,closed:closed.length,created:periodActions.length,previousCreated:previous.nce,overdue:overdue.length,evaluated:evaluated.length,effectiveRate:evaluated.length?Math.round(effective/evaluated.length*100):0,averageCloseDays:closeDays.length?Math.round(closeDays.reduce((s,x)=>s+x,0)/closeDays.length*10)/10:null,onTimeRate:onTime.length?Math.round(onTime.filter(Boolean).length/onTime.length*100):null,stages:stageCounts},
    months,
    causes:[...causes.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'vi')).slice(0,5),
    topTests,
    details:{points:pointDetails,actions:actionDetails,open,overdue,evaluated}
  };
}
function dashboardKpiSetPeriod(value){
  dashKpiPeriod=['30','90','180','custom'].includes(value)?value:'30';
  if(dashKpiPeriod==='custom'&&(!dashKpiStart||!dashKpiEnd)){const range=dashboardKpiRange();dashKpiStart=range.start;dashKpiEnd=range.end;}
  rerender();
}
function dashboardKpiSetScope(kind,value){
  if(kind==='instrument'){dashKpiInstrument=value||'all';dashKpiTest='all';}
  else dashKpiTest=value||'all';
  rerender();
}
function dashboardKpiCustomRange(){
  const start=parseVN((document.getElementById('dashKpiStart')||{}).value||''),end=parseVN((document.getElementById('dashKpiEnd')||{}).value||'');
  if(start&&end){dashKpiStart=start;dashKpiEnd=end;dashKpiPeriod='custom';rerender();}
}
function dashboardOpenAction(id,detail=false){
  closeModal();const idx=(state.actions||[]).findIndex(a=>a.id===id);if(idx<0)return;
  go('actions');if(detail)viewActionDetail(idx);else editAction(idx);
}
function dashboardKpiOpenDetail(kind){
  const insight=dashKpiLast&&dashKpiLast.insight;if(!insight)return;
  const qcKinds={accepted:'QC được chấp nhận',rejected:'QC bị loại'},actionKinds={open:'NCE đang mở',effective:'Đánh giá hiệu lực CAPA'};
  let title=qcKinds[kind]||actionKinds[kind]||'Chi tiết KPI',rows='';
  if(qcKinds[kind]){
    const points=insight.details.points.filter(x=>kind==='rejected'?x.verdict.level==='rej':x.verdict.level!=='rej').sort((a,b)=>String(b.p.date).localeCompare(String(a.p.date))||pointRunNo(b.p)-pointRunNo(a.p)),visible=points.slice(0,500);
    rows=visible.map(({t,p,verdict})=>`<tr><td>${vnDate(p.date)}</td><td><b>${esc(testDisplayName(t))}</b><small>M${p.level} · Lô ${esc(p.lot||'—')}</small></td><td class="num"><b>${fmt(p.val)}</b> ${esc(t.unit||'')}</td><td><span class="tag ${verdict.level}">${verdict.level==='rej'?'Loại bỏ':verdict.level==='warn'?'Cảnh báo':'Đạt'}</span></td><td>${btn('Xem điểm',`closeModal();openActionQcEvidence('${jsq(t.id)}',${+p.level||0},'${jsq(p.id)}','${jsq(p.date)}','${jsq(p.lot||'')}')`,'ghost sm')}</td></tr>`).join('');
    rows=rows?`${points.length>visible.length?`<div class="dash-kpi-detail-note">Hiển thị 500/${points.length} điểm mới nhất. Thu hẹp kỳ hoặc xét nghiệm để xem chính xác hơn.</div>`:''}<div class="dash-kpi-detail-wrap"><table><thead><tr><th>Ngày</th><th>Xét nghiệm</th><th class="num">Giá trị</th><th>Kết luận</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Không có điểm phù hợp trong phạm vi đang lọc.</div>';
  }else{
    const actions=(kind==='open'?insight.details.open:insight.details.evaluated).slice().sort((a,b)=>String(actionEventDate(b)).localeCompare(String(actionEventDate(a)))),visible=actions.slice(0,500);
    rows=(actions.length>visible.length?`<div class="dash-kpi-detail-note">Hiển thị 500/${actions.length} hồ sơ mới nhất.</div>`:'')+visible.map(a=>{const t=state.tests.find(x=>x.id===a.testId),wf=actionWorkflowStatus(a);return `<div class="dash-kpi-action-row"><div><b>${esc(a.nceId||'Hồ sơ NCE')} · ${t?esc(testDisplayName(t)):esc(a.rule||'Sự cố')}</b><span>${vnDate(actionEventDate(a))} · ${esc(wf.label)}${a.dueDate?' · hạn '+vnDate(a.dueDate):''}</span></div>${btn(kind==='open'?'Tiếp tục':'Xem hồ sơ',`dashboardOpenAction('${jsq(a.id)}',${kind==='open'?'false':'true'})`,'ghost sm')}</div>`;}).join('');
    rows=rows||'<div class="empty">Không có hồ sơ phù hợp trong phạm vi đang lọc.</div>';
  }
  openModal(modalTemplate({title:`${title} · ${vnDate(insight.period.start)} – ${vnDate(insight.period.end)}`,body:rows,cls:'dash-kpi-modal'}));
}
function pageDash(){
  const tests=operationalTests(),missingWestgard=tests.filter(t=>!wgMemo.has(t.id));
  if(missingWestgard.length&&scheduleWestgardPrewarm(missingWestgard))return pageDashLoading(tests,missingWestgard.length);
  const today=isoToday();
  const urgent=[],watch=[],exp=[],noTarget=[];
  const dashItems=tests.map(t=>{
    const wg=activeWestgard(t),panel=operationalPanelForTest(t),instrumentKey=String(t.instrumentId||(panel&&panel.instrumentId)||t.machine||'__unassigned__');
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
    return{t,wg,instrumentKey,s,levelData,todayCount,totalPoints,latest,search,missingToday:todayCount<levelData.length};
  });
  const totalPts=dashItems.reduce((n,x)=>n+x.totalPoints,0),todayPts=dashItems.reduce((n,x)=>n+x.todayCount,0);
  const rej=dashItems.filter(x=>x.s==='rej').length,warn=dashItems.filter(x=>x.s==='warn').length,missingToday=dashItems.filter(x=>x.missingToday).map(x=>x.t);
  const instrumentNames=new Map((state.instruments||[]).map(x=>[x.id,x.name])),instrumentChoices=new Map();
  dashItems.forEach(item=>{const t=item.t,key=item.instrumentKey;if(!instrumentChoices.has(key))instrumentChoices.set(key,instrumentNames.get(key)||t.machine||'Chưa gán máy');});
  const scopedByInstrument=dashItems.filter(item=>dashKpiInstrument==='all'||item.instrumentKey===dashKpiInstrument);
  if(dashKpiTest!=='all'&&!scopedByInstrument.some(x=>x.t.id===dashKpiTest))dashKpiTest='all';
  const kpiItems=dashboardKpiScopeItems(dashItems),range=dashboardKpiRange(today),scopeRestricted=dashKpiInstrument!=='all'||dashKpiTest!=='all';
  const insight=dashboardKpiSnapshot(kpiItems,state.actions||[],today,{...range,scopeRestricted}),quality=insight.quality,capa=insight.capa,targets=dashboardKpiTargets(),maxMonthPoints=Math.max(1,...insight.months.map(x=>x.points));
  dashKpiLast={insight,items:kpiItems};
  const periodOptions=[['30','30 ngày'],['90','90 ngày'],['180','6 tháng'],['custom','Tùy chọn']].map(([value,label])=>`<option value="${value}" ${dashKpiPeriod===value?'selected':''}>${label}</option>`).join('');
  const instrumentOptions=`<option value="all">Tất cả thiết bị</option>`+[...instrumentChoices.entries()].sort((a,b)=>a[1].localeCompare(b[1],'vi')).map(([value,label])=>`<option value="${escAttr(value)}" ${dashKpiInstrument===value?'selected':''}>${esc(label)}</option>`).join('');
  const testOptions=`<option value="all">Tất cả xét nghiệm</option>`+scopedByInstrument.map(x=>`<option value="${escAttr(x.t.id)}" ${dashKpiTest===x.t.id?'selected':''}>${esc(testDisplayName(x.t))}</option>`).join('');
  const customRange=dashKpiPeriod==='custom'?`<div><label>Từ ngày</label>${dateBox('dashKpiStart',range.start,'','onchange="dashboardKpiCustomRange()"')}</div><div><label>Đến ngày</label>${dateBox('dashKpiEnd',range.end,'','onchange="dashboardKpiCustomRange()"')}</div>`:'';
  const filterHtml=`<div class="dash-kpi-filters"><div><label>Kỳ KPI</label><select aria-label="Kỳ KPI" onchange="dashboardKpiSetPeriod(this.value)">${periodOptions}</select></div>${customRange}<div><label>Thiết bị</label><select aria-label="Lọc KPI theo thiết bị" onchange="dashboardKpiSetScope('instrument',this.value)">${instrumentOptions}</select></div><div><label>Xét nghiệm</label><select aria-label="Lọc KPI theo xét nghiệm" onchange="dashboardKpiSetScope('test',this.value)">${testOptions}</select></div></div>`;
  const trendHtml=insight.months.map(m=>{const height=Math.max(m.points?10:2,Math.round(m.points/maxMonthPoints*100)),rejHeight=m.points?Math.max(m.rejected?5:0,Math.round(m.rejected/m.points*height)):0;return `<div class="dash-trend-month" aria-label="${escAttr(`${m.label}: ${m.points} điểm QC, ${m.rejected} bị loại, ${m.nce} hồ sơ NCE`)}"><div class="dash-trend-count">${m.points}</div><div class="dash-trend-bar" style="height:${height}%"><span style="height:${rejHeight}%"></span></div><b>${esc(m.label)}</b><small>${m.nce} NCE</small></div>`;}).join('');
  const stageMeta=[['investigating','Điều tra'],['rerun','Chờ QC lại'],['effectiveness','Đánh giá hiệu lực'],['approval','Chờ duyệt'],['closed','Đã khép trong kỳ']],stageMax=Math.max(1,...stageMeta.map(([key])=>capa.stages[key]||0));
  const stageHtml=stageMeta.map(([key,label])=>`<div class="dash-capa-stage"><div><span>${esc(label)}</span><b>${capa.stages[key]||0}</b></div><div><span style="width:${Math.round((capa.stages[key]||0)/stageMax*100)}%"></span></div></div>`).join('');
  const causesHtml=insight.causes.length?insight.causes.map(x=>`<span class="dash-cause-chip">${esc(x.label)} <b>${x.count}</b></span>`).join(''):'<span class="hint">Chưa đủ dữ liệu nguyên nhân trong kỳ.</span>';
  const topTestsHtml=insight.topTests.length?insight.topTests.map(x=>`<div class="dash-quality-test"><div><b>${esc(testDisplayName(x.test))}</b><span>${x.rejected} loại bỏ · ${x.warnings} cảnh báo / ${x.points} điểm</span></div>${btn('Xem Westgard',`selTest='${jsq(x.test.id)}';go('westgard')`,'ghost sm')}</div>`).join(''):'<div class="alert ok">Không có xét nghiệm phát sinh loại bỏ hoặc cảnh báo trong kỳ.</div>';
  const rejectCompare=quality.rejectRateDelta==null?'Chưa đủ kỳ trước':`${quality.rejectRateDelta>0?'+':''}${fmt(quality.rejectRateDelta,1)} điểm % so kỳ trước`,nceCompare=capa.previousCreated===capa.created?'Không đổi so kỳ trước':`${capa.created>capa.previousCreated?'+':''}${capa.created-capa.previousCreated} hồ sơ so kỳ trước`;
  const acceptedClass=!quality.points?'none':quality.rejectRate<=targets.qcRejectMax?'ok':quality.rejectRate<=targets.qcRejectMax*2?'warn':'rej',rejectClass=acceptedClass;
  const effectiveClass=!capa.evaluated?'none':capa.effectiveRate>=targets.capaEffectiveMin&&(capa.averageCloseDays==null||capa.averageCloseDays<=targets.closeDaysMax)?'ok':capa.effectiveRate>=Math.max(0,targets.capaEffectiveMin-15)?'warn':'rej';
  const kpiHtml=`<section class="panel dash-quality-panel" aria-labelledby="dashQualityTitle"><div class="dash-quality-head"><div><h3 id="dashQualityTitle">KPI chất lượng & CAPA</h3><p>${vnDate(insight.period.start)} – ${vnDate(insight.period.end)} · ${kpiItems.length}/${tests.length} xét nghiệm trong phạm vi</p></div>${role()==='admin'?btn('Mục tiêu KPI',`go('settings');requestAnimationFrame(()=>document.getElementById('kpiTargets')?.scrollIntoView({behavior:'smooth'}))`,'ghost sm'):''}</div>
    ${filterHtml}
    <div class="dash-quality-kpis">
      <button type="button" class="dash-quality-kpi ${acceptedClass}" onclick="dashboardKpiOpenDetail('accepted')" aria-label="Xem các điểm QC được chấp nhận"><span>QC được chấp nhận</span><b>${quality.points?fmt(quality.acceptedRate,1)+'%':'—'}</b><small>${quality.points?`${quality.points-quality.rejected}/${quality.points} điểm · mục tiêu loại ≤ ${fmt(targets.qcRejectMax,1)}%`:'Chưa có điểm QC trong kỳ'}</small></button>
      <button type="button" class="dash-quality-kpi ${rejectClass}" onclick="dashboardKpiOpenDetail('rejected')" aria-label="Xem các điểm QC bị loại"><span>Tỷ lệ QC bị loại</span><b>${quality.points?fmt(quality.rejectRate,1)+'%':'—'}</b><small>${quality.rejected} loại bỏ · ${rejectCompare}</small></button>
      <button type="button" class="dash-quality-kpi ${capa.overdue?'rej':capa.open?'warn':'ok'}" onclick="dashboardKpiOpenDetail('open')" aria-label="Xem các hồ sơ NCE đang mở"><span>NCE đang mở</span><b>${capa.open}</b><small>${capa.overdue?capa.overdue+' quá hạn · ':''}${capa.created} phát sinh · ${nceCompare}</small></button>
      <button type="button" class="dash-quality-kpi ${effectiveClass}" onclick="dashboardKpiOpenDetail('effective')" aria-label="Xem các đánh giá hiệu lực CAPA"><span>CAPA có hiệu lực</span><b>${capa.evaluated?capa.effectiveRate+'%':'—'}</b><small>${!capa.evaluated?'Chưa có CAPA được đánh giá':`Mục tiêu ≥ ${fmt(targets.capaEffectiveMin,0)}% · khép TB ${capa.averageCloseDays==null?'—':fmt(capa.averageCloseDays,1)+' ngày'}`}</small></button>
    </div>
    <div class="dash-insight-grid">
      <div class="dash-insight-card"><div class="dash-insight-title"><div><h4>Xu hướng QC 6 tháng</h4><span>Cột đỏ là phần bị loại · số dưới là NCE</span></div></div><div class="dash-trend" role="img" aria-label="Xu hướng số điểm QC, điểm bị loại và hồ sơ NCE trong sáu tháng">${trendHtml}</div></div>
      <div class="dash-insight-card"><div class="dash-insight-title"><div><h4>Luồng CAPA</h4><span>${capa.onTimeRate==null?'Chưa đủ dữ liệu đúng hạn':capa.onTimeRate+'% đúng hạn · mục tiêu ≥ '+fmt(targets.onTimeMin,0)+'%'}${capa.averageCloseDays==null?'':' · TB '+fmt(capa.averageCloseDays,1)+'/'+fmt(targets.closeDaysMax,0)+' ngày'}</span></div></div><div class="dash-capa-stages">${stageHtml}</div><div class="dash-causes"><span>Nguyên nhân trong kỳ</span><div>${causesHtml}</div></div></div>
    </div>
    <div class="dash-quality-watch"><div class="dash-insight-title"><div><h4>Xét nghiệm cần chú ý</h4><span>Xếp theo số lần loại bỏ rồi đến cảnh báo trong kỳ đang chọn</span></div></div><div class="dash-quality-tests">${topTestsHtml}</div></div>
  </section>`;
  /* Nhiều xét nghiệm có thể dùng chung 1 lô (VD panel điện giải) -> gộp theo
     lô+mức, chỉ hiện 1 dòng/lô kèm số xét nghiệm dùng chung, thay vì lặp lại
     dòng cảnh báo hết hạn cho từng xét nghiệm riêng lẻ. */
  const expByLot=new Map();
  exp.forEach(e=>{const key=e.l.qcLotId||(e.l.lot||'')+'|'+e.l.level;const cur=expByLot.get(key);if(!cur||e.d<cur.d)expByLot.set(key,{...e,count:(cur?cur.count:0)+1});else cur.count++;});
  const shiftItem=(o,cls)=>`<div class="shift-item ${cls}"><div><b>${esc(testDisplayName(o.t))} · M${o.l.level}</b><div class="meta">${vnDate(o.p.date)} · ${fmt(o.p.val)} ${esc(o.t.unit||'')} · ${o.rules.join(', ')||'—'}</div></div>${btn('Xem',`entrySel={testId:'${o.t.id}',level:${o.l.level}};entryStart=null;entryEnd=null;go('entry')`,'ghost sm')}</div>`;
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
  const expHtml=[...expByLot.values()].sort((a,b)=>a.d-b.d).slice(0,5).map(e=>`<div class="shift-item ${e.d<0?'rej':'warn'}"><div><b>Lô ${esc(e.l.lot||'?')} · M${e.l.level}</b><div class="meta">${e.count>1?e.count+' xét nghiệm · ':''}${e.d<0?'Hết hạn '+(-e.d)+' ngày':'Còn '+e.d+' ngày'}</div></div><span class="tag ${e.d<0?'rej':'warn'}">${e.d<0?'HSD':'Sắp hết'}</span></div>`).join('')||'<div class="hint">Không có lô sắp hết hạn trong 30 ngày.</div>';
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
    const latestText=latest?`${vnDate(latest.date)} · M${latest._level} · ${fmt(latest.val)}`:'Chưa có điểm';
    const rank=s==='rej'?0:s==='warn'?1:todayCount<lvls.length?2:s==='ok'?3:4;
    return{rank,name:t.name,html:`<tr class="${s}" data-search="${escAttr(search)}"><td><div class="dash-test-name">${esc(testDisplayName(t))}</div><div class="dash-test-sub">${esc(t.machine||'Chưa gán máy')}</div></td><td><div class="dash-level-list">${levels}</div></td><td>${todayTag}</td><td class="num"><b>${totalPoints}</b></td><td>${statusTag}</td><td><span class="dash-latest">${latestText}</span></td><td>${btn('Xem QC',`entrySel={testId:'${t.id}',level:${lvls[0].level}};entryStart=null;entryEnd=null;go('entry')`,'ghost sm')}</td></tr>`};
  }).sort((a,b)=>a.rank-b.rank||String(a.name||'').localeCompare(String(b.name||''),'vi')).map(x=>x.html).join('');
  const testListHtml=statusItems.length?`<div class="dash-test-list"><table><thead><tr><th>Xét nghiệm</th><th>Mức QC / lô</th><th>QC hôm nay</th><th class="num">Tổng điểm</th><th>Westgard</th><th>Gần nhất</th><th><span style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">Thao tác</span></th></tr></thead><tbody>${testRows}</tbody></table></div><div id="dashTestEmpty" class="dash-test-empty" style="display:none">Không tìm thấy xét nghiệm phù hợp.</div>`:`<div class="dash-test-empty">Không tìm thấy xét nghiệm phù hợp.</div>`;
  const done=todayPts,doneTests=Math.max(0,tests.length-missingToday.length),pct=tests.length?Math.round(doneTests/tests.length*100):0;
  const mood=rej?'Cần xử lý ngay':overdue.length?'Có hồ sơ NCE quá hạn':warn?'Có cảnh báo cần theo dõi':missingToday.length?'Còn QC cần nhập':'Đang trong kiểm soát';
  const moodText=rej?'Có xét nghiệm đang bị loại, ưu tiên kiểm tra và ghi nhận khắc phục.':overdue.length?`${overdue.length} hồ sơ khắc phục đã qua hạn xử lý mà chưa khép vòng.`:warn?'Có tín hiệu cảnh báo, nên xem lại biểu đồ và xu hướng trước khi trả kết quả.':missingToday.length?'Một số xét nghiệm chưa đủ QC hôm nay, nên hoàn tất trước giờ chạy mẫu.':'Không có cảnh báo trọng yếu trong dữ liệu hiện tại.';
  return `<div class="head"><div><h1>Bảng điều khiển</h1><p>${esc(state.lab.name||'Khoa Xét nghiệm')}${state.lab.dept?' · '+esc(state.lab.dept):''}</p></div>${topUserBox()}</div>
   <div class="dash-hero">
     <div class="dash-status"><div class="eyebrow">Trạng thái trực ca · ${vnDate(today)}</div><h2>${mood}</h2><p>${moodText}</p>
       <div class="dash-progress"><span style="width:${pct}%"></span></div><div class="hint" style="margin-top:8px">${doneTests}/${tests.length||0} xét nghiệm đã đủ QC hôm nay · ${pct}% hoàn tất</div></div>
     <div class="dash-kpis"><div class="dash-kpi"><div class="k">Xét nghiệm</div><div class="v">${tests.length}</div></div><div class="dash-kpi"><div class="k">Điểm QC</div><div class="v">${totalPts}</div></div>
       <div class="dash-kpi"><div class="k">Vi phạm</div><div class="v" style="color:var(--red)">${rej}</div></div><div class="dash-kpi"><div class="k">QC hôm nay</div><div class="v" style="color:var(--teal)">${done}</div></div></div>
   </div>
   ${kpiHtml}
   <div class="dash-main">
     <div class="panel"><h3>Cần xử lý / Theo dõi</h3>${followHtml}</div>
     <div class="panel"><h3>Lô & hạn dùng</h3><div class="dash-list">${expHtml}</div></div>
   </div>
    <div class="panel">${tests.length?`<div class="dash-test-toolbar"><h3>Danh sách xét nghiệm</h3><div class="dash-test-search"><input id="dashTestSearch" type="search" placeholder="Tìm xét nghiệm, máy, lô..." value="${escAttr(dashTestQ)}" oninput="dashTestFilter(this.value)"><span id="dashTestCount">${statusItems.length}/${statusItems.length}</span></div></div><div class="dash-test-filterbar">${dashStatusTabs}</div>${testListHtml}`:emptyState('Chưa có xét nghiệm đang vận hành','Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi theo dõi.')}</div>`;
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
    <div class="panel dash-loading-panel"><div class="dash-spinner"></div><div><h3>Đang tính trạng thái kiểm soát chất lượng</h3><p class="hint">Công việc nặng đã được chuyển khỏi luồng giao diện để thao tác không bị đóng băng.</p></div></div>`;
}

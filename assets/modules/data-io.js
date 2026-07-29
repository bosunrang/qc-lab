/* ===== DATA IO ===== */
function csvCell(v){
  if(typeof v==='number')return Number.isFinite(v)?String(v):'';
  v=v==null?'':String(v);
  if(/^[\s]*[=+\-@]/.test(v))v="'"+v;
  return /[",\n\r;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
}
function downloadCSV(name,rows){const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function exportMetaRows(kind='Báo cáo'){const app=window.QCLAB_APP||{version:'dev'},rules=Object.entries(state.westgardRules||{}).filter(x=>x[1]!==false).map(x=>x[0]).join(', ');return[['Metadata',kind],['Phiên bản app',`${app.name||'QC Lab'} ${app.version||'dev'}`],['Người xuất',userName()],['Thời gian xuất',formatDateTimeVN(new Date().toISOString())],['Bộ luật áp dụng',rules||'Chưa cấu hình']];}
function reportRows(tid,start,end){const t=state.tests.find(x=>x.id===tid);if(!t)return[];const inMonth=p=>(!start||p.date>=start)&&(!end||p.date<=end),wg=activeWestgard(t),teaVal=typeof sgTea==='function'?sgTea(t):(t.tea||0);let rows=[...exportMetaRows('Báo cáo nội kiểm'),[],['BÁO CÁO NỘI KIỂM',state.lab.name||'',state.lab.dept||'',reportRangeText(start,end)],[],['Xét nghiệm',testDisplayName(t),'Máy',t.machine||'','Đơn vị',t.unit||'','TEa%',teaVal||''],['Nguồn TEa',typeof sgTeaLabel==='function'?sgTeaLabel(sgTeaSource(t)):'Ricos / Westgard biological variation','Cơ sở',typeof sgTeaRefText==='function'?sgTeaRefText(t):'','Tài liệu',t.teaDoc||'','Người duyệt',t.teaApprovedBy||''],['Ghi chú','Cột "Sigma (kỳ)" tính từ Mean/CV thực tế trong đúng khoảng ngày báo cáo này, khác với Sigma đã thẩm định ở trang Six Sigma & Sai số. Dấu * bên cạnh Sigma nghĩa là n<20, CV/Sigma chưa đủ ổn định để tham khảo.']];operationalLevels(t).forEach(l=>{(typeof previousLotSeries==='function'?previousLotSeries(t,l.level):[]).forEach(s=>{const inPts=s.pts.filter(inMonth);if(!inPts.length)return;const wgP=QCCore.westgardByPoint(s.pts,s.mean,s.sd,rule=>testRuleOn(t,rule)),idxOf=new Map(s.pts.map((p,i)=>[p.id,i]));rows.push([],['Mức '+l.level,'Lô '+s.lot,'Đã chuyển tiếp','Mean',s.mean,'SD',s.sd]);rows.push(['Ghi chú','Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).']);rows.push(['Ngày','Lần chạy','NV thực hiện','Họ tên nhân viên','Giá trị','Z','Kết luận','Luật','Loại sai số']);inPts.forEach(p=>{const i=idxOf.get(p.id),f=wgP.F[i]||{level:'ok',rules:[]},z=wgP.zs[i],staff=pointStaff(p);rows.push([vnDate(p.date),p.runId||'',staff.code,staff.name,p.val,(z>=0?'+':'')+fmt(z)+'s',stateName(ruleResultLevel(t,f.rules||[])),((f.rules||[]).join(' | ')||((f.supportRules||[]).length?'Bằng chứng: '+f.supportRules.join(' | '):'')),errorType(f.rules||[])]);});const{st:stP,bias:biasP,te:teP,sigma:sigmaP}=reportLevelStats(inPts,s.mean,teaVal);rows.push(['Thống kê (lô cũ)','n',stP.n,'Mean thực',fmt(stP.m),'SD',fmt(stP.sd,3),'CV%',fmt(stP.cv),'Bias%',fmt(biasP),'TE%',fmt(teP),'Sigma (kỳ)',sigmaP==null?'':fmt(sigmaP,2)+(stP.n<20?' *':'')]);});const pts=operationalLotPoints(t,l.level).filter(inMonth);rows.push([],['Mức '+l.level,'Lô '+(l.lot||''),'Dải '+(l.applied==='lab'?'PXN':'NSX'),'Mean',l.mean,'SD',l.sd]);rows.push(['Ngày','Lần chạy','NV thực hiện','Họ tên nhân viên','Giá trị','Z','Kết luận','Luật','Loại sai số']);if(pts.length){pts.forEach(p=>{const f=wg.byPoint.get(p.id)||{level:'ok',rules:[],z:(p.val-l.mean)/l.sd},staff=pointStaff(p);rows.push([vnDate(p.date),p.runId||'',staff.code,staff.name,p.val,(f.z>=0?'+':'')+fmt(f.z)+'s',stateName(f.level),(f.rules.join(' | ')||((f.supportRules||[]).length?'Bằng chứng: '+f.supportRules.join(' | '):'')),errorType(f.rules)]);});const{st,bias,te,sigma}=reportLevelStats(pts,l.mean,teaVal);rows.push(['Thống kê','n',st.n,'Mean thực',fmt(st.m),'SD',fmt(st.sd,3),'CV%',fmt(st.cv),'Bias%',fmt(bias),'TE%',fmt(te),'Sigma (kỳ)',sigma==null?'':fmt(sigma,2)+(st.n<20?' *':'')]);}else rows.push(['Không có dữ liệu trong khoảng ngày đã chọn']);});const acts=(state.actions||[]).filter(a=>a.testId===tid&&inMonth(a));rows.push([],['NHẬT KÝ KHẮC PHỤC'],['Ngày','Mã NCE','Mức / lô','Luật','Loại sai số','Hành động','Điều tra & ảnh hưởng','Người phụ trách','QC chạy lại','Trạng thái duyệt','Người duyệt','Ý kiến duyệt','Trạng thái hồ sơ']);acts.forEach(a=>{const wf=typeof actionWorkflowStatus==='function'?actionWorkflowStatus(a):{complete:false,label:'Chưa hoàn tất'},rr=typeof actionRerunStatus==='function'?actionRerunStatus(a):{label:''};rows.push([vnDate(a.date),a.nceId||'',actionLevelShort(t,a.level,a.lot),a.rule||'',a.errorType||'',a.action||a.correction||'',typeof actionProtocolSummary==='function'?actionProtocolSummary(a):'',a.by||'',rr.label||'',typeof actionApprovalLabel==='function'?actionApprovalLabel(a):(a.approvalStatus||'pending'),a.approvedBy||'',a.approvalNote||'',wf.label||'Chưa hoàn tất']);});return rows;}
function exportReportCSV(){const tid=document.getElementById('rTest').value,{start,end}=typeof reportDateRange==='function'?reportDateRange():{start:'',end:''};const t=state.tests.find(x=>x.id===tid);if(!t)return;const label=start||end?(start||'batdau')+'_'+(end||'hientai'):'toanbo';downloadCSV('Bao_cao_IQC_'+safeName(t.name)+'_'+safeName(label)+'.csv',reportRows(tid,start,end));}
function exportActionsCSV(){
  const rows=[...exportMetaRows('Nhật ký khắc phục'),[],['Mã NCE','Ngày','Thời điểm ghi nhận','Nguồn phát hiện','Giai đoạn','Xét nghiệm','Mức / lô','Luật','Loại sai số','Hành động','Điều tra & ảnh hưởng','Người phụ trách','Hạn hoàn thành','S ban đầu','O ban đầu','D ban đầu','RPN ban đầu','Phân loại nguy cơ','Căn cứ SOP','Quyết định cho phép trở lại','Ngày cho phép','Người cho phép','Căn cứ cho phép','QC chạy lại','Kết luận hiệu lực','Ngày đánh giá hiệu lực','Bằng chứng hiệu lực','Người đánh giá','S còn lại','O còn lại','D còn lại','RPN còn lại','Phân loại nguy cơ còn lại','Căn cứ đánh giá lại','Trạng thái duyệt','Người duyệt','Thời điểm duyệt','Ý kiến duyệt','Lý do trả lại','Người trả lại','Thời điểm trả lại','Trạng thái bản ghi','Lý do hủy','Người hủy','Thời điểm hủy','Hồ sơ trước','Hồ sơ tiếp theo','Trạng thái hồ sơ']];
  const effLabels={pending:'Chưa đánh giá',effective:'Có hiệu lực',ineffective:'Chưa hiệu lực'};
  (state.actions||[]).forEach(a=>{
    const t=state.tests.find(x=>x.id===a.testId),wf=typeof actionWorkflowStatus==='function'?actionWorkflowStatus(a):{complete:false,label:'Chưa hoàn tất'},rr=typeof actionRerunStatus==='function'?actionRerunStatus(a):{label:''},labels=typeof ACTION_LABELS==='object'?ACTION_LABELS:{source:{},phase:{},risk:{},release:{}};
    rows.push([a.nceId||'',vnDate(a.date),a.createdAt?formatDateTimeVN(a.createdAt):'',labels.source[a.eventSource]||a.eventSource||'',labels.phase[a.processPhase]||a.processPhase||'',t?testDisplayName(t):'',actionLevelShort(t,a.level,a.lot),a.rule||'',a.errorType||'',a.action||a.correction||'',typeof actionProtocolSummary==='function'?actionProtocolSummary(a):'',a.by||'',a.dueDate?vnDate(a.dueDate):'',a.riskSeverity||'',a.riskOccurrence||'',a.riskDetectability||'',typeof actionRiskScore==='function'?actionRiskScore(a):'',labels.risk[a.riskLevel]||a.riskLevel||'',a.riskBasis||'',labels.release[a.releaseStatus]||a.releaseStatus||'',a.releaseDate?vnDate(a.releaseDate):'',a.releaseBy||'',a.releaseNote||'',rr.label||'',effLabels[a.effectivenessStatus]||a.effectivenessStatus||'',a.effectivenessDate?vnDate(a.effectivenessDate):'',a.effectivenessNote||'',a.effectivenessBy||'',a.residualSeverity||'',a.residualOccurrence||'',a.residualDetectability||'',typeof actionResidualRiskScore==='function'?actionResidualRiskScore(a):'',labels.risk[a.residualRiskLevel]||a.residualRiskLevel||'',a.residualRiskBasis||'',typeof actionApprovalLabel==='function'?actionApprovalLabel(a):(a.approvalStatus||'pending'),a.approvedBy||'',a.approvedAt?formatDateTimeVN(a.approvedAt):'',a.approvalNote||'',a.returnNote||'',a.returnBy||'',a.returnAt?formatDateTimeVN(a.returnAt):'',a.recordStatus==='cancelled'?'Đã hủy':'Đang hoạt động',a.cancelReason||'',a.cancelledBy||'',a.cancelledAt?formatDateTimeVN(a.cancelledAt):'',a.parentNceId||'',a.followUpNceId||'',wf.label||'Chưa hoàn tất']);
  });
  downloadCSV('Nhat_ky_khac_phuc_QC.csv',rows);
}
function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function sigmaReportMetric(r){return r?{cv:r.cv,bias:r.bias,biasMethod:r.biasMethod,biasLabel:r.biasLabel,tea:r.tea,teaTarget:r.teaTarget,teaCriterionRule:r.teaCriterionRule,teaCriterionPercent:r.teaCriterionPercent,teaCriterionAbsolute:r.teaCriterionAbsolute,teaCriterionUnit:r.teaCriterionUnit,sigma:r.sigma,dpmo:r.dpmo,yld:r.yld,label:r.label,n:r.n,cvSource:r.cvSource,sourceStart:r.sourceStart,sourceEnd:r.sourceEnd,sourceLot:r.sourceLot,cohortStatus:r.cohortStatus,classifiable:r.classifiable,qcpEligible:r.qcpEligible,warning:r.warning}:null;}
function sigmaReportRows(onlyTestId='',mode='latest',period='',periodId=''){
  return sgTrackedTests().filter(t=>!onlyTestId||t.id===onlyTestId).flatMap(t=>{
    const levels=typeof sgVisibleLevels==='function'?sgVisibleLevels(t):(t.levels||[]).map(l=>l.level);
    if(!levels.length)return[];
    const rows=sgRows(t,sgData(t.id),levels).filter(row=>row.rs.some(Boolean));
    if(!rows.length)return[];
    const selected=mode==='all'?rows:mode==='period'?rows.filter(row=>periodId?row.e.id===periodId:row.e.period===period):rows.slice(-1);
    const name=testDisplayName(t)||'(chưa đặt tên)';
    return selected.map(row=>{const currentSrc=typeof sgTeaSource==='function'?sgTeaSource(t):(t.teaSource||'ricos'),first=row.rs.find(Boolean),tea=first?first.tea:(typeof sgEntryTea==='function'?sgEntryTea(t,row.e):sgTea(t)),metrics=levels.map((level,i)=>({level,metric:sigmaReportMetric(row.rs[i])})).filter(x=>x.metric),meta=typeof sgTeaSourceMeta==='function'?sgTeaSourceMeta(t,row.e.teaSource||currentSrc):{};return{name,period:vnPeriod(row.e.period)||row.e.period||'',tea,teaSource:row.e.teaSource||currentSrc,teaLabel:row.e.teaLabel||(typeof sgTeaLabel==='function'?sgTeaLabel(currentSrc):currentSrc),teaReference:row.e.teaReference||(typeof sgTeaRefText==='function'?sgTeaRefText(t):''),teaSourceId:row.e.teaSourceId||meta.id||'',teaSourceVersion:row.e.teaSourceVersion||meta.version||'',teaSourceUrl:row.e.teaSourceUrl||meta.url||'',teaEffectiveDate:row.e.teaEffectiveDate||meta.effectiveDate||'',teaReviewedDate:row.e.teaReviewedDate||meta.reviewedDate||'',teaReviewedBy:row.e.teaReviewedBy||meta.reviewedBy||'',levels:metrics,r1:metrics[0]&&metrics[0].metric,r2:metrics[1]&&metrics[1].metric};});
  });
}
function sigmaLevelsOf(row){const levels=Array.isArray(row&&row.levels)?row.levels:[{level:1,metric:row&&row.r1||null},{level:2,metric:row&&row.r2||null}];return levels.filter(x=>x&&x.metric);}
function sigmaDataURLBytes(durl){const b64=durl.split(',')[1],bin=atob(b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
const SIGMA_EXPORT_PIXEL_RATIO=6,SIGMA_EXPORT_MAX_DIMENSION=16384;
function sigmaExportPixelRatio(W,H,scale=SIGMA_EXPORT_PIXEL_RATIO){W=Number(W);H=Number(H);scale=Number(scale);if(!(W>0&&H>0&&scale>0))return 1;return Math.max(.1,Math.min(scale,SIGMA_EXPORT_MAX_DIMENSION/W,SIGMA_EXPORT_MAX_DIMENSION/H));}
function sigmaCanvas(W,H,scale){scale=sigmaExportPixelRatio(W,H,scale);const cv=document.createElement('canvas');cv.width=Math.round(W*scale);cv.height=Math.round(H*scale);const ctx=cv.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);return{cv,ctx};}
function drawSigmaReportChart(rows){
  const data=rows.map(d=>({name:d.period||d.name,levels:sigmaLevelsOf(d).filter(x=>x.metric.classifiable!==false&&Number.isFinite(x.metric.sigma))})).filter(x=>x.levels.length);
  if(!data.length)return null;
  const N=data.length,W=Math.max(760,72*N+170),H=400,scale=SIGMA_EXPORT_PIXEL_RATIO,pl=52,pr=22,pt=54,pb=92,iw=W-pl-pr,ih=H-pt-pb;
  const all=data.flatMap(x=>x.levels.map(l=>l.metric.sigma));
  const top=Math.max(8,Math.ceil(Math.max(...all)*1.05)),k=sigmaCanvas(W,H,scale),ctx=k.ctx,Y=v=>pt+ih-(v/top)*ih;
  /** @type {[number,number,string][]} */
  ([[0,3,'#f6dcd8'],[3,4,'#fdeecb'],[4,6,'#e4eee3'],[6,top,'#d6e8de']]).forEach(b=>{if(b[1]>b[0]){ctx.fillStyle=b[2];const y1=Y(Math.min(b[1],top)),y2=Y(b[0]);ctx.fillRect(pl,y1,iw,y2-y1);}});
  ctx.font='12px Arial';ctx.fillStyle='#9a9486';ctx.textAlign='right';ctx.strokeStyle='rgba(0,0,0,.06)';ctx.lineWidth=1;
  for(let g=0;g<=top;g+=2){const y=Y(g);ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(W-pr,y);ctx.stroke();ctx.fillText(String(g),pl-6,y+4);}
  const refLine=(v,col)=>{ctx.save();ctx.strokeStyle=col;ctx.setLineDash([5,4]);ctx.lineWidth=1.3;const y=Y(v);ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(W-pr,y);ctx.stroke();ctx.restore();ctx.fillStyle=col;ctx.textAlign='left';ctx.font='bold 12px Arial';ctx.fillText(v+'σ',W-pr-26,y-4);};
  refLine(3,'#c0392b');refLine(6,'#13603f');
  const slot=iw/N,maxLevels=Math.max(...data.map(x=>x.levels.length)),bw=Math.max(5,Math.min(24,slot*.72/maxLevels));
  data.forEach((x,i)=>{const cx=pl+(i+.5)*slot;
    const bar=(s,lvl,ox)=>{if(s==null)return;const col=sgZone(s).c,bx=cx+ox-bw/2,y=Y(s),h=Y(0)-y;ctx.fillStyle=col;ctx.fillRect(bx,y,bw,h);ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1;ctx.strokeRect(bx,y,bw,h);ctx.fillStyle='#16211f';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(s.toFixed(2),bx+bw/2,y-5);ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.fillText(String(lvl),bx+bw/2,Y(0)-4);};
    x.levels.forEach((l,j)=>bar(l.metric.sigma,l.level,(j-(x.levels.length-1)/2)*bw*1.15));ctx.save();ctx.translate(cx,pt+ih+12);ctx.rotate(-Math.PI/4.2);ctx.fillStyle='#3a443f';ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText(x.name.length>16?x.name.slice(0,15)+'…':x.name,0,0);ctx.restore();
  });
  ctx.strokeStyle='#16211f';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(pl,pt);ctx.lineTo(pl,pt+ih);ctx.lineTo(W-pr,pt+ih);ctx.stroke();
  ctx.fillStyle='#16211f';ctx.font='bold 15px Arial';ctx.textAlign='left';ctx.fillText('Sigma theo xét nghiệm',pl,22);
  let lx=pl,ly=38;[['#c0392b','<3σ'],['#dd8b1f','3–4σ'],['#3f9a55','4–6σ'],['#13603f','≥6σ']].forEach(z=>{ctx.fillStyle=z[0];ctx.fillRect(lx,ly-9,14,8);ctx.fillStyle='#16211f';ctx.font='bold 11px Arial';ctx.fillText(z[1],lx+18,ly-1);lx+=66;});
  ctx.fillStyle='#6b756f';ctx.font='11px Arial';ctx.fillText('Số trong cột = mức QC',lx+6,ly-1);
  return{bytes:sigmaDataURLBytes(k.cv.toDataURL('image/png')),dispW:W,dispH:H};
}
function sigmaMdcItems(rows){
  const items=[];(rows||[]).forEach(d=>{sigmaLevelsOf(d).forEach(x=>{const r=x.metric,tea=Number(r&&r.tea)||Number(d.tea);if(r&&tea>0&&r.classifiable!==false&&Number.isFinite(r.cv)&&r.cv>=0&&Number.isFinite(r.bias)&&Number.isFinite(r.sigma))items.push({name:d.period||d.name,level:x.level,x:r.cv/tea*100,y:Math.abs(r.bias)/tea*100,sigma:r.sigma});});});return items;
}
function sigmaPeriodLabel(value){
  const raw=String(value||'').trim().replace(/^Kỳ\s*/i,''),iso=raw.match(/^(\d{4})-(\d{1,2})$/),vn=raw.match(/^(\d{1,2})\/(\d{4})$/);
  if(iso)return String(Number(iso[2])).padStart(2,'0')+'/'+iso[1];
  if(vn)return String(Number(vn[1])).padStart(2,'0')+'/'+vn[2];
  return raw||'?';
}
function sigmaMdcPeriodLabel(value){return sigmaPeriodLabel(value).replace(/^0(?=\d\/)/,'');}
function sigmaExportPeriods(rows){return[...new Set((rows||[]).map(r=>sigmaPeriodLabel(r&&r.period)).filter(Boolean))].join(', ');}
function sigmaMdcLabelPlacements(items,X,Y,ctx,bounds){
  const used=[],points=(items||[]).map(p=>({left:X(p.x)-9,right:X(p.x)+9,top:Y(p.y)-9,bottom:Y(p.y)+9})),b=bounds||{},left=b.left||0,right=b.right||Infinity,top=b.top||0,bottom=b.bottom||Infinity,overlap=(a,c)=>a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top;
  return(items||[]).map((p,index)=>{
    const label=sigmaMdcPeriodLabel(p.name),px=X(p.x),py=Y(p.y),width=Math.ceil(ctx&&ctx.measureText?ctx.measureText(label).width:label.length*6),height=12;
    const raw=[[px+11,py+3],[px+11,py-10],[px+11,py+16],[px-width-11,py+3],[px-width-11,py-10],[px-width-11,py+16],[px-width/2,py-13],[px-width/2,py+20]];
    const candidates=raw.map(([x,y])=>({x,y,left:x-2,right:x+width+2,top:y-height,bottom:y+3})).filter(c=>c.left>=left&&c.right<=right&&c.top>=top&&c.bottom<=bottom);
    const score=c=>used.reduce((n,u)=>n+(overlap(c,u)?10:0),0)+points.reduce((n,q,i)=>n+(i!==index&&overlap(c,q)?3:0),0);
    const chosen=(candidates.length?candidates:raw.map(([x,y])=>({x,y,left:x-2,right:x+width+2,top:y-height,bottom:y+3}))).sort((a,c)=>score(a)-score(c))[0];
    used.push(chosen);return{label,x:chosen.x,y:chosen.y};
  });
}
function drawSigmaReportMDC(rows){
  const items=sigmaMdcItems(rows);
  if(!items.length)return null;
  const W=780,H=420,scale=SIGMA_EXPORT_PIXEL_RATIO,pl=58,pr=22,pt=50,pb=54,iw=W-pl-pr,ih=H-pt-pb,maxX=Math.max(50,Math.max(...items.map(p=>p.x)))*1.1,maxY=100,k=sigmaCanvas(W,H,scale),ctx=k.ctx,X=v=>pl+Math.min(v,maxX)/maxX*iw,Y=v=>pt+ih-Math.min(v,maxY)/maxY*ih;
  ctx.font='11px Arial';ctx.fillStyle='#9a9486';ctx.strokeStyle='#eee7d8';ctx.lineWidth=1;ctx.textAlign='right';
  for(let g=0;g<=maxY;g+=20){const y=Y(g);ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(W-pr,y);ctx.stroke();ctx.fillText(String(g),pl-6,y+4);}
  ctx.textAlign='center';for(let gx=0;gx<=maxX;gx+=10)ctx.fillText(String(Math.round(gx)),X(gx),pt+ih+16);
  /** @type {[number,string][]} */
  ([[2,'#c0392b'],[3,'#dd8b1f'],[4,'#b59a00'],[5,'#3f9a55'],[6,'#0e4d4a']]).forEach(p=>{const S=p[0],col=p[1],x2=100/S,ex=Math.min(x2,maxX),ey=Math.max(0,100-S*ex);ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(X(0),Y(100));ctx.lineTo(X(ex),Y(ey));ctx.stroke();ctx.fillStyle=col;ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText(S+'σ',x2<=maxX?X(x2)+2:W-pr-22,x2<=maxX?Y(0)-3:Y(100-S*maxX)-2);});
  items.forEach(p=>{ctx.beginPath();ctx.arc(X(p.x),Y(p.y),7,0,2*Math.PI);ctx.fillStyle=sgZone(p.sigma).c;ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#fff';ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(String(p.level),X(p.x),Y(p.y)+3);});
  ctx.fillStyle='#16211f';ctx.font='10px Arial';ctx.textAlign='left';sigmaMdcLabelPlacements(items,X,Y,ctx,{left:pl,right:W-pr,top:pt,bottom:pt+ih}).forEach(p=>ctx.fillText(p.label,p.x,p.y));
  ctx.strokeStyle='#16211f';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(pl,pt);ctx.lineTo(pl,pt+ih);ctx.lineTo(W-pr,pt+ih);ctx.stroke();
  ctx.fillStyle='#16211f';ctx.font='bold 15px Arial';ctx.textAlign='left';ctx.fillText('Biểu đồ Quyết định Phương pháp (MDC) — các mức QC',pl,22);
  ctx.font='11px Arial';ctx.fillStyle='#6b756f';ctx.fillText('Màu điểm theo xếp loại Sigma · số trong điểm là mức QC · đường 2σ–6σ',pl,40);
  ctx.font='12px Arial';ctx.fillStyle='#16211f';ctx.textAlign='center';ctx.fillText('CV / TEa (%)',(pl+W-pr)/2,H-8);ctx.save();ctx.translate(16,(pt+ih)/2);ctx.rotate(-Math.PI/2);ctx.fillText('|Bias| / TEa (%)',0,0);ctx.restore();
  return{bytes:sigmaDataURLBytes(k.cv.toDataURL('image/png')),dispW:W,dispH:H};
}
/* Lõi OOXML/ZIP dùng chung cho mọi bộ xuất .xlsx (SigmaXlsx + ReportXlsx): ghi ZIP
   STORE (không nén) kèm CRC32 tự tính, escape XML, đổi px→EMU, và các helper ô
   inlineStr/số. Byte-precise — bất kỳ sai lệch offset/độ dài nào cũng tạo file .xlsx
   hỏng mà không báo lỗi lúc xuất, nên phần này được kiểm bằng tests/sigma-xlsx.test.js
   và tests/report-xlsx.test.js (đều tự parse lại bytes, không tin code của app). */
const XlsxCore=(()=>{
  const crcT=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  const enc=new TextEncoder(),u8=s=>enc.encode(s),escX=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const crc32=buf=>{let c=0xFFFFFFFF;for(let i=0;i<buf.length;i++)c=crcT[(c^buf[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
  const zip=files=>{const parts=[],central=[];let offset=0;const num=(v,len)=>{const a=new Uint8Array(len);for(let i=0;i<len;i++){a[i]=v&255;v>>>=8;}return a;},push=a=>{parts.push(a);offset+=a.length;};files.forEach(f=>{const nameB=u8(f.name),data=f.data,crc=crc32(data),off=offset;[num(0x04034b50,4),num(20,2),num(0,2),num(0,2),num(0,2),num(0,2),num(crc,4),num(data.length,4),num(data.length,4),num(nameB.length,2),num(0,2),nameB,data].forEach(push);central.push({nameB,crc,len:data.length,off});});const cdStart=offset;central.forEach(c=>[num(0x02014b50,4),num(20,2),num(20,2),num(0,2),num(0,2),num(0,2),num(0,2),num(c.crc,4),num(c.len,4),num(c.len,4),num(c.nameB.length,2),num(0,2),num(0,2),num(0,2),num(0,2),num(0,4),num(c.off,4),c.nameB].forEach(push));const cdLen=offset-cdStart;[num(0x06054b50,4),num(0,2),num(0,2),num(central.length,2),num(central.length,2),num(cdLen,4),num(cdStart,4),num(0,2)].forEach(push);const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);let pos=0;parts.forEach(p=>{out.set(p,pos);pos+=p.length;});return out;};
  const emu=px=>Math.round(px*9525),COLS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const cellStr=(ref,s,v)=>'<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+escX(v)+'</t></is></c>',cellNum=(ref,s,v)=>v===''||v==null||(typeof v==='number'&&!Number.isFinite(v))?cellStr(ref,s,''):('<c r="'+ref+'" s="'+s+'"><v>'+v+'</v></c>');
  const r2=x=>(x==null||!Number.isFinite(x))?'':Number(Number(x).toFixed(2)),r4=x=>(x==null||!Number.isFinite(x))?'':Number(Number(x).toFixed(4));
  return{u8,escX,crc32,zip,emu,COLS,cellStr,cellNum,r2,r4};
})();
const DEFAULT_SIGMA_SHEET='Tổng hợp Six Sigma';
const SigmaXlsx=(()=>{
  const {u8,escX,zip,emu,COLS,cellStr,cellNum,r2,r4}=XlsxCore;
  const styles=()=>{const fonts=['<font><sz val="9"/><name val="Arial"/><color rgb="FF000000"/></font>','<font><b/><sz val="9"/><name val="Arial"/><color rgb="FF000000"/></font>','<font><b/><sz val="9"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>','<font><b/><sz val="13"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>','<font><sz val="9"/><name val="Arial"/><color rgb="FF555555"/></font>'],fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'];['0D3D24','1F5C3A','2D8653','5AAA6B','E07B1A','C0392B','F2F7F4','FFF3E0','FFFFFF'].forEach(c=>fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF'+c+'"/></patternFill></fill>'));const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>','<border><left style="thin"><color rgb="FFAAAAAA"/></left><right style="thin"><color rgb="FFAAAAAA"/></right><top style="thin"><color rgb="FFAAAAAA"/></top><bottom style="thin"><color rgb="FFAAAAAA"/></bottom><diagonal/></border>'],xf=(f,fl,b,ha,va,wrap)=>'<xf numFmtId="0" fontId="'+f+'" fillId="'+fl+'" borderId="'+b+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment'+(ha?' horizontal="'+ha+'"':'')+(va?' vertical="'+va+'"':'')+(wrap?' wrapText="1"':'')+'/></xf>';const xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',xf(3,2,0,'center','center',0),xf(4,0,0,'center','center',1),xf(2,3,1,'center','center',1),xf(1,8,1,'center','center',1),xf(1,10,1,'center','center',1),xf(0,8,1,'center','center',1),xf(0,10,1,'center','center',1),xf(0,9,1,'center','center',1),xf(2,3,1,'center','center',1),xf(2,4,1,'center','center',1),xf(2,5,1,'center','center',1),xf(2,6,1,'center','center',1),xf(2,7,1,'center','center',1),xf(0,0,0,'left','center',1)];return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';};
  const periodNo=v=>{const m=String(v||'').match(/(?:Kỳ\s*)?(\d{1,2})\/\d{4}$/i);return m?Number(m[1]):v;},periodCell=(ref,style,v)=>{const n=periodNo(v);return typeof n==='number'&&Number.isFinite(n)?cellNum(ref,style,n):cellStr(ref,style,n);};
  const sheet=(rows,meta,hasDrawing)=>{
    const zoneXf={'Đẳng cấp thế giới':9,'Xuất sắc':10,'Tốt':11,'Cận biên':12,'Không đạt':13},levels=[],periodMerges=[],assayMerges=[];
    (rows||[]).forEach((d,pIdx)=>{
      const usable=sigmaLevelsOf(d),items=usable.length?usable:[{level:'—',metric:null}],start=levels.length;
      items.forEach((item,i)=>levels.push({d,item,pIdx,first:i===0,assayFirst:false}));
      if(items.length>1){const r0=4+start,r1=r0+items.length-1;periodMerges.push('B'+r0+':B'+r1,'C'+r0+':C'+r1);}
    });
    for(let start=0;start<levels.length;){
      let end=start+1;while(end<levels.length&&levels[end].d.name===levels[start].d.name)end++;
      levels[start].assayFirst=true;
      if(end-start>1)assayMerges.push('A'+(4+start)+':A'+(3+end));
      start=end;
    }
    const out=[],noteRow=4+levels.length;
    out.push('<row r="1" ht="27.75" customHeight="1">'+cellStr('A1',1,meta.title)+'</row>');
    out.push('<row r="2" ht="36" customHeight="1">'+cellStr('A2',2,meta.subtitle)+'</row>');
    const H=['Xét nghiệm','Kỳ','TEa (%)','Mức','Sigma','Xếp loại','CV (%)','Bias (%)','DPMO','Yield (%)','n IQC'];
    out.push('<row r="3" ht="39.75" customHeight="1">'+H.map((h,i)=>cellStr(COLS[i]+'3',3,h)).join('')+'</row>');
    levels.forEach((p,idx)=>{
      const rn=4+idx,zebra=p.pIdx%2===0,base=zebra?6:7,name=zebra?4:5,r=p.item&&p.item.metric;
      const cells=[cellStr('A'+rn,name,p.assayFirst?p.d.name:''),p.first?periodCell('B'+rn,base,p.d.period):cellStr('B'+rn,base,''),p.first?cellNum('C'+rn,base,r2(p.d.tea)):cellStr('C'+rn,base,'')];
      if(!r){['D','E','F','G','H','I','J','K'].forEach(col=>cells.push(cellStr(col+rn,base,'—')));}
      else{const zx=zoneXf[r.label]||base;cells.push(cellStr('D'+rn,base,p.item.level),cellNum('E'+rn,zx,r2(r.sigma)),cellStr('F'+rn,zx,r.label),cellNum('G'+rn,base,r2(r.cv)),cellNum('H'+rn,base,r2(r.bias)),cellNum('I'+rn,base,Math.round(r.dpmo)),cellNum('J'+rn,base,r4(r.yld)),r.n==null?cellStr('K'+rn,base,'—'):cellNum('K'+rn,base,r.n));}
      out.push('<row r="'+rn+'" ht="18" customHeight="1">'+cells.join('')+'</row>');
    });
    out.push('<row r="'+noteRow+'" ht="32" customHeight="1">'+cellStr('A'+noteRow,14,'Lưu ý: Không tự quy đổi Sigma thành số bệnh nhân giữa hai lần QC. Tần suất và quy tắc QC phải được phê duyệt theo đánh giá nguy cơ, độ ổn định hệ thống, tải mẫu, hậu quả lâm sàng và SOP của đơn vị.')+'</row>');
    const merges=['A1:K1','A2:K2','A'+noteRow+':K'+noteRow,...assayMerges,...periodMerges],cols='<cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="3" width="11" customWidth="1"/><col min="4" max="4" width="8" customWidth="1"/><col min="5" max="5" width="9" customWidth="1"/><col min="6" max="6" width="20" customWidth="1"/><col min="7" max="11" width="11" customWidth="1"/></cols>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:K'+noteRow+'"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="11.4"/>'+cols+'<sheetData>'+out.join('')+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(m=>'<mergeCell ref="'+m+'"/>').join('')+'</mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>'+(hasDrawing?'<drawing r:id="rId1"/>':'')+'</worksheet>';
  };
  const drawing=(images,startRow0)=>{let nextRow=startRow0;return'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+images.map((img,i)=>{const row=nextRow;nextRow+=Math.ceil(img.dispH/15)+1;const cx=emu(img.dispW),cy=emu(img.dispH);return '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+row+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="'+cx+'" cy="'+cy+'"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="'+(i+1)+'" name="Chart'+(i+1)+'"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId'+(i+1)+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';}).join('')+'</xdr:wsDr>';};
  const build=(rows,meta,images=[])=>{images=images.filter(im=>im&&im.bytes&&im.bytes.length);const hasDraw=images.length>0,levelCount=(rows||[]).reduce((n,d)=>n+Math.max(1,sigmaLevelsOf(d).length),0),noteRow=4+levelCount,chartStartRow0=noteRow+1,ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+(hasDraw?'<Default Extension="png" ContentType="image/png"/>':'')+'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+(hasDraw?'<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':'')+'</Types>';const files=[{name:'[Content_Types].xml',data:u8(ct)},{name:'_rels/.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')},{name:'xl/workbook.xml',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+escX('Tổng hợp Six Sigma')+'" sheetId="1" r:id="rId1"/></sheets></workbook>')},{name:'xl/_rels/workbook.xml.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')},{name:'xl/styles.xml',data:u8(styles())},{name:'xl/worksheets/sheet1.xml',data:u8(sheet(rows,meta,hasDraw))}];if(hasDraw){files.push({name:'xl/worksheets/_rels/sheet1.xml.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>')});files.push({name:'xl/drawings/drawing1.xml',data:u8(drawing(images,chartStartRow0))});let rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';images.forEach((im,i)=>rels+='<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image'+(i+1)+'.png"/>');files.push({name:'xl/drawings/_rels/drawing1.xml.rels',data:u8(rels+'</Relationships>')});images.forEach((im,i)=>files.push({name:'xl/media/image'+(i+1)+'.png',data:im.bytes}));}return zip(files);};
  return{build};
})();
function renameSigmaSheet(bytes,sheetName){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decode=new TextDecoder(),files=[];let off=0;
  while(off+30<=bytes.length&&view.getUint32(off,true)===0x04034b50){
    const nameLen=view.getUint16(off+26,true),extraLen=view.getUint16(off+28,true),size=view.getUint32(off+18,true),nameStart=off+30,dataStart=nameStart+nameLen+extraLen;
    const name=decode.decode(bytes.slice(nameStart,nameStart+nameLen));let data=bytes.slice(dataStart,dataStart+size);
    if(name==='xl/workbook.xml'){const xml=decode.decode(data).replace(/(<sheet name=")[^"]*(")/,'$1'+XlsxCore.escX(sheetName)+'$2');data=XlsxCore.u8(xml);}
    files.push({name,data});off=dataStart+size;
  }
  return files.length?XlsxCore.zip(files):bytes;
}
const sigmaXlsxBuild=SigmaXlsx.build;
SigmaXlsx.build=(rows,meta,images)=>renameSigmaSheet(sigmaXlsxBuild(rows,meta,images),(meta&&meta.sheetName)||DEFAULT_SIGMA_SHEET);
/* Chỉ số style (thứ tự phải khớp với mảng xfs trong ReportXlsx.styles bên dưới). */
const RXST={TITLE:1,SUB:2,SECTION:3,LABEL:4,VAL:5,TH:6,TD:7,TDL:8,NOTE:9,REJ:10,WARN:11};
/* Bộ ghi .xlsx TỔNG QUÁT (khác SigmaXlsx vốn cứng theo layout Sigma): nhận một "doc"
   gồm cols (độ rộng cột), rows (mảng các hàng, mỗi hàng là mảng ô {v,s[,num]} hoặc
   null=ô trống), merges, rowHeights và images (ảnh PNG neo theo hàng row0 0-based).
   Dùng cho báo cáo nội kiểm theo ngày (giống bảng của báo cáo in) kèm biểu đồ LJ. */
const ReportXlsx=(()=>{
  const {u8,escX,zip,emu,COLS,cellStr,cellNum}=XlsxCore;
  const styles=()=>{
    const fonts=[
      '<font><sz val="9"/><name val="Arial"/><color rgb="FF16202B"/></font>',                 /*0 thường*/
      '<font><b/><sz val="9"/><name val="Arial"/><color rgb="FF16202B"/></font>',              /*1 đậm*/
      '<font><b/><sz val="12"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>',             /*2 tiêu đề mục (trắng)*/
      '<font><b/><sz val="15"/><name val="Arial"/><color rgb="FF16202B"/></font>',             /*3 tiêu đề lớn*/
      '<font><sz val="9"/><name val="Arial"/><color rgb="FF647686"/></font>',                  /*4 phụ đề xám*/
      '<font><b/><sz val="9"/><name val="Arial"/><color rgb="FF244452"/></font>',              /*5 nhãn/th*/
      '<font><i/><sz val="9"/><name val="Arial"/><color rgb="FF647686"/></font>'];             /*6 ghi chú nghiêng*/
    const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'];
    ['0E8F8F','E7F1F4','FFFFFF','FDECEA','FFF6E5'].forEach(c=>fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF'+c+'"/></patternFill></fill>'));
    /* fillId: 2=teal 3=E7F1F4 4=trắng 5=đỏ nhạt 6=vàng nhạt */
    const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>','<border><left style="thin"><color rgb="FFCBD8DF"/></left><right style="thin"><color rgb="FFCBD8DF"/></right><top style="thin"><color rgb="FFCBD8DF"/></top><bottom style="thin"><color rgb="FFCBD8DF"/></bottom><diagonal/></border>'];
    const xf=(f,fl,b,ha,va,wrap)=>'<xf numFmtId="0" fontId="'+f+'" fillId="'+fl+'" borderId="'+b+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment'+(ha?' horizontal="'+ha+'"':'')+(va?' vertical="'+va+'"':'')+(wrap?' wrapText="1"':'')+'/></xf>';
    const xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
      xf(3,0,0,'center','center',0), /*1 TITLE*/
      xf(4,0,0,'center','center',1), /*2 SUB*/
      xf(2,2,0,'left','center',0),   /*3 SECTION*/
      xf(5,3,1,'left','center',1),   /*4 LABEL*/
      xf(0,4,1,'left','center',1),   /*5 VAL*/
      xf(5,3,1,'center','center',1), /*6 TH*/
      xf(0,4,1,'center','center',0), /*7 TD*/
      xf(0,4,1,'left','center',1),   /*8 TDL*/
      xf(6,0,0,'left','center',1),   /*9 NOTE*/
      xf(1,5,1,'center','center',0), /*10 REJ*/
      xf(1,6,1,'center','center',0)];/*11 WARN*/
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };
  const sheetXml=(doc)=>{
    const colsXml='<cols>'+doc.cols.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>';
    const body=doc.rows.map((cells,ri)=>{
      const rn=ri+1,ht=doc.rowHeights&&doc.rowHeights[rn];
      const cs=(cells||[]).map((cell,ci)=>{if(!cell)return '';const ref=COLS[ci]+rn;return cell.num?cellNum(ref,cell.s,cell.v):cellStr(ref,cell.s,cell.v);}).join('');
      return '<row r="'+rn+'"'+(ht?' ht="'+ht+'" customHeight="1"':'')+'>'+cs+'</row>';
    }).join('');
    const lastRow=doc.rows.length||1,lastCol=COLS[doc.cols.length-1],merges=doc.merges||[];
    const mergeXml=merges.length?'<mergeCells count="'+merges.length+'">'+merges.map(m=>'<mergeCell ref="'+m+'"/>').join('')+'</mergeCells>':'';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:'+lastCol+lastRow+'"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>'+colsXml+'<sheetData>'+body+'</sheetData>'+mergeXml+'<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>'+(doc.hasDrawing?'<drawing r:id="rId1"/>':'')+'</worksheet>';
  };
  const drawingXml=(images)=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+images.map((img,i)=>{const cx=emu(img.dispW),cy=emu(img.dispH);return '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+img.row0+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="'+cx+'" cy="'+cy+'"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="'+(i+1)+'" name="Chart'+(i+1)+'"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId'+(i+1)+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';}).join('')+'</xdr:wsDr>';
  const build=(doc)=>{
    const images=(doc.images||[]).filter(im=>im&&im.bytes&&im.bytes.length);
    const hasDraw=images.length>0;doc={...doc,hasDrawing:hasDraw};
    const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+(hasDraw?'<Default Extension="png" ContentType="image/png"/>':'')+'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+(hasDraw?'<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':'')+'</Types>';
    const files=[{name:'[Content_Types].xml',data:u8(ct)},{name:'_rels/.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')},{name:'xl/workbook.xml',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+escX(doc.sheetName||'Báo cáo')+'" sheetId="1" r:id="rId1"/></sheets></workbook>')},{name:'xl/_rels/workbook.xml.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')},{name:'xl/styles.xml',data:u8(styles())},{name:'xl/worksheets/sheet1.xml',data:u8(sheetXml(doc))}];
    if(hasDraw){
      files.push({name:'xl/worksheets/_rels/sheet1.xml.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>')});
      files.push({name:'xl/drawings/drawing1.xml',data:u8(drawingXml(images))});
      let rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      images.forEach((im,i)=>rels+='<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image'+(i+1)+'.png"/>');
      files.push({name:'xl/drawings/_rels/drawing1.xml.rels',data:u8(rels+'</Relationships>')});
      images.forEach((im,i)=>files.push({name:'xl/media/image'+(i+1)+'.png',data:im.bytes}));
    }
    return zip(files);
  };
  return{build};
})();
/* Dựng "doc" cho ReportXlsx từ đúng dữ liệu của báo cáo in (printReport trong reports.js):
   bảng thông tin đơn vị, biểu đồ LJ tổng hợp (nếu ≥2 mức), rồi từng mức: biểu đồ LJ,
   bảng Mean/SD/CV/Bias/TE/Sigma, bảng điểm, điểm vi phạm; cuối cùng là nhật ký khắc phục.
   Cần DOM để render biểu đồ (ljDataURL/ljMultiDataURL) nên chỉ chạy trong trình duyệt. */
function reportXlsxDoc(tid,start,end){
  const t=state.tests.find(x=>x.id===tid);if(!t)return null;
  const ST=RXST,NCOL=10,LASTCOL='J',CHART_W=930,CHART_H=Math.round(930*430/1400),ROW_PX=17;
  const inMonth=p=>(!start||p.date>=start)&&(!end||p.date<=end),wg=activeWestgard(t);
  const teaVal=typeof sgTea==='function'?sgTea(t):(t.tea||0);
  const teaSourceText=typeof sgTeaLabel==='function'?sgTeaLabel(sgTeaSource(t)):'Ricos / Westgard biological variation';
  const rows=[],merges=[],images=[],rowHeights={};let R=0;
  const S=(v,s)=>({v,s}),Nn=(v,s)=>({v,s,num:true});
  const n1=v=>Number.isFinite(v)?Number(Number(v).toFixed(1)):'',n2=v=>Number.isFinite(v)?Number(Number(v).toFixed(2)):'',n3=v=>Number.isFinite(v)?Number(Number(v).toFixed(3)):'';
  const push=cells=>{rows.push(cells);return ++R;};                       // trả về số hàng 1-based vừa thêm
  const fullMerge=r=>merges.push('A'+r+':'+LASTCOL+r);
  const blank=()=>push([]);
  const section=txt=>{const r=push([S(txt,ST.SECTION)]);fullMerge(r);rowHeights[r]=21;};
  const note=txt=>{const r=push([S(txt,ST.NOTE)]);fullMerge(r);rowHeights[r]=Math.min(60,14+Math.ceil(String(txt).length/95)*13);};
  const imgBytes=typeof sigmaDataURLBytes==='function'?sigmaDataURLBytes:null;
  const chart=durl=>{if(!durl||!imgBytes)return;const row0=R;let bytes;try{bytes=imgBytes(durl);}catch(e){return;}images.push({bytes,dispW:CHART_W,dispH:CHART_H,row0});const spacer=Math.ceil(CHART_H/ROW_PX)+1;for(let i=0;i<spacer;i++)blank();};
  // ---- Tiêu đề + thông tin đơn vị (bám theo báo cáo in: tiêu đề căn giữa, thanh app/luật, bảng meta cân đối) ----
  const appMeta=window.QCLAB_APP||{},rulesStr=Object.entries(state.westgardRules||{}).filter(x=>x[1]!==false).map(x=>x[0]).join(', ')||'Chưa cấu hình';
  let r=push([S('BÁO CÁO NỘI KIỂM CHẤT LƯỢNG XÉT NGHIỆM',ST.TITLE)]);fullMerge(r);rowHeights[r]=24;
  const brandLine=(state.lab.name||'BỆNH VIỆN / ĐƠN VỊ')+' · '+(state.lab.dept||'Khoa Xét nghiệm')+(state.lab.address?' · '+state.lab.address:'')+'   ·   Xuất '+formatDateTimeVN(new Date().toISOString())+' · Người xuất: '+userName();
  r=push([S(brandLine,ST.SUB)]);fullMerge(r);rowHeights[r]=brandLine.length>120?29:15;
  blank();
  // Mỗi hàng meta: nhãn A:B | giá trị C:F | nhãn2 G:H | giá trị2 I:J — cùng một lưới cân đối.
  // Mọi ô trong vùng gộp phải mang style có viền, nếu không Excel bỏ vẽ cạnh của ô gộp (nhìn như bị cắt viền).
  const metaRow=(l1,v1,l2,v2)=>{const rr=push([S(l1,ST.LABEL),S('',ST.LABEL),S(v1,ST.VAL),S('',ST.VAL),S('',ST.VAL),S('',ST.VAL),S(l2,ST.LABEL),S('',ST.LABEL),S(v2,ST.VAL),S('',ST.VAL)]);merges.push('A'+rr+':B'+rr,'C'+rr+':F'+rr,'G'+rr+':H'+rr,'I'+rr+':J'+rr);rowHeights[rr]=21;};
  const metaWide=(l,v)=>{const cells=[S(l,ST.LABEL),S('',ST.LABEL),S(v,ST.VAL)];for(let i=0;i<7;i++)cells.push(S('',ST.VAL));const rr=push(cells);merges.push('A'+rr+':B'+rr,'C'+rr+':J'+rr);rowHeights[rr]=Math.min(54,18+Math.ceil(String(v).length/110)*12);};
  metaRow('Phiên bản app',(appMeta.name||'QC Lab')+' '+(appMeta.version||'dev'),'Bộ luật áp dụng',rulesStr);
  metaRow('Xét nghiệm',testDisplayName(t)+(t.unit?' · '+t.unit:''),'Máy',t.machine||'');
  metaRow('Khoảng ngày',reportRangeText(start,end),'TEa%',teaVal||'—');
  metaWide('Nguồn TEa',teaSourceText+(typeof sgTeaRefText==='function'&&sgTeaRefText(t)?' · '+sgTeaRefText(t):'')+(t.teaDoc?' · '+t.teaDoc:'')+(t.teaApprovedBy?' · duyệt '+t.teaApprovedBy:''));
  metaWide('Ghi chú Sigma','Sigma (kỳ) tính từ Mean/CV thực tế trong đúng khoảng ngày báo cáo này, khác với Sigma đã thẩm định ở trang Six Sigma & Sai số. Dấu * nghĩa là kỳ có n < 20 kết quả, CV/Sigma chưa đủ ổn định.');
  // ---- Biểu đồ LJ tổng hợp (nếu có ≥2 mức có điểm) ----
  const multiViews=operationalLevels(t).map(l=>({level:l.level,lot:l.lot,mean:l.mean,sd:l.sd,pts:operationalLotPoints(t,l.level).filter(inMonth),label:'M'+l.level+'·'+(l.lot||'?')}));
  if(multiViews.filter(v=>v.pts.length).length>=2){blank();section('Levey-Jennings tổng hợp theo Z-score');chart(typeof ljMultiDataURL==='function'?ljMultiDataURL(multiViews,t):null);}
  // ---- Bảng ô cho từng mục ----
  const mergePairs=(r,pairs)=>pairs.forEach(([a,b])=>merges.push(a+r+':'+b+r));
  const statsHeader=()=>{const r=push([S('n',ST.TH),S('Mean thực',ST.TH),S('',ST.TH),S('SD',ST.TH),S('CV%',ST.TH),S('Bias%',ST.TH),S('TE%',ST.TH),S('TEa%',ST.TH),S('Sigma (kỳ)',ST.TH),S('',ST.TH)]);mergePairs(r,[['B','C'],['I','J']]);rowHeights[r]=18;};
  const statsRow=(st,bias,te,sigma)=>{const sg=sigma==null?S('—',ST.TD):(st.n<20?S(fmt(sigma,1)+' *',ST.TD):Nn(n1(sigma),ST.TD)),r=push([Nn(st.n,ST.TD),Nn(n2(st.m),ST.TD),S('',ST.TD),Nn(n3(st.sd),ST.TD),Nn(n2(st.cv),ST.TD),Nn(n2(bias),ST.TD),Nn(n2(te),ST.TD),(teaVal?Nn(n2(teaVal),ST.TD):S('—',ST.TD)),sg,S('',ST.TD)]);mergePairs(r,[['B','C'],['I','J']]);};
  const pointsHeader=()=>{const r=push([S('Ngày',ST.TH),S('',ST.TH),S('Lần chạy',ST.TH),S('',ST.TH),S('NV',ST.TH),S('Giá trị',ST.TH),S('Z',ST.TH),S('Kết luận',ST.TH),S('Luật / bằng chứng',ST.TH),S('',ST.TH)]);mergePairs(r,[['A','B'],['C','D'],['I','J']]);rowHeights[r]=18;};
  const pointsRow=o=>{const rules=[...new Set(o.f.rules||[])],support=[...new Set(o.f.supportRules||[])].filter(rule=>!rules.includes(rule)),ruleText=rules.join(', ')||(support.length?'Bằng chứng: '+support.join(', '):'—'),staff=pointStaff(o.p),vs=o.f.level==='rej'?ST.REJ:o.f.level==='warn'?ST.WARN:ST.TD,r=push([S(vnDate(o.p.date),ST.TD),S('',ST.TD),S(o.p.runId||'—',ST.TD),S('',ST.TD),S(staff.code||'—',ST.TD),Nn(Number.isFinite(o.p.val)?o.p.val:'',ST.TD),S((o.z>=0?'+':'')+fmt(o.z)+'s',ST.TD),S(stateName(o.f.level),vs),S(ruleText,ST.TDL),S('',ST.TDL)]);mergePairs(r,[['A','B'],['C','D'],['I','J']]);};
  const violHeader=()=>{const r=push([S('Ngày',ST.TH),S('',ST.TH),S('NV',ST.TH),S('Giá trị',ST.TH),S('Z',ST.TH),S('Luật',ST.TH),S('',ST.TH),S('Loại sai số',ST.TH),S('',ST.TH),S('',ST.TH)]);mergePairs(r,[['A','B'],['F','G'],['H','J']]);rowHeights[r]=18;};
  const violRow=o=>{const rules=[...new Set(o.f.rules||[])],r=push([S(vnDate(o.p.date),ST.TD),S('',ST.TD),S(pointStaff(o.p).code||'—',ST.TD),Nn(Number.isFinite(o.p.val)?o.p.val:'',ST.TD),S((o.z>=0?'+':'')+fmt(o.z)+'s',ST.TD),S(rules.join(', '),ST.WARN),S('',ST.WARN),S(errorType(rules),ST.TDL),S('',ST.TDL),S('',ST.TDL)]);mergePairs(r,[['A','B'],['F','G'],['H','J']]);};
  // ---- Từng mức ----
  operationalLevels(t).forEach(l=>{
    (typeof previousLotSeries==='function'?previousLotSeries(t,l.level):[]).forEach(s=>{
      const inPts=s.pts.filter(inMonth);if(!inPts.length)return;
      const wgP=QCCore.westgardByPoint(s.pts,s.mean,s.sd,rule=>testRuleOnWithin(t,rule)),idxOf=new Map(s.pts.map((p,i)=>[p.id,i]));
      blank();section('Mức '+l.level+' — Lô cũ '+(s.lot||'?')+' · đã chuyển tiếp (Mean='+fmt(s.mean)+', SD='+fmt(s.sd,3)+')');
      note('Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).');
      chart(typeof ljDataURL==='function'?ljDataURL(inPts,s.mean,s.sd):null);
      const stat=reportLevelStats(inPts,s.mean,teaVal);statsHeader();statsRow(stat.st,stat.bias,stat.te,stat.sigma);
      const allS=inPts.map(p=>{const i=idxOf.get(p.id),raw=wgP.F[i]||{rules:[]},f={...raw,level:ruleResultLevel(t,raw.rules||[])},z=wgP.zs[i];return{p,f,z};});
      blank();pointsHeader();allS.forEach(pointsRow);
      const violS=allS.filter(o=>o.f.level!=='ok');
      if(violS.length){blank();violHeader();violS.forEach(violRow);}
    });
    const pts=operationalLotPoints(t,l.level).filter(inMonth);
    blank();section('Mức '+l.level+' — Lô '+(l.lot||'?')+' · Dải '+(l.applied==='lab'?'PXN':'NSX')+' (Mean='+fmt(l.mean)+', SD='+fmt(l.sd,3)+')');
    if(!pts.length){note('Không có dữ liệu trong khoảng ngày đã chọn.');return;}
    chart(typeof ljDataURL==='function'?ljDataURL(pts,l.mean,l.sd):null);
    const stat=reportLevelStats(pts,l.mean,teaVal);statsHeader();statsRow(stat.st,stat.bias,stat.te,stat.sigma);
    const all=pts.map(p=>{const f=wg.byPoint.get(p.id)||{level:'ok',rules:[],z:(p.val-l.mean)/l.sd};return{p,f,z:f.z};});
    blank();pointsHeader();all.forEach(pointsRow);
    const viol=all.filter(o=>o.f.level!=='ok');
    if(viol.length){blank();violHeader();viol.forEach(violRow);}
  });
  // ---- Nhật ký khắc phục ----
  const acts=(state.actions||[]).filter(a=>a.testId===tid&&inMonth(a));
  if(acts.length){
    blank();section('Hành động khắc phục trong khoảng ngày đã chọn');
    push([S('Ngày',ST.TH),S('Mức / lô',ST.TH),S('Luật',ST.TH),S('Loại SS',ST.TH),S('Hành động',ST.TH),S('Người',ST.TH),S('QC chạy lại',ST.TH),S('Duyệt',ST.TH),S('Khép vòng',ST.TH),S('Ý kiến',ST.TH)]);
    acts.forEach(a=>{const wf=typeof actionWorkflowStatus==='function'?actionWorkflowStatus(a):{complete:false,label:'Chưa hoàn tất'},rr=typeof actionRerunStatus==='function'?actionRerunStatus(a):{label:''},protocol=typeof actionProtocolSummary==='function'?actionProtocolSummary(a):'';push([S((a.nceId?a.nceId+'\n':'')+vnDate(a.date),ST.TD),S(actionLevelShort(t,a.level,a.lot),ST.TD),S(a.rule||'',ST.TD),S(a.errorType||'',ST.TD),S((a.action||a.correction||'')+(protocol?'\n'+protocol:''),ST.TDL),S(a.by||'',ST.TD),S(rr.label||'',ST.TD),S((typeof actionApprovalLabel==='function'?actionApprovalLabel(a):(a.approvalStatus||'pending'))+(a.approvedBy?' ('+a.approvedBy+')':''),ST.TD),S(wf.label||'Chưa hoàn tất',ST.TD),S(a.approvalNote||'',ST.TDL)]);});
  }
  blank();const sr=push([S('Người thực hiện — Người kiểm tra — Phụ trách khoa (ký, ghi rõ họ tên)',ST.NOTE)]);fullMerge(sr);
  return{sheetName:'Báo cáo nội kiểm',cols:[8,12,12,10,10,10,13,13,17,22].slice(0,NCOL),rows,merges,rowHeights,images};
}
async function exportReportXLSX(){
  const tid=document.getElementById('rTest').value,{start,end}=typeof reportDateRange==='function'?reportDateRange():{start:'',end:''};
  const t=state.tests.find(x=>x.id===tid);if(!t)return;
  let doc;try{doc=reportXlsxDoc(tid,start,end);}catch(e){await infoDialog('Không thể tạo báo cáo Excel:\n'+(e&&e.message?e.message:e));return;}
  if(!doc)return;
  try{const bytes=ReportXlsx.build(doc),label=start||end?(start||'batdau')+'_'+(end||'hientai'):'toanbo';downloadBlob('Bao_cao_IQC_'+safeName(t.name)+'_'+safeName(label)+'.xlsx',new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));}
  catch(e){await infoDialog('Không thể xuất Excel:\n'+(e&&e.message?e.message:e));}
}
/* Bản Excel chuyên biệt của trang Phân tích Westgard: bám đúng lô/mức đang xem.
   Không xuất toàn bộ điểm bình thường vì một lô có thể có hàng nghìn kết quả; chỉ giữ
   điểm cảnh báo/loại và điểm lịch sử đang làm bằng chứng cho một quy tắc. */
function westgardXlsxDoc(tid){
  const t=state.tests.find(x=>x.id===tid);if(!t)return null;
  const wg=activeWestgard(t);if(!wg.views.length)return null;
  const ST=RXST,LASTCOL='I',CHART_W=900,CHART_H=Math.round(900*430/1400),ROW_PX=17,rows=[],merges=[],images=[],rowHeights={};let R=0;
  const S=(v,s)=>({v,s}),Nn=(v,s)=>({v,s,num:true}),push=cells=>{rows.push(cells);return ++R;},blank=()=>push([]),fullMerge=r=>merges.push('A'+r+':'+LASTCOL+r);
  const section=txt=>{const r=push([S(txt,ST.SECTION)]);fullMerge(r);rowHeights[r]=21;};
  const note=txt=>{const r=push([S(txt,ST.NOTE)]);fullMerge(r);rowHeights[r]=Math.min(60,14+Math.ceil(String(txt).length/90)*13);};
  const metaRow=(l1,v1,l2,v2)=>{const r=push([S(l1,ST.LABEL),S('',ST.LABEL),S(v1,ST.VAL),S('',ST.VAL),S('',ST.VAL),S(l2,ST.LABEL),S('',ST.LABEL),S(v2,ST.VAL),S('',ST.VAL)]);merges.push('A'+r+':B'+r,'C'+r+':E'+r,'F'+r+':G'+r,'H'+r+':I'+r);rowHeights[r]=21;};
  const metaWide=(l,v)=>{const r=push([S(l,ST.LABEL),S('',ST.LABEL),S(v,ST.VAL),S('',ST.VAL),S('',ST.VAL),S('',ST.VAL),S('',ST.VAL),S('',ST.VAL),S('',ST.VAL)]);merges.push('A'+r+':B'+r,'C'+r+':I'+r);rowHeights[r]=Math.min(48,18+Math.ceil(String(v).length/105)*12);};
  const chart=durl=>{if(!durl||typeof sigmaDataURLBytes!=='function')return;let bytes;try{bytes=sigmaDataURLBytes(durl);}catch(e){return;}images.push({bytes,dispW:CHART_W,dispH:CHART_H,row0:R});for(let i=0;i<Math.ceil(CHART_H/ROW_PX)+1;i++)blank();};
  const app=window.QCLAB_APP||{},machine=instrumentName(t.instrumentId,t.machine)||t.machine||'—',withinRules=WG_RULES.filter(rule=>testRuleOnWithin(t,rule)).join(', ')||'Không có',acrossRules=WG_RULES.filter(rule=>testRuleOnAcross(t,rule)).join(', ')||'Không có';
  let r=push([S('PHÂN TÍCH WESTGARD — '+testDisplayName(t),ST.TITLE)]);fullMerge(r);rowHeights[r]=24;
  const brand=(state.lab.name||'BỆNH VIỆN / ĐƠN VỊ')+' · '+(state.lab.dept||'Khoa Xét nghiệm')+(state.lab.address?' · '+state.lab.address:'')+'   ·   Xuất '+formatDateTimeVN(new Date().toISOString())+' · Người xuất: '+userName();
  r=push([S(brand,ST.SUB)]);fullMerge(r);rowHeights[r]=brand.length>115?29:15;blank();
  metaRow('Xét nghiệm',testDisplayName(t)+(t.unit?' · '+t.unit:''),'Thiết bị',machine);
  metaRow('Phiên bản app',(app.name||'QC Lab')+' '+(app.version||'dev'),'Phạm vi','Lô/mức đang xem');
  metaWide('Luật theo từng mức',withinRules);
  metaWide('Luật liên mức / lần chạy',acrossRules);
  metaWide('Dữ liệu chi tiết','Chỉ gồm điểm cảnh báo/loại và điểm lịch sử cấu thành quy tắc; các điểm QC bình thường không được xuất.');
  const multiViews=typeof wgMultiViews==='function'?wgMultiViews(t):wg.views.map(v=>({level:v.l.level,lot:v.l.lot,mean:v.l.mean,sd:v.l.sd,pts:v.pts,label:'M'+v.l.level+'·'+(v.l.lot||'?')}));
  if(multiViews.filter(v=>v.pts&&v.pts.length).length>=2){blank();section('Levey-Jennings tổng hợp theo Z-score');chart(typeof ljMultiDataURL==='function'?ljMultiDataURL(multiViews,t):null);}
  const head=()=>push([S('#',ST.TH),S('Ngày',ST.TH),S('Lần chạy',ST.TH),S('NV',ST.TH),S('Giá trị',ST.TH),S('Z',ST.TH),S('Kết luận',ST.TH),S('Luật / bằng chứng',ST.TH),S('Loại sai số',ST.TH)]);
  const detail=(o,index)=>{const rules=[...new Set(o.f.rules||[])],support=[...new Set(o.f.supportRules||[])].filter(x=>!rules.includes(x)),evidence=!rules.length&&support.length,used=rules.length?rules:support,ruleText=rules.join(', ')||(evidence?'Bằng chứng: '+support.join(', '):'—'),verdict=evidence?'Bằng chứng':qcVerdictLabel(o.f.level),vs=o.f.level==='rej'?ST.REJ:o.f.level==='warn'?ST.WARN:ST.TD;push([Nn(index,ST.TD),S(vnDate(o.p.date),ST.TD),S(o.p.runId||'—',ST.TD),S(pointStaff(o.p).code||'—',ST.TD),Nn(Number.isFinite(o.p.val)?o.p.val:'',ST.TD),S((o.z>=0?'+':'')+fmt(o.z)+'s',ST.TD),S(verdict,vs),S(ruleText,ST.TDL),S(used.length?errorType(used):'—',ST.TDL)]);};
  wg.views.forEach(v=>{
    const l=v.l,prev=wgPrevOpen.has(t.id+'|'+l.level)&&(typeof previousLotSeries==='function'?previousLotSeries(t,l.level):[])[0],series=prev||{lot:l.lot,mean:l.mean,sd:l.sd,pts:v.pts},isPrev=!!prev;
    let all;if(isPrev){const calc=QCCore.westgardByPoint(series.pts,series.mean,series.sd,rule=>testRuleOnWithin(t,rule));all=series.pts.map((p,i)=>{const raw=calc.F[i]||{rules:[],supportRules:[]},f={...raw,level:ruleResultLevel(t,raw.rules||[])};return{p,f,z:calc.zs[i]};});}
    else all=series.pts.map(p=>{const f=wg.byPoint.get(p.id)||{level:'ok',rules:[],supportRules:[],z:(p.val-series.mean)/series.sd};return{p,f,z:f.z};});
    const relevant=all.filter(o=>o.f.level!=='ok'||(o.f.supportRules||[]).length),pointIndex=new Map(series.pts.map((p,i)=>[p.id,i+1]));
    blank();section('Mức '+l.level+' — '+(isPrev?'Lô cũ ':'Lô ')+(series.lot||'?')+(isPrev?' · đã chuyển tiếp':'')+' (Mean='+fmt(series.mean)+', SD='+fmt(series.sd,3)+')');
    if(isPrev)note('Lô cũ chỉ được đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).');
    if(!series.pts.length){note('Chưa có dữ liệu QC ở mức này.');return;}
    chart(typeof ljDataURL==='function'?ljDataURL(series.pts,series.mean,series.sd):null);
    note('Tổng '+series.pts.length+' điểm · Xuất '+relevant.length+' điểm vi phạm/bằng chứng.');
    if(!relevant.length){note('Không có điểm vi phạm/cảnh báo hoặc điểm bằng chứng ở lô này.');return;}
    head();relevant.forEach(o=>detail(o,pointIndex.get(o.p.id)||1));
  });
  blank();r=push([S('Người thực hiện — Người kiểm tra — Phụ trách khoa (ký, ghi rõ họ tên)',ST.NOTE)]);fullMerge(r);
  return{sheetName:'Phân tích Westgard',cols:[7,12,14,9,12,9,15,23,22],rows,merges,rowHeights,images};
}
async function exportWestgardXLSX(){
  const t=state.tests.find(x=>x.id===selTest);if(!t){await infoDialog('Chưa chọn được xét nghiệm để xuất Excel.');return;}
  let doc;try{doc=westgardXlsxDoc(t.id);}catch(e){await infoDialog('Không thể tạo báo cáo Westgard Excel:\n'+(e&&e.message?e.message:e));return;}
  if(!doc){await infoDialog('Xét nghiệm này chưa có mức QC đang vận hành để xuất Excel.');return;}
  try{const bytes=ReportXlsx.build(doc);downloadBlob('Phan_tich_Westgard_'+safeName(t.name)+'.xlsx',new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));}
  catch(e){await infoDialog('Không thể xuất Excel:\n'+(e&&e.message?e.message:e));}
}
function sigmaExportMeta(){const app=window.QCLAB_APP||{},rules=Object.entries(state.westgardRules||{}).filter(x=>x[1]!==false).map(x=>x[0]).join(', ')||'Chưa cấu hình';return{app,rules};}
function sigmaTeaTrace(rows){
  const groups=new Map();(rows||[]).forEach(r=>{const head=[r.teaLabel||r.teaSource||'TEa',r.teaSourceVersion||''].filter(Boolean).join(' '),trace=[head,r.teaReference||'',r.teaEffectiveDate?'hiệu lực '+vnDate(r.teaEffectiveDate):''].filter(Boolean).join(' · '),period=sigmaPeriodLabel(r.period);if(!groups.has(trace))groups.set(trace,new Set());groups.get(trace).add(period);});
  const distinguish=groups.size>1;return[...groups.entries()].map(([trace,periods])=>trace+(distinguish?' (kỳ '+[...periods].join(', ')+')':'')).join(' | ');
}
async function buildSigmaXlsx(rows,title,subtitle,fileName,sheetName=DEFAULT_SIGMA_SHEET){
  const images=[];try{const c=drawSigmaReportChart(rows);if(c)images.push(c);const m=drawSigmaReportMDC(rows);if(m)images.push(m);}catch(e){}
  try{const bytes=SigmaXlsx.build(rows,{title,subtitle,sheetName},images);downloadBlob(fileName,new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));}
  catch(e){await infoDialog('Không thể xuất báo cáo Sigma:\n'+(e&&e.message?e.message:e));}
}
async function exportSigmaPeriodXLSX(periodId){
  const t=state.tests.find(x=>x.id===sgTest),entry=t&&sgData(t.id).find(x=>x.id===periodId);if(!t||!entry){await infoDialog('Chưa chọn được kỳ Sigma.');return;}
  const rows=sigmaReportRows(t.id,'period',entry.period,entry.id);if(!rows.length){await infoDialog('Kỳ này chưa đủ dữ liệu Sigma để xuất báo cáo.');return;}
  const {app,rules}=sigmaExportMeta(),period=vnPeriod(entry.period)||entry.period,month=String(parseInt(String(entry.period).slice(5),10)||'');
  await buildSigmaXlsx(rows,`BÁO CÁO SIX SIGMA - ${testDisplayName(t)} - ${period}`,`Nguồn: QC Lab · Xuất ${formatDateTimeVN(new Date().toISOString())} · Kỳ xuất: ${sigmaExportPeriods(rows)} · Người xuất: ${userName()} · App ${app.version||'dev'} · Bộ luật: ${rules} · Truy xuất TEa: ${sigmaTeaTrace(rows)}`,`Bao_Cao_Six_Sigma_${safeName(t.name)}_${safeName(entry.period)}.xlsx`,`Kỳ ${month}`);
}
async function exportSigmaPeriodsXLSX(){
  const t=state.tests.find(x=>x.id===sgTest);if(!t){await infoDialog('Chưa chọn xét nghiệm.');return;}
  const rows=sigmaReportRows(t.id,'all');if(!rows.length){await infoDialog('Xét nghiệm này chưa có kỳ Sigma đủ dữ liệu để xuất báo cáo.');return;}
  const {app,rules}=sigmaExportMeta();
  await buildSigmaXlsx(rows,`BÁO CÁO TỔNG HỢP SIX SIGMA THEO KỲ - ${testDisplayName(t)}`,`Nguồn: QC Lab · Xuất ${formatDateTimeVN(new Date().toISOString())} · Kỳ xuất: ${sigmaExportPeriods(rows)} · Người xuất: ${userName()} · App ${app.version||'dev'} · Bộ luật: ${rules} · Truy xuất TEa: ${sigmaTeaTrace(rows)}`,`Bao_Cao_Six_Sigma_Theo_Ky_${safeName(t.name)}.xlsx`);
}

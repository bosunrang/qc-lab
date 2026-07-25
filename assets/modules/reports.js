/* ===== REPORTS (printable) ===== */
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escAttr(s){return esc(s);}
function reportHeader(title,subtitle='Nội kiểm chất lượng xét nghiệm'){const L=state.lab,app=window.QCLAB_APP||{version:'dev',build:''},rules=Object.entries(state.westgardRules||{}).filter(x=>x[1]!==false).map(x=>x[0]).join(', ');return '<div class="rpt-head">'+
  '<div class="rpt-brand"><div><div class="rpt-hosp">'+esc(L.name||'BỆNH VIỆN / ĐƠN VỊ')+'</div><div class="rpt-dept">'+esc(L.dept||'Khoa Xét nghiệm')+'</div><div class="rpt-addr">'+esc(L.address||'')+'</div></div></div>'+
  '<div class="rpt-meta"><b>Thời gian xuất</b><span>'+formatDateTimeVN(new Date().toISOString())+'</span><b style="margin-top:5px">Người xuất</b><span>'+esc(userName())+'</span></div></div>'+
  '<table class="meta-table"><tr><th>Phiên bản app</th><td>'+esc((app.name||'QC Lab')+' '+(app.version||'dev'))+'</td><th>Bộ luật áp dụng</th><td>'+esc(rules||'Chưa cấu hình')+'</td></tr></table>'+
  '<div class="rpt-title"><div>'+title+'</div><span>'+esc(subtitle)+'</span></div>';}
function signBlock(){return '<div class="sign-grid"><div><b>Người thực hiện</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>Người kiểm tra</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>Phụ trách khoa</b><span>(Ký, ghi rõ họ tên)</span></div></div>';}
async function openPrint(title,bodyHtml,options={}){
  const w=window.open('','_blank');if(!w){await infoDialog('Trình duyệt chặn cửa sổ. Cho phép pop-up để in báo cáo.');return;}
  /* Font Manrope tự host (assets/tokens.css @font-face → assets/fonts/*.woff2),
     KHÔNG tải từ Google Fonts: phòng xét nghiệm offline vẫn phải in đúng font,
     đúng metric bố cục. Cửa sổ in là about:blank nên phải dùng URL tuyệt đối —
     đường dẫn tương đối bên trong tokens.css (fonts/...) tự phân giải theo vị
     trí file CSS nên vẫn đúng. */
  const printFontCss=new URL('assets/tokens.css',location.href).href;
  /* Desktop (Electron): chỉ 1 nút "Lưu PDF" → opener.qcPrintPdf.save() → main
     process printToPDF (đường in headless CHUẨN, tôn trọng @media print/@page)
     rồi hộp thoại lưu file — dứt điểm lỗi hộp thoại in hệ thống của
     Electron/Windows raster bằng CSS màn hình và phủ nền xám kín trang PDF.
     Token ghép đúng cửa sổ in khi mở nhiều popup. Trình duyệt thường: window.print()
     như cũ. (In giấy từ desktop không cần — user xác nhận 2026-07-24; hạ tầng
     qc-print:paper vẫn giữ để Ctrl+P trong popup không bị nền xám.) */
  const printToken='qp'+Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36);
  const btns=window.qcPrintPdf
    ?'<button class="print-btn" onclick="qcSavePdf()">Lưu PDF</button>'
    :'<button class="print-btn" onclick="qcDoPrint()">In / Lưu PDF</button>';
  w.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>'+esc(title)+'</title><link rel="stylesheet" href="'+printFontCss+'"><style>'+
    '@page{size:'+(options.landscape?'A4 landscape':'A4')+';margin:13mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:"Manrope",Arial,Helvetica,sans-serif;color:#14202b;margin:0;background:#eef2f5;font-size:12px;line-height:1.42}'+
    '.page{max-width:1120px;margin:18px auto;background:#fff;padding:22px 26px 28px;border:1px solid #dce3e9;box-shadow:0 10px 30px rgba(20,33,43,.08)}'+
    '.rpt-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:2px solid #14202b;padding-bottom:12px;margin-bottom:14px}.rpt-brand{display:flex;gap:12px;align-items:center}.rpt-hosp{font-size:15px;font-weight:850}.rpt-dept{font-weight:700;margin-top:1px}.rpt-addr{font-size:11px;color:#647686;margin-top:1px}.rpt-meta{text-align:right;color:#647686;font-size:11px}.rpt-meta b{display:block;color:#14202b}.rpt-title{text-align:center;margin:12px 0 16px}.rpt-title div{font-size:19px;font-weight:850;text-transform:uppercase;letter-spacing:.02em}.rpt-title span{display:block;font-size:11px;color:#647686;margin-top:3px}'+
    '.rpt-card{border:1px solid #dce3e9;border-radius:8px;margin:12px 0 14px;overflow:hidden;background:#fff}.rpt-card h3{margin:0;padding:10px 12px;background:#0e8f8f;color:#fff;border-bottom:1px solid #0b7777;font-size:14px;font-weight:800}.rpt-card .body{padding:12px}h3{margin:16px 0 8px;padding:9px 10px;border:1px solid #0b7777;border-radius:7px;background:#0e8f8f;color:#fff;font-size:14px;font-weight:800}.meta-table th{width:16%;background:#e7f1f4;color:#244452}.soft-note{color:#647686;font-style:italic;margin:8px 0 0}.chart-img,.page img{display:block;width:100%;max-height:360px;object-fit:contain;border:1px solid #dce3e9;border-radius:6px;background:#fff;margin:0 auto 10px}'+
    'table{width:100%;border-collapse:separate;border-spacing:0;margin:0 0 8px;border:1px solid #dce3e9;border-radius:7px;overflow:hidden}th,td{padding:7px 9px;text-align:center;border-bottom:1px solid #eef2f5}tr:last-child td{border-bottom:none}th{background:#e7f1f4;color:#244452;font-size:11px;font-weight:800}td.num,th.num{font-variant-numeric:tabular-nums}.pill{display:inline-block;border-radius:999px;background:#e8f3f2;color:#0a6e6e;padding:2px 8px;font-weight:800;font-size:10.5px}.hint,.muted{color:#647686}.alert{display:block;margin:8px 0;padding:9px 11px;border-left:3px solid #3f7795;background:#edf5fa;border-radius:5px}.rpt-chart-grid{display:grid;grid-template-columns:1fr;gap:12px}.rpt-chart svg{display:block;width:100%;height:auto;max-height:315px}.sign-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:36px}.sign-grid div{text-align:center;padding-top:48px;border-top:1px solid #9aa8b3}.sign-grid b{display:block}.sign-grid span{font-size:11px;color:#647686;font-style:italic}.print-btn{position:fixed;top:12px;right:12px;border:none;border-radius:8px;background:#14202b;color:#fff;padding:9px 13px;font-weight:800;box-shadow:0 8px 22px rgba(20,33,43,.22);cursor:pointer}'+
    '@media print{body{background:#fff}.page{max-width:none;margin:0;padding:0;border:none;box-shadow:none}.print-btn{display:none}.rpt-card{break-inside:avoid}.chart-img{max-height:310px}}'+
    /* Electron/Windows in qua hộp thoại hệ thống raster bằng MEDIA MÀN HÌNH (bỏ
       qua @media print) → nền xám #eef2f5 + khung .page bị in vào bản giấy/PDF.
       Chế độ .printing do JS bật (click nút / beforeprint / main process) đảm
       bảo trang sạch dù đường in nào cũng đúng; printToPDF và trình duyệt thường
       vẫn ưu tiên @media print như cũ. */
    'body.printing{background:#fff}body.printing .page{max-width:none;margin:0;padding:0;border:none;box-shadow:none}body.printing .print-btn{display:none}'+
    '</style></head><body><div class="page">'+bodyHtml+'</div>'+btns+
    '<script>window.__qcPrintToken="'+printToken+'";function qcDoPrint(){document.body.classList.add("printing");if(window.opener&&opener.qcPrintPdf){opener.qcPrintPdf.printPaper(window.__qcPrintToken)}else{window.print()}}function qcSavePdf(){document.body.classList.add("printing");if(window.opener&&opener.qcPrintPdf){opener.qcPrintPdf.save(window.__qcPrintToken,document.title||"Bao-cao")}else{qcDoPrint()}}window.onbeforeprint=function(){document.body.classList.add("printing")};window.onafterprint=function(){document.body.classList.remove("printing")};</'+'script></body></html>');
  w.document.close();w.focus();
}
function sigmaPeriodPrintRows(row,levels){
  return(levels||[]).map((level,i)=>{const r=row&&row.rs&&row.rs[i];if(!r)return'<tr><td>Mức '+level+'</td><td colspan="9" class="muted">Chưa đủ CV IQC và Bias EQA/EQC để tính Sigma</td></tr>';const source=r.cvSource==='iqc-period'||r.cvSource==='iqc-cohort'?((r.n||0)+' điểm'+(r.sourceLot?' · Lô '+esc(r.sourceLot):'')):'Nhập tay',sigma=(r.classifiable?'':'≈')+fmt(r.sigma,2);return'<tr><td><b>Mức '+level+'</b></td><td class="num">'+fmt(r.tea,2)+'</td><td class="num"><b style="color:'+escAttr(r.c)+'">'+sigma+'</b></td><td><span class="pill" style="color:'+escAttr(r.c)+'">'+esc(r.label)+'</span></td><td class="num">'+fmt(r.cv,2)+'</td><td class="num">'+fmt(r.bias,2)+'</td><td class="num">'+sgFmtDPMO(r.dpmo)+'</td><td class="num">'+fmt(r.yld,4)+'%</td><td>'+source+'</td><td>'+esc(r.readinessLabel||r.cohortStatus||'—')+'</td></tr>';}).join('');
}
function sigmaPeriodsPrintRows(rows,levels){
  return(rows||[]).flatMap(row=>{const period=vnPeriod(row.e.period)||row.e.period||'?';return(levels||[]).map((level,i)=>{const r=row.rs&&row.rs[i];if(!r)return'<tr><td><b>'+esc(period)+'</b></td><td>Mức '+level+'</td><td colspan="9" class="muted">Chưa đủ CV IQC và Bias EQA/EQC để tính Sigma</td></tr>';const source=r.cvSource==='iqc-period'||r.cvSource==='iqc-cohort'?((r.n||0)+' điểm'+(r.sourceLot?' · Lô '+esc(r.sourceLot):'')):'Nhập tay',sigma=(r.classifiable?'':'≈')+fmt(r.sigma,2);return'<tr><td><b>'+esc(period)+'</b></td><td><b>Mức '+level+'</b></td><td class="num">'+fmt(r.tea,2)+'</td><td class="num"><b style="color:'+escAttr(r.c)+'">'+sigma+'</b></td><td><span class="pill" style="color:'+escAttr(r.c)+'">'+esc(r.label)+'</span></td><td class="num">'+fmt(r.cv,2)+'</td><td class="num">'+fmt(r.bias,2)+'</td><td class="num">'+sgFmtDPMO(r.dpmo)+'</td><td class="num">'+fmt(r.yld,4)+'%</td><td>'+source+'</td><td>'+esc(r.readinessLabel||r.cohortStatus||'—')+'</td></tr>';});}).join('');
}
async function printSigmaPeriod(periodId){
  const t=state.tests.find(x=>x.id===sgTest),entry=t&&sgData(t.id).find(x=>x.id===periodId);if(!t||!entry){await infoDialog('Chưa chọn được kỳ Sigma để in.');return;}
  const levels=sgVisibleLevels(t),row=sgRows(t,[entry],levels)[0],exportRows=sigmaReportRows(t.id,'period',entry.period,entry.id);if(!row||!row.rs.some(Boolean)||!exportRows.length){await infoDialog('Kỳ này chưa đủ dữ liệu Sigma để tạo báo cáo in.');return;}
  const period=vnPeriod(entry.period)||entry.period||'?',trace=sigmaTeaTrace(exportRows),valid=row.rs.some(r=>r&&r.classifiable)?[row]:[],machine=instrumentName(t.instrumentId,t.machine)||t.machine||'—';
  let body=reportHeader('BÁO CÁO SIX SIGMA — '+esc(testDisplayName(t))+' — '+esc(period),'Đánh giá hiệu năng phương pháp theo kỳ');
  body+='<table><tr><th style="width:18%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:15%">Kỳ báo cáo</th><td>'+esc(period)+'</td></tr><tr><th>Thiết bị</th><td>'+esc(machine)+'</td><th>Nguồn TEa</th><td>'+esc(trace||'Chưa có thông tin truy xuất')+'</td></tr></table>';
  body+='<div class="rpt-card"><h3>Kết quả Six Sigma theo mức QC</h3><div class="body"><table><tr><th>Mức</th><th>TEa (%)</th><th>Sigma</th><th>Xếp loại</th><th>CV IQC (%)</th><th>Bias EQA (%)</th><th>DPMO</th><th>Yield</th><th>Nguồn CV</th><th>Trạng thái dữ liệu</th></tr>'+sigmaPeriodPrintRows(row,levels)+'</table><p class="soft-note">DPMO và Yield là quy đổi tham khảo với dịch 1,5σ. CV nhập tay vẫn được tính Sigma nhưng không dùng để tự động đề xuất thiết kế QC.</p></div></div>';
  body+='<div class="rpt-card"><h3>Thiết kế QC theo Sigma (OPSpecs)</h3><div class="body">'+sgFrequencyHTML(t,row,levels)+'</div></div>';
  if(valid.length)body+='<div class="rpt-chart-grid"><div class="rpt-card rpt-chart"><h3>Biểu đồ Sigma</h3><div class="body">'+sgTrendSVG(t,valid,levels)+'</div></div><div class="rpt-card rpt-chart"><h3>Biểu đồ Quyết định Phương pháp (MDC)</h3><div class="body">'+sgMDCSVG(t,valid,levels)+'</div></div></div>';
  else body+='<p class="soft-note">Kỳ này chưa có mức đủ điều kiện phân loại để vẽ biểu đồ Sigma và MDC.</p>';
  body+=signBlock();await openPrint('Báo cáo Six Sigma — '+testDisplayName(t)+' — '+period,body,{landscape:true});
}
async function printSigmaPeriods(){
  const t=state.tests.find(x=>x.id===sgTest);if(!t){await infoDialog('Chưa chọn xét nghiệm để in.');return;}
  const levels=sgVisibleLevels(t),rows=sgRows(t,sgData(t.id),levels),exportRows=sigmaReportRows(t.id,'all');if(!rows.some(row=>row.rs.some(Boolean))||!exportRows.length){await infoDialog('Xét nghiệm này chưa có kỳ Sigma đủ dữ liệu để tạo báo cáo in tổng hợp.');return;}
  const valid=rows.filter(row=>row.rs.some(r=>r&&r.classifiable)),periods=sigmaExportPeriods(exportRows),trace=sigmaTeaTrace(exportRows),machine=instrumentName(t.instrumentId,t.machine)||t.machine||'—';
  let body=reportHeader('BÁO CÁO TỔNG HỢP SIX SIGMA THEO KỲ — '+esc(testDisplayName(t)),'So sánh hiệu năng phương pháp giữa các kỳ đánh giá');
  body+='<table><tr><th style="width:18%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:15%">Các kỳ báo cáo</th><td>'+esc(periods||'—')+'</td></tr><tr><th>Thiết bị</th><td>'+esc(machine)+'</td><th>Nguồn TEa</th><td>'+esc(trace||'Chưa có thông tin truy xuất')+'</td></tr></table>';
  body+='<div class="rpt-card"><h3>So sánh kết quả Six Sigma theo kỳ</h3><div class="body"><table><tr><th>Kỳ</th><th>Mức</th><th>TEa (%)</th><th>Sigma</th><th>Xếp loại</th><th>CV IQC (%)</th><th>Bias EQA (%)</th><th>DPMO</th><th>Yield</th><th>Nguồn CV</th><th>Trạng thái dữ liệu</th></tr>'+sigmaPeriodsPrintRows(rows,levels)+'</table><p class="soft-note">DPMO và Yield là quy đổi tham khảo với dịch 1,5σ. CV nhập tay vẫn được tính Sigma nhưng không dùng để tự động đề xuất thiết kế QC.</p></div></div>';
  if(valid.length)body+='<div class="rpt-chart-grid"><div class="rpt-card rpt-chart"><h3>Xu hướng Sigma theo kỳ</h3><div class="body">'+sgTrendSVG(t,valid,levels)+'</div></div><div class="rpt-card rpt-chart"><h3>Biểu đồ Quyết định Phương pháp (MDC)</h3><div class="body">'+sgMDCSVG(t,valid,levels)+'</div></div></div>';
  else body+='<p class="soft-note">Các kỳ hiện có chưa đủ điều kiện phân loại để vẽ biểu đồ Sigma và MDC.</p>';
  body+=signBlock();await openPrint('Báo cáo tổng hợp Six Sigma theo kỳ — '+testDisplayName(t),body,{landscape:true});
}
/* In trang Phân tích Westgard đang xem (mức/lô đang chọn, kể cả "xem lô cũ").
   Chỉ in bảng VI PHẠM/cảnh báo (không phải toàn bộ điểm) vì trang này không có
   khoảng ngày giới hạn như Báo cáo — một lô có thể có hàng nghìn điểm qua
   nhiều năm, in hết sẽ ra một bản in không thực dụng. */
async function printWestgard(){
  const t=state.tests.find(x=>x.id===selTest);if(!t){await infoDialog('Chưa chọn được xét nghiệm để in.');return;}
  const wg=activeWestgard(t);if(!wg.views.length){await infoDialog('Xét nghiệm này chưa có mức QC đang vận hành để in.');return;}
  const machine=instrumentName(t.instrumentId,t.machine)||t.machine||'—',withinRules=WG_RULES.filter(r=>testRuleOnWithin(t,r)).join(', ')||'Không có',acrossRules=WG_RULES.filter(r=>testRuleOnAcross(t,r)).join(', ')||'Không có';
  let body=reportHeader('PHÂN TÍCH WESTGARD — '+esc(testDisplayName(t)),'Đối chiếu luật theo mức QC, lô và lần chạy');
  body+='<table><tr><th style="width:20%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:18%">Thiết bị</th><td>'+esc(machine)+'</td></tr><tr><th>Luật theo từng mức</th><td colspan="3">'+esc(withinRules)+'</td></tr><tr><th>Luật liên mức / lần chạy</th><td colspan="3">'+esc(acrossRules)+'</td></tr></table>';
  const multiViews=wg.views.map(v=>({level:v.l.level,lot:v.l.lot,mean:v.l.mean,sd:v.l.sd,pts:v.pts,label:'M'+v.l.level+'·'+(v.l.lot||'?')}));
  if(multiViews.filter(v=>v.pts.length).length>=2)body+='<h3>Levey-Jennings tổng hợp theo Z-score</h3><img src="'+ljMultiDataURL(multiViews,t)+'">';
  wg.views.forEach(v=>{
    const l=v.l,prevSeries=previousLotSeries(t,l.level),prevOpen=wgPrevOpen.has(t.id+'|'+l.level);
    if(prevOpen&&prevSeries.length){
      const s=prevSeries[0],wgP=QCCore.westgardByPoint(s.pts,s.mean,s.sd,rule=>testRuleOnWithin(t,rule)),idxOf=new Map(s.pts.map((p,i)=>[p.id,i]));
      body+='<h3>Mức '+l.level+' — Lô cũ '+esc(s.lot)+' · đã chuyển tiếp (Mean='+fmt(s.mean)+', SD='+fmt(s.sd,3)+')</h3>';
      body+='<p class="soft-note">Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).</p>';
      body+='<img src="'+ljDataURL(s.pts,s.mean,s.sd)+'">';
      const viol=s.pts.map((p,i)=>{const raw=wgP.F[i]||{rules:[]};return{p,f:{...raw,level:ruleResultLevel(t,raw.rules||[])},z:wgP.zs[i]};}).filter(o=>o.f.level!=='ok');
      body+=viol.length?'<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo (lô cũ):</b></p>'+reportPointsTableHtml(viol):'<p><i>Không có điểm vi phạm/cảnh báo (lô cũ).</i></p>';
      return;
    }
    body+='<h3>Mức '+l.level+' — Lô '+esc(l.lot||'?')+' (Mean='+fmt(l.mean)+', SD='+fmt(l.sd,3)+')</h3>';
    if(!v.pts.length){body+='<p><i>Chưa có dữ liệu QC ở mức này.</i></p>';return;}
    body+='<img src="'+ljDataURL(v.pts,l.mean,l.sd)+'">';
    const viol=v.pts.map(p=>{const f=wg.byPoint.get(p.id)||{level:'ok',rules:[],z:(p.val-l.mean)/l.sd};return{p,f,z:f.z};}).filter(o=>o.f.level!=='ok');
    body+=viol.length?'<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo:</b></p>'+reportPointsTableHtml(viol):'<p><i>Không có điểm vi phạm/cảnh báo.</i></p>';
  });
  body+=signBlock();await openPrint('Phân tích Westgard — '+testDisplayName(t),body);
}
function reportPointsTableHtml(items){
  if(!items.length)return '<p><i>Không có điểm nào trong khoảng ngày đã chọn.</i></p>';
  const rows=items.map(o=>{
    const rules=[...new Set(o.f.rules||[])],support=[...new Set(o.f.supportRules||[])].filter(rule=>!rules.includes(rule)),ruleText=rules.join(', ')||(support.length?'Bằng chứng: '+support.join(', '):'—'),lv=qcVerdictLabel(o.f.level),staff=pointStaff(o.p);
    return '<tr><td>'+vnDate(o.p.date)+'</td><td>'+esc(o.p.runId||'—')+'</td><td>'+esc(staff.code||'—')+'</td><td class="num">'+fmt(o.p.val)+'</td><td class="num">'+(o.z>=0?'+':'')+fmt(o.z)+'s</td><td>'+esc(lv)+'</td><td>'+esc(ruleText)+'</td></tr>';
  }).join('');
  return '<table><tr><th>Ngày</th><th>Lần chạy</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th></tr>'+rows+'</table>';
}
async function printReport(){
  const tid=document.getElementById('rTest').value,{start,end}=typeof reportDateRange==='function'?reportDateRange():{start:'',end:''};
  const t=state.tests.find(x=>x.id===tid);if(!t)return;
  const inMonth=p=>(!start||p.date>=start)&&(!end||p.date<=end),wg=activeWestgard(t);
  let body=reportHeader('BÁO CÁO NỘI KIỂM CHẤT LƯỢNG XÉT NGHIỆM');
  const teaVal=typeof sgTea==='function'?sgTea(t):(t.tea||0),teaSourceText=typeof sgTeaLabel==='function'?sgTeaLabel(sgTeaSource(t)):'Ricos / Westgard biological variation';
  body+='<table><tr><th style="width:25%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:18%">Máy</th><td>'+esc(t.machine||'')+'</td></tr>'+
        '<tr><th>Khoảng ngày báo cáo</th><td>'+esc(reportRangeText(start,end))+'</td><th>TEa%</th><td>'+(teaVal||'—')+'</td></tr>'+
        '<tr><th>Nguồn TEa</th><td colspan="3">'+esc(teaSourceText)+(typeof sgTeaRefText==='function'&&sgTeaRefText(t)?' · '+esc(sgTeaRefText(t)):'')+(t.teaDoc?' · '+esc(t.teaDoc):'')+(t.teaEffectiveDate?' · hiệu lực '+vnDate(t.teaEffectiveDate):'')+(t.teaApprovedBy?' · duyệt '+esc(t.teaApprovedBy):'')+'</td></tr></table>';
  body+='<p class="soft-note">Cột "Sigma (kỳ)" dưới đây tính từ Mean/CV thực tế trong đúng khoảng ngày báo cáo này — khác với Sigma đã thẩm định ở trang Six Sigma &amp; Sai số (dùng CV IQC và Bias EQA/EQC đã rà soát). Hai số có thể khác nhau; dấu * bên cạnh Sigma nghĩa là kỳ này có n &lt; 20 kết quả, CV/Sigma chưa đủ ổn định để tham khảo.</p>';
  const multiViews=operationalLevels(t).map(l=>({level:l.level,lot:l.lot,mean:l.mean,sd:l.sd,pts:operationalLotPoints(t,l.level).filter(inMonth),label:'M'+l.level+'·'+(l.lot||'?')}));
  if(multiViews.filter(v=>v.pts.length).length>=2){
    body+='<h3>Levey-Jennings tổng hợp theo Z-score</h3>';
    body+='<img src="'+ljMultiDataURL(multiViews,t)+'">';
  }
  operationalLevels(t).forEach(l=>{
    (typeof previousLotSeries==='function'?previousLotSeries(t,l.level):[]).forEach(s=>{const inPts=s.pts.filter(inMonth);if(!inPts.length)return;const wgP=QCCore.westgardByPoint(s.pts,s.mean,s.sd,rule=>testRuleOnWithin(t,rule)),idxOf=new Map(s.pts.map((p,i)=>[p.id,i]));
      body+='<h3>Mức '+l.level+' — Lô cũ '+esc(s.lot)+' · đã chuyển tiếp (Mean='+fmt(s.mean)+', SD='+fmt(s.sd,3)+')</h3>';
      body+='<p class="soft-note">Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy) — phạm vi hẹp hơn lô đang dùng ở mục bên dưới.</p>';
      body+='<img src="'+ljDataURL(inPts,s.mean,s.sd)+'">';
      const{st:stS,bias:biasS,te:teS,sigma:sigmaS}=reportLevelStats(inPts,s.mean,teaVal);
      body+='<table><tr><th>n</th><th class="num">Mean thực</th><th class="num">SD</th><th class="num">CV%</th><th class="num">Bias%</th><th class="num">TE%</th><th class="num">TEa%</th><th class="num">Sigma (kỳ)</th></tr>'+
        '<tr><td>'+stS.n+'</td><td class="num">'+fmt(stS.m)+'</td><td class="num">'+fmt(stS.sd,3)+'</td><td class="num">'+fmt(stS.cv)+'</td><td class="num">'+fmt(biasS)+'</td><td class="num">'+fmt(teS)+'</td><td class="num">'+(teaVal||'—')+'</td><td class="num">'+(sigmaS==null?'—':fmt(sigmaS,1)+(stS.n<20?' *':''))+'</td></tr></table>';
      const allS=inPts.map(p=>{const i=idxOf.get(p.id),raw=wgP.F[i]||{rules:[]},f={...raw,level:ruleResultLevel(t,raw.rules||[])},z=wgP.zs[i];return{p,f,z};});
      body+='<p style="margin-top:8px"><b>Điểm trong khoảng xem (lô cũ):</b></p>'+reportPointsTableHtml(allS);
      const violS=allS.filter(o=>o.f.level!=='ok');
      if(violS.length){body+='<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo (lô cũ):</b></p><table><tr><th>Ngày</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Luật</th><th>Loại sai số</th></tr>'+
        violS.map(o=>'<tr><td>'+vnDate(o.p.date)+'</td><td>'+esc(pointStaff(o.p).code||'—')+'</td><td class="num">'+fmt(o.p.val)+'</td><td class="num">'+(o.z>=0?'+':'')+fmt(o.z)+'s</td><td>'+[...new Set(o.f.rules)].join(', ')+'</td><td>'+errorType([...new Set(o.f.rules)])+'</td></tr>').join('')+'</table>';}
      else body+='<p><i>Không có điểm vi phạm trong khoảng ngày đã chọn (lô cũ).</i></p>';
    });
    const pts=operationalLotPoints(t,l.level).filter(inMonth);
    body+='<h3>Mức '+l.level+' — Lô '+esc(l.lot||'?')+' · Dải '+(l.applied==='lab'?'PXN':'NSX')+' (Mean='+fmt(l.mean)+', SD='+fmt(l.sd,3)+')</h3>';
    if(!pts.length){body+='<p><i>Không có dữ liệu trong khoảng ngày đã chọn.</i></p>';return;}
    body+='<img src="'+ljDataURL(pts,l.mean,l.sd)+'">';
    const{st,bias,te,sigma}=reportLevelStats(pts,l.mean,teaVal);
    body+='<table><tr><th>n</th><th class="num">Mean thực</th><th class="num">SD</th><th class="num">CV%</th><th class="num">Bias%</th><th class="num">TE%</th><th class="num">TEa%</th><th class="num">Sigma (kỳ)</th></tr>'+
      '<tr><td>'+st.n+'</td><td class="num">'+fmt(st.m)+'</td><td class="num">'+fmt(st.sd,3)+'</td><td class="num">'+fmt(st.cv)+'</td><td class="num">'+fmt(bias)+'</td><td class="num">'+fmt(te)+'</td><td class="num">'+(teaVal||'—')+'</td><td class="num">'+(sigma==null?'—':fmt(sigma,1)+(st.n<20?' *':''))+'</td></tr></table>';
    const all=pts.map(p=>{const f=wg.byPoint.get(p.id)||{level:'ok',rules:[],z:(p.val-l.mean)/l.sd};return{p,f,z:f.z};});
    body+='<p style="margin-top:8px"><b>Điểm trong khoảng xem:</b></p>'+reportPointsTableHtml(all);
    const viol=all.filter(o=>o.f.level!=='ok');
    if(viol.length){body+='<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo:</b></p><table><tr><th>Ngày</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Luật</th><th>Loại sai số</th></tr>'+
      viol.map(o=>'<tr><td>'+vnDate(o.p.date)+'</td><td>'+esc(pointStaff(o.p).code||'—')+'</td><td class="num">'+fmt(o.p.val)+'</td><td class="num">'+(o.z>=0?'+':'')+fmt(o.z)+'s</td><td>'+[...new Set(o.f.rules)].join(', ')+'</td><td>'+errorType([...new Set(o.f.rules)])+'</td></tr>').join('')+'</table>';}
    else body+='<p><i>Không có điểm vi phạm trong khoảng ngày đã chọn.</i></p>';
  });
  const acts=(state.actions||[]).filter(a=>a.testId===tid&&inMonth(a));
  if(acts.length){body+='<h3>Hành động khắc phục trong khoảng ngày đã chọn</h3><table><tr><th>Ngày</th><th>Mức / lô</th><th>Luật</th><th>Loại SS</th><th>Hành động</th><th>Người</th><th>QC chạy lại</th><th>Duyệt</th><th>Khép vòng</th><th>Ý kiến</th></tr>'+
    acts.map(a=>{const wf=typeof actionWorkflowStatus==='function'?actionWorkflowStatus(a):{complete:false},rr=typeof actionRerunStatus==='function'?actionRerunStatus(a):{label:''};return '<tr><td>'+vnDate(a.date)+'</td><td>'+esc(actionLevelShort(t,a.level,a.lot))+'</td><td>'+esc(a.rule)+'</td><td>'+esc(a.errorType)+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.by)+'</td><td>'+esc(rr.label||'')+'</td><td>'+esc(typeof actionApprovalLabel==='function'?actionApprovalLabel(a):(a.approvalStatus||'pending'))+(a.approvedBy?'<br><span style="font-size:10px;color:#647686">'+esc(a.approvedBy)+'</span>':'')+'</td><td>'+esc(wf.complete?'Hoàn tất':'Chưa hoàn tất')+'</td><td>'+esc(a.approvalNote||'')+'</td></tr>';}).join('')+'</table>';}
  body+=signBlock();
  await openPrint('Báo cáo nội kiểm — '+testDisplayName(t),body);
}
async function printRangeForm(tid,level){
  const t=state.tests.find(x=>x.id===tid);const l=lvlCfg(t,level),pts=operationalLotPoints(t,level);
  const c=stats(pts.map(p=>p.val)),days=new Set(pts.map(p=>p.date)).size;if(!c){await infoDialog('Chưa đủ dữ liệu.');return;}
  let body=reportHeader('BIỂU MẪU THIẾT LẬP DẢI KIỂM SOÁT QC MỚI');
  body+='<table><tr><th style="width:25%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:18%">Mức / Lô</th><td>M'+level+' / '+esc(l.lot||'?')+'</td></tr>'+
        '<tr><th>Máy</th><td>'+esc(t.machine||'')+'</td><th>Số kết quả / ngày độc lập</th><td>'+c.n+' / '+days+'</td></tr></table>';
  body+='<h3>So sánh dải kiểm soát</h3><table><tr><th></th><th class="num">Mean</th><th class="num">SD</th><th class="num">CV%</th><th class="num">±2SD</th></tr>'+
    '<tr><td>Dải nhà sản xuất / hiện tại</td><td class="num">'+fmt(l.mean)+'</td><td class="num">'+fmt(l.sd,3)+'</td><td class="num">'+fmt(l.mean?l.sd/Math.abs(l.mean)*100:0)+'</td><td class="num">'+fmt(l.mean-2*l.sd)+' – '+fmt(l.mean+2*l.sd)+'</td></tr>'+
    '<tr><td><b>Dải PXN đề xuất</b></td><td class="num"><b>'+fmt(c.m)+'</b></td><td class="num"><b>'+fmt(c.sd,3)+'</b></td><td class="num"><b>'+fmt(c.cv)+'</b></td><td class="num"><b>'+fmt(c.m-2*c.sd)+' – '+fmt(c.m+2*c.sd)+'</b></td></tr></table>';
  body+='<img src="'+ljDataURL(pts,c.m,c.sd)+'">';
  body+='<p style="margin-top:8px"><b>Điều kiện:</b> tối thiểu 20 kết quả trên 20 ngày độc lập, cùng lô QC, không có điểm vi phạm/cảnh báo chưa xử lý; áp dụng khi hệ thống ổn định và được phê duyệt theo SOP.</p>';
  body+='<p>Kết luận: ☐ Áp dụng dải PXN mới &nbsp;&nbsp; ☐ Giữ dải nhà sản xuất</p>';
  body+=signBlock();await openPrint('Biểu mẫu thiết lập dải QC — '+testDisplayName(t),body);
}

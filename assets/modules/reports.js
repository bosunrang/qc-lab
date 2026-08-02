/* ===== REPORTS (printable) ===== */
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escAttr(s){return esc(s);}
function reportQcValue(t,value){return typeof fmtTestValue==='function'?fmtTestValue(t,value):fmt(value,3);}
/* SD/Mean thống kê: nhiều chữ số hơn giá trị đo. Fallback fmt(value,3) giữ đúng hành vi
   trước 2026-08-02 khi state.js chưa nạp (in ở document riêng). */
function reportQcStat(t,value){return typeof fmtTestStat==='function'?fmtTestStat(t,value):fmt(value,3);}
function reportQcPoint(point,t){return typeof fmtPointValue==='function'?fmtPointValue(point,t):fmt(point&&point.val,Math.max(2,Number(point&&point.valueDecimals)||0));}
function reportHeader(title,subtitle='Nội kiểm chất lượng xét nghiệm'){const L=state.lab,app=window.QCLAB_APP||{version:'dev'},rules=Object.entries(state.westgardRules||{}).filter(x=>x[1]!==false).map(x=>x[0]).join(', ');return '<div class="rpt-head">'+
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
    'table{width:100%;border-collapse:separate;border-spacing:0;margin:0 0 8px;border:1px solid #dce3e9;border-radius:7px;overflow:hidden}th,td{padding:7px 9px;text-align:center;border-bottom:1px solid #eef2f5}tr:last-child td{border-bottom:none}th{background:#e7f1f4;color:#244452;font-size:11px;font-weight:800}td.num,th.num{font-variant-numeric:tabular-nums}.pill{display:inline-block;border-radius:999px;background:#e8f3f2;color:#0a6e6e;padding:2px 8px;font-weight:800;font-size:10.5px}.hint,.muted{color:#647686}.alert{display:block;margin:8px 0;padding:9px 11px;border-left:3px solid #3f7795;background:#edf5fa;border-radius:5px}.rpt-chart-grid{display:grid;grid-template-columns:1fr;gap:12px}.rpt-chart svg{display:block;width:100%;height:auto;max-height:315px}.sign-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:36px}.sign-grid div{text-align:center;padding-top:48px;border-top:1px solid #9aa8b3}.sign-grid b{display:block}.sign-grid span{font-size:11px;color:#647686;font-style:italic}.nce-summary-table{font-size:10.5px}.nce-summary-cell{text-align:left;min-width:240px}.nce-summary div+div{margin-top:3px}.nce-summary b{color:#244452}.nce-appendix{margin-top:18px}.nce-appendix-intro{margin:0 0 12px;color:#647686}.nce-detail{margin-top:16px}.nce-detail-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}.nce-detail-head h3{flex:1;margin:0}.nce-detail-status{white-space:nowrap;font-weight:800;color:#0a6e6e;padding-top:9px}.nce-detail h4{margin:14px 0 7px;color:#244452;font-size:12px}.nce-detail-text{min-height:42px;padding:8px 10px;border:1px solid #dce3e9;border-radius:6px;background:#f8fafb;text-align:left;white-space:pre-wrap}.nce-detail-stack{display:grid;gap:7px;break-inside:avoid}.nce-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;gap:7px}.nce-detail-grid>div{display:flex;min-height:52px;padding:7px 9px;border:1px solid #dce3e9;border-radius:6px;background:#f8fafb;flex-direction:column;justify-content:center}.nce-detail-grid>div.nce-detail-wide{grid-column:1/-1}.nce-detail-grid span{display:block;color:#647686;font-size:10px}.nce-detail-grid b{display:block;margin-top:2px}.nce-check-table{table-layout:fixed}.nce-check-table th,.nce-check-table td{height:38px;padding:8px 10px;vertical-align:middle}.nce-check-table th:nth-child(1),.nce-check-table td:nth-child(1),.nce-check-table th:nth-child(3),.nce-check-table td:nth-child(3){text-align:left}.nce-check-table th:nth-child(2),.nce-check-table td:nth-child(2){text-align:center}.print-btn{position:fixed;top:12px;right:12px;border:none;border-radius:8px;background:#14202b;color:#fff;padding:9px 13px;font-weight:800;box-shadow:0 8px 22px rgba(20,33,43,.22);cursor:pointer}'+
    '@media print{body{background:#fff}.page{max-width:none;margin:0;padding:0;border:none;box-shadow:none}.print-btn{display:none}.rpt-card{break-inside:avoid}.chart-img{max-height:310px}.nce-appendix{break-before:page}.nce-detail+.nce-detail{break-before:page}.nce-detail h4{break-after:avoid-page;page-break-after:avoid}.nce-detail-grid>div,.nce-detail-text,.nce-check-table tr{break-inside:avoid}}'+
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
/* Bảng công bố độ không đảm bảo đo cho bản in. Số liệu lấy THẲNG r.mu mà sgComp()
   đã gắn — cùng một phép tính với panel MU trên trang Sigma — và chỉ rơi về sgMU()
   cho những mức chưa ra được Sigma (thiếu Bias), để bản in không bao giờ khác màn
   hình. Không tự điền 0 cho thành phần còn thiếu: cột Trạng thái phải nói ra. */
function sigmaMuCells(t,row,level,i){
  const r=row&&row.rs&&row.rs[i],mu=(r&&r.mu)||sgMU(t,row.e,level),unit=t&&t.unit||'';
  if(!mu)return'<td colspan="7" class="muted">Chưa có CV IQC — chưa lập được ngân sách MU</td>';
  const uBias=!mu.includeBias?'Không cộng':mu.uBias==null?'Chưa có Bias':fmt(mu.uBias,2),uCal=mu.uCal==null?'Chưa có CoA':fmt(mu.uCal,2);
  const abs=mu.absoluteU==null?'—':fmt(mu.absoluteU,3)+(unit?' '+esc(unit):'');
  return'<td class="num">'+fmt(mu.uRw,2)+'</td><td class="num">'+uBias+'</td><td class="num">'+uCal+'</td><td class="num">'+fmt(mu.uc,2)+'</td><td class="num"><b>'+fmt(mu.U,2)+'</b></td><td class="num">'+abs+'</td><td>'+(mu.complete?'<span class="pill">Đủ thành phần</span>':'Thiếu '+esc(mu.missing.join(', ')))+'</td>';
}
function sigmaMuPrintRows(t,row,levels){
  return(levels||[]).map((level,i)=>'<tr><td><b>Mức '+level+'</b></td>'+sigmaMuCells(t,row,level,i)+'</tr>').join('');
}
function sigmaMuPeriodsPrintRows(t,rows,levels){
  return(rows||[]).flatMap(row=>{const period=vnPeriod(row.e.period)||row.e.period||'?';
    return(levels||[]).map((level,i)=>'<tr><td><b>'+esc(period)+'</b></td><td><b>Mức '+level+'</b></td>'+sigmaMuCells(t,row,level,i)+'</tr>');}).join('');
}
function sigmaMuTrace(row,levels){
  const trace=[];
  (levels||[]).forEach(level=>{const L=(row.e.lv&&row.e.lv[level])||{};if(L.uCalBasis)trace.push('Mức '+level+' · nguồn u(cal): '+esc(L.uCalBasis));});
  const signed=(levels||[]).map(level=>(row.e.lv&&row.e.lv[level])||{}).find(L=>L.muReviewedBy||L.muReviewedDate);
  if(signed)trace.push('Người rà soát ngân sách MU: '+esc(signed.muReviewedBy||'—')+(signed.muReviewedDate?' · '+vnDate(signed.muReviewedDate):''));
  return trace;
}
const SIGMA_MU_PRINT_NOTE='<p class="soft-note">Mô hình top-down (ISO/TS 20914 · Nordtest TR 537): u(Rw) là CV% dài hạn của IQC, u(bias) = √(Bias² + u(Cref)²) từ EQA/EQC, u(cal) chép từ CoA của calibrator; u<sub>c</sub> = √(Σu²) và U = 2·u<sub>c</sub> (xấp xỉ 95%). Giới hạn MU cho phép (MAU) do SOP của đơn vị ấn định — báo cáo này không tự kết luận đạt/không đạt. Ngân sách còn thiếu thành phần không được công bố như một giá trị MU hoàn chỉnh.</p>';
function sigmaMuPrintCard(t,row,levels){
  const trace=sigmaMuTrace(row,levels);
  return'<div class="rpt-card"><h3>Độ không đảm bảo đo (MU) — ISO 15189:2022 §7.3.4</h3><div class="body">'+
    '<table><tr><th>Mức</th><th>u(Rw) %</th><th>u(bias) %</th><th>u(cal) %</th><th>u<sub>c</sub> %</th><th>U (k=2) %</th><th>U tại Mean</th><th>Trạng thái</th></tr>'+sigmaMuPrintRows(t,row,levels)+'</table>'+
    (trace.length?'<p class="hint">'+trace.join('<br>')+'</p>':'')+SIGMA_MU_PRINT_NOTE+'</div></div>';
}
async function printSigmaPeriod(periodId){
  const t=state.tests.find(x=>x.id===sgTest),entry=t&&sgData(t.id).find(x=>x.id===periodId);if(!t||!entry){await infoDialog('Chưa chọn được kỳ Sigma để in.');return;}
  const levels=sgVisibleLevels(t),row=sgRows(t,[entry],levels)[0],exportRows=sigmaReportRows(t.id,'period',entry.period,entry.id);if(!row||!row.rs.some(Boolean)||!exportRows.length){await infoDialog('Kỳ này chưa đủ dữ liệu Sigma để tạo báo cáo in.');return;}
  const period=vnPeriod(entry.period)||entry.period||'?',trace=sigmaTeaTrace(exportRows),valid=row.rs.some(r=>r&&r.classifiable)?[row]:[],machine=instrumentName(t.instrumentId,t.machine)||t.machine||'—';
  let body=reportHeader('BÁO CÁO SIX SIGMA — '+esc(testDisplayName(t))+' — '+esc(period),'Đánh giá hiệu năng phương pháp theo kỳ');
  body+='<table><tr><th style="width:18%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:15%">Kỳ báo cáo</th><td>'+esc(period)+'</td></tr><tr><th>Thiết bị</th><td>'+esc(machine)+'</td><th>Nguồn TEa</th><td>'+esc(trace||'Chưa có thông tin truy xuất')+'</td></tr></table>';
  body+='<div class="rpt-card"><h3>Kết quả Six Sigma theo mức QC</h3><div class="body"><table><tr><th>Mức</th><th>TEa (%)</th><th>Sigma</th><th>Xếp loại</th><th>CV IQC (%)</th><th>Bias EQA (%)</th><th>DPMO</th><th>Yield</th><th>Nguồn CV</th><th>Trạng thái dữ liệu</th></tr>'+sigmaPeriodPrintRows(row,levels)+'</table><p class="soft-note">DPMO và Yield là quy đổi tham khảo với dịch 1,5σ. CV nhập tay vẫn được tính Sigma nhưng không dùng để tự động đề xuất thiết kế QC.</p></div></div>';
  body+='<div class="rpt-card"><h3>Thiết kế QC theo Sigma (OPSpecs)</h3><div class="body">'+sgFrequencyHTML(t,row,levels)+'</div></div>';
  body+=sigmaMuPrintCard(t,row,levels);
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
  body+='<div class="rpt-card"><h3>Độ không đảm bảo đo (MU) theo kỳ — ISO 15189:2022 §7.3.4</h3><div class="body"><table><tr><th>Kỳ</th><th>Mức</th><th>u(Rw) %</th><th>u(bias) %</th><th>u(cal) %</th><th>u<sub>c</sub> %</th><th>U (k=2) %</th><th>U tại Mean</th><th>Trạng thái</th></tr>'+sigmaMuPeriodsPrintRows(t,rows,levels)+'</table>'+SIGMA_MU_PRINT_NOTE+'</div></div>';
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
      body+='<h3>Mức '+l.level+' — Lô cũ '+esc(s.lot)+' · đã chuyển tiếp (Mean='+reportQcValue(t,s.mean)+', SD='+reportQcStat(t,s.sd)+')</h3>';
      body+='<p class="soft-note">Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).</p>';
      body+='<img src="'+ljDataURL(s.pts,s.mean,s.sd)+'">';
      const viol=s.pts.map((p,i)=>{const raw=wgP.F[i]||{rules:[]};return{p,f:{...raw,level:ruleResultLevel(t,raw.rules||[])},z:wgP.zs[i]};}).filter(o=>o.f.level!=='ok');
      body+=viol.length?'<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo (lô cũ):</b></p>'+reportPointsTableHtml(viol,t):'<p><i>Không có điểm vi phạm/cảnh báo (lô cũ).</i></p>';
      return;
    }
    body+='<h3>Mức '+l.level+' — Lô '+esc(l.lot||'?')+' (Mean='+reportQcValue(t,l.mean)+', SD='+reportQcStat(t,l.sd)+')</h3>';
    if(!v.pts.length){body+='<p><i>Chưa có dữ liệu QC ở mức này.</i></p>';return;}
    body+='<img src="'+ljDataURL(v.pts,l.mean,l.sd)+'">';
    const viol=v.pts.map(p=>{const f=wg.byPoint.get(p.id)||{level:'ok',rules:[],z:(p.val-l.mean)/l.sd};return{p,f,z:f.z};}).filter(o=>o.f.level!=='ok');
    body+=viol.length?'<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo:</b></p>'+reportPointsTableHtml(viol,t):'<p><i>Không có điểm vi phạm/cảnh báo.</i></p>';
  });
  body+=signBlock();await openPrint('Phân tích Westgard — '+testDisplayName(t),body);
}
function reportPointsTableHtml(items,t){
  if(!items.length)return '<p><i>Không có điểm nào trong khoảng ngày đã chọn.</i></p>';
  const rows=items.map(o=>{
    const rules=[...new Set(o.f.rules||[])],support=[...new Set(o.f.supportRules||[])].filter(rule=>!rules.includes(rule)),ruleText=rules.join(', ')||(support.length?'Bằng chứng: '+support.join(', '):'—'),lv=qcVerdictLabel(o.f.level),staff=pointStaff(o.p);
    return '<tr><td>'+vnDate(o.p.date)+'</td><td>'+esc(o.p.runId||'—')+'</td><td>'+esc(staff.code||'—')+'</td><td class="num">'+reportQcPoint(o.p,t)+'</td><td class="num">'+(o.z>=0?'+':'')+fmt(o.z)+'s</td><td>'+esc(lv)+'</td><td>'+esc(ruleText)+'</td></tr>';
  }).join('');
  return '<table><tr><th>Ngày</th><th>Lần chạy</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th></tr>'+rows+'</table>';
}
/* Nội dung phiếu NCE (bóc nhãn, cắt đoạn, dựng checklist) nằm ở reportNceModel/
   reportNceSummaryParts trong data-io.js — dùng chung với bản Excel. Ở đây chỉ
   còn phần trình bày HTML. */
function reportNceSummaryHtml(a){
  return '<div class="nce-summary">'+reportNceSummaryParts(a).map(([label,text])=>'<div><b>'+esc(label)+':</b> '+esc(text)+'</div>').join('')+'</div>';
}
function reportNceDetailField(label,value,wide=false){return '<div'+(wide?' class="nce-detail-wide"':'')+'><span>'+esc(label)+'</span><b>'+esc(value||'—')+'</b></div>';}
function reportNceDetailHtml(a,t){
  const m=reportNceModel(a,t),F=reportNceDetailField;
  const checkRows=m.checks.map(([label,statusText,noteText])=>'<tr><td><b>'+esc(label)+'</b></td><td>'+esc(statusText)+'</td><td>'+esc(noteText)+'</td></tr>').join('');
  let html='<section class="nce-detail"><div class="nce-detail-head"><h3>Phiếu NCE '+esc(m.nceTitle)+'</h3><div class="nce-detail-status">'+esc(m.wfLabel)+'</div></div><div class="nce-detail-grid">'+F('Ngày xảy ra',m.eventDateText)+F('Xét nghiệm / mức / lô',m.testLevelText)+F('Luật / loại sai số',m.ruleErrText)+F('Nguồn / giai đoạn',m.sourcePhaseText)+F('Người phụ trách / hạn',m.ownerDueText)+F('Trạng thái bản ghi',m.recordStatusText)+'</div>';
  if(!m.modern)return html+'<h4>Hành động đã ghi</h4><div class="nce-detail-text">'+esc(m.legacyActionText)+'</div><h4>QC chạy lại / duyệt</h4><div class="nce-detail-grid">'+F('QC chạy lại',m.rerunText)+F('Phê duyệt',m.approvalShortText)+'</div></section>';
  html+='<h4>1. Kiểm soát và xử lý tức thời</h4><div class="nce-detail-stack"><div class="nce-detail-grid">'+F('Phạm vi kiểm soát',m.containmentText)+F('Ghi chú phạm vi',m.containmentNote)+'</div><div class="nce-detail-text">'+esc(m.correctionText)+'</div></div>';
  html+='<h4>2. Đánh giá nguy cơ ban đầu</h4><div class="nce-detail-grid">'+F('Phân loại / RPN',m.riskText)+F('S x O x D',m.sodText)+F('Căn cứ SOP',m.riskBasis,true)+'</div>';
  html+='<h4>3. Checklist điều tra</h4><table class="nce-check-table"><colgroup><col style="width:30%"><col style="width:22%"><col style="width:48%"></colgroup><tr><th>Hạng mục</th><th>Kết luận</th><th>Ghi chú / bằng chứng</th></tr>'+checkRows+'</table>';
  html+='<h4>4. Nguyên nhân và hành động khắc phục</h4><div class="nce-detail-stack"><div class="nce-detail-grid">'+F('Nhóm nguyên nhân',m.causeCategoryText)+F('Ngày hoàn thành hành động',m.actionCompletedText)+'</div><div class="nce-detail-text"><b>Nguyên nhân:</b> '+esc(m.causeText)+'\n<b>Hành động khắc phục:</b> '+esc(m.actionText)+'</div></div>';
  html+='<h4>5. Bằng chứng QC chạy lại và cho phép trở lại</h4><div class="nce-detail-grid">'+F('QC chạy lại',m.rerunText)+F('Quyết định',m.releaseText)+F('Ngày / người cho phép',m.releaseWhoText)+F('Căn cứ cho phép',m.releaseNote)+'</div>';
  html+='<h4>6. Ảnh hưởng người bệnh</h4><div class="nce-detail-grid">'+F('Kết luận',m.patientText)+F('Xử lý kết quả liên quan',m.patientAction)+'</div>';
  html+='<h4>7. Hiệu lực, nguy cơ còn lại và phê duyệt</h4><div class="nce-detail-grid">'+F('Đánh giá hiệu lực',m.effLabel)+F('Ngày / người đánh giá',m.effWhoText)+F('Bằng chứng hiệu lực',m.effNote)+F('Nguy cơ còn lại',m.residualText)+F('Căn cứ đánh giá lại',m.residualBasis)+F('Phê duyệt',m.approvalText)+F('Ý kiến duyệt',m.approvalNote,true)+'</div>';
  if(m.cancelled)html+='<h4>Thông tin hủy hồ sơ</h4><div class="nce-detail-text">'+esc(m.cancelText)+'</div>';
  return html+'</section>';
}
function reportNceAppendixHtml(actions,t){return '<div class="nce-appendix"><h3>Phụ lục - Hồ sơ NCE chi tiết</h3><p class="nce-appendix-intro">Phụ lục giữ đầy đủ nội dung điều tra, bằng chứng QC chạy lại, đánh giá hiệu lực và phê duyệt. Bảng tổng hợp phía trên chỉ trình bày thông tin trọng yếu.</p>'+actions.map(a=>reportNceDetailHtml(a,t)).join('')+'</div>';}
async function printReport(){
  const{tid,t,start,end,includeNceAppendix}=reportExportSelection();if(!t)return;
  const inMonth=reportInRange(start,end),wg=activeWestgard(t);
  let body=reportHeader('BÁO CÁO NỘI KIỂM CHẤT LƯỢNG XÉT NGHIỆM');
  const{teaVal,teaSourceText}=reportTeaInfo(t);
  body+='<table><tr><th style="width:25%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:18%">Máy</th><td>'+esc(t.machine||'')+'</td></tr>'+
        '<tr><th>Khoảng ngày báo cáo</th><td>'+esc(reportRangeText(start,end))+'</td><th>TEa%</th><td>'+(teaVal||'—')+'</td></tr>'+
        '<tr><th>Nguồn TEa</th><td colspan="3">'+esc(teaSourceText)+(typeof sgTeaRefText==='function'&&sgTeaRefText(t)?' · '+esc(sgTeaRefText(t)):'')+(t.teaDoc?' · '+esc(t.teaDoc):'')+(t.teaEffectiveDate?' · hiệu lực '+vnDate(t.teaEffectiveDate):'')+(t.teaApprovedBy?' · duyệt '+esc(t.teaApprovedBy):'')+'</td></tr></table>';
  body+='<p class="soft-note">Cột "Sigma (kỳ)" dưới đây tính từ Mean/CV thực tế trong đúng khoảng ngày báo cáo này — khác với Sigma đã thẩm định ở trang Six Sigma &amp; Sai số (dùng CV IQC và Bias EQA/EQC đã rà soát). Hai số có thể khác nhau; dấu * bên cạnh Sigma nghĩa là kỳ này có n &lt; 20 kết quả, CV/Sigma chưa đủ ổn định để tham khảo.</p>';
  const multiViews=reportMultiViews(t,inMonth);
  if(multiViews.filter(v=>v.pts.length).length>=2){
    body+='<h3>Levey-Jennings tổng hợp theo Z-score</h3>';
    body+='<img src="'+ljMultiDataURL(multiViews,t)+'">';
  }
  operationalLevels(t).forEach(l=>{
    (typeof previousLotSeries==='function'?previousLotSeries(t,l.level):[]).forEach(s=>{const{inPts,items:allS}=reportPrevLotRows(t,s,inMonth);if(!inPts.length)return;
      body+='<h3>Mức '+l.level+' — Lô cũ '+esc(s.lot)+' · đã chuyển tiếp (Mean='+reportQcValue(t,s.mean)+', SD='+reportQcStat(t,s.sd)+')</h3>';
      body+='<p class="soft-note">Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy) — phạm vi hẹp hơn lô đang dùng ở mục bên dưới.</p>';
      body+='<img src="'+ljDataURL(inPts,s.mean,s.sd)+'">';
      const{st:stS,bias:biasS,te:teS,sigma:sigmaS}=reportLevelStats(inPts,s.mean,teaVal);
      body+='<table><tr><th>n</th><th class="num">Mean thực</th><th class="num">SD</th><th class="num">CV%</th><th class="num">Bias%</th><th class="num">TE%</th><th class="num">TEa%</th><th class="num">Sigma (kỳ)</th></tr>'+
        '<tr><td>'+stS.n+'</td><td class="num">'+reportQcValue(t,stS.m)+'</td><td class="num">'+reportQcStat(t,stS.sd)+'</td><td class="num">'+fmt(stS.cv)+'</td><td class="num">'+fmt(biasS)+'</td><td class="num">'+fmt(teS)+'</td><td class="num">'+(teaVal||'—')+'</td><td class="num">'+(sigmaS==null?'—':fmt(sigmaS,1)+(stS.n<20?' *':''))+'</td></tr></table>';
      body+='<p style="margin-top:8px"><b>Điểm trong khoảng xem (lô cũ):</b></p>'+reportPointsTableHtml(allS,t);
      const violS=allS.filter(o=>o.f.level!=='ok');
      if(violS.length){body+='<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo (lô cũ):</b></p><table><tr><th>Ngày</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Luật</th><th>Loại sai số</th></tr>'+
        violS.map(o=>'<tr><td>'+vnDate(o.p.date)+'</td><td>'+esc(pointStaff(o.p).code||'—')+'</td><td class="num">'+reportQcPoint(o.p,t)+'</td><td class="num">'+(o.z>=0?'+':'')+fmt(o.z)+'s</td><td>'+[...new Set(o.f.rules)].join(', ')+'</td><td>'+errorType([...new Set(o.f.rules)])+'</td></tr>').join('')+'</table>';}
      else body+='<p><i>Không có điểm vi phạm trong khoảng ngày đã chọn (lô cũ).</i></p>';
    });
    const{pts,items:all}=reportLevelRows(t,l,wg,inMonth);
    body+='<h3>Mức '+l.level+' — Lô '+esc(l.lot||'?')+' · Dải '+(l.applied==='lab'?'PXN':'NSX')+' (Mean='+reportQcValue(t,l.mean)+', SD='+reportQcStat(t,l.sd)+')</h3>';
    if(!pts.length){body+='<p><i>Không có dữ liệu trong khoảng ngày đã chọn.</i></p>';return;}
    body+='<img src="'+ljDataURL(pts,l.mean,l.sd)+'">';
    const{st,bias,te,sigma}=reportLevelStats(pts,l.mean,teaVal);
    body+='<table><tr><th>n</th><th class="num">Mean thực</th><th class="num">SD</th><th class="num">CV%</th><th class="num">Bias%</th><th class="num">TE%</th><th class="num">TEa%</th><th class="num">Sigma (kỳ)</th></tr>'+
      '<tr><td>'+st.n+'</td><td class="num">'+reportQcValue(t,st.m)+'</td><td class="num">'+reportQcStat(t,st.sd)+'</td><td class="num">'+fmt(st.cv)+'</td><td class="num">'+fmt(bias)+'</td><td class="num">'+fmt(te)+'</td><td class="num">'+(teaVal||'—')+'</td><td class="num">'+(sigma==null?'—':fmt(sigma,1)+(st.n<20?' *':''))+'</td></tr></table>';
    body+='<p style="margin-top:8px"><b>Điểm trong khoảng xem:</b></p>'+reportPointsTableHtml(all,t);
    const viol=all.filter(o=>o.f.level!=='ok');
    if(viol.length){body+='<p style="margin-top:8px"><b>Điểm vi phạm/cảnh báo:</b></p><table><tr><th>Ngày</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Luật</th><th>Loại sai số</th></tr>'+
      viol.map(o=>'<tr><td>'+vnDate(o.p.date)+'</td><td>'+esc(pointStaff(o.p).code||'—')+'</td><td class="num">'+reportQcPoint(o.p,t)+'</td><td class="num">'+(o.z>=0?'+':'')+fmt(o.z)+'s</td><td>'+[...new Set(o.f.rules)].join(', ')+'</td><td>'+errorType([...new Set(o.f.rules)])+'</td></tr>').join('')+'</table>';}
    else body+='<p><i>Không có điểm vi phạm trong khoảng ngày đã chọn.</i></p>';
  });
  const acts=reportActionsInRange(tid,inMonth);
  if(acts.length){body+='<h3>Hành động khắc phục trong khoảng ngày đã chọn</h3><p class="soft-note">Bảng dưới đây là bản tóm tắt. Nội dung đầy đủ nằm trong phụ lục NCE khi tùy chọn kèm phụ lục được bật.</p><table class="nce-summary-table"><tr><th>Ngày / mã NCE</th><th>Mức / lô</th><th>Luật / loại SS</th><th>Tóm tắt xử lý</th><th>Người</th><th>QC chạy lại</th><th>Duyệt</th><th>Khép vòng</th></tr>'+
    acts.map(a=>{const m=reportNceModel(a,t),rr=typeof actionRerunStatus==='function'?actionRerunStatus(a):{label:''};return '<tr><td>'+(a.nceId?'<b>'+esc(a.nceId)+'</b><br>':'')+m.eventDateText+'</td><td>'+esc(actionLevelShort(t,a.level,a.lot))+'</td><td>'+esc(a.rule||'—')+'<br><span class="muted">'+esc(a.errorType||'—')+'</span></td><td class="nce-summary-cell">'+reportNceSummaryHtml(a)+'</td><td>'+esc(a.by||'—')+'</td><td>'+esc(rr.label||'—')+'</td><td>'+esc(typeof actionApprovalLabel==='function'?actionApprovalLabel(a):(a.approvalStatus||'pending'))+(a.approvedBy?'<br><span class="muted">'+esc(a.approvedBy)+'</span>':'')+'</td><td>'+esc(m.wfLabel)+'</td></tr>';}).join('')+'</table>';}
  body+=signBlock();
  if(acts.length&&includeNceAppendix)body+=reportNceAppendixHtml(acts,t);
  await openPrint('Báo cáo nội kiểm — '+testDisplayName(t),body);
}
async function printRangeForm(tid,level){
  const t=state.tests.find(x=>x.id===tid);const l=lvlCfg(t,level),pts=operationalLotPoints(t,level);
  const c=stats(pts.map(p=>p.val)),days=new Set(pts.map(p=>p.date)).size;if(!c){await infoDialog('Chưa đủ dữ liệu.');return;}
  let body=reportHeader('BIỂU MẪU THIẾT LẬP DẢI KIỂM SOÁT QC MỚI');
  body+='<table><tr><th style="width:25%">Xét nghiệm</th><td>'+esc(testDisplayName(t))+(t.unit?' · '+esc(t.unit):'')+'</td><th style="width:18%">Mức / Lô</th><td>M'+level+' / '+esc(l.lot||'?')+'</td></tr>'+
        '<tr><th>Máy</th><td>'+esc(t.machine||'')+'</td><th>Số kết quả / ngày độc lập</th><td>'+c.n+' / '+days+'</td></tr></table>';
  body+='<h3>So sánh dải kiểm soát</h3><table><tr><th></th><th class="num">Mean</th><th class="num">SD</th><th class="num">CV%</th><th class="num">±2SD</th></tr>'+
    '<tr><td>Dải nhà sản xuất / hiện tại</td><td class="num">'+reportQcValue(t,l.mean)+'</td><td class="num">'+reportQcStat(t,l.sd)+'</td><td class="num">'+fmt(l.mean?l.sd/Math.abs(l.mean)*100:0)+'</td><td class="num">'+reportQcValue(t,l.mean-2*l.sd)+' – '+reportQcValue(t,l.mean+2*l.sd)+'</td></tr>'+
    '<tr><td><b>Dải PXN đề xuất</b></td><td class="num"><b>'+reportQcValue(t,c.m)+'</b></td><td class="num"><b>'+reportQcStat(t,c.sd)+'</b></td><td class="num"><b>'+fmt(c.cv)+'</b></td><td class="num"><b>'+reportQcValue(t,c.m-2*c.sd)+' – '+reportQcValue(t,c.m+2*c.sd)+'</b></td></tr></table>';
  body+='<img src="'+ljDataURL(pts,c.m,c.sd)+'">';
  body+='<p style="margin-top:8px"><b>Điều kiện:</b> tối thiểu 20 kết quả trên 20 ngày độc lập, cùng lô QC, không có điểm vi phạm/cảnh báo chưa xử lý; áp dụng khi hệ thống ổn định và được phê duyệt theo SOP.</p>';
  body+='<p>Kết luận: ☐ Áp dụng dải PXN mới &nbsp;&nbsp; ☐ Giữ dải nhà sản xuất</p>';
  body+=signBlock();await openPrint('Biểu mẫu thiết lập dải QC — '+testDisplayName(t),body);
}

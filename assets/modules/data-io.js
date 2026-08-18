/* ===== DATA IO ===== */
function dataIoTypePx(token,fallback){return globalThis.cssTokenPixel(token,fallback);}
function dataIoCanvasFont(weight,token,fallback){return globalThis.sigmaCanvasFont(weight,token,fallback);}
function exportMetaRows(kind='Báo cáo'){return globalThis.exportMetaRowsService(kind);}
/* ===== TẦNG DỮ LIỆU DÙNG CHUNG CHO BÁO CÁO NỘI KIỂM =====
   Bản in (printReport trong reports.js) và bản Excel (reportXlsxDoc bên dưới)
   trình bày khác nhau nhưng lấy CÙNG một tập dữ liệu. Trước 2026-08-01 mỗi bên
   tự dựng lại tập đó — 8 dòng dài giống hệt nhau, cộng nguyên khối bóc nhãn hồ
   sơ NCE — nên thêm một trường vào hồ sơ là phải sửa hai nơi và không có gì bắt
   được nếu quên một. Mọi thứ dưới đây THUẦN DỮ LIỆU: không sinh HTML, không
   sinh ô Excel, chỉ trả chuỗi/mảng để hai bên tự trình bày. data-io.js nạp
   TRƯỚC reports.js nên chiều phụ thuộc là một chiều, không vòng.
   (exportActionsCSV cố tình KHÔNG dùng: CSV giữ mã gốc làm giá trị
   dự phòng khi thiếu nhãn, khác với bản in/Excel luôn hiển thị "—".) */
function reportInRange(start,end){return globalThis.reportExportHelpers.inRange(start,end);}
function reportTeaInfo(t){return globalThis.qcReportContext.teaInfo(t);}
function reportMultiViews(t,inRange){return globalThis.qcReportContext.multiViews(t,inRange);}
/* Lô cũ đã chuyển tiếp: chỉ chấm luật theo từng mức riêng lẻ (within), không
   gồm luật liên mức — nên phải tự chạy westgardByPoint chứ không dùng wg chung. */
function reportPrevLotRows(t,s,inRange){
  return globalThis.qcReportRowsService.previousLot(t,s,inRange);
}
function reportLevelRows(t,l,wg,inRange){return globalThis.qcReportRowsService.currentLot(t,l,wg,inRange);}
function reportActionsInRange(tid,inRange){return globalThis.qcReportRowsService.actions(tid,inRange);}
function reportNceExcerpt(value,max=150){return globalThis.reportExportHelpers.nceExcerpt(value,max);}
/* Ba dòng tóm tắt ở bảng nhật ký: bản in xếp thành <div>, bản Excel nối bằng \n. */
function reportNceSummaryParts(a){return globalThis.actionReportSummary(a);}
/* Toàn bộ nội dung một phiếu NCE đã bóc nhãn xong, dạng chuỗi thô (chưa esc).
   Thêm trường mới vào phiếu ⇒ thêm ở ĐÂY, cả bản in lẫn bản Excel nhận cùng lúc. */
function reportNceModel(a,t){return globalThis.actionReportModel(a,t);}
function exportReportCSV(){const{tid,t,start,end}=reportExportSelection();if(!t)return;const label=start||end?(start||'batdau')+'_'+(end||'hientai'):'toanbo',rows=globalThis.qcReportCsvRows(tid,start,end);globalThis.csvDownload('Bao_cao_IQC_'+safeName(t.name)+'_'+safeName(label)+'.csv',rows);}
function exportActionsCSV(){
  const rows=[...exportMetaRows('Nhật ký khắc phục'),[],['Mã NCE','Ngày xảy ra','Thời điểm mở hồ sơ','Nguồn phát hiện','Giai đoạn','Xét nghiệm','Mức / lô','Luật','Loại sai số','Hành động','Điều tra & ảnh hưởng','Bias trước khắc phục (%)','Bias sau khắc phục (%)','Người phụ trách','Hạn hoàn thành','S ban đầu','O ban đầu','D ban đầu','RPN ban đầu','Phân loại nguy cơ','Căn cứ SOP','Quyết định cho phép trở lại','Ngày cho phép','Người cho phép','Căn cứ cho phép','QC chạy lại','Kết luận hiệu lực','Ngày đánh giá hiệu lực','Bằng chứng hiệu lực','Người đánh giá','S còn lại','O còn lại','D còn lại','RPN còn lại','Phân loại nguy cơ còn lại','Căn cứ đánh giá lại','Trạng thái duyệt','Người duyệt','Thời điểm duyệt','Ý kiến duyệt','Lý do trả lại','Người trả lại','Thời điểm trả lại','Trạng thái bản ghi','Lý do hủy','Người hủy','Thời điểm hủy','Hồ sơ trước','Hồ sơ tiếp theo','Trạng thái hồ sơ']];
  (state.actions||[]).forEach(a=>{rows.push(globalThis.nceCsvRow(a));});
  globalThis.csvDownload('Nhat_ky_khac_phuc_QC.csv',rows);
}
function downloadBlob(name,blob){return globalThis.blobDownload(name,blob);}
function sigmaReportMetric(r){return globalThis.sigmaReportMetricService(r);}
function sigmaReportRows(onlyTestId='',mode='latest',period='',periodId=''){return globalThis.sigmaReportRowsService(onlyTestId,mode,period,periodId);}
function sigmaLevelsOf(row){return globalThis.reportExportHelpers.sigmaLevels(row);}
function sigmaDataURLBytes(durl){return globalThis.sigmaDataUrlBytes(durl);}
const SIGMA_EXPORT_PIXEL_RATIO=6,SIGMA_EXPORT_MAX_DIMENSION=16384;
function sigmaExportPixelRatio(W,H,scale=SIGMA_EXPORT_PIXEL_RATIO){return globalThis.sigmaExportPixelRatioService(W,H,scale,SIGMA_EXPORT_MAX_DIMENSION);}
function sigmaCanvas(W,H,scale){return globalThis.sigmaCanvasFactory(W,H,scale);}
function drawSigmaReportChart(rows){return globalThis.sigmaChartRenderer(rows);}
function sigmaMdcItems(rows){return globalThis.sigmaMdcItemsService(rows);}
function sigmaPeriodLabel(value){return globalThis.reportExportHelpers.periodLabel(value);}
function sigmaMdcPeriodLabel(value){return globalThis.reportExportHelpers.mdcPeriodLabel(value);}
function sigmaExportPeriods(rows){return globalThis.reportExportHelpers.exportPeriods(rows);}
function sigmaMdcLabelPlacements(items,X,Y,ctx,bounds){return globalThis.sigmaMdcLabelPlacementService(items,X,Y,ctx,bounds);}
/* Lõi OOXML/ZIP dùng chung cho mọi bộ xuất .xlsx (SigmaXlsx + ReportXlsx): ghi ZIP
   STORE (không nén) kèm CRC32 tự tính, escape XML, đổi px→EMU, và các helper ô
   inlineStr/số. Byte-precise — bất kỳ sai lệch offset/độ dài nào cũng tạo file .xlsx
   hỏng mà không báo lỗi lúc xuất, nên phần này được kiểm bằng tests/sigma-xlsx.test.js
   và tests/report-xlsx.test.js (đều tự parse lại bytes, không tin code của app). */
const XlsxCore=(()=>{
  const u8=globalThis.xlsxUtf8,escX=globalThis.xlsxEscape;
  const zip=globalThis.xlsxZip;
  const emu=globalThis.xlsxEmu,COLS=globalThis.xlsxColumns;
  const cells=globalThis.xlsxCells,cellStr=cells.text,cellNum=cells.number;
  const r2=x=>globalThis.xlsxRound(x,2),r4=x=>globalThis.xlsxRound(x,4);
  return{u8,escX,zip,emu,COLS,cellStr,cellNum,r2,r4};
})();
Object.assign(globalThis,{XlsxCore});
const DEFAULT_SIGMA_SHEET='Tổng hợp Six Sigma';
const SigmaXlsx=(()=>{
  const {u8,escX,zip,emu,COLS,cellStr,cellNum,r2,r4}=XlsxCore;
  const styles=globalThis.sigmaXlsxStyles;
  const periodNo=v=>globalThis.xlsxPeriodNumber(v),periodCell=(ref,style,v)=>{const n=periodNo(v);return typeof n==='number'&&Number.isFinite(n)?cellNum(ref,style,n):cellStr(ref,style,n);};
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
  const drawing=globalThis.xlsxDrawing;
  const build=(rows,meta,images=[])=>{images=images.filter(im=>im&&im.bytes&&im.bytes.length);const hasDraw=images.length>0,levelCount=(rows||[]).reduce((n,d)=>n+Math.max(1,sigmaLevelsOf(d).length),0),noteRow=4+levelCount,chartStartRow0=noteRow+1,ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+(hasDraw?'<Default Extension="png" ContentType="image/png"/>':'')+'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+(hasDraw?'<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':'')+'</Types>';const files=[{name:'[Content_Types].xml',data:u8(ct)},{name:'_rels/.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')},{name:'xl/workbook.xml',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+escX('Tổng hợp Six Sigma')+'" sheetId="1" r:id="rId1"/></sheets></workbook>')},{name:'xl/_rels/workbook.xml.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')},{name:'xl/styles.xml',data:u8(styles())},{name:'xl/worksheets/sheet1.xml',data:u8(sheet(rows,meta,hasDraw))}];if(hasDraw){files.push({name:'xl/worksheets/_rels/sheet1.xml.rels',data:u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>')});files.push({name:'xl/drawings/drawing1.xml',data:u8(drawing(images,chartStartRow0))});let rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';images.forEach((im,i)=>rels+='<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image'+(i+1)+'.png"/>');files.push({name:'xl/drawings/_rels/drawing1.xml.rels',data:u8(rels+'</Relationships>')});images.forEach((im,i)=>files.push({name:'xl/media/image'+(i+1)+'.png',data:im.bytes}));}return zip(files);};
  return{build};
})();
function drawSigmaReportMDC(rows){return globalThis.sigmaMdcRenderer(rows);}
function renameSigmaSheet(bytes,sheetName){return globalThis.renameSigmaXlsxSheet(bytes,sheetName);}
const sigmaXlsxBuild=SigmaXlsx.build;
SigmaXlsx.build=(rows,meta,images)=>renameSigmaSheet(sigmaXlsxBuild(rows,meta,images),(meta&&meta.sheetName)||DEFAULT_SIGMA_SHEET);
/* Chỉ số style (thứ tự phải khớp với mảng xfs trong ReportXlsx.styles bên dưới). */
const RXST=globalThis.reportXlsxStyleIds;
/* Bộ ghi .xlsx TỔNG QUÁT (khác SigmaXlsx vốn cứng theo layout Sigma): nhận một "doc"
   gồm cols (độ rộng cột), rows (mảng các hàng, mỗi hàng là mảng ô {v,s[,num]} hoặc
   null=ô trống), merges, rowHeights và images (ảnh PNG neo theo hàng row0 0-based).
   Dùng cho báo cáo nội kiểm theo ngày (giống bảng của báo cáo in) kèm biểu đồ LJ. */
const ReportXlsx=(()=>{
  const styles=globalThis.reportXlsxStyles;
  const sheetXml=globalThis.reportXlsxSheet;
  const drawingXml=globalThis.reportXlsxDrawing;
  const build=globalThis.reportXlsxBuild;
  return{build};
})();
/* Dựng "doc" cho ReportXlsx từ đúng dữ liệu của báo cáo in (printReport trong reports.js):
   bảng thông tin đơn vị, biểu đồ LJ tổng hợp (nếu ≥2 mức), rồi từng mức: biểu đồ LJ,
   bảng Mean/SD/CV/Bias/TE/Sigma, bảng điểm, điểm vi phạm; cuối cùng là nhật ký khắc phục.
   Cần DOM để render biểu đồ (ljDataURL/ljMultiDataURL) nên chỉ chạy trong trình duyệt. */
function reportXlsxDoc(tid,start,end,includeNceAppendix=true){
  const t=state.tests.find(x=>x.id===tid);if(!t)return null;
  const ST=RXST,NCOL=10,LASTCOL='J',CHART_W=930,CHART_H=Math.round(930*430/1400),ROW_PX=17;
  const inMonth=reportInRange(start,end),wg=activeWestgard(t);
  const{teaVal,teaSourceText}=reportTeaInfo(t);
  const rows=[],merges=[],images=[],rowHeights={};let R=0;
  const S=(v,s)=>({v,s}),Nn=(v,s)=>({v,s,num:true});
  const n1=v=>Number.isFinite(v)?Number(Number(v).toFixed(1)):'',n2=v=>Number.isFinite(v)?Number(Number(v).toFixed(2)):'',n3=v=>Number.isFinite(v)?Number(Number(v).toFixed(3)):'';
  const push=cells=>{rows.push(cells);return ++R;};                       // trả về số hàng 1-based vừa thêm
  const fullMerge=r=>merges.push('A'+r+':'+LASTCOL+r);
  const blank=()=>push([]);
  const section=txt=>{const r=push([S(txt,ST.SECTION)]);fullMerge(r);rowHeights[r]=21;};
  const note=txt=>{const r=push([S(txt,ST.NOTE)]);fullMerge(r);rowHeights[r]=Math.min(60,14+Math.ceil(String(txt).length/95)*13);};
  const nceCells=(value,style,count)=>Array.from({length:count},(_,i)=>S(i?'':value,style));
  const nceSub=txt=>{blank();const r=push(nceCells(txt,ST.LABEL,NCOL));fullMerge(r);rowHeights[r]=19;};
  const ncePair=(l1,v1,l2,v2)=>{const a=String(v1||'—'),b=String(v2||'—'),rr=push([...nceCells(l1,ST.LABEL,2),...nceCells(a,ST.VAL,3),...nceCells(l2,ST.LABEL,2),...nceCells(b,ST.VAL,3)]);merges.push('A'+rr+':B'+rr,'C'+rr+':E'+rr,'F'+rr+':G'+rr,'H'+rr+':J'+rr);rowHeights[rr]=Math.min(54,21+Math.max(Math.ceil(a.length/42),Math.ceil(b.length/42)-1)*12);};
  const nceWide=(label,value)=>{const text=String(value||'—'),rr=push([...nceCells(label,ST.LABEL,2),...nceCells(text,ST.VAL,8)]);merges.push('A'+rr+':B'+rr,'C'+rr+':J'+rr);rowHeights[rr]=Math.min(72,21+Math.max(0,Math.ceil(text.length/105)-1)*12);};
  const imgBytes=typeof sigmaDataURLBytes==='function'?sigmaDataURLBytes:null;
  const chart=durl=>{if(!durl||!imgBytes)return;const row0=R;let bytes;try{bytes=imgBytes(durl);}catch(e){return;}images.push({bytes,dispW:CHART_W,dispH:CHART_H,row0});const spacer=Math.ceil(CHART_H/ROW_PX)+1;for(let i=0;i<spacer;i++)blank();};
  // ---- Tiêu đề + thông tin đơn vị (bám theo báo cáo in: tiêu đề căn giữa, thanh app/luật, bảng meta cân đối) ----
  const appMeta=window.QCLAB_APP||{},rulesStr=Object.entries(state.westgardRules||{}).filter(x=>x[1]!==false).map(x=>x[0]).join(', ')||'Chưa cấu hình';
  const h=globalThis.reportXlsxHeader({styles:ST,appName:appMeta.name||'QC Lab',appVersion:appMeta.version||'dev',rules:rulesStr,labName:state.lab.name||'',department:state.lab.dept||'',address:state.lab.address||'',exportedAt:formatDateTimeVN(new Date().toISOString()),exportedBy:userName(),testName:testDisplayName(t),testUnit:t.unit||'',machine:t.machine||'',range:reportRangeText(start,end),tea:teaVal||'—',teaSource:teaSourceText,teaReference:typeof sgTeaRefText==='function'?sgTeaRefText(t):'',teaDocument:t.teaDoc||'',teaApprovedBy:t.teaApprovedBy||''});rows.push(...h.rows);merges.push(...h.merges);Object.assign(rowHeights,h.rowHeights);R=rows.length;
  // ---- Biểu đồ LJ tổng hợp (nếu có ≥2 mức có điểm) ----
  const multiViews=reportMultiViews(t,inMonth);
  if(multiViews.filter(v=>v.pts.length).length>=2){blank();section('Levey-Jennings tổng hợp theo Z-score');chart(typeof ljMultiDataURL==='function'?ljMultiDataURL(multiViews,t):null);}
  // ---- Bảng ô cho từng mục ----
  const mergePairs=(r,pairs)=>pairs.forEach(([a,b])=>merges.push(a+r+':'+b+r));
  const statsHeader=()=>{const r=push([S('n',ST.TH),S('Mean thực',ST.TH),S('',ST.TH),S('SD',ST.TH),S('CV%',ST.TH),S('Bias%',ST.TH),S('TE%',ST.TH),S('TEa%',ST.TH),S('Sigma (kỳ)',ST.TH),S('',ST.TH)]);mergePairs(r,[['B','C'],['I','J']]);rowHeights[r]=18;};
  const statsRow=(st,bias,te,sigma)=>{const sg=sigma==null?S('—',ST.TD):(st.n<20?S(fmt(sigma,1)+' *',ST.TD):Nn(n1(sigma),ST.TD)),r=push([Nn(st.n,ST.TD),Nn(n2(st.m),ST.TD),S('',ST.TD),Nn(n3(st.sd),ST.TD),Nn(n2(st.cv),ST.TD),Nn(n2(bias),ST.TD),Nn(n2(te),ST.TD),(teaVal?Nn(n2(teaVal),ST.TD):S('—',ST.TD)),sg,S('',ST.TD)]);mergePairs(r,[['B','C'],['I','J']]);};
  const pointsHeader=()=>{const r=push([S('Ngày',ST.TH),S('',ST.TH),S('Lần chạy',ST.TH),S('',ST.TH),S('NV',ST.TH),S('Giá trị',ST.TH),S('Z',ST.TH),S('Kết luận',ST.TH),S('Luật / bằng chứng',ST.TH),S('',ST.TH)]);mergePairs(r,[['A','B'],['C','D'],['I','J']]);rowHeights[r]=18;};
  const pointsRow=o=>{const rules=[...new Set(o.f.rules||[])],support=[...new Set(o.f.supportRules||[])].filter(rule=>!rules.includes(rule)),ruleText=rules.join(', ')||(support.length?'Bằng chứng: '+support.join(', '):'—'),staff=pointStaff(o.p),vs=o.f.level==='rej'?ST.REJ:o.f.level==='warn'?ST.WARN:ST.TD,r=push([S(vnDate(o.p.date),ST.TD),S('',ST.TD),S(o.p.runId||'—',ST.TD),S('',ST.TD),S(staff.code||'—',ST.TD),Nn(Number.isFinite(o.p.val)?o.p.val:'',ST.TD),S((o.z>=0?'+':'')+fmt(o.z)+'s',ST.TD),S(stateName(o.f.level),vs),S(ruleText,ST.TD),S('',ST.TD)]);mergePairs(r,[['A','B'],['C','D'],['I','J']]);};
  const violHeader=()=>{const r=push([S('Ngày',ST.TH),S('',ST.TH),S('NV',ST.TH),S('Giá trị',ST.TH),S('Z',ST.TH),S('Luật',ST.TH),S('',ST.TH),S('Loại sai số',ST.TH),S('',ST.TH),S('',ST.TH)]);mergePairs(r,[['A','B'],['F','G'],['H','J']]);rowHeights[r]=18;};
  const violRow=o=>{const rules=[...new Set(o.f.rules||[])],r=push([S(vnDate(o.p.date),ST.TD),S('',ST.TD),S(pointStaff(o.p).code||'—',ST.TD),Nn(Number.isFinite(o.p.val)?o.p.val:'',ST.TD),S((o.z>=0?'+':'')+fmt(o.z)+'s',ST.TD),S(rules.join(', '),ST.WARN),S('',ST.WARN),S(errorType(rules),ST.TDL),S('',ST.TDL),S('',ST.TDL)]);mergePairs(r,[['A','B'],['F','G'],['H','J']]);};
  // ---- Từng mức ----
  operationalLevels(t).forEach(l=>{
    (typeof previousLotSeries==='function'?previousLotSeries(t,l.level):[]).forEach(s=>{
      const{inPts,items:allS}=reportPrevLotRows(t,s,inMonth);if(!inPts.length)return;
      blank();section('Mức '+l.level+' — Lô cũ '+(s.lot||'?')+' · đã chuyển tiếp (Mean='+globalThis.qcExportValueFormat.value(t,s.mean)+', SD='+globalThis.qcExportValueFormat.stat(t,s.sd)+')');
      note('Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).');
      chart(typeof ljDataURL==='function'?ljDataURL(inPts,s.mean,s.sd):null);
      const stat=reportLevelStats(inPts,s.mean,teaVal);statsHeader();statsRow(stat.st,stat.bias,stat.te,stat.sigma);
      blank();pointsHeader();allS.forEach(pointsRow);
      const violS=allS.filter(o=>o.f.level!=='ok');
      if(violS.length){blank();violHeader();violS.forEach(violRow);}
    });
    const{pts,items:all}=reportLevelRows(t,l,wg,inMonth);
    blank();section('Mức '+l.level+' — Lô '+(l.lot||'?')+' · Dải '+(l.applied==='lab'?'PXN':'NSX')+' (Mean='+globalThis.qcExportValueFormat.value(t,l.mean)+', SD='+globalThis.qcExportValueFormat.stat(t,l.sd)+')');
    if(!pts.length){note('Không có dữ liệu trong khoảng ngày đã chọn.');return;}
    chart(typeof ljDataURL==='function'?ljDataURL(pts,l.mean,l.sd):null);
    const stat=reportLevelStats(pts,l.mean,teaVal);statsHeader();statsRow(stat.st,stat.bias,stat.te,stat.sigma);
    blank();pointsHeader();all.forEach(pointsRow);
    const viol=all.filter(o=>o.f.level!=='ok');
    if(viol.length){blank();violHeader();viol.forEach(violRow);}
  });
  // ---- Nhật ký khắc phục ----
  const acts=reportActionsInRange(tid,inMonth);
  if(acts.length){
    blank();section('Hành động khắc phục trong khoảng ngày đã chọn');
    note('Bảng dưới đây là bản tóm tắt. Nội dung đầy đủ nằm trong phụ lục NCE khi tùy chọn kèm phụ lục được bật.');
    let hr=push([S('Ngày / mã NCE',ST.TH),S('Mức / lô',ST.TH),S('Luật / loại SS',ST.TH),S('Tóm tắt xử lý',ST.TH),S('',ST.TH),S('',ST.TH),S('Người',ST.TH),S('QC chạy lại',ST.TH),S('Duyệt',ST.TH),S('Khép vòng',ST.TH)]);merges.push('D'+hr+':F'+hr);rowHeights[hr]=25;
    acts.forEach(a=>{const m=reportNceModel(a,t),rr=typeof actionRerunStatus==='function'?actionRerunStatus(a):{label:''},summary=reportNceSummaryParts(a).map(([label,text])=>label+': '+text).join('\n'),ar=push([S((a.nceId?a.nceId+'\n':'')+m.eventDateText,ST.TD),S(actionLevelShort(t,a.level,a.lot),ST.TD),S((a.rule||'—')+'\n'+(a.errorType||'—'),ST.TD),S(summary,ST.TDL),S('',ST.TDL),S('',ST.TDL),S(a.by||'—',ST.TD),S(rr.label||'—',ST.TD),S((typeof actionApprovalLabel==='function'?actionApprovalLabel(a):(a.approvalStatus||'pending'))+(a.approvedBy?'\n'+a.approvedBy:''),ST.TD),S(m.wfLabel,ST.TD)]);merges.push('D'+ar+':F'+ar);rowHeights[ar]=96;});
    if(includeNceAppendix){
      blank();section('Phụ lục - Hồ sơ NCE chi tiết');note('Phụ lục giữ đầy đủ nội dung điều tra, bằng chứng QC chạy lại, đánh giá hiệu lực và phê duyệt. Bảng tổng hợp phía trên chỉ trình bày thông tin trọng yếu.');
      acts.forEach(a=>{const m=reportNceModel(a,t);
        blank();section('Phiếu NCE '+m.nceTitle+' · '+m.wfLabel);
        ncePair('Ngày xảy ra',m.eventDateText,'Xét nghiệm / mức / lô',m.testLevelText);ncePair('Luật / loại sai số',m.ruleErrText,'Nguồn / giai đoạn',m.sourcePhaseText);ncePair('Người phụ trách / hạn',m.ownerDueText,'Trạng thái bản ghi',m.recordStatusText);
        if(!m.modern){nceSub('Hành động đã ghi');nceWide('Nội dung',m.legacyActionText);nceSub('QC chạy lại / duyệt');ncePair('QC chạy lại',m.rerunText,'Phê duyệt',m.approvalShortText);return;}
        nceSub('1. Kiểm soát và xử lý tức thời');ncePair('Phạm vi kiểm soát',m.containmentText,'Ghi chú phạm vi',m.containmentNote);nceWide('Xử lý tức thời',m.correctionText);
        nceSub('2. Đánh giá nguy cơ ban đầu');ncePair('Phân loại / RPN',m.riskText,'S x O x D',m.sodText);nceWide('Căn cứ SOP',m.riskBasis);
        nceSub('3. Checklist điều tra');let cr=push([S('Hạng mục',ST.TH),S('',ST.TH),S('',ST.TH),S('',ST.TH),S('Kết luận',ST.TH),S('',ST.TH),S('Ghi chú / bằng chứng',ST.TH),S('',ST.TH),S('',ST.TH),S('',ST.TH)]);merges.push('A'+cr+':D'+cr,'E'+cr+':F'+cr,'G'+cr+':J'+cr);m.checks.forEach(([label,statusText,noteText])=>{const rrr=push([...nceCells(label,ST.TDL,4),...nceCells(statusText,ST.TD,2),...nceCells(noteText,ST.TDL,4)]);merges.push('A'+rrr+':D'+rrr,'E'+rrr+':F'+rrr,'G'+rrr+':J'+rrr);rowHeights[rrr]=Math.min(54,23+Math.max(0,Math.ceil(noteText.length/55)-1)*12);});
        nceSub('4. Nguyên nhân và hành động khắc phục');ncePair('Nhóm nguyên nhân',m.causeCategoryText,'Ngày hoàn thành hành động',m.actionCompletedText);nceWide('Nguyên nhân',m.causeText);nceWide('Hành động khắc phục',m.actionText);
        nceSub('5. Bằng chứng QC chạy lại và cho phép trở lại');ncePair('QC chạy lại',m.rerunText,'Quyết định',m.releaseText);ncePair('Ngày / người cho phép',m.releaseWhoText,'Căn cứ cho phép',m.releaseNote);
        nceSub('6. Ảnh hưởng người bệnh');ncePair('Kết luận',m.patientText,'Xử lý kết quả liên quan',m.patientAction);
        nceSub('7. Hiệu lực, nguy cơ còn lại và phê duyệt');ncePair('Đánh giá hiệu lực',m.effLabel,'Ngày / người đánh giá',m.effWhoText);ncePair('Bằng chứng hiệu lực',m.effNote,'Nguy cơ còn lại',m.residualText);ncePair('Căn cứ đánh giá lại',m.residualBasis,'Phê duyệt',m.approvalText);nceWide('Ý kiến duyệt',m.approvalNote);
        if(m.cancelled){nceSub('Thông tin hủy hồ sơ');nceWide('Lý do / người / thời điểm',m.cancelText);}
      });
    }
  }
  blank();const sr=push([S('Người thực hiện — Người kiểm tra — Phụ trách khoa (ký, ghi rõ họ tên)',ST.NOTE)]);fullMerge(sr);
  return{sheetName:'Báo cáo nội kiểm',cols:[13,12,14,10,10,10,12,13,15,18].slice(0,NCOL),rows,merges,rowHeights,images};
}
async function exportReportXLSX(){
  const{tid,t,start,end,includeNceAppendix}=reportExportSelection();if(!t)return;
  let doc;try{doc=reportXlsxDoc(tid,start,end,includeNceAppendix);}catch(e){await infoDialog('Không thể tạo báo cáo Excel:\n'+(e&&e.message?e.message:e));return;}
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
  let r;const h=globalThis.westgardXlsxHeader({styles:ST,title:'PHÂN TÍCH WESTGARD — '+testDisplayName(t),labName:state.lab.name||'',department:state.lab.dept||'',address:state.lab.address||'',exportedAt:formatDateTimeVN(new Date().toISOString()),exportedBy:userName(),testName:testDisplayName(t),testUnit:t.unit||'',machine,appName:app.name||'QC Lab',appVersion:app.version||'dev',withinRules,acrossRules});rows.push(...h.rows);merges.push(...h.merges);Object.assign(rowHeights,h.rowHeights);R=rows.length;
  const multiViews=typeof wgMultiViews==='function'?wgMultiViews(t):wg.views.map(v=>({level:v.l.level,lot:v.l.lot,mean:v.l.mean,sd:v.l.sd,pts:v.pts,label:'M'+v.l.level+'·'+(v.l.lot||'?')}));
  if(multiViews.filter(v=>v.pts&&v.pts.length).length>=2){blank();section('Levey-Jennings tổng hợp theo Z-score');chart(typeof ljMultiDataURL==='function'?ljMultiDataURL(multiViews,t):null);}
  const head=()=>push([S('#',ST.TH),S('Ngày',ST.TH),S('Lần chạy',ST.TH),S('NV',ST.TH),S('Giá trị',ST.TH),S('Z',ST.TH),S('Kết luận',ST.TH),S('Luật / bằng chứng',ST.TH),S('Loại sai số',ST.TH)]);
  const detail=(o,index)=>{const row=globalThis.westgardXlsxRows.detail(o,index);push([Nn(row.index,ST.TD),S(row.date,ST.TD),S(row.runId,ST.TD),S(row.staffCode,ST.TD),Nn(row.value,ST.TD),S(row.z,ST.TD),S(row.verdict,row.style==='rej'?ST.REJ:row.style==='warn'?ST.WARN:ST.TD),S(row.ruleText,ST.TDL),S(row.error,ST.TDL)]);};
  wg.views.forEach(v=>{
    const l=v.l,prev=wgPrevOpen.has(t.id+'|'+l.level)&&(typeof previousLotSeries==='function'?previousLotSeries(t,l.level):[])[0],series=prev||{lot:l.lot,mean:l.mean,sd:l.sd,pts:v.pts},isPrev=!!prev;
    let all;if(isPrev){const calc=QCCore.westgardByPoint(series.pts,series.mean,series.sd,rule=>testRuleOnWithin(t,rule));all=series.pts.map((p,i)=>{const raw=calc.F[i]||{rules:[],supportRules:[]},f={...raw,level:ruleResultLevel(t,raw.rules||[])};return{p,f,z:calc.zs[i]};});}
    else all=series.pts.map(p=>{const f=wg.byPoint.get(p.id)||{level:'ok',rules:[],supportRules:[],z:(p.val-series.mean)/series.sd};return{p,f,z:f.z};});
    const relevant=all.filter(o=>o.f.level!=='ok'||(o.f.supportRules||[]).length),pointIndex=new Map(series.pts.map((p,i)=>[p.id,i+1]));
    blank();section('Mức '+l.level+' — '+(isPrev?'Lô cũ ':'Lô ')+(series.lot||'?')+(isPrev?' · đã chuyển tiếp':'')+' (Mean='+globalThis.qcExportValueFormat.value(t,series.mean)+', SD='+globalThis.qcExportValueFormat.stat(t,series.sd)+')');
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
function sigmaExportMeta(){return globalThis.sigmaExportMetaService.meta();}
function sigmaTeaTrace(rows){
  return globalThis.sigmaExportMetaService.teaTrace(rows);
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

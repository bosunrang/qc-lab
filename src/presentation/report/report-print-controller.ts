export interface ReportPrintControllerDeps {
  reportQcFormat: { value: (t: any, value: unknown) => string; stat: (t: any, value: unknown) => string; point: (point: any, t: any) => string };
  reportHeaderPresentation: (input: any) => string;
  lab: () => any;
  app: () => any;
  westgardRules: () => any;
  formatDateTimeVN: (value: string) => string;
  userName: () => string;
  reportSignBlock: () => string;
  openPrintWindow: () => any;
  infoDialog: (message: string) => Promise<unknown>;
  openPrint: (title: string, bodyHtml: string, options?: { landscape?: boolean }) => Promise<void>;
  currentHref: () => string;
  hasPdfPrinter: () => boolean;
  sigmaPrintRowsService: { periodRows: (row: any, levels: any[]) => string; periodsRows: (rows: any[], levels: any[]) => string };
  sigmaMuPrintRowsService: { periodRows: (t: any, row: any, levels: any[]) => string; periodsRows: (t: any, rows: any[], levels: any[]) => string };
  sigmaMuTraceService: (row: any, levels: any[]) => string[];
  findTest: (id: string) => any;
  sgTest: () => string;
  selTest: () => string;
  sgData: (tid: string) => any[];
  sgVisibleLevels: (t: any) => any[];
  sgRows: (t: any, data: any[], levels: any[]) => any[];
  sigmaReportRows: (tid: string, mode: string, period?: string, entryId?: string) => any[];
  vnPeriod: (value: unknown) => string;
  sigmaTeaTrace: (exportRows: any[]) => string;
  instrumentName: (instrumentId: unknown, machine: unknown) => string;
  testDisplayName: (t: any) => string;
  sgFrequencyHTML: (t: any, row: any, levels: any[]) => string;
  sgTrendSVG: (t: any, valid: any[], levels: any[]) => string;
  sgMDCSVG: (t: any, valid: any[], levels: any[]) => string;
  sigmaExportPeriods: (exportRows: any[]) => string;
  activeWestgard: (t: any) => any;
  westgardByPoint: (points: any[], mean: number, sd: number, scope: (rule: string) => boolean) => any;
  wgRules: () => readonly string[];
  testRuleOnWithin: (t: any, rule: string) => boolean;
  testRuleOnAcross: (t: any, rule: string) => boolean;
  previousLotSeries: (t: any, level: unknown) => any[];
  wgPrevOpenHas: (key: string) => boolean;
  ruleResultLevel: (t: any, rules: string[]) => string;
  reportPointsTableService: (items: any[], t: any) => string;
  actionReportHtml: { summary: (parts: [any, any][]) => string; detailField: (label: any, value: any, wide?: boolean) => string };
  reportNceDetailHtmlPresentation: (a: any, t: any) => string;
  reportNceAppendixPresentation: (actions: any[], t: any) => string;
  reportNceModel: (a: any, t: any) => any;
  reportNceSummaryParts: (a: any) => [any, any][];
  reportExportSelection: () => { tid: string; t: any; start: string; end: string; includeNceAppendix: boolean };
  reportInRange: (start: string, end: string) => (value: unknown) => boolean;
  reportRangeText: (start: string, end: string) => string;
  reportTeaInfo: (t: any) => { teaVal: number | null; teaSourceText: string };
  reportMultiViews: (t: any, inMonth: (value: unknown) => boolean) => any[];
  operationalLevels: (t: any) => any[];
  reportPrevLotRows: (t: any, s: any, inMonth: (value: unknown) => boolean) => { inPts: any[]; items: any[] };
  reportLevelStats: (pts: any[], mean: number, teaVal: number | null) => any;
  pointStaff: (p: any) => any;
  errorType: (rules: string[]) => string;
  reportLevelRows: (t: any, l: any, wg: any, inMonth: (value: unknown) => boolean) => { pts: any[]; items: any[] };
  reportActionsInRange: (tid: string, inMonth: (value: unknown) => boolean) => any[];
  actionRerunStatus: (a: any) => { label: string };
  actionLevelShort: (t: any, level: unknown, lot: unknown) => string;
  actionApprovalLabel: (a: any) => string;
  sgTeaRefText: (t: any) => string;
  lvlCfg: (t: any, level: number) => any;
  operationalLotPoints: (t: any, level: number) => any[];
  stats: (values: number[]) => any;
  ljDataURL: (points: any[], mean: number, sd: number) => string;
  ljMultiDataURL: (levelViews: any[], test: any, opts?: { divider?: boolean }) => string;
  format: (value: unknown, decimals?: number) => string;
  vnDate: (value: unknown) => string;
  escape: (value: unknown) => string;
}

export function createReportPrintController(deps: ReportPrintControllerDeps) {
  function reportQcValue(t: any, value: unknown) { return deps.reportQcFormat.value(t, value); }
  function reportQcStat(t: any, value: unknown) { return deps.reportQcFormat.stat(t, value); }
  function reportQcPoint(point: any, t: any) { return deps.reportQcFormat.point(point, t); }

  function reportHeader(title: string, subtitle = 'Nội kiểm chất lượng xét nghiệm') {
    return deps.reportHeaderPresentation({ title, subtitle, lab: deps.lab(), app: deps.app(), westgardRules: deps.westgardRules(), exportedAt: deps.formatDateTimeVN(new Date().toISOString()), exportedBy: deps.userName(), escape: deps.escape });
  }
  function signBlock() { return deps.reportSignBlock(); }

  /* Pha H2 lát cuối (2026-08-20): cửa sổ popup in kế thừa CSP của app chính
     (about:blank được document.write() từ cùng origin) — sau khi bỏ
     'unsafe-inline' khỏi script-src, thẻ <script> nội tuyến VÀ onclick=
     trần cũ trong HTML popup đều bị CSP chặn. Thay bằng: KHÔNG viết script
     nào vào HTML popup nữa — nút in chỉ còn một `id`, và listener/hàm
     qcDoPrint/qcSavePdf được gắn/định nghĩa từ PHÍA MỞ popup (chính là code
     này, một file thật trong bundle, không phải chuỗi HTML) ngay sau
     document.write(). `window` (trần, không tiền tố `opener.`) ở đây CHÍNH
     LÀ app chính — vì hàm này chạy trong app chính, không phải trong popup —
     nên `opener.qcPrintPdf` cũ giờ chỉ còn là `(window as any).qcPrintPdf`.
     `w.__qcPrintToken` VẪN phải là một property thật trên window của popup
     (main process Electron và scripts/print-check.js đọc trực tiếp qua
     executeJavaScript('window.__qcPrintToken')) — gán từ đây vẫn ra đúng kết
     quả, vì đó là property assignment thường, không phải thực thi script
     nội tuyến nên CSP không liên quan. */
  async function openPrintImpl(title: string, bodyHtml: string, options: { landscape?: boolean } = {}) {
    const w = deps.openPrintWindow(); if (!w) { await deps.infoDialog('Trình duyệt chặn cửa sổ. Cho phép pop-up để in báo cáo.'); return; }
    const printFontCss = new URL('assets/tokens.css', deps.currentHref()).href;
    const printToken = 'qp' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    const btns = deps.hasPdfPrinter()
      ? '<button class="print-btn" id="qcPrintTriggerBtn">Lưu PDF</button>'
      : '<button class="print-btn" id="qcPrintTriggerBtn">In / Lưu PDF</button>';
    w.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + deps.escape(title) + '</title><link rel="stylesheet" href="' + printFontCss + '"><style>' +
      '@page{size:' + (options.landscape ? 'A4 landscape' : 'A4') + ';margin:13mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:"Manrope",Arial,Helvetica,sans-serif;color:#14202b;margin:0;background:#eef2f5;font-size:var(--type-meta);line-height:1.42}' +
      '.page{max-width:1120px;margin:18px auto;background:#fff;padding:22px 26px 28px;border:1px solid #dce3e9;box-shadow:0 10px 30px rgba(20,33,43,.08)}' +
      '.rpt-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:2px solid #14202b;padding-bottom:12px;margin-bottom:14px}.rpt-brand{display:flex;gap:12px;align-items:center}.rpt-hosp{font-size:var(--type-heading-sm);font-weight:850}.rpt-dept{font-weight:700;margin-top:1px}.rpt-addr{font-size:var(--type-caption);color:#647686;margin-top:1px}.rpt-meta{text-align:right;color:#647686;font-size:var(--type-caption)}.rpt-meta b{display:block;color:#14202b}.rpt-meta-label{margin-top:var(--space-xs)}.rpt-section-label{margin-top:var(--space-sm)}.rpt-title{text-align:center;margin:12px 0 16px}.rpt-title div{font-size:var(--type-dialog-title);font-weight:850;text-transform:uppercase;letter-spacing:.02em}.rpt-title span{display:block;font-size:var(--type-caption);color:#647686;margin-top:3px}' +
      '.rpt-card{border:1px solid #dce3e9;border-radius:8px;margin:12px 0 14px;overflow:hidden;background:#fff}.rpt-card h3{margin:0;padding:10px 12px;background:#0e8f8f;color:#fff;border-bottom:1px solid #0b7777;font-size:var(--type-subhead);font-weight:800}.rpt-card .body{padding:12px}h3{margin:16px 0 8px;padding:9px 10px;border:1px solid #0b7777;border-radius:7px;background:#0e8f8f;color:#fff;font-size:var(--type-subhead);font-weight:800}.meta-table th{width:16%;background:#e7f1f4;color:#244452}.rpt-key-15{width:15%}.rpt-key-18{width:18%}.rpt-key-20{width:20%}.rpt-key-25{width:25%}.nce-check-item-col{width:30%}.nce-check-result-col{width:22%}.nce-check-note-col{width:48%}.soft-note{color:#647686;font-style:italic;margin:8px 0 0}.chart-img,.page img{display:block;width:100%;max-height:360px;object-fit:contain;border:1px solid #dce3e9;border-radius:6px;background:#fff;margin:0 auto 10px}' +
      'table{width:100%;border-collapse:separate;border-spacing:0;margin:0 0 8px;border:1px solid #dce3e9;border-radius:7px;overflow:hidden}th,td{padding:7px 9px;text-align:center;border-bottom:1px solid #eef2f5}tr:last-child td{border-bottom:none}th{background:#e7f1f4;color:#244452;font-size:var(--type-caption);font-weight:800}td.num,th.num{font-variant-numeric:tabular-nums}.pill{display:inline-block;border-radius:999px;background:#e8f3f2;color:#0a6e6e;padding:2px 8px;font-weight:800;font-size:var(--type-overline)}.hint,.muted{color:#647686}.alert{display:block;margin:8px 0;padding:9px 11px;border-left:3px solid #3f7795;background:#edf5fa;border-radius:5px}.rpt-chart-grid{display:grid;grid-template-columns:1fr;gap:12px}.rpt-chart svg{display:block;width:100%;height:auto;max-height:315px}.sign-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:36px}.sign-grid div{text-align:center;padding-top:48px;border-top:1px solid #9aa8b3}.sign-grid b{display:block}.sign-grid span{font-size:var(--type-caption);color:#647686;font-style:italic}.nce-summary-table{font-size:var(--type-overline)}.nce-summary-cell{text-align:left;min-width:240px}.nce-summary div+div{margin-top:3px}.nce-summary b{color:#244452}.nce-appendix{margin-top:18px}.nce-appendix-intro{margin:0 0 12px;color:#647686}.nce-detail{margin-top:16px}.nce-detail-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}.nce-detail-head h3{flex:1;margin:0}.nce-detail-status{white-space:nowrap;font-weight:800;color:#0a6e6e;padding-top:9px}.nce-detail h4{margin:14px 0 7px;color:#244452;font-size:var(--type-meta)}.nce-detail-text{min-height:42px;padding:8px 10px;border:1px solid #dce3e9;border-radius:6px;background:#f8fafb;text-align:left;white-space:pre-wrap}.nce-detail-stack{display:grid;gap:7px;break-inside:avoid}.nce-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;gap:7px}.nce-detail-grid>div{display:flex;min-height:52px;padding:7px 9px;border:1px solid #dce3e9;border-radius:6px;background:#f8fafb;flex-direction:column;justify-content:center}.nce-detail-grid>div.nce-detail-wide{grid-column:1/-1}.nce-detail-grid span{display:block;color:#647686;font-size:var(--type-overline)}.nce-detail-grid b{display:block;margin-top:2px}.nce-check-table{table-layout:fixed}.nce-check-table th,.nce-check-table td{height:38px;padding:8px 10px;vertical-align:middle}.nce-check-table th:nth-child(1),.nce-check-table td:nth-child(1),.nce-check-table th:nth-child(3),.nce-check-table td:nth-child(3){text-align:left}.nce-check-table th:nth-child(2),.nce-check-table td:nth-child(2){text-align:center}.print-btn{position:fixed;top:12px;right:12px;border:none;border-radius:8px;background:#14202b;color:#fff;padding:9px 13px;font-weight:800;box-shadow:0 8px 22px rgba(20,33,43,.22);cursor:pointer}' +
      '@media print{body{background:#fff}.page{max-width:none;margin:0;padding:0;border:none;box-shadow:none}.print-btn{display:none}.rpt-card{break-inside:avoid}.chart-img{max-height:310px}.nce-appendix{break-before:page}.nce-detail+.nce-detail{break-before:page}.nce-detail h4{break-after:avoid-page;page-break-after:avoid}.nce-detail-grid>div,.nce-detail-text,.nce-check-table tr{break-inside:avoid}}' +
      'body.printing{background:#fff}body.printing .page{max-width:none;margin:0;padding:0;border:none;box-shadow:none}body.printing .print-btn{display:none}' +
      '</style></head><body><div class="page">' + bodyHtml + '</div>' + btns + '</body></html>');
    w.document.close();
    w.__qcPrintToken = printToken;
    const doPrint = () => {
      w.document.body.classList.add('printing');
      if (typeof window !== 'undefined' && (window as any).qcPrintPdf) (window as any).qcPrintPdf.printPaper(printToken);
      else w.print();
    };
    const savePdf = () => {
      w.document.body.classList.add('printing');
      if (typeof window !== 'undefined' && (window as any).qcPrintPdf) (window as any).qcPrintPdf.save(printToken, w.document.title || 'Bao-cao');
      else doPrint();
    };
    const triggerBtn = w.document.getElementById('qcPrintTriggerBtn');
    if (triggerBtn) triggerBtn.addEventListener('click', deps.hasPdfPrinter() ? savePdf : doPrint);
    w.onbeforeprint = () => { w.document.body.classList.add('printing'); };
    w.onafterprint = () => { w.document.body.classList.remove('printing'); };
    w.focus();
  }

  function sigmaPeriodPrintRows(row: any, levels: any[]) { return deps.sigmaPrintRowsService.periodRows(row, levels); }
  function sigmaPeriodsPrintRows(rows: any[], levels: any[]) { return deps.sigmaPrintRowsService.periodsRows(rows, levels); }
  function sigmaMuPrintRows(t: any, row: any, levels: any[]) { return deps.sigmaMuPrintRowsService.periodRows(t, row, levels); }
  function sigmaMuPeriodsPrintRows(t: any, rows: any[], levels: any[]) { return deps.sigmaMuPrintRowsService.periodsRows(t, rows, levels); }
  function sigmaMuTrace(row: any, levels: any[]) { return deps.sigmaMuTraceService(row, levels); }

  const SIGMA_MU_PRINT_NOTE = '<p class="soft-note">Mô hình top-down (ISO/TS 20914 · Nordtest TR 537): u(Rw) là CV% dài hạn của IQC, u(bias) = √(Bias² + u(Cref)²) từ EQA/EQC, u(cal) chép từ CoA của calibrator; u<sub>c</sub> = √(Σu²) và U = 2·u<sub>c</sub> (xấp xỉ 95%). Giới hạn MU cho phép (MAU) do SOP của đơn vị ấn định — báo cáo này không tự kết luận đạt/không đạt. Ngân sách còn thiếu thành phần không được công bố như một giá trị MU hoàn chỉnh.</p>';

  function sigmaMuPrintCard(t: any, row: any, levels: any[]) {
    const trace = sigmaMuTrace(row, levels);
    return '<div class="rpt-card"><h3>Độ không đảm bảo đo (MU) — ISO 15189:2022 §7.3.4</h3><div class="body">' +
      '<table><tr><th>Mức</th><th>u(Rw) %</th><th>u(bias) %</th><th>u(cal) %</th><th>u<sub>c</sub> %</th><th>U (k=2) %</th><th>U tại Mean</th><th>Trạng thái</th></tr>' + sigmaMuPrintRows(t, row, levels) + '</table>' +
      (trace.length ? '<p class="hint">' + trace.join('<br>') + '</p>' : '') + SIGMA_MU_PRINT_NOTE + '</div></div>';
  }

  async function printSigmaPeriod(periodId: string) {
    const t = deps.findTest(deps.sgTest()), entry = t && deps.sgData(t.id).find((x: any) => x.id === periodId); if (!t || !entry) { await deps.infoDialog('Chưa chọn được kỳ Sigma để in.'); return; }
    const levels = deps.sgVisibleLevels(t), row = deps.sgRows(t, [entry], levels)[0], exportRows = deps.sigmaReportRows(t.id, 'period', entry.period, entry.id); if (!row || !row.rs.some(Boolean) || !exportRows.length) { await deps.infoDialog('Kỳ này chưa đủ dữ liệu Sigma để tạo báo cáo in.'); return; }
    const period = deps.vnPeriod(entry.period) || entry.period || '?', trace = deps.sigmaTeaTrace(exportRows), valid = row.rs.some((r: any) => r && r.classifiable) ? [row] : [], machine = deps.instrumentName(t.instrumentId, t.machine) || t.machine || '—';
    let body = reportHeader('BÁO CÁO SIX SIGMA — ' + deps.escape(deps.testDisplayName(t)) + ' — ' + deps.escape(period), 'Đánh giá hiệu năng phương pháp theo kỳ');
    body += '<table><tr><th class="rpt-key-18">Xét nghiệm</th><td>' + deps.escape(deps.testDisplayName(t)) + (t.unit ? ' · ' + deps.escape(t.unit) : '') + '</td><th class="rpt-key-15">Kỳ báo cáo</th><td>' + deps.escape(period) + '</td></tr><tr><th>Thiết bị</th><td>' + deps.escape(machine) + '</td><th>Nguồn TEa</th><td>' + deps.escape(trace || 'Chưa có thông tin truy xuất') + '</td></tr></table>';
    body += '<div class="rpt-card"><h3>Kết quả Six Sigma theo mức QC</h3><div class="body"><table><tr><th>Mức</th><th>TEa (%)</th><th>Sigma</th><th>Xếp loại</th><th>CV IQC (%)</th><th>Bias EQA (%)</th><th>DPMO</th><th>Yield</th><th>Nguồn CV</th><th>Trạng thái dữ liệu</th></tr>' + sigmaPeriodPrintRows(row, levels) + '</table><p class="soft-note">DPMO và Yield là quy đổi tham khảo với dịch 1,5σ. CV nhập tay vẫn được tính Sigma nhưng không dùng để tự động đề xuất thiết kế QC.</p></div></div>';
    body += '<div class="rpt-card"><h3>Thiết kế QC theo Sigma (OPSpecs)</h3><div class="body">' + deps.sgFrequencyHTML(t, row, levels) + '</div></div>';
    body += sigmaMuPrintCard(t, row, levels);
    if (valid.length) body += '<div class="rpt-chart-grid"><div class="rpt-card rpt-chart"><h3>Biểu đồ Sigma</h3><div class="body">' + deps.sgTrendSVG(t, valid, levels) + '</div></div><div class="rpt-card rpt-chart"><h3>Biểu đồ Quyết định Phương pháp (MDC)</h3><div class="body">' + deps.sgMDCSVG(t, valid, levels) + '</div></div></div>';
    else body += '<p class="soft-note">Kỳ này chưa có mức đủ điều kiện phân loại để vẽ biểu đồ Sigma và MDC.</p>';
    body += signBlock(); await deps.openPrint('Báo cáo Six Sigma — ' + deps.testDisplayName(t) + ' — ' + period, body, { landscape: true });
  }

  async function printSigmaPeriods() {
    const t = deps.findTest(deps.sgTest()); if (!t) { await deps.infoDialog('Chưa chọn xét nghiệm để in.'); return; }
    const levels = deps.sgVisibleLevels(t), rows = deps.sgRows(t, deps.sgData(t.id), levels), exportRows = deps.sigmaReportRows(t.id, 'all'); if (!rows.some((row: any) => row.rs.some(Boolean)) || !exportRows.length) { await deps.infoDialog('Xét nghiệm này chưa có kỳ Sigma đủ dữ liệu để tạo báo cáo in tổng hợp.'); return; }
    const valid = rows.filter((row: any) => row.rs.some((r: any) => r && r.classifiable)), periods = deps.sigmaExportPeriods(exportRows), trace = deps.sigmaTeaTrace(exportRows), machine = deps.instrumentName(t.instrumentId, t.machine) || t.machine || '—';
    let body = reportHeader('BÁO CÁO TỔNG HỢP SIX SIGMA THEO KỲ — ' + deps.escape(deps.testDisplayName(t)), 'So sánh hiệu năng phương pháp giữa các kỳ đánh giá');
    body += '<table><tr><th class="rpt-key-18">Xét nghiệm</th><td>' + deps.escape(deps.testDisplayName(t)) + (t.unit ? ' · ' + deps.escape(t.unit) : '') + '</td><th class="rpt-key-15">Các kỳ báo cáo</th><td>' + deps.escape(periods || '—') + '</td></tr><tr><th>Thiết bị</th><td>' + deps.escape(machine) + '</td><th>Nguồn TEa</th><td>' + deps.escape(trace || 'Chưa có thông tin truy xuất') + '</td></tr></table>';
    body += '<div class="rpt-card"><h3>So sánh kết quả Six Sigma theo kỳ</h3><div class="body"><table><tr><th>Kỳ</th><th>Mức</th><th>TEa (%)</th><th>Sigma</th><th>Xếp loại</th><th>CV IQC (%)</th><th>Bias EQA (%)</th><th>DPMO</th><th>Yield</th><th>Nguồn CV</th><th>Trạng thái dữ liệu</th></tr>' + sigmaPeriodsPrintRows(rows, levels) + '</table><p class="soft-note">DPMO và Yield là quy đổi tham khảo với dịch 1,5σ. CV nhập tay vẫn được tính Sigma nhưng không dùng để tự động đề xuất thiết kế QC.</p></div></div>';
    body += '<div class="rpt-card"><h3>Độ không đảm bảo đo (MU) theo kỳ — ISO 15189:2022 §7.3.4</h3><div class="body"><table><tr><th>Kỳ</th><th>Mức</th><th>u(Rw) %</th><th>u(bias) %</th><th>u(cal) %</th><th>u<sub>c</sub> %</th><th>U (k=2) %</th><th>U tại Mean</th><th>Trạng thái</th></tr>' + sigmaMuPeriodsPrintRows(t, rows, levels) + '</table>' + SIGMA_MU_PRINT_NOTE + '</div></div>';
    if (valid.length) body += '<div class="rpt-chart-grid"><div class="rpt-card rpt-chart"><h3>Xu hướng Sigma theo kỳ</h3><div class="body">' + deps.sgTrendSVG(t, valid, levels) + '</div></div><div class="rpt-card rpt-chart"><h3>Biểu đồ Quyết định Phương pháp (MDC)</h3><div class="body">' + deps.sgMDCSVG(t, valid, levels) + '</div></div></div>';
    else body += '<p class="soft-note">Các kỳ hiện có chưa đủ điều kiện phân loại để vẽ biểu đồ Sigma và MDC.</p>';
    body += signBlock(); await deps.openPrint('Báo cáo tổng hợp Six Sigma theo kỳ — ' + deps.testDisplayName(t), body, { landscape: true });
  }

  async function printWestgard() {
    const t = deps.findTest(deps.selTest()); if (!t) { await deps.infoDialog('Chưa chọn được xét nghiệm để in.'); return; }
    const wg = deps.activeWestgard(t); if (!wg.views.length) { await deps.infoDialog('Xét nghiệm này chưa có mức QC đang vận hành để in.'); return; }
    const machine = deps.instrumentName(t.instrumentId, t.machine) || t.machine || '—', withinRules = deps.wgRules().filter(r => deps.testRuleOnWithin(t, r)).join(', ') || 'Không có', acrossRules = deps.wgRules().filter(r => deps.testRuleOnAcross(t, r)).join(', ') || 'Không có';
    let body = reportHeader('PHÂN TÍCH WESTGARD — ' + deps.escape(deps.testDisplayName(t)), 'Đối chiếu luật theo mức QC, lô và lần chạy');
    body += '<table><tr><th class="rpt-key-20">Xét nghiệm</th><td>' + deps.escape(deps.testDisplayName(t)) + (t.unit ? ' · ' + deps.escape(t.unit) : '') + '</td><th class="rpt-key-18">Thiết bị</th><td>' + deps.escape(machine) + '</td></tr><tr><th>Luật theo từng mức</th><td colspan="3">' + deps.escape(withinRules) + '</td></tr><tr><th>Luật liên mức / lần chạy</th><td colspan="3">' + deps.escape(acrossRules) + '</td></tr></table>';
    const multiViews = wg.views.map((v: any) => ({ level: v.l.level, lot: v.l.lot, mean: v.l.mean, sd: v.l.sd, pts: v.pts, label: 'M' + v.l.level + '·' + (v.l.lot || '?') }));
    if (multiViews.filter((v: any) => v.pts.length).length >= 2) body += '<h3>Levey-Jennings tổng hợp theo Z-score</h3><img src="' + deps.ljMultiDataURL(multiViews, t) + '">';
    wg.views.forEach((v: any) => {
      const l = v.l, prevSeries = deps.previousLotSeries(t, l.level), prevOpen = deps.wgPrevOpenHas(t.id + '|' + l.level);
      if (prevOpen && prevSeries.length) {
        const s = prevSeries[0], wgP = deps.westgardByPoint(s.pts, s.mean, s.sd, (rule: string) => deps.testRuleOnWithin(t, rule));
        body += '<h3>Mức ' + l.level + ' — Lô cũ ' + deps.escape(s.lot) + ' · đã chuyển tiếp (Mean=' + reportQcValue(t, s.mean) + ', SD=' + reportQcStat(t, s.sd) + ')</h3>';
        body += '<p class="soft-note">Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).</p>';
        body += '<img src="' + deps.ljDataURL(s.pts, s.mean, s.sd) + '">';
        const viol = s.pts.map((p: any, i: number) => { const raw = wgP.F[i] || { rules: [] }; return { p, f: { ...raw, level: deps.ruleResultLevel(t, raw.rules || []) }, z: wgP.zs[i] }; }).filter((o: any) => o.f.level !== 'ok');
        body += viol.length ? '<p class="rpt-section-label"><b>Điểm vi phạm/cảnh báo (lô cũ):</b></p>' + reportPointsTableHtml(viol, t) : '<p><i>Không có điểm vi phạm/cảnh báo (lô cũ).</i></p>';
        return;
      }
      body += '<h3>Mức ' + l.level + ' — Lô ' + deps.escape(l.lot || '?') + ' (Mean=' + reportQcValue(t, l.mean) + ', SD=' + reportQcStat(t, l.sd) + ')</h3>';
      if (!v.pts.length) { body += '<p><i>Chưa có dữ liệu QC ở mức này.</i></p>'; return; }
      body += '<img src="' + deps.ljDataURL(v.pts, l.mean, l.sd) + '">';
      const viol = v.pts.map((p: any) => { const f = wg.byPoint.get(p.id) || { level: 'ok', rules: [], z: (p.val - l.mean) / l.sd }; return { p, f, z: f.z }; }).filter((o: any) => o.f.level !== 'ok');
      body += viol.length ? '<p class="rpt-section-label"><b>Điểm vi phạm/cảnh báo:</b></p>' + reportPointsTableHtml(viol, t) : '<p><i>Không có điểm vi phạm/cảnh báo.</i></p>';
    });
    body += signBlock(); await deps.openPrint('Phân tích Westgard — ' + deps.testDisplayName(t), body);
  }

  function reportPointsTableHtml(items: any[], t: any) { return deps.reportPointsTableService(items, t); }
  function reportNceSummaryHtml(a: any) { return deps.actionReportHtml.summary(deps.reportNceSummaryParts(a)); }
  function reportNceDetailField(label: any, value: any, wide = false) { return deps.actionReportHtml.detailField(label, value, wide); }
  function reportNceDetailHtml(a: any, t: any) { return deps.reportNceDetailHtmlPresentation(a, t); }
  function reportNceAppendixHtml(actions: any[], t: any) { return deps.reportNceAppendixPresentation(actions, t); }

  async function printReport() {
    const { tid, t, start, end, includeNceAppendix } = deps.reportExportSelection(); if (!t) return;
    const inMonth = deps.reportInRange(start, end), wg = deps.activeWestgard(t);
    let body = reportHeader('BÁO CÁO NỘI KIỂM CHẤT LƯỢNG XÉT NGHIỆM');
    const { teaVal, teaSourceText } = deps.reportTeaInfo(t);
    body += '<table><tr><th class="rpt-key-25">Xét nghiệm</th><td>' + deps.escape(deps.testDisplayName(t)) + (t.unit ? ' · ' + deps.escape(t.unit) : '') + '</td><th class="rpt-key-18">Máy</th><td>' + deps.escape(t.machine || '') + '</td></tr>' +
      '<tr><th>Khoảng ngày báo cáo</th><td>' + deps.escape(deps.reportRangeText(start, end)) + '</td><th>TEa%</th><td>' + (teaVal || '—') + '</td></tr>' +
      '<tr><th>Nguồn TEa</th><td colspan="3">' + deps.escape(teaSourceText) + (deps.sgTeaRefText(t) ? ' · ' + deps.escape(deps.sgTeaRefText(t)) : '') + (t.teaDoc ? ' · ' + deps.escape(t.teaDoc) : '') + (t.teaEffectiveDate ? ' · hiệu lực ' + deps.vnDate(t.teaEffectiveDate) : '') + (t.teaApprovedBy ? ' · duyệt ' + deps.escape(t.teaApprovedBy) : '') + '</td></tr></table>';
    body += '<p class="soft-note">Cột "Sigma (kỳ)" dưới đây tính từ Mean/CV thực tế trong đúng khoảng ngày báo cáo này — khác với Sigma đã thẩm định ở trang Six Sigma &amp; Sai số (dùng CV IQC và Bias EQA/EQC đã rà soát). Hai số có thể khác nhau; dấu * bên cạnh Sigma nghĩa là kỳ này có n &lt; 20 kết quả, CV/Sigma chưa đủ ổn định để tham khảo.</p>';
    const multiViews = deps.reportMultiViews(t, inMonth);
    if (multiViews.filter((v: any) => v.pts.length).length >= 2) {
      body += '<h3>Levey-Jennings tổng hợp theo Z-score</h3>';
      body += '<img src="' + deps.ljMultiDataURL(multiViews, t) + '">';
    }
    deps.operationalLevels(t).forEach((l: any) => {
      deps.previousLotSeries(t, l.level).forEach((s: any) => {
        const { inPts, items: allS } = deps.reportPrevLotRows(t, s, inMonth); if (!inPts.length) return;
        body += '<h3>Mức ' + l.level + ' — Lô cũ ' + deps.escape(s.lot) + ' · đã chuyển tiếp (Mean=' + reportQcValue(t, s.mean) + ', SD=' + reportQcStat(t, s.sd) + ')</h3>';
        body += '<p class="soft-note">Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy) — phạm vi hẹp hơn lô đang dùng ở mục bên dưới.</p>';
        body += '<img src="' + deps.ljDataURL(inPts, s.mean, s.sd) + '">';
        const { st: stS, bias: biasS, te: teS, sigma: sigmaS } = deps.reportLevelStats(inPts, s.mean, teaVal);
        body += '<table><tr><th>n</th><th class="num">Mean thực</th><th class="num">SD</th><th class="num">CV%</th><th class="num">Bias%</th><th class="num">TE%</th><th class="num">TEa%</th><th class="num">Sigma (kỳ)</th></tr>' +
          '<tr><td>' + stS.n + '</td><td class="num">' + reportQcValue(t, stS.m) + '</td><td class="num">' + reportQcStat(t, stS.sd) + '</td><td class="num">' + deps.format(stS.cv) + '</td><td class="num">' + deps.format(biasS) + '</td><td class="num">' + deps.format(teS) + '</td><td class="num">' + (teaVal || '—') + '</td><td class="num">' + (sigmaS == null ? '—' : deps.format(sigmaS, 1) + (stS.n < 20 ? ' *' : '')) + '</td></tr></table>';
        body += '<p class="rpt-section-label"><b>Điểm trong khoảng xem (lô cũ):</b></p>' + reportPointsTableHtml(allS, t);
        const violS = allS.filter((o: any) => o.f.level !== 'ok');
        if (violS.length) {
          body += '<p class="rpt-section-label"><b>Điểm vi phạm/cảnh báo (lô cũ):</b></p><table><tr><th>Ngày</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Luật</th><th>Loại sai số</th></tr>' +
            violS.map((o: any) => '<tr><td>' + deps.vnDate(o.p.date) + '</td><td>' + deps.escape(deps.pointStaff(o.p).code || '—') + '</td><td class="num">' + reportQcPoint(o.p, t) + '</td><td class="num">' + (o.z >= 0 ? '+' : '') + deps.format(o.z) + 's</td><td>' + [...new Set(o.f.rules)].join(', ') + '</td><td>' + deps.errorType([...new Set(o.f.rules)] as string[]) + '</td></tr>').join('') + '</table>';
        }
        else body += '<p><i>Không có điểm vi phạm trong khoảng ngày đã chọn (lô cũ).</i></p>';
      });
      const { pts, items: all } = deps.reportLevelRows(t, l, wg, inMonth);
      body += '<h3>Mức ' + l.level + ' — Lô ' + deps.escape(l.lot || '?') + ' · Dải ' + (l.applied === 'lab' ? 'PXN' : 'NSX') + ' (Mean=' + reportQcValue(t, l.mean) + ', SD=' + reportQcStat(t, l.sd) + ')</h3>';
      if (!pts.length) { body += '<p><i>Không có dữ liệu trong khoảng ngày đã chọn.</i></p>'; return; }
      body += '<img src="' + deps.ljDataURL(pts, l.mean, l.sd) + '">';
      const { st, bias, te, sigma } = deps.reportLevelStats(pts, l.mean, teaVal);
      body += '<table><tr><th>n</th><th class="num">Mean thực</th><th class="num">SD</th><th class="num">CV%</th><th class="num">Bias%</th><th class="num">TE%</th><th class="num">TEa%</th><th class="num">Sigma (kỳ)</th></tr>' +
        '<tr><td>' + st.n + '</td><td class="num">' + reportQcValue(t, st.m) + '</td><td class="num">' + reportQcStat(t, st.sd) + '</td><td class="num">' + deps.format(st.cv) + '</td><td class="num">' + deps.format(bias) + '</td><td class="num">' + deps.format(te) + '</td><td class="num">' + (teaVal || '—') + '</td><td class="num">' + (sigma == null ? '—' : deps.format(sigma, 1) + (st.n < 20 ? ' *' : '')) + '</td></tr></table>';
      body += '<p class="rpt-section-label"><b>Điểm trong khoảng xem:</b></p>' + reportPointsTableHtml(all, t);
      const viol = all.filter((o: any) => o.f.level !== 'ok');
      if (viol.length) {
        body += '<p class="rpt-section-label"><b>Điểm vi phạm/cảnh báo:</b></p><table><tr><th>Ngày</th><th>NV</th><th class="num">Giá trị</th><th class="num">Z</th><th>Luật</th><th>Loại sai số</th></tr>' +
          viol.map((o: any) => '<tr><td>' + deps.vnDate(o.p.date) + '</td><td>' + deps.escape(deps.pointStaff(o.p).code || '—') + '</td><td class="num">' + reportQcPoint(o.p, t) + '</td><td class="num">' + (o.z >= 0 ? '+' : '') + deps.format(o.z) + 's</td><td>' + [...new Set(o.f.rules)].join(', ') + '</td><td>' + deps.errorType([...new Set(o.f.rules)] as string[]) + '</td></tr>').join('') + '</table>';
      }
      else body += '<p><i>Không có điểm vi phạm trong khoảng ngày đã chọn.</i></p>';
    });
    const acts = deps.reportActionsInRange(tid, inMonth);
    if (acts.length) {
      body += '<h3>Hành động khắc phục trong khoảng ngày đã chọn</h3><p class="soft-note">Bảng dưới đây là bản tóm tắt. Nội dung đầy đủ nằm trong phụ lục NCE khi tùy chọn kèm phụ lục được bật.</p><table class="nce-summary-table"><tr><th>Ngày / mã NCE</th><th>Mức / lô</th><th>Luật / loại SS</th><th>Tóm tắt xử lý</th><th>Người</th><th>QC chạy lại</th><th>Duyệt</th><th>Khép vòng</th></tr>' +
        acts.map((a: any) => { const m = deps.reportNceModel(a, t), rr = deps.actionRerunStatus(a); return '<tr><td>' + (a.nceId ? '<b>' + deps.escape(a.nceId) + '</b><br>' : '') + m.eventDateText + '</td><td>' + deps.escape(deps.actionLevelShort(t, a.level, a.lot)) + '</td><td>' + deps.escape(a.rule || '—') + '<br><span class="muted">' + deps.escape(a.errorType || '—') + '</span></td><td class="nce-summary-cell">' + reportNceSummaryHtml(a) + '</td><td>' + deps.escape(a.by || '—') + '</td><td>' + deps.escape(rr.label || '—') + '</td><td>' + deps.escape(deps.actionApprovalLabel(a)) + (a.approvedBy ? '<br><span class="muted">' + deps.escape(a.approvedBy) + '</span>' : '') + '</td><td>' + deps.escape(m.wfLabel) + '</td></tr>'; }).join('') + '</table>';
    }
    body += signBlock();
    if (acts.length && includeNceAppendix) body += reportNceAppendixHtml(acts, t);
    await deps.openPrint('Báo cáo nội kiểm — ' + deps.testDisplayName(t), body);
  }

  async function printRangeForm(tid: string, level: number) {
    const t = deps.findTest(tid); const l = deps.lvlCfg(t, level), pts = deps.operationalLotPoints(t, level);
    const c = deps.stats(pts.map((p: any) => p.val)), days = new Set(pts.map((p: any) => p.date)).size; if (!c) { await deps.infoDialog('Chưa đủ dữ liệu.'); return; }
    let body = reportHeader('BIỂU MẪU THIẾT LẬP DẢI KIỂM SOÁT QC MỚI');
    body += '<table><tr><th class="rpt-key-25">Xét nghiệm</th><td>' + deps.escape(deps.testDisplayName(t)) + (t.unit ? ' · ' + deps.escape(t.unit) : '') + '</td><th class="rpt-key-18">Mức / Lô</th><td>M' + level + ' / ' + deps.escape(l.lot || '?') + '</td></tr>' +
      '<tr><th>Máy</th><td>' + deps.escape(t.machine || '') + '</td><th>Số kết quả / ngày độc lập</th><td>' + c.n + ' / ' + days + '</td></tr></table>';
    body += '<h3>So sánh dải kiểm soát</h3><table><tr><th></th><th class="num">Mean</th><th class="num">SD</th><th class="num">CV%</th><th class="num">±2SD</th></tr>' +
      '<tr><td>Dải nhà sản xuất / hiện tại</td><td class="num">' + reportQcValue(t, l.mean) + '</td><td class="num">' + reportQcStat(t, l.sd) + '</td><td class="num">' + deps.format(l.mean ? l.sd / Math.abs(l.mean) * 100 : 0) + '</td><td class="num">' + reportQcValue(t, l.mean - 2 * l.sd) + ' – ' + reportQcValue(t, l.mean + 2 * l.sd) + '</td></tr>' +
      '<tr><td><b>Dải PXN đề xuất</b></td><td class="num"><b>' + reportQcValue(t, c.m) + '</b></td><td class="num"><b>' + reportQcStat(t, c.sd) + '</b></td><td class="num"><b>' + deps.format(c.cv) + '</b></td><td class="num"><b>' + reportQcValue(t, c.m - 2 * c.sd) + ' – ' + reportQcValue(t, c.m + 2 * c.sd) + '</b></td></tr></table>';
    body += '<img src="' + deps.ljDataURL(pts, c.m, c.sd) + '">';
    body += '<p class="rpt-section-label"><b>Điều kiện:</b> tối thiểu 20 kết quả trên 20 ngày độc lập, cùng lô QC, không có điểm vi phạm/cảnh báo chưa xử lý; áp dụng khi hệ thống ổn định và được phê duyệt theo SOP.</p>';
    body += '<p>Kết luận: ☐ Áp dụng dải PXN mới &nbsp;&nbsp; ☐ Giữ dải nhà sản xuất</p>';
    body += signBlock(); await deps.openPrint('Biểu mẫu thiết lập dải QC — ' + deps.testDisplayName(t), body);
  }

  return {
    reportQcValue, reportQcStat, reportQcPoint, reportHeader, signBlock, openPrint: openPrintImpl,
    sigmaPeriodPrintRows, sigmaPeriodsPrintRows, sigmaMuPrintRows, sigmaMuPeriodsPrintRows, sigmaMuTrace, sigmaMuPrintCard,
    printSigmaPeriod, printSigmaPeriods, printWestgard,
    reportPointsTableHtml, reportNceSummaryHtml, reportNceDetailField, reportNceDetailHtml, reportNceAppendixHtml,
    printReport, printRangeForm,
  };
}

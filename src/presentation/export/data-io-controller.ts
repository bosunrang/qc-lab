export interface DataIoControllerDeps {
  cssTokenPixel: (token: string, fallback: number) => number;
  sigmaCanvasFont: (weight: number, token: string, fallback: number) => string;
  exportMetaRowsService: (kind: string) => any[][];
  reportExportHelpers: {
    inRange: (start: string, end: string) => (value: unknown) => boolean;
    nceExcerpt: (value: unknown, max?: number) => string;
    sigmaLevels: (row: any) => any[];
    periodLabel: (value: unknown) => string;
    mdcPeriodLabel: (value: unknown) => string;
    exportPeriods: (rows: any[]) => string;
  };
  qcReportContext: {
    teaInfo: (t: any) => { teaVal: number | null; teaSourceText: string };
    multiViews: (t: any, inRange: (value: unknown) => boolean) => any[];
  };
  qcReportRowsService: {
    previousLot: (t: any, s: any, inRange: (value: unknown) => boolean) => { inPts: any[]; items: any[] };
    currentLot: (t: any, l: any, wg: any, inRange: (value: unknown) => boolean) => { pts: any[]; items: any[] };
    actions: (tid: string, inRange: (value: unknown) => boolean) => any[];
  };
  actionReportSummary: (a: any) => any[][];
  actionReportModel: (a: any, t: any) => any;
  qcReportCsvRows: (tid: string, start: string, end: string) => any[][];
  csvDownload: (name: string, rows: any[][]) => void;
  nceCsvRow: (a: any) => any[];
  blobDownload: (name: string, blob: Blob) => void;
  sigmaReportMetricService: (r: any) => any;
  sigmaReportRowsService: (onlyTestId: string, mode: string, period: string, periodId: string) => any[];
  sigmaDataUrlBytes: (durl: string) => Uint8Array;
  sigmaExportPixelRatioService: (W: number, H: number, scale: number, maxDimension: number) => number;
  sigmaCanvasFactory: (W: number, H: number, scale: number) => any;
  sigmaChartRenderer: (rows: any[]) => any;
  sigmaMdcItemsService: (rows: any[]) => any;
  sigmaMdcLabelPlacementService: (items: any, X: any, Y: any, ctx: any, bounds: any) => any;
  sigmaMdcRenderer: (rows: any[]) => any;
  xlsxUtf8: (text: string) => Uint8Array;
  xlsxEscape: (text: string) => string;
  xlsxZip: (files: { name: string; data: Uint8Array }[]) => Uint8Array;
  xlsxEmu: (px: number) => number;
  xlsxColumns: string[];
  xlsxCells: { text: (ref: string, style: number, value: unknown) => string; number: (ref: string, style: number, value: unknown) => string };
  xlsxRound: (value: number, digits: number) => number;
  xlsxPeriodNumber: (value: unknown) => number | string;
  xlsxDrawing: (images: any[], chartStartRow0: number) => string;
  sigmaXlsxStyles: () => string;
  renameSigmaXlsxSheet: (bytes: Uint8Array, sheetName: string) => Uint8Array;
  reportXlsxStyleIds: Record<string, number>;
  reportXlsxBuild: (doc: any) => Uint8Array;
  reportXlsxHeader: (opts: any) => { rows: any[]; merges: string[]; rowHeights: Record<number, number> };
  westgardXlsxHeader: (opts: any) => { rows: any[]; merges: string[]; rowHeights: Record<number, number> };
  westgardXlsxRows: { detail: (o: any, index: number) => any };
  sigmaExportMetaService: { meta: () => { app: any; rules: string }; teaTrace: (rows: any[]) => string };
  qcExportValueFormat: { value: (t: any, value: unknown) => string; stat: (t: any, value: unknown) => string };
  errorType: (rules: string[]) => string;
  activeWestgard: (t: any) => any;
  operationalLevels: (t: any) => any[];
  previousLotSeries?: (t: any, level: unknown) => any[];
  reportLevelStats: (pts: any[], mean: number, teaVal: number | null) => any;
  pointStaff: (p: any) => any;
  ruleResultLevel: (t: any, rules: string[]) => string;
  testRuleOnWithin: (t: any, rule: string) => boolean;
  testRuleOnAcross: (t: any, rule: string) => boolean;
  instrumentName: (instrumentId: unknown, machine: unknown) => string;
  testDisplayName: (t: any) => string;
  formatDateTimeVN: (value: string) => string;
  userName: () => string;
  vnDate: (value: unknown) => string;
  vnPeriod: (value: unknown) => string;
  stateName: (value: unknown) => string;
  safeName: (value: unknown) => string;
  format: (value: unknown, decimals?: number) => string;
  infoDialog: (message: string) => Promise<unknown>;
  actionLevelShort: (t: any, level: unknown, lot: unknown) => string;
  actionRerunStatus?: (a: any) => { label: string };
  actionApprovalLabel?: (a: any) => string;
  ljDataURL?: (points: any[], mean: number, sd: number) => string;
  ljMultiDataURL?: (levelViews: any[], test: any, opts?: { divider?: boolean }) => string;
  wgMultiViews?: (t: any) => any[];
  wgPrevOpenHas: (key: string) => boolean;
  sgTeaRefText?: (t: any) => string;
  sgData: (tid: string) => any[];
  reportExportSelection: () => { tid: string; t: any; start: string; end: string; includeNceAppendix: boolean };
  reportRangeText: (start: string, end: string) => string;
  westgardByPoint: (points: any[], mean: number, sd: number, scope: (rule: string) => boolean) => any;
  wgRules: () => readonly string[];
  findTest: (id: string) => any;
  lab: () => any;
  westgardRules: () => any;
  actions: () => any[];
  appMeta: () => any;
  selTest: () => string;
  sgTest: () => string;
  exportMetaRows: (kind?: string) => any[][];
}

export function createDataIoController(deps: DataIoControllerDeps) {
  function dataIoTypePx(token: string, fallback: number) { return deps.cssTokenPixel(token, fallback); }
  function dataIoCanvasFont(weight: number, token: string, fallback: number) { return deps.sigmaCanvasFont(weight, token, fallback); }
  function exportMetaRowsImpl(kind = 'Báo cáo') { return deps.exportMetaRowsService(kind); }

  function reportInRange(start: string, end: string) { return deps.reportExportHelpers.inRange(start, end); }
  function reportTeaInfo(t: any) { return deps.qcReportContext.teaInfo(t); }
  function reportMultiViews(t: any, inRange: (value: unknown) => boolean) { return deps.qcReportContext.multiViews(t, inRange); }
  function reportPrevLotRows(t: any, s: any, inRange: (value: unknown) => boolean) { return deps.qcReportRowsService.previousLot(t, s, inRange); }
  function reportLevelRows(t: any, l: any, wg: any, inRange: (value: unknown) => boolean) { return deps.qcReportRowsService.currentLot(t, l, wg, inRange); }
  function reportActionsInRange(tid: string, inRange: (value: unknown) => boolean) { return deps.qcReportRowsService.actions(tid, inRange); }
  function reportNceExcerpt(value: unknown, max = 150) { return deps.reportExportHelpers.nceExcerpt(value, max); }
  function reportNceSummaryParts(a: any) { return deps.actionReportSummary(a); }
  function reportNceModel(a: any, t: any) { return deps.actionReportModel(a, t); }

  function exportReportCSV() {
    const { tid, t, start, end } = deps.reportExportSelection(); if (!t) return;
    const label = start || end ? (start || 'batdau') + '_' + (end || 'hientai') : 'toanbo', rows = deps.qcReportCsvRows(tid, start, end);
    deps.csvDownload('Bao_cao_IQC_' + deps.safeName(t.name) + '_' + deps.safeName(label) + '.csv', rows);
  }

  function exportActionsCSV() {
    const rows = [...deps.exportMetaRows('Nhật ký khắc phục'), [], ['Mã NCE', 'Ngày xảy ra', 'Thời điểm mở hồ sơ', 'Nguồn phát hiện', 'Giai đoạn', 'Xét nghiệm', 'Mức / lô', 'Luật', 'Loại sai số', 'Hành động', 'Điều tra & ảnh hưởng', 'Bias trước khắc phục (%)', 'Bias sau khắc phục (%)', 'Người phụ trách', 'Hạn hoàn thành', 'S ban đầu', 'O ban đầu', 'D ban đầu', 'RPN ban đầu', 'Phân loại nguy cơ', 'Căn cứ SOP', 'Quyết định cho phép trở lại', 'Ngày cho phép', 'Người cho phép', 'Căn cứ cho phép', 'QC chạy lại', 'Kết luận hiệu lực', 'Ngày đánh giá hiệu lực', 'Bằng chứng hiệu lực', 'Người đánh giá', 'S còn lại', 'O còn lại', 'D còn lại', 'RPN còn lại', 'Phân loại nguy cơ còn lại', 'Căn cứ đánh giá lại', 'Trạng thái duyệt', 'Người duyệt', 'Thời điểm duyệt', 'Ý kiến duyệt', 'Lý do trả lại', 'Người trả lại', 'Thời điểm trả lại', 'Trạng thái bản ghi', 'Lý do hủy', 'Người hủy', 'Thời điểm hủy', 'Hồ sơ trước', 'Hồ sơ tiếp theo', 'Trạng thái hồ sơ']];
    (deps.actions() || []).forEach((a: any) => { rows.push(deps.nceCsvRow(a)); });
    deps.csvDownload('Nhat_ky_khac_phuc_QC.csv', rows);
  }

  function downloadBlob(name: string, blob: Blob) { return deps.blobDownload(name, blob); }
  function sigmaReportMetric(r: any) { return deps.sigmaReportMetricService(r); }
  function sigmaReportRows(onlyTestId = '', mode = 'latest', period = '', periodId = '') { return deps.sigmaReportRowsService(onlyTestId, mode, period, periodId); }
  function sigmaLevelsOf(row: any) { return deps.reportExportHelpers.sigmaLevels(row); }
  function sigmaDataURLBytes(durl: string) { return deps.sigmaDataUrlBytes(durl); }
  const SIGMA_EXPORT_PIXEL_RATIO = 6, SIGMA_EXPORT_MAX_DIMENSION = 16384;
  function sigmaExportPixelRatio(W: number, H: number, scale = SIGMA_EXPORT_PIXEL_RATIO) { return deps.sigmaExportPixelRatioService(W, H, scale, SIGMA_EXPORT_MAX_DIMENSION); }
  function sigmaCanvas(W: number, H: number, scale: number) { return deps.sigmaCanvasFactory(W, H, scale); }
  function drawSigmaReportChart(rows: any[]) { return deps.sigmaChartRenderer(rows); }
  function sigmaMdcItems(rows: any[]) { return deps.sigmaMdcItemsService(rows); }
  function sigmaPeriodLabel(value: unknown) { return deps.reportExportHelpers.periodLabel(value); }
  function sigmaMdcPeriodLabel(value: unknown) { return deps.reportExportHelpers.mdcPeriodLabel(value); }
  function sigmaExportPeriods(rows: any[]) { return deps.reportExportHelpers.exportPeriods(rows); }
  function sigmaMdcLabelPlacements(items: any, X: any, Y: any, ctx: any, bounds: any) { return deps.sigmaMdcLabelPlacementService(items, X, Y, ctx, bounds); }

  const XlsxCore = (() => {
    const u8 = deps.xlsxUtf8, escX = deps.xlsxEscape;
    const zip = deps.xlsxZip;
    const emu = deps.xlsxEmu, COLS = deps.xlsxColumns;
    const cells = deps.xlsxCells, cellStr = cells.text, cellNum = cells.number;
    const r2 = (x: number) => deps.xlsxRound(x, 2), r4 = (x: number) => deps.xlsxRound(x, 4);
    return { u8, escX, zip, emu, COLS, cellStr, cellNum, r2, r4 };
  })();

  const DEFAULT_SIGMA_SHEET = 'Tổng hợp Six Sigma';
  const SigmaXlsx = (() => {
    const { u8, escX, zip, COLS, cellStr, cellNum, r2, r4 } = XlsxCore;
    const styles = deps.sigmaXlsxStyles;
    const periodNo = (v: unknown) => deps.xlsxPeriodNumber(v), periodCell = (ref: string, style: number, v: unknown) => { const n = periodNo(v); return typeof n === 'number' && Number.isFinite(n) ? cellNum(ref, style, n) : cellStr(ref, style, n); };
    const sheet = (rows: any[], meta: any, hasDrawing: boolean) => {
      const zoneXf: Record<string, number> = { 'Đẳng cấp thế giới': 9, 'Xuất sắc': 10, 'Tốt': 11, 'Cận biên': 12, 'Không đạt': 13 }, levels: any[] = [], periodMerges: string[] = [], assayMerges: string[] = [];
      (rows || []).forEach((d: any, pIdx: number) => {
        const usable = sigmaLevelsOf(d), items = usable.length ? usable : [{ level: '—', metric: null }], start = levels.length;
        items.forEach((item: any, i: number) => levels.push({ d, item, pIdx, first: i === 0, assayFirst: false }));
        if (items.length > 1) { const r0 = 4 + start, r1 = r0 + items.length - 1; periodMerges.push('B' + r0 + ':B' + r1, 'C' + r0 + ':C' + r1); }
      });
      for (let start = 0; start < levels.length;) {
        let end = start + 1; while (end < levels.length && levels[end].d.name === levels[start].d.name) end++;
        levels[start].assayFirst = true;
        if (end - start > 1) assayMerges.push('A' + (4 + start) + ':A' + (3 + end));
        start = end;
      }
      const out: string[] = [], noteRow = 4 + levels.length;
      out.push('<row r="1" ht="27.75" customHeight="1">' + cellStr('A1', 1, meta.title) + '</row>');
      out.push('<row r="2" ht="36" customHeight="1">' + cellStr('A2', 2, meta.subtitle) + '</row>');
      const H = ['Xét nghiệm', 'Kỳ', 'TEa (%)', 'Mức', 'Sigma', 'Xếp loại', 'CV (%)', 'Bias (%)', 'DPMO', 'Yield (%)', 'n IQC'];
      out.push('<row r="3" ht="39.75" customHeight="1">' + H.map((h, i) => cellStr(COLS[i] + '3', 3, h)).join('') + '</row>');
      levels.forEach((p: any, idx: number) => {
        const rn = 4 + idx, zebra = p.pIdx % 2 === 0, base = zebra ? 6 : 7, name = zebra ? 4 : 5, r = p.item && p.item.metric;
        const cells = [cellStr('A' + rn, name, p.assayFirst ? p.d.name : ''), p.first ? periodCell('B' + rn, base, p.d.period) : cellStr('B' + rn, base, ''), p.first ? cellNum('C' + rn, base, r2(p.d.tea)) : cellStr('C' + rn, base, '')];
        if (!r) { ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => cells.push(cellStr(col + rn, base, '—'))); }
        else { const zx = zoneXf[r.label] || base; cells.push(cellStr('D' + rn, base, p.item.level), cellNum('E' + rn, zx, r2(r.sigma)), cellStr('F' + rn, zx, r.label), cellNum('G' + rn, base, r2(r.cv)), cellNum('H' + rn, base, r2(r.bias)), cellNum('I' + rn, base, Math.round(r.dpmo)), cellNum('J' + rn, base, r4(r.yld)), r.n == null ? cellStr('K' + rn, base, '—') : cellNum('K' + rn, base, r.n)); }
        out.push('<row r="' + rn + '" ht="18" customHeight="1">' + cells.join('') + '</row>');
      });
      out.push('<row r="' + noteRow + '" ht="32" customHeight="1">' + cellStr('A' + noteRow, 14, 'Lưu ý: Không tự quy đổi Sigma thành số bệnh nhân giữa hai lần QC. Tần suất và quy tắc QC phải được phê duyệt theo đánh giá nguy cơ, độ ổn định hệ thống, tải mẫu, hậu quả lâm sàng và SOP của đơn vị.') + '</row>');
      const merges = ['A1:K1', 'A2:K2', 'A' + noteRow + ':K' + noteRow, ...assayMerges, ...periodMerges], cols = '<cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="3" width="11" customWidth="1"/><col min="4" max="4" width="8" customWidth="1"/><col min="5" max="5" width="9" customWidth="1"/><col min="6" max="6" width="20" customWidth="1"/><col min="7" max="11" width="11" customWidth="1"/></cols>';
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:K' + noteRow + '"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="11.4"/>' + cols + '<sheetData>' + out.join('') + '</sheetData><mergeCells count="' + merges.length + '">' + merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>' + (hasDrawing ? '<drawing r:id="rId1"/>' : '') + '</worksheet>';
    };
    const drawing = deps.xlsxDrawing;
    const build = (rows: any[], meta: any, images: any[] = []) => {
      images = images.filter(im => im && im.bytes && im.bytes.length);
      const hasDraw = images.length > 0, levelCount = (rows || []).reduce((n, d) => n + Math.max(1, sigmaLevelsOf(d).length), 0), noteRow = 4 + levelCount, chartStartRow0 = noteRow + 1,
        ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + (hasDraw ? '<Default Extension="png" ContentType="image/png"/>' : '') + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + (hasDraw ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') + '</Types>';
      const files: { name: string; data: Uint8Array }[] = [{ name: '[Content_Types].xml', data: u8(ct) }, { name: '_rels/.rels', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') }, { name: 'xl/workbook.xml', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + escX('Tổng hợp Six Sigma') + '" sheetId="1" r:id="rId1"/></sheets></workbook>') }, { name: 'xl/_rels/workbook.xml.rels', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') }, { name: 'xl/styles.xml', data: u8(styles()) }, { name: 'xl/worksheets/sheet1.xml', data: u8(sheet(rows, meta, hasDraw)) }];
      if (hasDraw) {
        files.push({ name: 'xl/worksheets/_rels/sheet1.xml.rels', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>') });
        files.push({ name: 'xl/drawings/drawing1.xml', data: u8(drawing(images, chartStartRow0)) });
        let rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
        images.forEach((im, i) => rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image' + (i + 1) + '.png"/>');
        files.push({ name: 'xl/drawings/_rels/drawing1.xml.rels', data: u8(rels + '</Relationships>') });
        images.forEach((im, i) => files.push({ name: 'xl/media/image' + (i + 1) + '.png', data: im.bytes }));
      }
      return zip(files);
    };
    return { build };
  })();

  function drawSigmaReportMDC(rows: any[]) { return deps.sigmaMdcRenderer(rows); }
  function renameSigmaSheet(bytes: Uint8Array, sheetName: string) { return deps.renameSigmaXlsxSheet(bytes, sheetName); }
  const sigmaXlsxBuild = SigmaXlsx.build;
  SigmaXlsx.build = (rows: any[], meta: any, images?: any[]) => renameSigmaSheet(sigmaXlsxBuild(rows, meta, images), (meta && meta.sheetName) || DEFAULT_SIGMA_SHEET);

  const RXST = deps.reportXlsxStyleIds;
  const ReportXlsx = { build: deps.reportXlsxBuild };

  function reportXlsxDoc(tid: string, start: string, end: string, includeNceAppendix = true): any {
    const t = deps.findTest(tid); if (!t) return null;
    const ST: any = RXST, NCOL = 10, LASTCOL = 'J', CHART_W = 930, CHART_H = Math.round(930 * 430 / 1400), ROW_PX = 17;
    const inMonth = reportInRange(start, end), wg = deps.activeWestgard(t);
    const { teaVal, teaSourceText } = reportTeaInfo(t);
    const rows: any[] = [], merges: string[] = [], images: any[] = [], rowHeights: Record<number, number> = {}; let R = 0;
    const S = (v: any, s: number) => ({ v, s }), Nn = (v: any, s: number) => ({ v, s, num: true });
    const n1 = (v: number) => Number.isFinite(v) ? Number(Number(v).toFixed(1)) : '', n2 = (v: number) => Number.isFinite(v) ? Number(Number(v).toFixed(2)) : '', n3 = (v: number) => Number.isFinite(v) ? Number(Number(v).toFixed(3)) : '';
    const push = (cells: any[]) => { rows.push(cells); return ++R; };
    const fullMerge = (r: number) => merges.push('A' + r + ':' + LASTCOL + r);
    const blank = () => push([]);
    const section = (txt: string) => { const r = push([S(txt, ST.SECTION)]); fullMerge(r); rowHeights[r] = 21; };
    const note = (txt: string) => { const r = push([S(txt, ST.NOTE)]); fullMerge(r); rowHeights[r] = Math.min(60, 14 + Math.ceil(String(txt).length / 95) * 13); };
    const nceCells = (value: any, style: number, count: number) => Array.from({ length: count }, (_, i) => S(i ? '' : value, style));
    const nceSub = (txt: string) => { blank(); const r = push(nceCells(txt, ST.LABEL, NCOL)); fullMerge(r); rowHeights[r] = 19; };
    const ncePair = (l1: any, v1: any, l2: any, v2: any) => { const a = String(v1 || '—'), b = String(v2 || '—'), rr = push([...nceCells(l1, ST.LABEL, 2), ...nceCells(a, ST.VAL, 3), ...nceCells(l2, ST.LABEL, 2), ...nceCells(b, ST.VAL, 3)]); merges.push('A' + rr + ':B' + rr, 'C' + rr + ':E' + rr, 'F' + rr + ':G' + rr, 'H' + rr + ':J' + rr); rowHeights[rr] = Math.min(54, 21 + Math.max(Math.ceil(a.length / 42), Math.ceil(b.length / 42) - 1) * 12); };
    const nceWide = (label: any, value: any) => { const text = String(value || '—'), rr = push([...nceCells(label, ST.LABEL, 2), ...nceCells(text, ST.VAL, 8)]); merges.push('A' + rr + ':B' + rr, 'C' + rr + ':J' + rr); rowHeights[rr] = Math.min(72, 21 + Math.max(0, Math.ceil(text.length / 105) - 1) * 12); };
    const imgBytes = sigmaDataURLBytes;
    const chart = (durl: string | null) => { if (!durl || !imgBytes) return; const row0 = R; let bytes; try { bytes = imgBytes(durl); } catch (e) { return; } images.push({ bytes, dispW: CHART_W, dispH: CHART_H, row0 }); const spacer = Math.ceil(CHART_H / ROW_PX) + 1; for (let i = 0; i < spacer; i++) blank(); };
    // ---- Tiêu đề + thông tin đơn vị (bám theo báo cáo in: tiêu đề căn giữa, thanh app/luật, bảng meta cân đối) ----
    const appMeta = deps.appMeta() || {}, rulesStr = Object.entries(deps.westgardRules() || {}).filter((x: any) => x[1] !== false).map((x: any) => x[0]).join(', ') || 'Chưa cấu hình';
    const h = deps.reportXlsxHeader({ styles: ST, appName: appMeta.name || 'QC Lab', appVersion: appMeta.version || 'dev', rules: rulesStr, labName: deps.lab().name || '', department: deps.lab().dept || '', address: deps.lab().address || '', exportedAt: deps.formatDateTimeVN(new Date().toISOString()), exportedBy: deps.userName(), testName: deps.testDisplayName(t), testUnit: t.unit || '', machine: t.machine || '', range: deps.reportRangeText(start, end), tea: teaVal || '—', teaSource: teaSourceText, teaReference: deps.sgTeaRefText ? deps.sgTeaRefText(t) : '', teaDocument: t.teaDoc || '', teaApprovedBy: t.teaApprovedBy || '' }); rows.push(...h.rows); merges.push(...h.merges); Object.assign(rowHeights, h.rowHeights); R = rows.length;
    // ---- Biểu đồ LJ tổng hợp (nếu có ≥2 mức có điểm) ----
    const multiViews = reportMultiViews(t, inMonth);
    if (multiViews.filter((v: any) => v.pts.length).length >= 2) { blank(); section('Levey-Jennings tổng hợp theo Z-score'); chart(deps.ljMultiDataURL ? deps.ljMultiDataURL(multiViews, t) : null); }
    // ---- Bảng ô cho từng mục ----
    const mergePairs = (r: number, pairs: [string, string][]) => pairs.forEach(([a, b]) => merges.push(a + r + ':' + b + r));
    const statsHeader = () => { const r = push([S('n', ST.TH), S('Mean thực', ST.TH), S('', ST.TH), S('SD', ST.TH), S('CV%', ST.TH), S('Bias%', ST.TH), S('TE%', ST.TH), S('TEa%', ST.TH), S('Sigma (kỳ)', ST.TH), S('', ST.TH)]); mergePairs(r, [['B', 'C'], ['I', 'J']]); rowHeights[r] = 18; };
    const statsRow = (st: any, bias: number, te: number, sigma: number | null) => { const sg = sigma == null ? S('—', ST.TD) : (st.n < 20 ? S(deps.format(sigma, 1) + ' *', ST.TD) : Nn(n1(sigma), ST.TD)), r = push([Nn(st.n, ST.TD), Nn(n2(st.m), ST.TD), S('', ST.TD), Nn(n3(st.sd), ST.TD), Nn(n2(st.cv), ST.TD), Nn(n2(bias), ST.TD), Nn(n2(te), ST.TD), (teaVal ? Nn(n2(teaVal), ST.TD) : S('—', ST.TD)), sg, S('', ST.TD)]); mergePairs(r, [['B', 'C'], ['I', 'J']]); };
    const pointsHeader = () => { const r = push([S('Ngày', ST.TH), S('', ST.TH), S('Lần chạy', ST.TH), S('', ST.TH), S('NV', ST.TH), S('Giá trị', ST.TH), S('Z', ST.TH), S('Kết luận', ST.TH), S('Luật / bằng chứng', ST.TH), S('', ST.TH)]); mergePairs(r, [['A', 'B'], ['C', 'D'], ['I', 'J']]); rowHeights[r] = 18; };
    const pointsRow = (o: any) => { const rules = [...new Set(o.f.rules || [])], support = [...new Set(o.f.supportRules || [])].filter((rule: any) => !rules.includes(rule)), ruleText = rules.join(', ') || (support.length ? 'Bằng chứng: ' + support.join(', ') : '—'), staff = deps.pointStaff(o.p), vs = o.f.level === 'rej' ? ST.REJ : o.f.level === 'warn' ? ST.WARN : ST.TD, r = push([S(deps.vnDate(o.p.date), ST.TD), S('', ST.TD), S(o.p.runId || '—', ST.TD), S('', ST.TD), S(staff.code || '—', ST.TD), Nn(Number.isFinite(o.p.val) ? o.p.val : '', ST.TD), S((o.z >= 0 ? '+' : '') + deps.format(o.z) + 's', ST.TD), S(deps.stateName(o.f.level), vs), S(ruleText, ST.TD), S('', ST.TD)]); mergePairs(r, [['A', 'B'], ['C', 'D'], ['I', 'J']]); };
    const violHeader = () => { const r = push([S('Ngày', ST.TH), S('', ST.TH), S('NV', ST.TH), S('Giá trị', ST.TH), S('Z', ST.TH), S('Luật', ST.TH), S('', ST.TH), S('Loại sai số', ST.TH), S('', ST.TH), S('', ST.TH)]); mergePairs(r, [['A', 'B'], ['F', 'G'], ['H', 'J']]); rowHeights[r] = 18; };
    const violRow = (o: any) => { const rules = [...new Set(o.f.rules || [])], r = push([S(deps.vnDate(o.p.date), ST.TD), S('', ST.TD), S(deps.pointStaff(o.p).code || '—', ST.TD), Nn(Number.isFinite(o.p.val) ? o.p.val : '', ST.TD), S((o.z >= 0 ? '+' : '') + deps.format(o.z) + 's', ST.TD), S(rules.join(', '), ST.WARN), S('', ST.WARN), S(deps.errorType(rules as string[]), ST.TDL), S('', ST.TDL), S('', ST.TDL)]); mergePairs(r, [['A', 'B'], ['F', 'G'], ['H', 'J']]); };
    // ---- Từng mức ----
    deps.operationalLevels(t).forEach((l: any) => {
      (deps.previousLotSeries ? deps.previousLotSeries(t, l.level) : []).forEach((s: any) => {
        const { inPts, items: allS } = reportPrevLotRows(t, s, inMonth); if (!inPts.length) return;
        blank(); section('Mức ' + l.level + ' — Lô cũ ' + (s.lot || '?') + ' · đã chuyển tiếp (Mean=' + deps.qcExportValueFormat.value(t, s.mean) + ', SD=' + deps.qcExportValueFormat.stat(t, s.sd) + ')');
        note('Vi phạm ở lô cũ chỉ đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).');
        chart(deps.ljDataURL ? deps.ljDataURL(inPts, s.mean, s.sd) : null);
        const stat = deps.reportLevelStats(inPts, s.mean, teaVal); statsHeader(); statsRow(stat.st, stat.bias, stat.te, stat.sigma);
        blank(); pointsHeader(); allS.forEach(pointsRow);
        const violS = allS.filter((o: any) => o.f.level !== 'ok');
        if (violS.length) { blank(); violHeader(); violS.forEach(violRow); }
      });
      const { pts, items: all } = reportLevelRows(t, l, wg, inMonth);
      blank(); section('Mức ' + l.level + ' — Lô ' + (l.lot || '?') + ' · Dải ' + (l.applied === 'lab' ? 'PXN' : 'NSX') + ' (Mean=' + deps.qcExportValueFormat.value(t, l.mean) + ', SD=' + deps.qcExportValueFormat.stat(t, l.sd) + ')');
      if (!pts.length) { note('Không có dữ liệu trong khoảng ngày đã chọn.'); return; }
      chart(deps.ljDataURL ? deps.ljDataURL(pts, l.mean, l.sd) : null);
      const stat = deps.reportLevelStats(pts, l.mean, teaVal); statsHeader(); statsRow(stat.st, stat.bias, stat.te, stat.sigma);
      blank(); pointsHeader(); all.forEach(pointsRow);
      const viol = all.filter((o: any) => o.f.level !== 'ok');
      if (viol.length) { blank(); violHeader(); viol.forEach(violRow); }
    });
    // ---- Nhật ký khắc phục ----
    const acts = reportActionsInRange(tid, inMonth);
    if (acts.length) {
      blank(); section('Hành động khắc phục trong khoảng ngày đã chọn');
      note('Bảng dưới đây là bản tóm tắt. Nội dung đầy đủ nằm trong phụ lục NCE khi tùy chọn kèm phụ lục được bật.');
      let hr = push([S('Ngày / mã NCE', ST.TH), S('Mức / lô', ST.TH), S('Luật / loại SS', ST.TH), S('Tóm tắt xử lý', ST.TH), S('', ST.TH), S('', ST.TH), S('Người', ST.TH), S('QC chạy lại', ST.TH), S('Duyệt', ST.TH), S('Khép vòng', ST.TH)]); merges.push('D' + hr + ':F' + hr); rowHeights[hr] = 25;
      acts.forEach((a: any) => { const m = reportNceModel(a, t), rr = deps.actionRerunStatus ? deps.actionRerunStatus(a) : { label: '' }, summary = reportNceSummaryParts(a).map(([label, text]: any[]) => label + ': ' + text).join('\n'), ar = push([S((a.nceId ? a.nceId + '\n' : '') + m.eventDateText, ST.TD), S(deps.actionLevelShort(t, a.level, a.lot), ST.TD), S((a.rule || '—') + '\n' + (a.errorType || '—'), ST.TD), S(summary, ST.TDL), S('', ST.TDL), S('', ST.TDL), S(a.by || '—', ST.TD), S(rr.label || '—', ST.TD), S((deps.actionApprovalLabel ? deps.actionApprovalLabel(a) : (a.approvalStatus || 'pending')) + (a.approvedBy ? '\n' + a.approvedBy : ''), ST.TD), S(m.wfLabel, ST.TD)]); merges.push('D' + ar + ':F' + ar); rowHeights[ar] = 96; });
      if (includeNceAppendix) {
        blank(); section('Phụ lục - Hồ sơ NCE chi tiết'); note('Phụ lục giữ đầy đủ nội dung điều tra, bằng chứng QC chạy lại, đánh giá hiệu lực và phê duyệt. Bảng tổng hợp phía trên chỉ trình bày thông tin trọng yếu.');
        acts.forEach((a: any) => {
          const m = reportNceModel(a, t);
          blank(); section('Phiếu NCE ' + m.nceTitle + ' · ' + m.wfLabel);
          ncePair('Ngày xảy ra', m.eventDateText, 'Xét nghiệm / mức / lô', m.testLevelText); ncePair('Luật / loại sai số', m.ruleErrText, 'Nguồn / giai đoạn', m.sourcePhaseText); ncePair('Người phụ trách / hạn', m.ownerDueText, 'Trạng thái bản ghi', m.recordStatusText);
          if (!m.modern) { nceSub('Hành động đã ghi'); nceWide('Nội dung', m.legacyActionText); nceSub('QC chạy lại / duyệt'); ncePair('QC chạy lại', m.rerunText, 'Phê duyệt', m.approvalShortText); return; }
          nceSub('1. Kiểm soát và xử lý tức thời'); ncePair('Phạm vi kiểm soát', m.containmentText, 'Ghi chú phạm vi', m.containmentNote); nceWide('Xử lý tức thời', m.correctionText);
          nceSub('2. Đánh giá nguy cơ ban đầu'); ncePair('Phân loại / RPN', m.riskText, 'S x O x D', m.sodText); nceWide('Căn cứ SOP', m.riskBasis);
          nceSub('3. Checklist điều tra'); let cr = push([S('Hạng mục', ST.TH), S('', ST.TH), S('', ST.TH), S('', ST.TH), S('Kết luận', ST.TH), S('', ST.TH), S('Ghi chú / bằng chứng', ST.TH), S('', ST.TH), S('', ST.TH), S('', ST.TH)]); merges.push('A' + cr + ':D' + cr, 'E' + cr + ':F' + cr, 'G' + cr + ':J' + cr); m.checks.forEach(([label, statusText, noteText]: [any, any, any]) => { const rrr = push([...nceCells(label, ST.TDL, 4), ...nceCells(statusText, ST.TD, 2), ...nceCells(noteText, ST.TDL, 4)]); merges.push('A' + rrr + ':D' + rrr, 'E' + rrr + ':F' + rrr, 'G' + rrr + ':J' + rrr); rowHeights[rrr] = Math.min(54, 23 + Math.max(0, Math.ceil(noteText.length / 55) - 1) * 12); });
          nceSub('4. Nguyên nhân và hành động khắc phục'); ncePair('Nhóm nguyên nhân', m.causeCategoryText, 'Ngày hoàn thành hành động', m.actionCompletedText); nceWide('Nguyên nhân', m.causeText); nceWide('Hành động khắc phục', m.actionText);
          nceSub('5. Bằng chứng QC chạy lại và cho phép trở lại'); ncePair('QC chạy lại', m.rerunText, 'Quyết định', m.releaseText); ncePair('Ngày / người cho phép', m.releaseWhoText, 'Căn cứ cho phép', m.releaseNote);
          nceSub('6. Ảnh hưởng người bệnh'); ncePair('Kết luận', m.patientText, 'Xử lý kết quả liên quan', m.patientAction);
          nceSub('7. Hiệu lực, nguy cơ còn lại và phê duyệt'); ncePair('Đánh giá hiệu lực', m.effLabel, 'Ngày / người đánh giá', m.effWhoText); ncePair('Bằng chứng hiệu lực', m.effNote, 'Nguy cơ còn lại', m.residualText); ncePair('Căn cứ đánh giá lại', m.residualBasis, 'Phê duyệt', m.approvalText); nceWide('Ý kiến duyệt', m.approvalNote);
          if (m.cancelled) { nceSub('Thông tin hủy hồ sơ'); nceWide('Lý do / người / thời điểm', m.cancelText); }
        });
      }
    }
    blank(); const sr = push([S('Người thực hiện — Người kiểm tra — Phụ trách khoa (ký, ghi rõ họ tên)', ST.NOTE)]); fullMerge(sr);
    return { sheetName: 'Báo cáo nội kiểm', cols: [13, 12, 14, 10, 10, 10, 12, 13, 15, 18].slice(0, NCOL), rows, merges, rowHeights, images };
  }

  async function exportReportXLSX() {
    const { tid, t, start, end, includeNceAppendix } = deps.reportExportSelection(); if (!t) return;
    let doc; try { doc = reportXlsxDoc(tid, start, end, includeNceAppendix); } catch (e: any) { await deps.infoDialog('Không thể tạo báo cáo Excel:\n' + (e && e.message ? e.message : e)); return; }
    if (!doc) return;
    try { const bytes = ReportXlsx.build(doc), label = start || end ? (start || 'batdau') + '_' + (end || 'hientai') : 'toanbo'; downloadBlob('Bao_cao_IQC_' + deps.safeName(t.name) + '_' + deps.safeName(label) + '.xlsx', new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); }
    catch (e: any) { await deps.infoDialog('Không thể xuất Excel:\n' + (e && e.message ? e.message : e)); }
  }

  function westgardXlsxDoc(tid: string): any {
    const t = deps.findTest(tid); if (!t) return null;
    const wg = deps.activeWestgard(t); if (!wg.views.length) return null;
    const ST: any = RXST, LASTCOL = 'I', CHART_W = 900, CHART_H = Math.round(900 * 430 / 1400), ROW_PX = 17, rows: any[] = [], merges: string[] = [], images: any[] = [], rowHeights: Record<number, number> = {}; let R = 0;
    const S = (v: any, s: number) => ({ v, s }), Nn = (v: any, s: number) => ({ v, s, num: true }), push = (cells: any[]) => { rows.push(cells); return ++R; }, blank = () => push([]), fullMerge = (r: number) => merges.push('A' + r + ':' + LASTCOL + r);
    const section = (txt: string) => { const r = push([S(txt, ST.SECTION)]); fullMerge(r); rowHeights[r] = 21; };
    const note = (txt: string) => { const r = push([S(txt, ST.NOTE)]); fullMerge(r); rowHeights[r] = Math.min(60, 14 + Math.ceil(String(txt).length / 90) * 13); };
    const metaRow = (l1: any, v1: any, l2: any, v2: any) => { const r = push([S(l1, ST.LABEL), S('', ST.LABEL), S(v1, ST.VAL), S('', ST.VAL), S('', ST.VAL), S(l2, ST.LABEL), S('', ST.LABEL), S(v2, ST.VAL), S('', ST.VAL)]); merges.push('A' + r + ':B' + r, 'C' + r + ':E' + r, 'F' + r + ':G' + r, 'H' + r + ':I' + r); rowHeights[r] = 21; };
    const metaWide = (l: any, v: any) => { const r = push([S(l, ST.LABEL), S('', ST.LABEL), S(v, ST.VAL), S('', ST.VAL), S('', ST.VAL), S('', ST.VAL), S('', ST.VAL), S('', ST.VAL), S('', ST.VAL)]); merges.push('A' + r + ':B' + r, 'C' + r + ':I' + r); rowHeights[r] = Math.min(48, 18 + Math.ceil(String(v).length / 105) * 12); };
    const chart = (durl: string | null) => { if (!durl || !deps.sigmaDataUrlBytes) return; let bytes; try { bytes = sigmaDataURLBytes(durl); } catch (e) { return; } images.push({ bytes, dispW: CHART_W, dispH: CHART_H, row0: R }); for (let i = 0; i < Math.ceil(CHART_H / ROW_PX) + 1; i++) blank(); };
    const app = deps.appMeta() || {}, machine = deps.instrumentName(t.instrumentId, t.machine) || t.machine || '—', withinRules = deps.wgRules().filter(rule => deps.testRuleOnWithin(t, rule)).join(', ') || 'Không có', acrossRules = deps.wgRules().filter(rule => deps.testRuleOnAcross(t, rule)).join(', ') || 'Không có';
    let r; const h = deps.westgardXlsxHeader({ styles: ST, title: 'PHÂN TÍCH WESTGARD — ' + deps.testDisplayName(t), labName: deps.lab().name || '', department: deps.lab().dept || '', address: deps.lab().address || '', exportedAt: deps.formatDateTimeVN(new Date().toISOString()), exportedBy: deps.userName(), testName: deps.testDisplayName(t), testUnit: t.unit || '', machine, appName: app.name || 'QC Lab', appVersion: app.version || 'dev', withinRules, acrossRules }); rows.push(...h.rows); merges.push(...h.merges); Object.assign(rowHeights, h.rowHeights); R = rows.length;
    const multiViews = deps.wgMultiViews ? deps.wgMultiViews(t) : wg.views.map((v: any) => ({ level: v.l.level, lot: v.l.lot, mean: v.l.mean, sd: v.l.sd, pts: v.pts, label: 'M' + v.l.level + '·' + (v.l.lot || '?') }));
    if (multiViews.filter((v: any) => v.pts && v.pts.length).length >= 2) { blank(); section('Levey-Jennings tổng hợp theo Z-score'); chart(deps.ljMultiDataURL ? deps.ljMultiDataURL(multiViews, t) : null); }
    const head = () => push([S('#', ST.TH), S('Ngày', ST.TH), S('Lần chạy', ST.TH), S('NV', ST.TH), S('Giá trị', ST.TH), S('Z', ST.TH), S('Kết luận', ST.TH), S('Luật / bằng chứng', ST.TH), S('Loại sai số', ST.TH)]);
    const detail = (o: any, index: number) => { const row = deps.westgardXlsxRows.detail(o, index); push([Nn(row.index, ST.TD), S(row.date, ST.TD), S(row.runId, ST.TD), S(row.staffCode, ST.TD), Nn(row.value, ST.TD), S(row.z, ST.TD), S(row.verdict, row.style === 'rej' ? ST.REJ : row.style === 'warn' ? ST.WARN : ST.TD), S(row.ruleText, ST.TDL), S(row.error, ST.TDL)]); };
    wg.views.forEach((v: any) => {
      const l = v.l, prev = deps.wgPrevOpenHas(t.id + '|' + l.level) && (deps.previousLotSeries ? deps.previousLotSeries(t, l.level) : [])[0], series = prev || { lot: l.lot, mean: l.mean, sd: l.sd, pts: v.pts }, isPrev = !!prev;
      let all: any[]; if (isPrev) { const calc = deps.westgardByPoint(series.pts, series.mean, series.sd, (rule: string) => deps.testRuleOnWithin(t, rule)); all = series.pts.map((p: any, i: number) => { const raw = calc.F[i] || { rules: [], supportRules: [] }, f = { ...raw, level: deps.ruleResultLevel(t, raw.rules || []) }; return { p, f, z: calc.zs[i] }; }); }
      else all = series.pts.map((p: any) => { const f = wg.byPoint.get(p.id) || { level: 'ok', rules: [], supportRules: [], z: (p.val - series.mean) / series.sd }; return { p, f, z: f.z }; });
      const relevant = all.filter((o: any) => o.f.level !== 'ok' || (o.f.supportRules || []).length), pointIndex = new Map<string, number>(series.pts.map((p: any, i: number) => [p.id, i + 1]));
      blank(); section('Mức ' + l.level + ' — ' + (isPrev ? 'Lô cũ ' : 'Lô ') + (series.lot || '?') + (isPrev ? ' · đã chuyển tiếp' : '') + ' (Mean=' + deps.qcExportValueFormat.value(t, series.mean) + ', SD=' + deps.qcExportValueFormat.stat(t, series.sd) + ')');
      if (isPrev) note('Lô cũ chỉ được đánh giá luật Westgard theo từng mức riêng lẻ, không gồm luật liên mức (như R4s giữa các mức cùng lần chạy).');
      if (!series.pts.length) { note('Chưa có dữ liệu QC ở mức này.'); return; }
      chart(deps.ljDataURL ? deps.ljDataURL(series.pts, series.mean, series.sd) : null);
      note('Tổng ' + series.pts.length + ' điểm · Xuất ' + relevant.length + ' điểm vi phạm/bằng chứng.');
      if (!relevant.length) { note('Không có điểm vi phạm/cảnh báo hoặc điểm bằng chứng ở lô này.'); return; }
      head(); relevant.forEach((o: any) => detail(o, pointIndex.get(o.p.id) || 1));
    });
    blank(); r = push([S('Người thực hiện — Người kiểm tra — Phụ trách khoa (ký, ghi rõ họ tên)', ST.NOTE)]); fullMerge(r);
    return { sheetName: 'Phân tích Westgard', cols: [7, 12, 14, 9, 12, 9, 15, 23, 22], rows, merges, rowHeights, images };
  }

  async function exportWestgardXLSX() {
    const t = deps.findTest(deps.selTest()); if (!t) { await deps.infoDialog('Chưa chọn được xét nghiệm để xuất Excel.'); return; }
    let doc; try { doc = westgardXlsxDoc(t.id); } catch (e: any) { await deps.infoDialog('Không thể tạo báo cáo Westgard Excel:\n' + (e && e.message ? e.message : e)); return; }
    if (!doc) { await deps.infoDialog('Xét nghiệm này chưa có mức QC đang vận hành để xuất Excel.'); return; }
    try { const bytes = ReportXlsx.build(doc); downloadBlob('Phan_tich_Westgard_' + deps.safeName(t.name) + '.xlsx', new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); }
    catch (e: any) { await deps.infoDialog('Không thể xuất Excel:\n' + (e && e.message ? e.message : e)); }
  }

  function sigmaExportMeta() { return deps.sigmaExportMetaService.meta(); }
  function sigmaTeaTrace(rows: any[]) { return deps.sigmaExportMetaService.teaTrace(rows); }

  async function buildSigmaXlsx(rows: any[], title: string, subtitle: string, fileName: string, sheetName = DEFAULT_SIGMA_SHEET) {
    const images: any[] = []; try { const c = drawSigmaReportChart(rows); if (c) images.push(c); const m = drawSigmaReportMDC(rows); if (m) images.push(m); } catch (e) { /* chart render tự bỏ qua khi canvas không sẵn sàng */ }
    try { const bytes = SigmaXlsx.build(rows, { title, subtitle, sheetName }, images); downloadBlob(fileName, new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); }
    catch (e: any) { await deps.infoDialog('Không thể xuất báo cáo Sigma:\n' + (e && e.message ? e.message : e)); }
  }

  async function exportSigmaPeriodXLSX(periodId: string) {
    const t = deps.findTest(deps.sgTest()), entry = t && deps.sgData(t.id).find((x: any) => x.id === periodId); if (!t || !entry) { await deps.infoDialog('Chưa chọn được kỳ Sigma.'); return; }
    const rows = sigmaReportRows(t.id, 'period', entry.period, entry.id); if (!rows.length) { await deps.infoDialog('Kỳ này chưa đủ dữ liệu Sigma để xuất báo cáo.'); return; }
    const { app, rules } = sigmaExportMeta(), period = deps.vnPeriod(entry.period) || entry.period, month = String(parseInt(String(entry.period).slice(5), 10) || '');
    await buildSigmaXlsx(rows, `BÁO CÁO SIX SIGMA - ${deps.testDisplayName(t)} - ${period}`, `Nguồn: QC Lab · Xuất ${deps.formatDateTimeVN(new Date().toISOString())} · Kỳ xuất: ${sigmaExportPeriods(rows)} · Người xuất: ${deps.userName()} · App ${app.version || 'dev'} · Bộ luật: ${rules} · Truy xuất TEa: ${sigmaTeaTrace(rows)}`, `Bao_Cao_Six_Sigma_${deps.safeName(t.name)}_${deps.safeName(entry.period)}.xlsx`, `Kỳ ${month}`);
  }

  async function exportSigmaPeriodsXLSX() {
    const t = deps.findTest(deps.sgTest()); if (!t) { await deps.infoDialog('Chưa chọn xét nghiệm.'); return; }
    const rows = sigmaReportRows(t.id, 'all'); if (!rows.length) { await deps.infoDialog('Xét nghiệm này chưa có kỳ Sigma đủ dữ liệu để xuất báo cáo.'); return; }
    const { app, rules } = sigmaExportMeta();
    await buildSigmaXlsx(rows, `BÁO CÁO TỔNG HỢP SIX SIGMA THEO KỲ - ${deps.testDisplayName(t)}`, `Nguồn: QC Lab · Xuất ${deps.formatDateTimeVN(new Date().toISOString())} · Kỳ xuất: ${sigmaExportPeriods(rows)} · Người xuất: ${deps.userName()} · App ${app.version || 'dev'} · Bộ luật: ${rules} · Truy xuất TEa: ${sigmaTeaTrace(rows)}`, `Bao_Cao_Six_Sigma_Theo_Ky_${deps.safeName(t.name)}.xlsx`);
  }

  return {
    dataIoTypePx, dataIoCanvasFont, exportMetaRows: exportMetaRowsImpl,
    reportInRange, reportTeaInfo, reportMultiViews, reportPrevLotRows, reportLevelRows, reportActionsInRange, reportNceExcerpt, reportNceSummaryParts, reportNceModel,
    exportReportCSV, exportActionsCSV, downloadBlob, sigmaReportMetric, sigmaReportRows, sigmaLevelsOf, sigmaDataURLBytes, sigmaExportPixelRatio, sigmaCanvas, drawSigmaReportChart, sigmaMdcItems, sigmaPeriodLabel, sigmaMdcPeriodLabel, sigmaExportPeriods, sigmaMdcLabelPlacements,
    SIGMA_EXPORT_PIXEL_RATIO,
    XlsxCore, SigmaXlsx, drawSigmaReportMDC, renameSigmaSheet, RXST, ReportXlsx,
    reportXlsxDoc, exportReportXLSX, westgardXlsxDoc, exportWestgardXLSX,
    sigmaExportMeta, sigmaTeaTrace, buildSigmaXlsx, exportSigmaPeriodXLSX, exportSigmaPeriodsXLSX,
  };
}

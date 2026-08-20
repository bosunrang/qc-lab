type AnyRec = any;

const RC_MIN_PAIRS = 5;
/* palette khớp design token trong app.css; dùng cho SVG/báo cáo (in ở document riêng, không đọc được var()) */
const RCC = { teal: '#0c6f78', tealDeep: '#0a5d65', ink: '#172833', muted: '#667b89', line: '#d4dde3', grid: '#e9eff3', red: '#a43a33', amber: '#a36f15', green: '#087044', okBg: '#e3f3f0', okFg: '#0a5e67', midBg: '#fbf0db', midFg: '#a36f15', noBg: '#f7e4e2', noFg: '#a43a33' };
const RCPAD = { l: 54, r: 18, t: 18, b: 46 };
const RC_META_LOG_LABEL: Record<string, string> = { lotOld: 'Số lô cũ', lotNew: 'Số lô mới', biasTarget: 'Bias mong muốn (%)', alpha: 'Mức ý nghĩa (α)' };

export function createReagentPageController(deps: {
  document: Document;
  getState: () => AnyRec;
  ui: () => AnyRec;
  save: (opts?: AnyRec) => void;
  rerender: () => void;
  requestFrame: (work: () => void, delay: number) => void;
  logAct: (action: string, detail: string, target: string) => void;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  fmt: (value: unknown, decimals?: number) => string;
  jsq: (value: unknown) => string;
  vnDate: (value: unknown) => string;
  formatDateTimeVN: (value: unknown) => string;
  parseVN: (value: unknown) => string;
  cleanText: (value: unknown, max: number) => string;
  uid: () => string;
  canWrite: () => boolean;
  requireWrite: () => boolean;
  requireAdmin: () => boolean;
  dateBox: (id: string, value: string, cls: string, attrs: string) => string;
  button: (label: string, action: string | { action: string; args?: unknown[] } | null, cls?: string, title?: string, options?: AnyRec) => string;
  headOnly: (title: string, subtitle: string, actions?: string) => string;
  emptyState: (title: string, body: string, actions?: string) => string;
  searchText: (value: unknown) => string;
  openModal: (html: string) => void;
  closeModal: () => void;
  confirmDialog: (opts: AnyRec) => Promise<boolean>;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  scheduleSearchRender: (owner: AnyRec, apply: () => void, focusId?: string) => void;
  reportHeader: (title: string) => string;
  signBlock: () => string;
  openPrint: (title: string, body: string) => Promise<unknown>;
  teaAnalyteDisplay: (name: string) => string;
  refTests: () => AnyRec[];
  service: AnyRec;
  workflow: AnyRec;
  pres: AnyRec;
}) {
  const rcLabel = (d: AnyRec) => deps.pres.comparisonLabel.label(d.test, deps.teaAnalyteDisplay);
  const rcAct = () => deps.service.find(deps.getState(), deps.ui().rcId);
  const rcSaveSoon = () => { const ui = deps.ui(); clearTimeout(ui.rcSaveT); ui.rcSaveT = setTimeout(() => deps.save(), 600); };
  const rcPairCalc = (r: AnyRec) => deps.pres.pairMath.pairCalc(r);
  const rcCalc = (ds: AnyRec) => deps.pres.calculator.calculate(ds, RC_MIN_PAIRS);
  const rcAxis = (W: number, H: number, xmin: number, xmax: number, ymin: number, ymax: number, xlab: string, ylab: string) => deps.pres.chartAxis(W, H, xmin, xmax, ymin, ymax, xlab, ylab, RCC, RCPAD, deps.esc);
  const rcPadr = (min: number, max: number) => deps.pres.chart.range([min, max]);
  const rcToolIcon = (type: string) => deps.pres.toolIcon.icon(type);
  const rcMiniIcon = (type: string) => deps.pres.toolIcon.icon(type);
  const rcScatterSVG = (R: AnyRec, t: AnyRec) => deps.pres.scatterSvg(R, t, rcPadr, rcAxis, RCC);
  const rcBlandSVG = (R: AnyRec) => deps.pres.blandSvg(R, rcPadr, rcAxis, RCC);
  const rcSelectOptions = () => deps.pres.selectOptions(deps.getState().reagentTests, deps.ui().rcId, deps.escapeAttr, (d: AnyRec) => deps.esc(rcLabel(d)));

  const pageReagent = () => {
    const state = deps.getState(), ui = deps.ui();
    if (!state.reagentTests.length) return deps.pres.emptyPage({ headHtml: deps.headOnly('So sánh 2 lô hóa chất', ''), emptyStateHtml: deps.emptyState('Chưa có phép so sánh', 'Tải lại dữ liệu hoặc tạo phép so sánh mới.', '') });
    if (!ui.rcId || !state.reagentTests.find((d: AnyRec) => d.id === ui.rcId)) ui.rcId = state.reagentTests[0].id;
    const ds = rcAct(), t = ds.test, ro = !deps.canWrite() ? 'disabled' : '';
    const oldLotHead = 'Lô cũ' + (t.lotOld ? `: ${deps.esc(t.lotOld)}` : ''), newLotHead = 'Lô mới' + (t.lotNew ? `: ${deps.esc(t.lotNew)}` : '');
    const rows = ds.rows.map((r: AnyRec, i: number) => { const c = rcPairCalc(r); return deps.pres.pairRow({ index: i, row: r, readOnly: !deps.canWrite(), pair: c, format: deps.fmt, escAttr: deps.escapeAttr }); }).join('');
    const toolbarHtml = deps.pres.toolbar({ selectOptionsHtml: rcSelectOptions(), primaryActionsHtml: deps.canWrite() ? deps.button('+ Thêm', { action: 'openRcCreateModal' }, 'teal rc-add-btn') + deps.button(rcToolIcon('trash') + ' Xóa', { action: 'rcDeleteCurrent' }, 'danger rc-delete-btn') : '', secondaryActionsHtml: (deps.canWrite() ? deps.button(rcToolIcon('search') + ' Tìm', { action: 'openRcModal' }, 'ghost rc-find-btn') : '') + deps.button(rcToolIcon('print') + ' In hóa chất này', { action: 'rcPrint' }, 'teal rc-report-btn') + deps.button(rcToolIcon('report') + ' Báo cáo tổng hợp', { action: 'rcPrintSummary' }, 'teal rc-report-main') });
    const pairPanelHtml = deps.pres.pairPanel({ oldLotHeadHtml: oldLotHead, newLotHeadHtml: newLotHead, rowsHtml: rows, actionsHtml: deps.canWrite() ? deps.button('+ Thêm mẫu', { action: 'rcAddRow' }, 'ghost sm') + ' ' + deps.button('Xóa dữ liệu', { action: 'rcClearRows' }, 'ghost sm') : '', minPairs: RC_MIN_PAIRS });
    const infoPanelHtml = deps.pres.infoPanel({ disabledAttr: ro, reagentValueHtml: deps.escapeAttr(t.reagent), unitValueHtml: deps.escapeAttr(t.unit), lotOldValueHtml: deps.escapeAttr(t.lotOld), lotNewValueHtml: deps.escapeAttr(t.lotNew), dateInputHtml: deps.dateBox('rcDate', t.date || '', '', `${ro} data-action="rcMeta" data-args='["date"]' data-action-on="change"`), operatorValueHtml: deps.escapeAttr(t.operator), sampleTypeValueHtml: deps.escapeAttr(t.sampleType), biasTarget: t.biasTarget, alpha: t.alpha, coverageChecked: !!t.coverageConfirmed, canWrite: deps.canWrite(), userIconHtml: rcMiniIcon('user'), sampleIconHtml: rcMiniIcon('sample') });
    const chartsPanelHtml = deps.pres.chartsPanel();
    const resultsPanelsHtml = deps.pres.resultsPanels();
    return deps.headOnly('So sánh 2 lô hóa chất', 'Sàng lọc định lượng · hồi quy mô tả · Bland-Altman · phê duyệt theo SOP') +
     toolbarHtml + `<div class="rc-entry-grid">${infoPanelHtml}
   ${pairPanelHtml}</div>
   ${resultsPanelsHtml}
   ${chartsPanelHtml}`;
  };

  const rcCompute = () => {
    const ds = rcAct(); if (!ds) return; const R = rcCalc(ds);
    const f = rcFmt, ft = rcFmtT;
    const st = deps.document.getElementById('rcStats') as AnyRec, cr = deps.document.getElementById('rcCrit') as AnyRec, vd = deps.document.getElementById('rcVerdict') as AnyRec, sc = deps.document.getElementById('rcScatter') as AnyRec, bl = deps.document.getElementById('rcBland') as AnyRec;
    if (!st) return;
    const html = deps.pres.resultHtml(R, RC_MIN_PAIRS, f, ft); st.innerHTML = html.statsHtml; cr.innerHTML = html.criteriaHtml; vd.innerHTML = html.verdictHtml; if (!R) { sc.innerHTML = ''; bl.innerHTML = ''; return; } sc.innerHTML = rcScatterSVG(R, ds.test); bl.innerHTML = rcBlandSVG(R);
  };

  const rcMetaFocus = (k: string) => { const ui = deps.ui(); ui.rcMetaBefore = ui.rcMetaBefore || {}; const ds = rcAct(); ui.rcMetaBefore[k] = ds ? ds.test[k] : undefined; };
  const rcMetaLog = (k: string) => {
    const ui = deps.ui(), ds = rcAct(); if (!ds || !ui.rcMetaBefore || !(k in ui.rcMetaBefore)) return;
    const before = ui.rcMetaBefore[k], after = ds.test[k]; delete ui.rcMetaBefore[k];
    if (before === after) return;
    deps.logAct('Cập nhật so sánh hóa chất', `${RC_META_LOG_LABEL[k] || k}: ${before ?? '—'} → ${after ?? '—'}`, rcLabel(ds));
  };
  const rcMeta = (k: string, v: AnyRec) => {
    if (!deps.requireWrite()) return; const before = rcAct() && rcAct().test[k];
    const result = deps.service.updateMetadata(deps.getState(), { id: deps.ui().rcId, key: k, value: k === 'date' ? (deps.parseVN(v) || deps.cleanText(v, 20)) : v });
    if (result.error) return; const ds = result.comparison; rcSaveSoon(); rcCompute();
    if (k === 'coverageConfirmed' && before !== result.value) deps.logAct('Xác nhận bao phủ SOP', `${result.value ? 'Đã xác nhận' : 'Chưa xác nhận'} bao phủ khoảng đo/điểm quyết định lâm sàng`, rcLabel(ds));
    if (k === 'reagent' || k === 'lotOld' || k === 'lotNew') { const d = deps.document.getElementById('rcCmpDisp'); if (d) d.textContent = rcLabel(rcAct()); const s = deps.document.getElementById('rcSel') as AnyRec; if (s) { const o = [...s.options].find((o: AnyRec) => o.value === deps.ui().rcId); if (o) o.textContent = rcLabel(rcAct()); } const oh = deps.document.getElementById('rcOldLotHead'), nh = deps.document.getElementById('rcNewLotHead'); if (oh) oh.textContent = 'Lô cũ' + (ds.test.lotOld ? ': ' + ds.test.lotOld : ''); if (nh) nh.textContent = 'Lô mới' + (ds.test.lotNew ? ': ' + ds.test.lotNew : ''); }
  };
  const rcUpdateRowCalc = (i: number) => {
    const row = deps.document.querySelector(`[data-rc-row="${i}"]`), ds = rcAct(); if (!row || !ds || !ds.rows[i]) return;
    const c = rcPairCalc(ds.rows[i]), avg = row.querySelector('.rc-calc.avg'), dif = row.querySelector('.rc-calc.dif');
    if (avg) avg.textContent = c ? deps.fmt(c.avg, 3) : '–';
    if (dif) { dif.textContent = c ? deps.fmt(c.dif, 3) : '–'; dif.classList.toggle('neg', !!(c && c.dif < 0)); }
  };
  const rcCell = (i: number, w: string, v: AnyRec) => { if (!deps.requireWrite()) return; const result = deps.service.updateCell(deps.getState(), { id: deps.ui().rcId, rowIndex: i, column: w, value: v }); if (result.error) return; rcSaveSoon(); rcUpdateRowCalc(i); rcCompute(); };
  const rcAddRow = () => { if (!deps.requireWrite()) return; if (deps.service.addRow(deps.getState(), { id: deps.ui().rcId }).error) return; deps.save({ clearDerived: false }); deps.rerender(); };
  const rcRmRow = (i: number) => { if (!deps.requireWrite()) return; if (deps.service.removeRow(deps.getState(), { id: deps.ui().rcId, rowIndex: i }).error) return; deps.save({ clearDerived: false }); deps.rerender(); };
  const rcClearRows = () => { if (!deps.requireWrite()) return; if (deps.service.clearRows(deps.getState(), { id: deps.ui().rcId }).error) return; deps.save({ clearDerived: false }); deps.rerender(); };
  const rcSwitch = (id: string) => { deps.ui().rcId = id; deps.rerender(); };
  const rcDelete = async (id: string, keepModal = false) => {
    if (!deps.requireAdmin()) return; if (deps.getState().reagentTests.length <= 1) { await deps.infoDialog('Phải còn ít nhất 1 phép so sánh.'); return; }
    if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa phép so sánh', message: 'Xóa phép so sánh này?', confirmLabel: 'Xóa', cancelLabel: 'Hủy' })) return;
    const result = deps.workflow.remove({ id }); if (result.error) return; if (deps.ui().rcId === id) deps.ui().rcId = result.nextId; if (keepModal) renderRcModal(); deps.rerender();
  };
  const rcDeleteCurrent = () => rcDelete(deps.ui().rcId);
  const rcQuickLabel = (type: string) => deps.pres.quickLabel.label(type);
  const rcQuickList = (type: string) => { const result = deps.service.ensureQuickList(deps.getState(), type); return result.error ? [] : result.items; };
  const rcOpenQuick = (type: string) => { if (!deps.requireWrite()) return; deps.ui().rcQuickType = type; rcRenderQuickModal(); };
  const rcRenderQuickModal = () => {
    const type = deps.ui().rcQuickType || 'operator', items = rcQuickList(type), label = rcQuickLabel(type);
    const rows = deps.pres.quickPickerRows({ items, labelHtml: deps.esc(label), esc: deps.esc, selectButtonHtml: (i: number) => deps.button('Chọn', { action: 'rcPickQuick', args: [i] }, 'teal sm') });
    deps.openModal(deps.pres.quickPickerModal({ labelHtml: deps.esc(label), rowsHtml: rows, placeholderHtml: deps.escapeAttr(label), addButtonHtml: deps.button('Thêm', { action: 'rcAddQuick' }, 'teal sm'), closeButtonHtml: deps.button('Đóng', { action: 'closeModal' }, 'ghost') }));
    deps.requestFrame(() => { const e = deps.document.getElementById('rcQuickNew') as AnyRec; if (e) e.focus(); }, 0);
  };
  const rcPickQuick = (i: number) => { const result = deps.service.pickQuick(deps.getState(), { id: deps.ui().rcId, type: deps.ui().rcQuickType, index: i }); if (result.error) return; deps.save({ clearDerived: false }); deps.closeModal(); deps.rerender(); };
  const rcAddQuick = () => {
    const input = deps.document.getElementById('rcQuickNew') as AnyRec, v = deps.cleanText(input && input.value, 120).trim(); if (!v) return;
    const result = deps.service.addQuick(deps.getState(), { type: deps.ui().rcQuickType, value: v }); if (result.error) return;
    deps.save({ clearDerived: false }); rcRenderQuickModal();
  };
  const rcDelQuick = async (i: number) => {
    const items = rcQuickList(deps.ui().rcQuickType), v = items[i]; if (!v) return;
    if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa khỏi danh sách', message: `Xóa "${v}" khỏi danh sách?`, confirmLabel: 'Xóa', cancelLabel: 'Hủy' })) return;
    if (deps.service.removeQuick(deps.getState(), { type: deps.ui().rcQuickType, index: i }).error) return; deps.save({ clearDerived: false }); rcRenderQuickModal();
  };
  const openRcModal = () => { deps.ui().rcModalQ = ''; renderRcModal(); };
  const rcModalSearchSet = (v: string) => { deps.ui().rcModalQ = v; deps.scheduleSearchRender(rcModalSearchSet, renderRcModal, 'rcModalSearch'); };
  const renderRcModal = () => {
    const q = deps.searchText(deps.ui().rcModalQ);
    const hit = (d: AnyRec) => !q || [rcLabel(d), d.test.reagent, d.test.lotOld, d.test.lotNew, d.test.unit, d.test.operator].some((v: unknown) => deps.searchText(v).includes(q));
    const rows = deps.pres.pickerRows({ items: deps.getState().reagentTests.filter(hit).map((d: AnyRec) => ({ id: d.id, labelHtml: deps.esc(rcLabel(d)), unitHtml: deps.esc(d.test.unit || ''), rowCount: d.rows && d.rows.length || 0, selected: d.id === deps.ui().rcId })), canWrite: deps.canWrite(), selectButtonHtml: (id: string, selected: boolean) => deps.button(selected ? 'Đang chọn' : 'Chọn', { action: 'rcPick', args: [id] }, (selected ? 'teal' : 'ghost') + ' sm') });
    deps.openModal(deps.pres.pickerModal({ searchValueHtml: deps.escapeAttr(deps.ui().rcModalQ), rowsHtml: rows, closeButtonHtml: deps.button('Đóng', { action: 'closeModal' }, 'ghost') }));
    deps.requestFrame(() => { const e = deps.document.getElementById('rcModalSearch') as AnyRec; if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 0);
  };
  const rcPick = (id: string) => { deps.ui().rcId = id; deps.closeModal(); deps.rerender(); };
  const rcDeleteFromModal = (id: string) => rcDelete(id, true);
  const openRcCreateModal = () => { deps.ui().rcCreateModalQ = ''; renderRcCreateModal(); };
  const rcCreateSearchSet = (v: string) => { deps.ui().rcCreateModalQ = v; deps.scheduleSearchRender(rcCreateSearchSet, renderRcCreateModal, 'rcCreateSearch'); };
  const renderRcCreateModal = () => {
    const q = deps.ui().rcCreateModalQ.trim(), ql = deps.searchText(q);
    const cats: Record<string, AnyRec[]> = {}; deps.refTests().forEach((r: AnyRec) => { if (ql && ![r[0], r[1], r[4], deps.teaAnalyteDisplay(r[0])].some((v: unknown) => deps.searchText(v).includes(ql))) return; (cats[r[4]] = cats[r[4]] || []).push(r); });
    const refs = deps.pres.createReferenceRows(Object.keys(cats).map(cat => ({ nameHtml: deps.esc(cat), rowsHtml: cats[cat].map((r: AnyRec) => `<button class="refrow" data-action="rcCreateFrom" data-args="${deps.escapeAttr(JSON.stringify([r[0], r[1] || '']))}">${deps.esc(deps.teaAnalyteDisplay(r[0]))}</button>`).join('') })), '');
    const createTyped = deps.pres.createTypedRow(q ? deps.esc(q) : '', `data-action="rcCreateFrom" data-args="${deps.escapeAttr(JSON.stringify([q || 'Hóa chất mới']))}"`);
    deps.openModal(deps.pres.createModal({ searchValueHtml: deps.escapeAttr(deps.ui().rcCreateModalQ), createTypedHtml: createTyped, referenceRowsHtml: refs, emptyReferenceHtml: '<div class="empty" style="padding:18px">Không tìm thấy trong danh mục chuẩn.</div>', closeButtonHtml: deps.button('Đóng', { action: 'closeModal' }, 'ghost') }));
    deps.requestFrame(() => { const e = deps.document.getElementById('rcCreateSearch') as AnyRec; if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 0);
  };
  const rcCreateFrom = (name: string, unit = '') => { if (!deps.requireWrite()) return; const result = deps.workflow.create({ id: deps.uid(), name, unit }); if (result.error) return; deps.ui().rcId = result.comparison.id; deps.closeModal(); deps.rerender(); };
  const rcFmt = (x: AnyRec, k = 4) => deps.pres.report.formatNumber(x, k);
  const rcFmtT = (x: AnyRec) => deps.pres.report.formatTStatistic(x);
  const rcDateText = (v: AnyRec) => v ? deps.esc(deps.vnDate(v)) : deps.formatDateTimeVN(new Date().toISOString()).split(' ').slice(1).join(' ');
  const rcReportVerdict = (R: AnyRec) => deps.pres.report.verdict(R, RCC);
  const rcReportPill = (R: AnyRec) => deps.pres.report.pillHtml(rcReportVerdict(R), deps.esc);
  const rcReportHeader = (title: string, sub: string) => deps.reportHeader(title) + deps.pres.report.subtitleHtml(deps.esc(sub || ''), RCC.muted);
  const rcReportSummaryTable = (items: AnyRec[]) => deps.pres.report.summaryTableHtml(items, RCC, deps.esc);
  const rcReportDetail = (ds: AnyRec, i = 0, pagebreak = false) => {
    const R = rcCalc(ds), t = ds.test;
    const model = deps.pres.report.detailModel(R, t, RC_MIN_PAIRS, rcDateText(t.date));
    let body = deps.pres.report.detailMetaHtml(model.metadata, deps.esc);
    if (!R) return deps.pres.reportDetailCard({ index: i + 1, reagentHtml: deps.esc(t.reagent || 'Hóa chất mới'), pillHtml: rcReportPill(R), bodyHtml: body + deps.pres.report.missingDataHtml(RC_MIN_PAIRS), pagebreak });
    body += deps.pres.report.pairTableHtml(model.pairs);
    body += deps.pres.report.metricsHtml(model.metrics);
    body += deps.pres.report.conclusionHtml(deps.esc(model.conclusion), RCC.muted);
    body += deps.pres.reportChartGrid(rcScatterSVG(R, t), rcBlandSVG(R));
    return deps.pres.reportDetailCard({ index: i + 1, reagentHtml: deps.esc(t.reagent || 'Hóa chất mới'), pillHtml: rcReportPill(R), bodyHtml: body, pagebreak });
  };
  const rcReportItems = () => deps.pres.reportItem.items(deps.getState().reagentTests, rcCalc);
  const rcPrintSummary = async () => {
    const items = rcReportItems();
    if (!items.length) { await deps.infoDialog('Chưa có phép so sánh hóa chất.'); return; }
    const valid = items.filter((x: AnyRec) => x.R).length;
    if (!valid) { await deps.infoDialog(`Chưa đủ dữ liệu để tạo báo cáo tổng hợp (mỗi hóa chất cần tối thiểu ${RC_MIN_PAIRS} cặp giá trị hợp lệ).`); return; }
    let body = rcReportHeader('BÁO CÁO SO SÁNH 2 LÔ HÓA CHẤT', `Tổng hợp ${items.length} hóa chất · ${valid} phép đủ dữ liệu · Ngày xuất: ${deps.formatDateTimeVN(new Date().toISOString())}`);
    body += rcReportSummaryTable(items);
    items.forEach((it: AnyRec, i: number) => body += rcReportDetail(it.ds, i, i > 0));
    body += deps.signBlock();
    await deps.openPrint('Báo cáo so sánh hóa chất tổng hợp', body);
  };
  const rcPrint = async () => {
    const ds = rcAct(), R = rcCalc(ds); if (!R) { await deps.infoDialog(`Chưa đủ dữ liệu (tối thiểu ${RC_MIN_PAIRS} cặp).`); return; }
    let body = rcReportHeader('BÁO CÁO SO SÁNH 2 LÔ HÓA CHẤT', 'Tổng hợp 1 hóa chất · Ngày xuất: ' + deps.formatDateTimeVN(new Date().toISOString()));
    body += rcReportSummaryTable([{ ds, R }]);
    body += rcReportDetail(ds, 0, false);
    body += deps.signBlock();
    await deps.openPrint('So sánh lô — ' + (ds.test.reagent || ''), body);
  };

  return { rcLabel, rcAct, rcCalc, rcCompute, pageReagent, rcMeta, rcMetaFocus, rcMetaLog, rcCell, rcUpdateRowCalc, rcAddRow, rcRmRow, rcClearRows, rcSwitch, rcDelete, rcDeleteCurrent, rcOpenQuick, rcPickQuick, rcAddQuick, rcDelQuick, openRcModal, rcModalSearchSet, renderRcModal, rcPick, rcDeleteFromModal, openRcCreateModal, rcCreateSearchSet, renderRcCreateModal, rcCreateFrom, rcPrint, rcPrintSummary, rcReportDetail, rcReportItems, rcReportSummaryTable };
}

type AnyRec = any;

/**
 * Trang "Cấu hình chung" (Manage) — máy/panel/lô/nhóm lô/Mean-SD/chuyển tiếp
 * lô/danh mục xét nghiệm/lịch sử dữ liệu/Bảng TEa tham chiếu. Toàn bộ HTML thật
 * đã nằm trong các hàm `deps.pres.xxxPresentation()` (TypeScript) từ các đợt
 * trước; controller này chỉ còn phần điều phối — đọc state, gọi đúng
 * presentation, ghi UI state, mở modal/dialog.
 */
export function createManagePageController(deps: {
  document: Document;
  getState: () => AnyRec;
  ui: () => AnyRec;
  currentPage: () => string;
  rerender: () => void;
  role: () => string;
  userName: () => string;
  requireAdmin: (message?: string) => boolean;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  btn: (label: string, action: string, cls?: string, title?: string, options?: AnyRec) => string;
  emptyState: (title: string, body: string, actions?: string) => string;
  dateBox: (id: string, value: string, cls: string, attrs: string) => string;
  headOnly: (title: string, subtitle: string, actions?: string) => string;
  openModal: (html: string) => void;
  closeModal: () => void;
  confirmDialog: (opts: AnyRec) => Promise<boolean>;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  searchText: (value: unknown) => string;
  vnDate: (value: unknown) => string;
  fmt: (value: unknown, decimals?: number) => string;
  fmtTestValue: (test: AnyRec, value: unknown) => string;
  formatDateTimeVN: (value: unknown) => string;
  isoToday: () => string;
  parseVN: (value: unknown) => string;
  QCCore: { cleanText: (value: unknown, maximumLength?: number) => string };
  scheduleSearchRender: (owner: AnyRec, apply: () => void, focusId?: string) => void;
  teaSourceRegistry: () => AnyRec;
  effectiveTeaRefs: () => AnyRec[];
  teaRefIsDefault: (value: unknown) => boolean;
  teaRefName: (value: unknown) => string;
  teaAnalyteMeta: (name: unknown, record?: AnyRec) => AnyRec;
  teaAnalyteDisplay: (name: unknown, record?: AnyRec) => string;
  testDisplayName: (test: AnyRec) => string;
  transitionSwitchesLot: (transition: AnyRec) => boolean;
  lotGroupInUse: (group: AnyRec) => boolean;
  targetConfigAssigned: (test: AnyRec, level: number, lotId: string) => AnyRec;
  plannedTargetFor: (test: AnyRec, level: number, lotId: string) => AnyRec;
  lotTargetSnapshot: (test: AnyRec, level: number, lotId: string) => AnyRec;
  targetRangeDraft: (cfg: AnyRec) => AnyRec;
  targetNumberText: (value: unknown, test: AnyRec, kind?: string) => string;
  TeaReferenceService: AnyRec;
  TeaReferenceWorkflowCommand: AnyRec;
  /* ~76 hàm dựng HTML thuần (TypeScript), gom một chỗ thay vì khai kiểu từng cái
     — khớp cách reagent-page-controller.ts đã làm với deps.pres. */
  pres: AnyRec;
}) {
  const state = () => deps.getState();
  const ui = () => deps.ui();

  const manageSearchSet = (v: unknown) => {
    ui().manageQ = v;
    deps.scheduleSearchRender(manageSearchSet, renderManageBody, 'manageSearch');
  };
  const manageMatch = (values: unknown[]) => deps.pres.manageSearchMatchPresentation(values, ui().manageQ, deps.searchText);
  const manageSearchPlaceholder = () => deps.pres.manageSearchPlaceholderPresentation(ui().manageTab);
  const groupsOfLot = (id: unknown) => deps.pres.groupsOfLotPresentation(state().lotGroups, id);
  const lotGroupLabels = (id: unknown) => deps.pres.manageLotGroupLabelsPresentation(state().lotGroups, id);
  const instrumentName = (id: unknown, fallback = '') => deps.pres.manageInstrumentNamePresentation(state().instruments, id, fallback);
  const panelName = (id: unknown) => deps.pres.managePanelNamePresentation(state().qcPanels, id);
  const lotLabel = (id: unknown) => deps.pres.manageLotLabelPresentation(state().qcLots, id);
  const lotTransitionToNo = (lotId: unknown) => deps.pres.lotTransitionTargetNumberPresentation(state().lotTransitions || [], state().qcLots, lotId, deps.transitionSwitchesLot);
  const lotStatus = (l: AnyRec) => deps.pres.manageLotStatusPresentation(l, lotTransitionToNo(l.id));

  const manageShell = (body: string) => {
    const histCount = state().tests.reduce((n: number, t: AnyRec) => n + (t.levels || []).reduce((m: number, l: AnyRec) => m + Math.max(1, (l.meanSdHistory || []).length), 0), 0);
    const items: [string, string][] = [['instruments', 'Máy xét nghiệm'], ['assays', 'Danh mục xét nghiệm'], ['panels', 'Panel QC'], ['lots', 'Lô & Nhóm QC'], ['targets', 'Mean/SD'], ['transitions', 'Chuyển tiếp lô'], ['history', 'Lịch sử dữ liệu'], ['tearefs', 'Bảng TEa tham chiếu']];
    const counts: AnyRec = { lots: state().qcLots.length + ' / ' + state().lotGroups.length, panels: state().qcPanels.length, targets: state().tests.reduce((n: number, t: AnyRec) => n + t.levels.filter((l: AnyRec) => l.qcLotId).length, 0), history: histCount, transitions: state().lotTransitions.length, assays: state().tests.length, instruments: state().instruments.length, tearefs: deps.effectiveTeaRefs().length };
    return deps.pres.manageShellPresentation(items.map(x => ({ id: x[0], label: x[1], count: counts[x[0]] || '' })), ui().manageTab, body);
  };
  const manageToolbar = (title: string, sub: string, action?: string, label?: string) => {
    const ph = manageSearchPlaceholder();
    return deps.pres.manageToolbarPresentation({ title, subtitle: sub, placeholder: ph, query: ui().manageQ, action, actionLabel: label });
  };

  const manageLots = () => {
    const rows = state().qcLots.filter((l: AnyRec) => manageMatch([l.lotNo, l.description, l.supplier, l.program, lotGroupLabels(l.id), l.level, l.exp])).map((l: AnyRec) => { const used = state().tests.reduce((n: number, t: AnyRec) => n + t.levels.filter((x: AnyRec) => x.qcLotId === l.id).length, 0), s = lotStatus(l), model = { id: l.id, lotNo: l.lotNo, description: l.description, program: l.program, level: l.level, expiry: l.exp ? deps.vnDate(l.exp) : '', status: s, used }; return deps.pres.manageLotRowPresentation(model); }).join('');
    const groupRows = state().lotGroups.filter((g: AnyRec) => manageMatch([g.name, g.note, ...(g.lotIds || []).map((id: unknown) => (state().qcLots.find((l: AnyRec) => l.id === id) || {}).lotNo)])).map((g: AnyRec) => {
      const lots = (g.lotIds || []).map((id: unknown) => state().qcLots.find((l: AnyRec) => l.id === id)).filter(Boolean), archived = g.active === false;
      /* archived (g.active===false): nhóm đã lưu trữ. stopped/planned: giữ liên kết lô để
         xem lịch sử hoặc kích hoạt lại nhưng bị khóa khỏi Nhập QC. lotGroupInUse() chỉ cho
         biết nhóm còn được cấu hình Mean/SD tham chiếu hay không; trạng thái vận hành thật
         được isOperationalLotGroup() quyết định. */
      const inUse = deps.lotGroupInUse(g);
      const statusTag = deps.pres.lotGroupStatusPresentation(archived, g.status, inUse);
      const toggle = deps.pres.lotGroupToggleActionPresentation(archived, g.status, inUse), toggleBtn = toggle ? deps.btn(toggle.label, toggle.command === 'activate' ? `activateLotGroup('${g.id}')` : `toggleLotGroupStatus('${g.id}')`, toggle.variant) : '';
      const lotsHtml = deps.pres.lotGroupLotPillsHtml(lots.map((l: AnyRec) => ({ lotNo: deps.esc(l.lotNo), level: l.level }))), actionsHtml = deps.btn('Sửa nhóm', `openConfigGroup('${g.id}')`, 'ghost sm') + deps.btn('Mean/SD', `openTargetMatrix('','${g.id}')`, 'ghost sm') + toggleBtn + deps.btn('Xóa', `deleteConfigGroup('${g.id}')`, 'danger sm'), model = { archived, name: g.name, note: g.note, status: statusTag, lotsHtml, actionsHtml };
      return deps.pres.manageLotGroupCardPresentation(model);
    }).join('');
    return manageToolbar('Lô & Nhóm QC', 'Quản lý từng lô và nhóm lô QC.') + deps.pres.manageLotConfigLayoutPresentation({ lotAddButtonHtml: deps.btn('Thêm lô QC', 'openConfigLot()', 'teal sm'), lotRowsHtml: rows, lotEmptyHtml: deps.emptyState('Chưa có lô QC', 'Tạo từng lô QC độc lập, sau đó nhập Mean/SD cho Panel QC.'), groupAddButtonHtml: deps.btn('Thêm nhóm lô', 'openConfigGroup()', 'teal sm'), groupRowsHtml: groupRows, groupEmptyHtml: deps.emptyState('Chưa có nhóm lô', 'Chọn các lô QC đã tạo để ghép thành một nhóm, ví dụ 1101/1102.') });
  };

  const manageInstruments = () => {
    const rows = state().instruments.filter((i: AnyRec) => manageMatch([i.name, i.manufacturer, i.model, i.serial, i.section])).map((i: AnyRec) => { const n = state().tests.filter((t: AnyRec) => t.instrumentId === i.id).length; const model = { id: i.id, name: i.name, section: i.section, manufacturer: i.manufacturer, serial: i.serial, assayCount: n, active: !!i.active }; return deps.pres.manageInstrumentRowPresentation(model); }).join('');
    return manageToolbar('Máy xét nghiệm', 'Quản lý máy xét nghiệm, hãng và số sê-ri.', 'openConfigInstrument()', 'Thêm máy xét nghiệm') + deps.pres.manageInstrumentTablePresentation({ rowsHtml: rows, emptyHtml: deps.emptyState('Chưa có máy xét nghiệm', 'Thêm máy trước khi cấu hình xét nghiệm.') });
  };

  const managePanels = () => {
    const rows = state().qcPanels.filter((p: AnyRec) => manageMatch([p.name, p.note, instrumentName(p.instrumentId), ...(p.testIds || []).map((id: unknown) => (state().tests.find((t: AnyRec) => t.id === id) || {}).name)])).map((p: AnyRec) => { const tests = (p.testIds || []).map((id: unknown) => state().tests.find((t: AnyRec) => t.id === id)).filter(Boolean), testsHtml = tests.map((t: AnyRec) => `<span class="pill">${deps.esc(deps.testDisplayName(t))}</span>`).join(''), model = { id: p.id, name: p.name, instrument: instrumentName(p.instrumentId), testsHtml, testCount: tests.length, active: p.active !== false }; return deps.pres.managePanelRowPresentation(model); }).join('');
    return manageToolbar('Panel QC', 'Nhóm các xét nghiệm theo từng máy để thiết lập và quản lý QC.', 'openConfigPanel()', 'Thêm Panel QC') + deps.pres.managePanelTablePresentation({ rowsHtml: rows, emptyHtml: deps.emptyState('Chưa có Panel QC', 'Tạo Panel QC trước, sau đó nhập Mean/SD theo nhóm lô trong thẻ Mean/SD.') });
  };

  const manageTransitionsV2 = () => {
    const rows = state().lotTransitions.filter((tr: AnyRec) => manageMatch([panelName(tr.panelId), lotLabel(tr.fromLotId), lotLabel(tr.toLotId), tr.startDate, tr.status, tr.approvedBy])).map((tr: AnyRec) => { const s = deps.pres.manageTransitionStatusPresentation(tr.status), to = state().qcLots.find((l: AnyRec) => l.id === tr.toLotId), details = deps.pres.manageTransitionDetailsPresentation({ movedLotNo: deps.transitionSwitchesLot(tr) && to ? deps.esc(to.lotNo) : '', approvalText: tr.approvedBy ? deps.esc(tr.approvedBy) + (tr.approvedAt ? ' · ' + deps.formatDateTimeVN(tr.approvedAt) : '') : '' }), model = { id: tr.id, panel: panelName(tr.panelId), fromLot: lotLabel(tr.fromLotId), toLot: lotLabel(tr.toLotId), startDate: tr.startDate ? deps.vnDate(tr.startDate) : '', status: s, movedHtml: details.movedHtml, approvalHtml: details.approvalHtml }; return deps.pres.manageTransitionRowPresentation(model); }).join('');
    return manageToolbar('Chuyển tiếp lô QC', 'Theo dõi lô cũ, lô mới và trạng thái khi thay lô.', 'openLotTransitionV2()', 'Thêm hồ sơ chuyển lô') + deps.pres.manageTransitionTablePresentation({ rowsHtml: rows, emptyHtml: deps.emptyState('Chưa có hồ sơ chuyển lô', 'Tạo hồ sơ để theo dõi chuyển từ lô cũ sang lô mới.') });
  };

  const targetGroupLots = (group: AnyRec) => deps.pres.targetGroupLotsPresentation(state().qcLots, group);
  const targetGroupOptions = () => {
    const groups = state().lotGroups.filter((g: AnyRec) => g.active !== false);
    return deps.pres.targetGroupOptionsPresentation(groups, ui().manageTargetGroup, targetGroupLots, deps.pres.targetGroupLabelPresentation, deps.pres.targetGroupStatusSuffixPresentation, deps.esc);
  };
  const ensureTargetSelection = () => {
    const picked = deps.pres.targetSelectionPresentation(state().qcPanels, state().lotGroups, ui().manageTargetPanel, ui().manageTargetGroup, targetGroupLots);
    ui().manageTargetPanel = picked.panelId; ui().manageTargetGroup = picked.groupId;
  };

  const manageTargets = () => {
    ensureTargetSelection();
    const prerequisite = deps.pres.targetPrerequisitePresentation({ tests: state().tests.length, panels: state().qcPanels.length, lots: state().qcLots.length, groups: state().lotGroups.length });
    if (prerequisite === 'tests') return manageToolbar('Mean/SD theo nhóm lô QC', 'Chọn Panel QC để nhập Mean/SD hàng loạt.', "setManageTab('assays')", 'Thêm xét nghiệm') + deps.pres.manageEmptyPanelPresentation(deps.emptyState('Chưa có xét nghiệm', 'Tạo xét nghiệm trước, sau đó quay lại nhập Mean/SD theo nhóm lô.'));
    if (prerequisite === 'panels') return manageToolbar('Mean/SD theo nhóm lô QC', 'Chỉ dùng Panel QC để nhập Mean/SD hàng loạt.', "setManageTab('panels')", 'Thêm Panel QC') + deps.pres.manageEmptyPanelPresentation(deps.emptyState('Chưa có Panel QC', 'Tạo Panel QC và chọn các xét nghiệm thành viên trước, sau đó quay lại nhập Mean/SD theo nhóm lô.'));
    if (prerequisite === 'lots') return manageToolbar('Mean/SD theo nhóm lô QC', 'Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.', "setManageTab('lots')", 'Thêm lô QC') + deps.pres.manageEmptyPanelPresentation(deps.emptyState('Chưa có lô QC', 'Tạo lô QC trước, gom vào nhóm lô rồi quay lại nhập Mean/SD theo nhóm.'));
    if (prerequisite === 'groups') return manageToolbar('Mean/SD theo nhóm lô QC', 'Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.', "setManageTab('lots')", 'Thêm nhóm lô') + deps.pres.manageEmptyPanelPresentation(deps.emptyState('Chưa có nhóm lô QC', 'Tạo nhóm lô từ các lô QC trước, sau đó quay lại nhập Mean/SD theo nhóm.'));
    const group = state().lotGroups.find((x: AnyRec) => x.id === ui().manageTargetGroup), groupLots = targetGroupLots(group), targetLevelPick = deps.pres.targetLevelSelectionPresentation(groupLots, ui().manageTargetLevel), targetLevels = targetLevelPick.levels;
    ui().manageTargetLevel = targetLevelPick.level;
    const selectedLevel = Number(ui().manageTargetLevel), levelLotPick = deps.pres.targetLevelLotsPresentation(groupLots, selectedLevel), levelLots = levelLotPick.levelLots, levelDepletedLots = levelLotPick.depletedLots, q = deps.searchText(ui().manageQ), allTests = deps.pres.targetPanelTestsPresentation(state().qcPanels, state().tests, ui().manageTargetPanel), tests = allTests.filter((t: AnyRec) => !q || deps.pres.targetSearchValuesPresentation(t, group && group.name, levelLots, deps.testDisplayName, instrumentName).some((v: unknown) => deps.searchText(v).includes(q)));
    if (!group || !groupLots.length) return manageToolbar('Mean/SD theo nhóm lô QC', 'Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.') + deps.pres.manageEmptyPanelPresentation(deps.emptyState('Nhóm lô chưa có lô QC', 'Sửa nhóm lô và chọn các lô QC cần dùng trước.'));
    const rowItems = deps.pres.targetMatrixItemsPresentation(tests, levelLots, deps.targetConfigAssigned, deps.plannedTargetFor, deps.lotTargetSnapshot);
    const targetStats = deps.pres.targetMatrixStatsPresentation(rowItems);
    const rows = rowItems.map(({ t, lot, linked, same, assigned, planned, cfg }: AnyRec) => { const draft = deps.targetRangeDraft(cfg || {}), rowState = deps.pres.targetRowStatePresentation(linked, assigned, planned, lot.depleted), locked = rowState.locked, retiredTo = locked ? lotTransitionToNo(lot.id) : '', checked = rowState.checked, disabled = rowState.disabled; return deps.pres.targetMatrixRowPresentation({ testId: t.id, lotId: lot.id, locked, checked, disabled, name: deps.testDisplayName(t), unit: t.unit, mean: deps.targetNumberText(draft.mean, t), low: deps.targetNumberText(draft.low, t), high: deps.targetNumberText(draft.high, t), sd: deps.targetNumberText(draft.sd, t, 'stat'), status: rowState.status, retiredTo, otherLot: same && same.lot }, deps.esc, deps.escapeAttr); }).join('');
    const targetLevelTabs = deps.pres.targetLevelTabsPresentation(targetLevels, ui().manageTargetLevel), targetLevelToolbar = deps.pres.targetLevelToolbarPresentation(ui().manageTargetLevel, levelLots.map((l: AnyRec) => l.lotNo), targetLevelTabs, deps.esc), targetContent = rowItems.length ? targetLevelToolbar + deps.pres.targetMatrixTablePresentation(rows) + deps.pres.targetMatrixActionsPresentation(deps.btn('Bỏ chọn tất cả', "targetCheckAll(false)", 'ghost'), deps.btn('Chọn tất cả', "targetCheckAll(true)", 'ghost'), deps.btn('Lưu Mean/SD mức này', 'saveTargetMatrix()', 'teal')) : (() => { const empty = deps.pres.targetEmptyStatePresentation(allTests.length, levelLots.map((l: AnyRec) => l.lotNo), levelDepletedLots.map((l: AnyRec) => l.lotNo), ui().manageTargetLevel); return deps.emptyState(empty.title, empty.description); })();
    return manageToolbar('Mean/SD theo nhóm lô QC', 'Chọn Panel QC và nhóm lô, app tự đưa các xét nghiệm trong panel vào bảng Mean/SD.') +
      deps.pres.targetMatrixPanelPresentation({ selectorHtml: deps.pres.targetSelectorPresentation(deps.pres.targetPanelOptionsPresentation(state().qcPanels, ui().manageTargetPanel, instrumentName, deps.esc), targetGroupOptions()), summaryHtml: rowItems.length ? deps.pres.targetSummaryPresentation(targetStats) : '', contentHtml: targetContent });
  };

  const manageAssays = () => {
    const matched = state().tests.filter((t: AnyRec) => manageMatch([t.name, deps.testDisplayName(t), t.unit, t.method, t.reagent, instrumentName(t.instrumentId, t.machine), t.section, t.tea]));
    const rows = matched.map((t: AnyRec, idx: number) => { const model = { index: idx + 1, id: t.id, name: deps.testDisplayName(t), method: t.method, unit: t.unit, instrument: instrumentName(t.instrumentId, t.machine), section: t.section, reagent: t.reagent, tea: t.tea, closed: !!t.closed }; return deps.pres.manageAssayRowPresentation(model); }).join('');
    return manageToolbar('Danh mục xét nghiệm', 'Quản lý xét nghiệm, máy, đơn vị, phương pháp và TEa.', 'openConfigAssay()', 'Thêm xét nghiệm') + deps.pres.manageAssayTablePresentation({ rowsHtml: rows, emptyHtml: deps.emptyState('Chưa có xét nghiệm', 'Tạo xét nghiệm trước, sau đó gán lô và Mean/SD ở các thẻ cấu hình tương ứng.') });
  };

  const manageHistorySearchValues = (t: AnyRec) => deps.pres.historySearchValuesPresentation(t, state().qcLots, deps.testDisplayName);
  const manageHistory = () => {
    const q = deps.searchText(ui().manageQ), matches = state().tests.filter((t: AnyRec) => !q || manageHistorySearchValues(t).some((v: unknown) => deps.searchText(v).includes(q)));
    if (!state().tests.length) return manageToolbar('Lịch sử dữ liệu QC', 'Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.') + deps.pres.manageEmptyPanelPresentation(deps.emptyState('Chưa có xét nghiệm', 'Tạo xét nghiệm trước, sau đó cấu hình lô và Mean/SD.'));
    if (!matches.length) return manageToolbar('Lịch sử dữ liệu QC', 'Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.') + deps.pres.manageEmptyPanelPresentation(deps.emptyState('Không tìm thấy xét nghiệm', 'Thử tìm theo tên xét nghiệm.'));
    const historyPick = deps.pres.historyAssaySelectionPresentation(matches, ui().manageHistoryTest);
    ui().manageHistoryTest = historyPick.selectedId;
    const t = historyPick.assay;
    const opts = deps.pres.historyAssayOptionsPresentation(matches, t.id, deps.testDisplayName, deps.esc);
    const rows = deps.pres.historyRowsPresentation(t, state().qcLots, state().data[t.id] || [], lotGroupLabels);
    const visibleRows = deps.pres.historyVisibleRowsPresentation(rows, t.name, q, deps.searchText);
    const html = deps.pres.historyRowSortPresentation(visibleRows).map((r: AnyRec) => {
      const period = deps.pres.historyPeriodLabelPresentation(r.h.effectiveFrom, r.h.effectiveTo, deps.vnDate);
      const model = { testId: r.t.id, level: r.l.level, lot: r.lotNo || '', group: r.group, mean: deps.fmtTestValue(r.t, r.h.mean), low: r.h.low != null ? deps.fmtTestValue(r.t, r.h.low) : '—', high: r.h.high != null ? deps.fmtTestValue(r.t, r.h.high) : '—', sd: deps.fmtTestValue(r.t, r.h.sd), period, source: r.h.source, pointCount: r.pts.length };
      return deps.pres.manageHistoryRowPresentation(model);
    }).join('');
    const historyTotals = deps.pres.historySummaryPresentation(visibleRows);
    return manageToolbar('Lịch sử dữ liệu QC', 'Chọn một xét nghiệm để xem các lô/Mean-SD đã từng dùng.') +
      deps.pres.historyPanelPresentation({ selectorHtml: deps.pres.historySelectorPresentation(opts, historyTotals.rowCount, historyTotals.pointCount), tableHtml: deps.pres.historyTablePresentation(html, q ? deps.emptyState('Không tìm thấy mốc phù hợp', 'Thử tìm theo tên xét nghiệm, mức hoặc lô QC.') : deps.emptyState('Chưa có lịch sử lô', 'Xét nghiệm này chưa được gán lô/Mean-SD.')) });
  };

  /* ===== Bảng TEa tham chiếu (CLIA/Ricos/chuẩn hóa PXN) sửa được trong app ===== */
  const TEA_LAB_BASIS_SOURCES: [string, string][] = [['regulation', 'Quy định pháp lý / CLIA / quốc gia'], ['pt', 'Chương trình ngoại kiểm / PT'], ['eflm', 'EFLM Biological Variation'], ['ricos', 'Ricos / Westgard BV (nguồn cũ)'], ['professional', 'Hiệp hội / ủy ban chuyên môn'], ['other', 'Nguồn khác đã thẩm định']];
  const teaRefFind = (refKey: unknown) => deps.TeaReferenceService.find(state(), refKey);
  const teaRefNumOrNull = (v: unknown) => deps.TeaReferenceService.numberOrNull(v);
  const teaRefExternalChanged = (row: AnyRec, refKey: unknown) => deps.TeaReferenceService.externalChanged(row, refKey);
  const teaRefEnsure = (refKey: unknown) => deps.TeaReferenceService.ensure(state(), refKey).record;
  /* Sửa/xóa/thêm dòng TEa tham chiếu có thể ảnh hưởng TEa% của NHIỀU xét nghiệm
     đang track Sigma cùng lúc (không chỉ xét nghiệm đang mở) — đồng bộ lại snapshot
     kỳ hiện tại của tất cả trước khi lưu, để Sigma không hiển thị TEa cũ cho tới
     khi ai đó tình cờ mở lại trang đó. */
  const teaRefEdit = (name: unknown, field: string, val: unknown) => { if (!deps.requireAdmin()) return; deps.TeaReferenceWorkflowCommand.edit({ name, field, val }); };
  const teaRefRemove = (refKey: unknown) => { if (!deps.requireAdmin()) return; const isDefault = deps.teaRefIsDefault(refKey); deps.TeaReferenceWorkflowCommand.remove({ refKey, isDefault }); };
  const teaSourceRegistryHtml = () => { const items = deps.pres.teaSourceRegistryItemsPresentation(deps.teaSourceRegistry(), deps.vnDate); return deps.pres.teaSourceRegistryPresentation(items); };
  const teaRefOpenAdd = () => {
    if (!deps.requireAdmin()) return;
    deps.openModal(deps.pres.teaReferenceAddModalPresentation({ cancelButtonHtml: deps.btn('Hủy', 'closeModal()', 'ghost'), submitButtonHtml: deps.btn('Thêm xét nghiệm', 'teaRefAddSubmit()', 'teal') }));
    setTimeout(() => { const el = deps.document.getElementById('trAddName'); if (el) el.focus(); }, 0);
  };
  const teaRefAddSubmit = async () => {
    if (!deps.requireAdmin()) return;
    const name = deps.QCCore.cleanText((deps.document.getElementById('trAddName') as AnyRec).value, 120).trim();
    if (!name) { await deps.infoDialog('Nhập tên xét nghiệm.'); return; }
    const data = { name, abbreviation: deps.QCCore.cleanText((deps.document.getElementById('trAddAbbreviation') as AnyRec).value, 40).trim(), matrix: deps.QCCore.cleanText((deps.document.getElementById('trAddMatrix') as AnyRec).value, 80).trim(), unit: deps.QCCore.cleanText((deps.document.getElementById('trAddUnit') as AnyRec).value, 40), section: deps.QCCore.cleanText((deps.document.getElementById('trAddSection') as AnyRec).value, 80), clia: (deps.document.getElementById('trAddClia') as AnyRec).value, ricos: (deps.document.getElementById('trAddRicos') as AnyRec).value };
    deps.TeaReferenceWorkflowCommand.addCustom({ data });
  };
  const teaLabProfileOpen = (refKey: unknown) => {
    if (!deps.requireAdmin()) return;
    const ref = deps.effectiveTeaRefs().find(r => r[6] === refKey || deps.teaRefName(r[0]) === deps.teaRefName(refKey));
    if (!ref) return;
    const row = teaRefFind(refKey), meta = (row && row.sources && row.sources.lab) || {}, source = (row && row.labSource) || '', sourceOpts = ['<option value="">— Chọn nguồn chính —</option>', ...TEA_LAB_BASIS_SOURCES.map(([v, label]) => `<option value="${v}" ${source === v ? 'selected' : ''}>${deps.esc(label)}</option>`)].join(''), effective = meta.effectiveDate || deps.isoToday(), approvedDate = meta.reviewedDate || deps.isoToday(), prepared = (row && row.labPreparedBy) || deps.userName(), approved = meta.reviewedBy || deps.userName(), nextReview = (row && row.labNextReviewDate) || '';
    const body = deps.pres.teaReferenceLabProfileBodyPresentation({ labValue: row && row.lab != null ? row.lab : '', sourceOptionsHtml: sourceOpts, referenceValue: deps.escapeAttr(meta.document || ''), reasonHtml: deps.esc(meta.note || ''), effectiveDateHtml: deps.dateBox('teaLabEffectiveDate', effective, 'manage-date', 'aria-label="Ngày hiệu lực TEa chuẩn hóa"'), nextReviewDateHtml: deps.dateBox('teaLabNextReviewDate', nextReview, 'manage-date', 'aria-label="Ngày xem xét lại TEa chuẩn hóa"'), preparedValue: deps.escapeAttr(prepared), approvedValue: deps.escapeAttr(approved), approvedDateHtml: deps.dateBox('teaLabApprovedDate', approvedDate, 'manage-date', 'aria-label="Ngày phê duyệt TEa chuẩn hóa"') });
    const hasProfile = row && row.lab != null, remove = hasProfile ? deps.btn('Xóa TEa chuẩn hóa', `teaLabProfileRemove('${deps.escapeAttr(refKey)}')`, 'danger') : '';
    deps.openModal(deps.pres.teaReferenceLabProfileModalHtml({ title: hasProfile ? 'Sửa hồ sơ TEa chuẩn hóa' : 'Thêm hồ sơ TEa chuẩn hóa', bodyHtml: body, removeButtonHtml: remove, cancelButtonHtml: deps.btn('Hủy', 'closeModal()', 'ghost'), saveButtonHtml: deps.btn(hasProfile ? 'Lưu thay đổi' : 'Thêm hồ sơ TEa', `teaLabProfileSave('${deps.escapeAttr(refKey)}')`, 'teal') }));
    setTimeout(() => { const e = deps.document.getElementById('teaLabValue'); if (e) e.focus(); }, 0);
  };
  const teaLabProfileSave = async (refKey: unknown) => {
    if (!deps.requireAdmin()) return;
    const get = (id: string) => String((deps.document.getElementById(id) as AnyRec) && (deps.document.getElementById(id) as AnyRec).value || '').trim(), value = teaRefNumOrNull(get('teaLabValue')), source = get('teaLabSource'), reference = deps.QCCore.cleanText(get('teaLabReference'), 500), reason = deps.QCCore.cleanText(get('teaLabReason'), 4000), effective = deps.parseVN(get('teaLabEffectiveDate')) || '', nextReview = deps.parseVN(get('teaLabNextReviewDate')) || '', prepared = deps.QCCore.cleanText(get('teaLabPreparedBy'), 120), approved = deps.QCCore.cleanText(get('teaLabApprovedBy'), 120), approvedDate = deps.parseVN(get('teaLabApprovedDate')) || '';
    const basisLabel = deps.pres.teaLabBasisLabelPresentation(TEA_LAB_BASIS_SOURCES, source);
    if (value == null) { await deps.infoDialog('Nhập TEa chuẩn hóa lớn hơn 0%.'); return; }
    if (!basisLabel) { await deps.infoDialog('Chọn nguồn chính của TEa chuẩn hóa.'); return; }
    if (reference.length < 3) { await deps.infoDialog('Nhập tài liệu, phiên bản hoặc đường dẫn tham chiếu.'); return; }
    if (reason.length < 10) { await deps.infoDialog('Lý do lựa chọn cần ít nhất 10 ký tự.'); return; }
    if (!effective || !approvedDate) { await deps.infoDialog('Nhập ngày hiệu lực và ngày phê duyệt hợp lệ.'); return; }
    if (approvedDate > effective) { await deps.infoDialog('Ngày phê duyệt không được sau ngày hiệu lực.'); return; }
    if (nextReview && nextReview < effective) { await deps.infoDialog('Ngày xem xét lại không được trước ngày hiệu lực.'); return; }
    if (!prepared || !approved) { await deps.infoDialog('Nhập người xây dựng và người phê duyệt.'); return; }
    const profile = { value, source, sourceLabel: basisLabel, reference, reason, effective, nextReview, prepared, approved, approvedDate };
    deps.TeaReferenceWorkflowCommand.saveLabProfile({ refKey, profile });
  };
  const teaLabProfileRemove = async (refKey: unknown) => {
    if (!deps.requireAdmin()) return;
    const row = teaRefFind(refKey);
    if (!row || row.lab == null) return;
    const ok = await deps.confirmDialog({ kicker: 'TEa chuẩn hóa', title: 'Xóa TEa chuẩn hóa?', message: `${deps.teaAnalyteDisplay(row.name, row)} · ${row.lab}%`, detail: 'Các kỳ Sigma cũ vẫn giữ ảnh chụp TEa đã sử dụng. Kỳ hiện tại sẽ không còn dùng nguồn TEa chuẩn hóa này.', confirmLabel: 'Xóa TEa', cancelLabel: 'Hủy', danger: true });
    if (!ok) return;
    const isDefault = deps.teaRefIsDefault(refKey);
    deps.TeaReferenceWorkflowCommand.removeLabProfile({ refKey, isDefault });
  };
  const manageTeaRefs = () => {
    const canManage = deps.role() === 'admin', ro = canManage ? '' : 'disabled';
    const overMap = new Map<string, AnyRec>((state().teaRefs || []).map((r: AnyRec): [string, AnyRec] => [r.analyteId || deps.teaAnalyteMeta(r.name, r).analyteId || deps.teaRefName(r.name), r]));
    const rows = deps.effectiveTeaRefs()
      .map(([name, unit, clia, ricos, section, , analyteId, lab]: AnyRec) => { const isDef = deps.teaRefIsDefault(analyteId), record = overMap.get(analyteId), naming = deps.teaAnalyteMeta(name, record), externalChanged = teaRefExternalChanged(record, analyteId), kind = deps.pres.teaReferenceKindPresentation(isDef, externalChanged, !!(record && record.lab != null)); return { name, unit, clia, ricos, lab, section, analyteId, record, ...naming, kind }; })
      .filter((r: AnyRec) => manageMatch([r.name, r.displayName, r.standardName, r.abbreviation, ...r.aliases, r.matrix, r.unit, r.section]));
    deps.pres.teaReferenceSortPresentation(rows);
    const teaStatus = (kind: unknown) => deps.pres.teaReferenceStatusPresentation(kind);
    const body = rows.map((r: AnyRec) => {
      const rowActions = deps.pres.teaReferenceRowActionsPresentation(r.kind, canManage, r.lab != null), act = rowActions.action === 'restore' ? deps.btn('Khôi phục', `teaRefRemove('${deps.escapeAttr(r.analyteId)}')`, 'ghost sm', 'Khôi phục giá trị mặc định') : rowActions.action === 'remove' ? `<button class="x" onclick="teaRefRemove('${deps.escapeAttr(r.analyteId)}')" title="Xóa xét nghiệm tự thêm">✕</button>` : '';
      const namingTitle = deps.pres.teaReferenceNamingTitlePresentation(r);
      const labButton = rowActions.labProfile === 'none' ? '' : deps.btn(rowActions.labProfile === 'add' ? 'Thêm hồ sơ' : 'Xem hồ sơ', `teaLabProfileOpen('${deps.escapeAttr(r.analyteId)}')`, 'ghost sm', rowActions.labProfile === 'add' ? 'Lập hồ sơ TEa chuẩn hóa' : 'Xem hoặc cập nhật nguồn và lý do lựa chọn');
      return deps.pres.teaReferenceRowPresentation({ namingTitle: deps.escapeAttr(namingTitle), displayName: deps.esc(r.displayName || r.name), unit: deps.esc(r.unit || '—'), section: deps.esc(r.section || '—'), disabled: ro, cliaValue: deps.pres.teaReferenceInputValuePresentation(r.clia), ricosValue: deps.pres.teaReferenceInputValuePresentation(r.ricos), cliaChangeAction: `teaRefEdit('${deps.escapeAttr(r.analyteId)}','clia',this.value)`, ricosChangeAction: `teaRefEdit('${deps.escapeAttr(r.analyteId)}','ricos',this.value)`, labCellHtml: deps.pres.teaReferenceLabValuePresentation(r.lab, deps.fmt) + labButton, statusHtml: teaStatus(r.kind), actionHtml: act });
    }).join('');
    const empty = deps.pres.teaReferenceEmptyStatePresentation(!!deps.searchText(ui().manageQ));
    return manageToolbar('Bảng TEa tham chiếu', 'Tổng hợp TEa từ các nguồn tham chiếu, dùng thống nhất khi tính Sigma.', canManage ? 'teaRefOpenAdd()' : '', 'Thêm xét nghiệm') + teaSourceRegistryHtml() + deps.pres.teaReferenceTablePresentation({ rowsHtml: body, emptyHtml: deps.emptyState(empty.title, empty.description) });
  };

  const manageView = (): string => {
    const views: Record<string, () => string> = { lots: manageLots, panels: managePanels, targets: manageTargets, history: manageHistory, transitions: manageTransitionsV2, assays: manageAssays, instruments: manageInstruments, tearefs: manageTeaRefs };
    if (!views[ui().manageTab]) ui().manageTab = 'instruments';
    return views[ui().manageTab]();
  };
  const renderManageBody = () => {
    const el = deps.document.querySelector('.config-shell-main');
    if (deps.currentPage() !== 'manage' || !el) { deps.rerender(); return; }
    (el as AnyRec).innerHTML = manageView();
  };
  const pageManage = () => {
    const head = deps.headOnly('Cấu hình chung', 'Quản lý máy, Panel QC, lô QC, Mean/SD và luật QC'), shell = manageShell(manageView());
    return deps.pres.managePageHtml(head, shell);
  };

  return {
    manageSearchSet, manageMatch, manageSearchPlaceholder, groupsOfLot, lotGroupLabels, instrumentName, panelName,
    lotLabel, lotTransitionToNo, lotStatus, manageShell, manageToolbar, manageLots, manageInstruments, managePanels,
    manageTransitionsV2, targetGroupLots, targetGroupOptions, ensureTargetSelection, manageTargets, manageAssays,
    manageHistorySearchValues, manageHistory, teaRefFind, teaRefNumOrNull, teaRefExternalChanged, teaRefEnsure,
    teaRefEdit, teaRefRemove, teaSourceRegistryHtml, teaRefOpenAdd, teaRefAddSubmit, teaLabProfileOpen,
    teaLabProfileSave, teaLabProfileRemove, manageTeaRefs, manageView, renderManageBody, pageManage,
  };
}

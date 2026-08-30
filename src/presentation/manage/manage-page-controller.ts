type AnyRec = any;

/**
 * Trang "Cấu hình chung" (Manage) — máy/panel/lô/nhóm lô/Mean-SD/chuyển tiếp
 * lô/danh mục xét nghiệm/lịch sử dữ liệu/Bảng TEa tham chiếu. Trang này chạy
 * bằng React (src/react/pages/ManagePage.tsx, retired 2026-08-29) — controller
 * này giờ chỉ còn `manageModel()` (dữ liệu thuần cho React) cùng các hàm mở
 * modal/dialog (teaRefOpenAdd, teaLabProfileOpen, ...) mà modal vẫn dùng
 * nguyên vẹn vì render vào #modalRoot, ngoài tầm React.
 */
export function createManagePageController(deps: {
  document: Document;
  getState: () => AnyRec;
  ui: () => AnyRec;
  rerender: () => void;
  role: () => string;
  userName: () => string;
  requireAdmin: (message?: string) => boolean;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  btn: (label: string, action: string | { action: string; args?: unknown[] } | null, cls?: string, title?: string, options?: AnyRec) => string;
  dateBox: (id: string, value: string, cls: string, attrs: string) => string;
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
  /* Các hàm dữ liệu/logic thuần (TypeScript) mà manageModel() và các hàm modal
     dưới đây còn gọi tới, gom một chỗ thay vì khai kiểu từng cái — khớp cách
     reagent-page-controller.ts đã làm với deps.pres. */
  pres: AnyRec;
}) {
  const state = () => deps.getState();
  const ui = () => deps.ui();

  const manageSearchSet = (v: unknown) => {
    ui().manageQ = v;
    deps.scheduleSearchRender(manageSearchSet, deps.rerender, 'manageSearch');
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

  const targetGroupLots = (group: AnyRec) => deps.pres.targetGroupLotsPresentation(state().qcLots, group);
  const ensureTargetSelection = () => {
    const picked = deps.pres.targetSelectionPresentation(state().qcPanels, state().lotGroups, ui().manageTargetPanel, ui().manageTargetGroup, targetGroupLots);
    ui().manageTargetPanel = picked.panelId; ui().manageTargetGroup = picked.groupId;
  };

  const manageHistorySearchValues = (t: AnyRec) => deps.pres.historySearchValuesPresentation(t, state().qcLots, deps.testDisplayName);

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
  const teaRefOpenAdd = () => {
    if (!deps.requireAdmin()) return;
    deps.openModal(deps.pres.teaReferenceAddModalPresentation({ cancelButtonHtml: deps.btn('Hủy', { action: 'closeModal' }, 'ghost'), submitButtonHtml: deps.btn('Thêm xét nghiệm', { action: 'teaRefAddSubmit' }, 'teal') }));
    setTimeout(() => { const el = deps.document.getElementById('trAddName'); if (el) el.focus(); }, 0);
  };
  const teaRefAddSubmit = async () => {
    if (!deps.requireAdmin()) return;
    const name = deps.QCCore.cleanText((deps.document.getElementById('trAddName') as AnyRec).value, 120).trim();
    if (!name) { await deps.infoDialog('Nhập tên xét nghiệm.'); return; }
    const data = { name, abbreviation: deps.QCCore.cleanText((deps.document.getElementById('trAddAbbreviation') as AnyRec).value, 40).trim(), matrix: deps.QCCore.cleanText((deps.document.getElementById('trAddMatrix') as AnyRec).value, 80).trim(), unit: deps.QCCore.cleanText((deps.document.getElementById('trAddUnit') as AnyRec).value, 40), section: deps.QCCore.cleanText((deps.document.getElementById('trAddSection') as AnyRec).value, 80), clia: (deps.document.getElementById('trAddClia') as AnyRec).value, ricos: (deps.document.getElementById('trAddRicos') as AnyRec).value };
    deps.TeaReferenceWorkflowCommand.addCustom({ data });
  };
  const teaLabProfileOpenModel = (refKey: unknown) => {
    if (!deps.requireAdmin()) return null;
    const ref = deps.effectiveTeaRefs().find(r => r[6] === refKey || deps.teaRefName(r[0]) === deps.teaRefName(refKey));
    if (!ref) return null;
    const row = teaRefFind(refKey), meta = (row && row.sources && row.sources.lab) || {}, source = (row && row.labSource) || '';
    const effective = meta.effectiveDate || deps.isoToday(), approvedDate = meta.reviewedDate || deps.isoToday(), prepared = (row && row.labPreparedBy) || deps.userName(), approved = meta.reviewedBy || deps.userName(), nextReview = (row && row.labNextReviewDate) || '';
    const hasProfile = !!(row && row.lab != null);
    return {
      refKey, hasProfile, title: hasProfile ? 'Sửa hồ sơ TEa chuẩn hóa' : 'Thêm hồ sơ TEa chuẩn hóa',
      labValue: hasProfile ? row.lab : '', sourceOptions: TEA_LAB_BASIS_SOURCES.map(([value, label]) => ({ value, label })), source,
      referenceValue: meta.document || '', reasonValue: meta.note || '', effective, nextReview, prepared, approved, approvedDate,
    };
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
  /* ===== manageModel(): dữ liệu thuần cho trang React (src/react/pages/ManagePage.tsx) =====
     Mỗi hàm dưới đây là bản song song của manageXxx() ở trên — cùng logic lọc/tính, nhưng
     trả về mảng dữ liệu thay vì chuỗi HTML, để component React tự dựng JSX. Không sửa các
     hàm manageXxx()/deps.pres.xxxRowPresentation() cũ — chúng vẫn được giữ cho tới khi toàn
     bộ trang qua kiểm chứng song song. */
  const MANAGE_TABS: [string, string][] = [['instruments', 'Máy xét nghiệm'], ['assays', 'Danh mục xét nghiệm'], ['panels', 'Panel QC'], ['lots', 'Lô & Nhóm QC'], ['targets', 'Mean/SD'], ['transitions', 'Chuyển tiếp lô'], ['history', 'Lịch sử dữ liệu'], ['tearefs', 'Bảng TEa tham chiếu']];
  const manageShellModel = () => {
    const histCount = state().tests.reduce((n: number, t: AnyRec) => n + (t.levels || []).reduce((m: number, l: AnyRec) => m + Math.max(1, (l.meanSdHistory || []).length), 0), 0);
    const counts: AnyRec = { lots: state().qcLots.length + ' / ' + state().lotGroups.length, panels: state().qcPanels.length, targets: state().tests.reduce((n: number, t: AnyRec) => n + t.levels.filter((l: AnyRec) => l.qcLotId).length, 0), history: histCount, transitions: state().lotTransitions.length, assays: state().tests.length, instruments: state().instruments.length, tearefs: deps.effectiveTeaRefs().length };
    return MANAGE_TABS.map(x => ({ id: x[0], label: x[1], count: counts[x[0]] || '' }));
  };

  const manageInstrumentsModel = () => {
    const rows = state().instruments.filter((i: AnyRec) => manageMatch([i.name, i.manufacturer, i.model, i.serial, i.section])).map((i: AnyRec) => ({ id: i.id, name: i.name, section: i.section, manufacturer: i.manufacturer, serial: i.serial, assayCount: state().tests.filter((t: AnyRec) => t.instrumentId === i.id).length, active: !!i.active }));
    return { toolbar: { title: 'Máy xét nghiệm', subtitle: 'Quản lý máy xét nghiệm, hãng và số sê-ri.', action: { action: 'openConfigInstrument' }, actionLabel: 'Thêm máy xét nghiệm' }, rows };
  };

  const manageAssaysModel = () => {
    const matched = state().tests.filter((t: AnyRec) => manageMatch([t.name, deps.testDisplayName(t), t.unit, t.method, t.reagent, instrumentName(t.instrumentId, t.machine), t.section, t.tea]));
    const rows = matched.map((t: AnyRec, idx: number) => ({ index: idx + 1, id: t.id, name: deps.testDisplayName(t), method: t.method, unit: t.unit, instrument: instrumentName(t.instrumentId, t.machine), section: t.section, reagent: t.reagent, tea: t.tea, closed: !!t.closed }));
    return { toolbar: { title: 'Danh mục xét nghiệm', subtitle: 'Quản lý xét nghiệm, máy, đơn vị, phương pháp và TEa.', action: { action: 'openConfigAssay' }, actionLabel: 'Thêm xét nghiệm' }, rows };
  };

  const managePanelsModel = () => {
    const rows = state().qcPanels.filter((p: AnyRec) => manageMatch([p.name, p.note, instrumentName(p.instrumentId), ...(p.testIds || []).map((id: unknown) => (state().tests.find((t: AnyRec) => t.id === id) || {}).name)])).map((p: AnyRec) => {
      const tests = (p.testIds || []).map((id: unknown) => state().tests.find((t: AnyRec) => t.id === id)).filter(Boolean);
      return { id: p.id, name: p.name, instrument: instrumentName(p.instrumentId), tests: tests.map((t: AnyRec) => ({ id: t.id, label: deps.testDisplayName(t) })), testCount: tests.length, active: p.active !== false };
    });
    return { toolbar: { title: 'Panel QC', subtitle: 'Nhóm các xét nghiệm theo từng máy để thiết lập và quản lý QC.', action: { action: 'openConfigPanel' }, actionLabel: 'Thêm Panel QC' }, rows };
  };

  const manageLotsModel = () => {
    const lotRows = state().qcLots.filter((l: AnyRec) => manageMatch([l.lotNo, l.description, l.supplier, l.program, lotGroupLabels(l.id), l.level, l.exp])).map((l: AnyRec) => {
      const used = state().tests.reduce((n: number, t: AnyRec) => n + t.levels.filter((x: AnyRec) => x.qcLotId === l.id).length, 0);
      return { id: l.id, lotNo: l.lotNo, description: l.description, program: l.program, level: l.level, expiry: l.exp ? deps.vnDate(l.exp) : '', status: lotStatus(l), used };
    });
    const groupCards = state().lotGroups.filter((g: AnyRec) => manageMatch([g.name, g.note, ...(g.lotIds || []).map((id: unknown) => (state().qcLots.find((l: AnyRec) => l.id === id) || {}).lotNo)])).map((g: AnyRec) => {
      const lots = (g.lotIds || []).map((id: unknown) => state().qcLots.find((l: AnyRec) => l.id === id)).filter(Boolean), archived = g.active === false;
      const inUse = deps.lotGroupInUse(g);
      return { id: g.id, archived, name: g.name, note: g.note, status: deps.pres.lotGroupStatusPresentation(archived, g.status, inUse), lots: lots.map((l: AnyRec) => ({ lotNo: l.lotNo, level: l.level })), toggle: deps.pres.lotGroupToggleActionPresentation(archived, g.status, inUse) };
    });
    return { toolbar: { title: 'Lô & Nhóm QC', subtitle: 'Quản lý từng lô và nhóm lô QC.' }, lotRows, groupCards };
  };

  const manageTransitionsModel = () => {
    const rows = state().lotTransitions.filter((tr: AnyRec) => manageMatch([panelName(tr.panelId), lotLabel(tr.fromLotId), lotLabel(tr.toLotId), tr.startDate, tr.status, tr.approvedBy])).map((tr: AnyRec) => {
      const to = state().qcLots.find((l: AnyRec) => l.id === tr.toLotId);
      return { id: tr.id, panel: panelName(tr.panelId), fromLot: lotLabel(tr.fromLotId), toLot: lotLabel(tr.toLotId), startDate: tr.startDate ? deps.vnDate(tr.startDate) : '', status: deps.pres.manageTransitionStatusPresentation(tr.status), movedLotNo: deps.transitionSwitchesLot(tr) && to ? to.lotNo : '', approvalText: tr.approvedBy ? tr.approvedBy + (tr.approvedAt ? ' · ' + deps.formatDateTimeVN(tr.approvedAt) : '') : '' };
    });
    return { toolbar: { title: 'Chuyển tiếp lô QC', subtitle: 'Theo dõi lô cũ, lô mới và trạng thái khi thay lô.', action: { action: 'openLotTransitionV2' }, actionLabel: 'Thêm hồ sơ chuyển lô' }, rows };
  };

  const manageHistoryModel = () => {
    const toolbar = { title: 'Lịch sử dữ liệu QC', subtitle: 'Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.' };
    const q = deps.searchText(ui().manageQ), matches = state().tests.filter((t: AnyRec) => !q || manageHistorySearchValues(t).some((v: unknown) => deps.searchText(v).includes(q)));
    if (!state().tests.length) return { toolbar, empty: { title: 'Chưa có xét nghiệm', description: 'Tạo xét nghiệm trước, sau đó cấu hình lô và Mean/SD.' } };
    if (!matches.length) return { toolbar, empty: { title: 'Không tìm thấy xét nghiệm', description: 'Thử tìm theo tên xét nghiệm.' } };
    const historyPick = deps.pres.historyAssaySelectionPresentation(matches, ui().manageHistoryTest);
    ui().manageHistoryTest = historyPick.selectedId;
    const t = historyPick.assay;
    const rows = deps.pres.historyRowsPresentation(t, state().qcLots, state().data[t.id] || [], lotGroupLabels);
    const visibleRows = deps.pres.historyVisibleRowsPresentation(rows, t.name, q, deps.searchText);
    const tableRows = deps.pres.historyRowSortPresentation(visibleRows).map((r: AnyRec) => ({ testId: r.t.id, level: r.l.level, lot: r.lotNo || '', group: r.group, mean: deps.fmtTestValue(r.t, r.h.mean), low: r.h.low != null ? deps.fmtTestValue(r.t, r.h.low) : '—', high: r.h.high != null ? deps.fmtTestValue(r.t, r.h.high) : '—', sd: deps.fmtTestValue(r.t, r.h.sd), period: deps.pres.historyPeriodLabelPresentation(r.h.effectiveFrom, r.h.effectiveTo, deps.vnDate), source: r.h.source, pointCount: r.pts.length }));
    const totals = deps.pres.historySummaryPresentation(visibleRows);
    return { toolbar: { title: 'Lịch sử dữ liệu QC', subtitle: 'Chọn một xét nghiệm để xem các lô/Mean-SD đã từng dùng.' }, selectedTestId: t.id, options: matches.map((a: AnyRec) => ({ id: a.id, label: deps.testDisplayName(a) })), rowCount: totals.rowCount, pointCount: totals.pointCount, rows: tableRows, tableEmpty: !tableRows.length ? (q ? { title: 'Không tìm thấy mốc phù hợp', description: 'Thử tìm theo tên xét nghiệm, mức hoặc lô QC.' } : { title: 'Chưa có lịch sử lô', description: 'Xét nghiệm này chưa được gán lô/Mean-SD.' }) : null };
  };

  const manageTeaRefsModel = () => {
    const canManage = deps.role() === 'admin';
    const overMap = new Map<string, AnyRec>((state().teaRefs || []).map((r: AnyRec): [string, AnyRec] => [r.analyteId || deps.teaAnalyteMeta(r.name, r).analyteId || deps.teaRefName(r.name), r]));
    const rows = deps.effectiveTeaRefs()
      .map(([name, unit, clia, ricos, section, , analyteId, lab]: AnyRec) => { const isDef = deps.teaRefIsDefault(analyteId), record = overMap.get(analyteId), naming = deps.teaAnalyteMeta(name, record), externalChanged = teaRefExternalChanged(record, analyteId), kind = deps.pres.teaReferenceKindPresentation(isDef, externalChanged, !!(record && record.lab != null)); return { name, unit, clia, ricos, lab, section, analyteId, record, ...naming, kind }; })
      .filter((r: AnyRec) => manageMatch([r.name, r.displayName, r.standardName, r.abbreviation, ...r.aliases, r.matrix, r.unit, r.section]));
    deps.pres.teaReferenceSortPresentation(rows);
    const tableRows = rows.map((r: AnyRec) => ({ analyteId: r.analyteId, namingTitle: deps.pres.teaReferenceNamingTitlePresentation(r), displayName: r.displayName || r.name, unit: r.unit || '—', section: r.section || '—', clia: deps.pres.teaReferenceInputValuePresentation(r.clia), ricos: deps.pres.teaReferenceInputValuePresentation(r.ricos), lab: r.lab, rowActions: deps.pres.teaReferenceRowActionsPresentation(r.kind, canManage, r.lab != null), kind: r.kind }));
    const sourceItems = deps.pres.teaSourceRegistryItemsPresentation(deps.teaSourceRegistry(), deps.vnDate);
    return { toolbar: { title: 'Bảng TEa tham chiếu', subtitle: 'Tổng hợp TEa từ các nguồn tham chiếu, dùng thống nhất khi tính Sigma.', action: canManage ? { action: 'teaRefOpenAdd' } : null, actionLabel: 'Thêm xét nghiệm' }, canManage, sourceItems, rows: tableRows, empty: !tableRows.length ? deps.pres.teaReferenceEmptyStatePresentation(!!deps.searchText(ui().manageQ)) : null };
  };

  const manageTargetsModel = () => {
    const T = 'Mean/SD theo nhóm lô QC';
    ensureTargetSelection();
    const prerequisite = deps.pres.targetPrerequisitePresentation({ tests: state().tests.length, panels: state().qcPanels.length, lots: state().qcLots.length, groups: state().lotGroups.length });
    if (prerequisite === 'tests') return { toolbar: { title: T, subtitle: 'Chọn Panel QC để nhập Mean/SD hàng loạt.', action: { action: 'setManageTab', args: ['assays'] }, actionLabel: 'Thêm xét nghiệm' }, empty: { title: 'Chưa có xét nghiệm', description: 'Tạo xét nghiệm trước, sau đó quay lại nhập Mean/SD theo nhóm lô.' } };
    if (prerequisite === 'panels') return { toolbar: { title: T, subtitle: 'Chỉ dùng Panel QC để nhập Mean/SD hàng loạt.', action: { action: 'setManageTab', args: ['panels'] }, actionLabel: 'Thêm Panel QC' }, empty: { title: 'Chưa có Panel QC', description: 'Tạo Panel QC và chọn các xét nghiệm thành viên trước, sau đó quay lại nhập Mean/SD theo nhóm lô.' } };
    if (prerequisite === 'lots') return { toolbar: { title: T, subtitle: 'Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.', action: { action: 'setManageTab', args: ['lots'] }, actionLabel: 'Thêm lô QC' }, empty: { title: 'Chưa có lô QC', description: 'Tạo lô QC trước, gom vào nhóm lô rồi quay lại nhập Mean/SD theo nhóm.' } };
    if (prerequisite === 'groups') return { toolbar: { title: T, subtitle: 'Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.', action: { action: 'setManageTab', args: ['lots'] }, actionLabel: 'Thêm nhóm lô' }, empty: { title: 'Chưa có nhóm lô QC', description: 'Tạo nhóm lô từ các lô QC trước, sau đó quay lại nhập Mean/SD theo nhóm.' } };
    const group = state().lotGroups.find((x: AnyRec) => x.id === ui().manageTargetGroup), groupLots = targetGroupLots(group);
    if (!group || !groupLots.length) return { toolbar: { title: 'Mean/SD theo nhóm lô QC', subtitle: 'Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.' }, empty: { title: 'Nhóm lô chưa có lô QC', description: 'Sửa nhóm lô và chọn các lô QC cần dùng trước.' } };
    const panels = state().qcPanels.map((p: AnyRec) => ({ id: p.id, label: `${p.name} · ${instrumentName(p.instrumentId)}` }));
    const groups = state().lotGroups.filter((g: AnyRec) => g.active !== false && targetGroupLots(g).length).map((g: AnyRec) => ({ id: g.id, label: deps.pres.targetGroupLabelPresentation(g) + deps.pres.targetGroupStatusSuffixPresentation(g) }));
    const targetLevelPick = deps.pres.targetLevelSelectionPresentation(groupLots, ui().manageTargetLevel);
    ui().manageTargetLevel = targetLevelPick.level;
    const selectedLevel = Number(ui().manageTargetLevel), levelLotPick = deps.pres.targetLevelLotsPresentation(groupLots, selectedLevel), levelLots = levelLotPick.levelLots, levelDepletedLots = levelLotPick.depletedLots;
    const q = deps.searchText(ui().manageQ), allTests = deps.pres.targetPanelTestsPresentation(state().qcPanels, state().tests, ui().manageTargetPanel), tests = allTests.filter((t: AnyRec) => !q || deps.pres.targetSearchValuesPresentation(t, group.name, levelLots, deps.testDisplayName, instrumentName).some((v: unknown) => deps.searchText(v).includes(q)));
    const rowItems = deps.pres.targetMatrixItemsPresentation(tests, levelLots, deps.targetConfigAssigned, deps.plannedTargetFor, deps.lotTargetSnapshot);
    const stats = deps.pres.targetMatrixStatsPresentation(rowItems);
    const rows = rowItems.map(({ t, lot, linked, same, assigned, planned, cfg }: AnyRec) => {
      const draft = deps.targetRangeDraft(cfg || {}), rowState = deps.pres.targetRowStatePresentation(linked, assigned, planned, lot.depleted);
      return { testId: t.id, lotId: lot.id, locked: rowState.locked, checked: rowState.checked, disabled: rowState.disabled, name: deps.testDisplayName(t), unit: t.unit, mean: deps.targetNumberText(draft.mean, t), low: deps.targetNumberText(draft.low, t), high: deps.targetNumberText(draft.high, t), sd: deps.targetNumberText(draft.sd, t, 'stat'), status: rowState.status, retiredTo: rowState.locked ? lotTransitionToNo(lot.id) : '', otherLot: same && same.lot };
    });
    return {
      toolbar: { title: T, subtitle: 'Chọn Panel QC và nhóm lô, app tự đưa các xét nghiệm trong panel vào bảng Mean/SD.' }, panels, groups, panelId: ui().manageTargetPanel, groupId: ui().manageTargetGroup,
      levels: targetLevelPick.levels, level: ui().manageTargetLevel, levelLotNos: levelLots.map((l: AnyRec) => l.lotNo),
      rows, stats: rowItems.length ? stats : null,
      empty: rowItems.length ? null : deps.pres.targetEmptyStatePresentation(allTests.length, levelLots.map((l: AnyRec) => l.lotNo), levelDepletedLots.map((l: AnyRec) => l.lotNo), ui().manageTargetLevel),
    };
  };

  const manageModel = () => {
    if (!MANAGE_TABS.some(x => x[0] === ui().manageTab)) ui().manageTab = 'instruments';
    const tab = ui().manageTab as string;
    const builders: Record<string, () => AnyRec> = { lots: manageLotsModel, panels: managePanelsModel, targets: manageTargetsModel, history: manageHistoryModel, transitions: manageTransitionsModel, assays: manageAssaysModel, instruments: manageInstrumentsModel, tearefs: manageTeaRefsModel };
    return { tab, tabs: manageShellModel(), query: ui().manageQ, searchPlaceholder: manageSearchPlaceholder(), body: builders[tab]() };
  };

  return {
    manageSearchSet, manageMatch, manageSearchPlaceholder, groupsOfLot, lotGroupLabels, instrumentName, panelName,
    lotLabel, lotTransitionToNo, lotStatus, targetGroupLots, ensureTargetSelection,
    manageHistorySearchValues, teaRefFind, teaRefNumOrNull, teaRefExternalChanged, teaRefEnsure,
    teaRefEdit, teaRefRemove, teaRefOpenAdd, teaRefAddSubmit, teaLabProfileOpenModel,
    teaLabProfileSave, teaLabProfileRemove, manageModel,
  };
}

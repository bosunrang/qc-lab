type AnyRec = any;

export function createReportPageController(deps: {
  document: Document;
  getState: () => AnyRec;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  confirmDialog: (opts: AnyRec) => Promise<boolean>;
  requireAdmin: () => boolean;
  openModal: (html: string) => void;
  closeModal: () => void;
  reauthenticate: (opts: AnyRec) => Promise<boolean>;
  rerender: () => void;
  requestFrame: (work: () => void, delay: number) => void;
  esc: (value: unknown) => string;
  jsq: (value: unknown) => string;
  button: (label: string, action: string, variant?: string, title?: string, options?: AnyRec) => string;
  isoMonth: () => string;
  isoToday: () => string;
  monthVN: (ym: string) => string;
  parseVN: (value: unknown) => string;
  userName: () => string;
  uid: () => string;
  searchText: (value: unknown) => string;
  operationalTests: () => AnyRec[];
  testSelectLabel: (test: AnyRec, tests: AnyRec[]) => string;
  operationalLevels: (test: AnyRec) => AnyRec[];
  operationalPanelForTest: (test: AnyRec) => AnyRec;
  operationalLotGroupForTest: (test: AnyRec) => AnyRec;
  replaceSelectItems: (select: AnyRec, items: AnyRec[], emptyText?: string) => void;
  scheduleSearchRender: (owner: AnyRec, apply: () => void, focusId?: string) => void;
  periodPresentation: { currentYearMonth: (value: string, fallback: string) => string; setPart: (ym: string, part: string, value: string) => string };
  periodWorkflow: { lock: (input: AnyRec) => AnyRec; unlock: (input: AnyRec) => AnyRec };
  findLock: (state: AnyRec, ym: string) => AnyRec;
  unlockModalHtml: (input: AnyRec) => string;
  unlockReason: (value: string) => { valid: boolean; reason: string };
  lockListHtml: (locks: AnyRec[], isAdmin: boolean) => string;
  lockPanelHtml: (input: AnyRec) => string;
  lockPicker: (ym: string, year: number) => AnyRec;
  searchValuePresentation: { values: (test: AnyRec, deps: AnyRec) => string[] };
  reportSearch: { select: (tests: AnyRec[], q: string, selected: string, values: (t: AnyRec) => string[], searchText: (v: unknown) => string) => AnyRec };
  reportSelection: { defaults: (start: string, end: string, isoMonth: string, isoToday: string) => AnyRec; dateRange: (start: string, end: string) => AnyRec; exportSelection: (tests: AnyRec[], tid: string, start: string, end: string, includeNce: boolean) => AnyRec };
  rangeText: (start: string, end: string) => string;
  actionIconPresentation: { icon: (type: string) => string };
  role: () => string;
  pageHtml: (input: AnyRec) => string;
  rangePickerHtml: (start: string, end: string) => string;
}) {
  let reportQ = '', reportTest = '', reportRangeStart = '', reportRangeEnd = '', reportLockYm = '';
  const field = (id: string) => deps.document.getElementById(id) as AnyRec;

  const reportLockYmValue = () => deps.periodPresentation.currentYearMonth(reportLockYm, deps.isoMonth());

  const reportSetLockPart = (part: string, value: string) => {
    reportLockYm = deps.periodPresentation.setPart(reportLockYmValue(), part, value);
    deps.rerender();
  };

  const reportLockPeriod = async () => {
    if (!deps.requireAdmin()) return;
    const ym = reportLockYmValue(), label = deps.monthVN(ym);
    if (!await deps.confirmDialog({ kicker: 'Khóa kỳ báo cáo', title: `Khóa kỳ ${label}?`, message: 'Sau khi khóa, không ai (kể cả admin) sửa/hủy được điểm QC trong kỳ này ở bất kỳ xét nghiệm nào cho tới khi mở khóa.', detail: 'Chỉ nên khóa sau khi đã xuất xong báo cáo chính thức của kỳ.', confirmLabel: 'Khóa kỳ', cancelLabel: 'Hủy' })) return;
    if (!await deps.reauthenticate({ title: 'Xác thực khóa kỳ', message: `Nhập lại mật khẩu để khóa kỳ ${label}.` })) return;
    const result = deps.periodWorkflow.lock({ ym, lockedAt: new Date().toISOString(), lockedBy: deps.userName(), id: deps.uid(), label });
    if (result.error) { await deps.infoDialog(result.error === 'already-locked' ? `Kỳ ${label} đã được khóa từ trước.` : 'Không khóa được kỳ này.'); return; }
    await deps.infoDialog(`Đã khóa kỳ ${label}.`, { type: 'success' });
  };

  const reportUnlockPeriod = (ym: string) => {
    if (!deps.requireAdmin()) return;
    const label = deps.monthVN(ym);
    deps.openModal(deps.unlockModalHtml({ titleHtml: `Mở khóa kỳ ${deps.esc(label)}`, periodLabelHtml: deps.esc(label), closeButtonHtml: deps.button('Đóng', 'closeModal()', 'ghost'), confirmButtonHtml: deps.button('Xác nhận mở khóa', `reportConfirmUnlockPeriod('${deps.jsq(ym)}')`, 'danger') }));
    deps.requestFrame(() => { const e = field('unlockReasonInput'); if (e) e.focus(); }, 50);
  };

  const reportConfirmUnlockPeriod = async (ym: string) => {
    const input = field('unlockReasonInput'), reasonCheck = deps.unlockReason(input ? input.value : ''), clean = reasonCheck.reason;
    if (!reasonCheck.valid) {
      const err = field('unlockReasonErr');
      if (err) err.style.display = '';
      if (input) input.focus();
      return;
    }
    deps.closeModal();
    if (!await deps.reauthenticate({ title: 'Xác thực mở khóa kỳ', message: `Nhập lại mật khẩu để mở khóa kỳ ${deps.monthVN(ym)}.` })) return;
    const label = deps.monthVN(ym), result = deps.periodWorkflow.unlock({ ym, reason: clean, label });
    if (result.error) { await deps.infoDialog('Kỳ này hiện không bị khóa.'); deps.rerender(); return; }
    await deps.infoDialog(`Đã mở khóa kỳ ${label}.`, { type: 'success' });
  };

  const reportLockListHtml = () => deps.lockListHtml(deps.getState().periodLocks || [], deps.role() === 'admin');

  const reportSearchValues = (t: AnyRec) => deps.searchValuePresentation.values(t, { testLabel: deps.testSelectLabel, operationalLevels: deps.operationalLevels, panelForTest: deps.operationalPanelForTest, lotGroupForTest: deps.operationalLotGroupForTest });

  const reportApplySearch = () => {
    const tests = deps.operationalTests(), q = deps.searchText(reportQ), result = deps.reportSearch.select(tests, q, reportTest, reportSearchValues, deps.searchText), matched = result.matched;
    reportTest = result.selected;
    const select = field('rTest'), count = field('reportTestCount');
    deps.replaceSelectItems(select, matched.map((t: AnyRec) => ({ value: t.id, label: deps.testSelectLabel(t, tests) })), 'Không tìm thấy xét nghiệm phù hợp');
    if (select && reportTest) select.value = reportTest;
    if (count) count.textContent = `(${matched.length}/${tests.length})`;
    deps.document.querySelectorAll('[data-report-action]').forEach((button: AnyRec) => button.disabled = !matched.length);
  };

  const reportSearchSet = (v: string) => {
    reportQ = v;
    deps.scheduleSearchRender(reportSearchSet, reportApplySearch, 'reportSearch');
  };

  const reportRangeDefaults = () => {
    const r = deps.reportSelection.defaults(reportRangeStart, reportRangeEnd, deps.isoMonth(), deps.isoToday());
    reportRangeStart = r.start; reportRangeEnd = r.end;
    return r;
  };

  const reportDateRange = () => {
    const s = deps.parseVN((field('rStartDate') || {}).value || '') || '', e = deps.parseVN((field('rEndDate') || {}).value || '') || '';
    return deps.reportSelection.dateRange(s, e);
  };

  const reportExportSelection = () => {
    const tid = (field('rTest') || {}).value || '', { start, end } = reportDateRange();
    return deps.reportSelection.exportSelection(deps.getState().tests, tid, start, end, (field('reportNceAppendix') || {}).checked !== false);
  };

  const reportRangeChanged = () => {
    const { start, end } = reportDateRange();
    reportRangeStart = start; reportRangeEnd = end;
  };

  const reportRangeText = (start: string, end: string) => deps.rangeText(start, end);

  const reportActionIcon = (type: string) => deps.actionIconPresentation.icon(type);

  const reportLockPanelHtml = () => {
    const state = deps.getState(), isAdmin = deps.role() === 'admin', ym = reportLockYmValue(), picker = deps.lockPicker(ym, new Date().getFullYear());
    return deps.lockPanelHtml({ isAdmin, year: picker.year, month: picker.month, months: picker.months, years: picker.years, already: !!deps.findLock(state, ym), lockListHtml: reportLockListHtml() });
  };

  const pageReportV2 = () => {
    const tests = deps.operationalTests();
    const q = deps.searchText(reportQ), matched = tests.filter((t: AnyRec) => !q || reportSearchValues(t).some((v: string) => deps.searchText(v).includes(q)));
    if (matched.length && (!reportTest || !matched.some((t: AnyRec) => t.id === reportTest))) reportTest = matched[0].id;
    if (!matched.length) reportTest = '';
    const { start, end } = reportRangeDefaults();
    return deps.pageHtml({ tests, matched, selectedId: reportTest, query: reportQ, start, end, isAdmin: deps.role() === 'admin', lockPanelHtml: reportLockPanelHtml() });
  };

  const reportRangePicker = (start: string, end: string) => deps.rangePickerHtml(start, end);

  return { reportLockYmValue, reportSetLockPart, reportLockPeriod, reportUnlockPeriod, reportConfirmUnlockPeriod, reportLockListHtml, reportSearchValues, reportSearchSet, reportApplySearch, reportRangeDefaults, reportDateRange, reportExportSelection, reportRangeChanged, reportRangeText, reportActionIcon, reportLockPanelHtml, pageReportV2, reportRangePicker };
}

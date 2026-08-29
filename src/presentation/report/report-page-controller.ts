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
  button: (label: string, action: string | { action: string; args?: unknown[] } | null, variant?: string, title?: string, options?: AnyRec) => string;
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
  scheduleSearchRender: (owner: AnyRec, apply: () => void, focusId?: string) => void;
  periodPresentation: { currentYearMonth: (value: string, fallback: string) => string; setPart: (ym: string, part: string, value: string) => string };
  periodWorkflow: { lock: (input: AnyRec) => AnyRec; unlock: (input: AnyRec) => AnyRec };
  findLock: (state: AnyRec, ym: string) => AnyRec;
  unlockModalHtml: (input: AnyRec) => string;
  unlockReason: (value: string) => { valid: boolean; reason: string };
  lockPicker: (ym: string, year: number) => AnyRec;
  searchValuePresentation: { values: (test: AnyRec, deps: AnyRec) => string[] };
  reportSelection: { defaults: (start: string, end: string, isoMonth: string, isoToday: string) => AnyRec; dateRange: (start: string, end: string) => AnyRec; exportSelection: (tests: AnyRec[], tid: string, start: string, end: string, includeNce: boolean) => AnyRec };
  rangeText: (start: string, end: string) => string;
  actionIconPresentation: { icon: (type: string) => string };
  role: () => string;
  sortedLocks: (locks: AnyRec[]) => AnyRec[];
  formatDateTimeVN: (value: unknown) => string;
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
    deps.openModal(deps.unlockModalHtml({ titleHtml: `Mở khóa kỳ ${deps.esc(label)}`, periodLabelHtml: deps.esc(label), closeButtonHtml: deps.button('Đóng', { action: 'closeModal' }, 'ghost'), confirmButtonHtml: deps.button('Xác nhận mở khóa', { action: 'reportConfirmUnlockPeriod', args: [ym] }, 'danger') }));
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

  const reportSearchValues = (t: AnyRec) => deps.searchValuePresentation.values(t, { testLabel: deps.testSelectLabel, operationalLevels: deps.operationalLevels, panelForTest: deps.operationalPanelForTest, lotGroupForTest: deps.operationalLotGroupForTest });

  const reportSearchSet = (v: string) => {
    reportQ = v;
    deps.scheduleSearchRender(reportSearchSet, deps.rerender, 'reportSearch');
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

  const reportLockPanelModel = () => {
    const state = deps.getState(), isAdmin = deps.role() === 'admin', ym = reportLockYmValue(), picker = deps.lockPicker(ym, new Date().getFullYear());
    const locks = deps.sortedLocks(state.periodLocks || []).map((lock: AnyRec) => ({
      ym: lock.ym,
      monthLabel: deps.monthVN(lock.ym),
      lockedBy: lock.lockedBy || '—',
      lockedAtText: lock.lockedAt ? deps.formatDateTimeVN(lock.lockedAt) : '',
    }));
    return { isAdmin, year: picker.year, month: picker.month, months: picker.months, years: picker.years, already: !!deps.findLock(state, ym), ym, locks };
  };

  const reportModel = () => {
    const tests = deps.operationalTests();
    const q = deps.searchText(reportQ), matched = tests.filter((t: AnyRec) => !q || reportSearchValues(t).some((v: string) => deps.searchText(v).includes(q)));
    if (matched.length && (!reportTest || !matched.some((t: AnyRec) => t.id === reportTest))) reportTest = matched[0].id;
    if (!matched.length) reportTest = '';
    const isAdmin = deps.role() === 'admin';
    if (!tests.length) return { empty: true as const, isAdmin, lockPanel: reportLockPanelModel() };
    const { start, end } = reportRangeDefaults();
    return {
      empty: false as const,
      query: reportQ,
      totalCount: tests.length,
      matched: matched.map((t: AnyRec) => ({ id: t.id, label: deps.testSelectLabel(t, tests) })),
      selectedId: reportTest,
      start, end,
      disabled: !matched.length,
      lockPanel: reportLockPanelModel(),
    };
  };

  return { reportLockYmValue, reportSetLockPart, reportLockPeriod, reportUnlockPeriod, reportConfirmUnlockPeriod, reportSearchValues, reportSearchSet, reportRangeDefaults, reportDateRange, reportExportSelection, reportRangeChanged, reportRangeText, reportActionIcon, reportModel };
}

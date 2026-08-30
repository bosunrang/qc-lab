type AnyRec = any;

/**
 * Trang "Nhập QC" (Entry) — nhập/hủy điểm QC theo ngày, mức QC và lô đang vận
 * hành, trang thao tác dữ liệu nhạy cảm nhất của ứng dụng. Đã chuyển sang
 * React (2026-08-30, trang cuối cùng — xem docs/REACT-ADOPTION-PLAN.md):
 * `entryModel()` là dữ liệu thuần cho `src/react/pages/EntryPage.tsx`; hai
 * hàm HTML còn lại (`deps.pres.entryVoidModalHtml`/`entryPreSaveWarningModalHtml`)
 * chỉ phục vụ 2 modal render vào `#modalRoot`, ngoài tầm React. Controller còn
 * lại là phần điều phối — đọc state, dựng cây xét nghiệm/bảng nhập/biểu đồ
 * Levey-Jennings, ghi UI state, và gọi đúng workflow command TypeScript khi
 * ghi/hủy điểm QC hay ghi chú ngày.
 *
 * `document`/`window`/`localStorage` là getter LAZY — không phải giá trị
 * capture một lần — vì test (`tests/partial-render-helpers.test.js`) gán lại
 * toàn bộ biến `document=...` giữa các lần gọi để mô phỏng cây điều hướng
 * bàn phím; đọc `deps.document()` mỗi lần thay vì giữ tham chiếu cũ.
 */
export function createEntryPageController(deps: {
  document: () => AnyRec;
  window: () => AnyRec;
  localStorage: () => AnyRec;
  getState: () => AnyRec;
  ui: () => AnyRec;
  analysisUi: () => AnyRec;
  currentPage: () => string;
  rerender: () => void;
  isReactEntry: () => boolean;
  afterRender: (page: string) => void;
  role: () => string;
  canWrite: () => boolean;
  requireWrite: () => boolean;
  requireUnlockedPeriod: (date: string, action: string) => Promise<boolean>;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  jsq: (value: unknown) => string;
  btn: (label: string, action: string | { action: string; args?: unknown[] } | null, cls?: string, title?: string, options?: AnyRec) => string;
  dateBox: (id: string, value: string, cls?: string, attrs?: string) => string;
  openModal: (html: string) => void;
  closeModal: () => void;
  confirmDialog: (opts: AnyRec) => Promise<boolean>;
  searchText: (value: unknown) => string;
  vnDate: (value: unknown) => string;
  fmt: (value: unknown, decimals?: number) => string;
  fmtTestValue: (test: AnyRec, value: unknown) => string;
  fmtTestStat: (test: AnyRec, value: unknown) => string;
  fmtPointValue: (point: AnyRec, test: AnyRec) => string;
  isoToday: () => string;
  isoMonth: () => string;
  dateObj: (value: unknown) => Date;
  testDisplayName: (test: AnyRec) => string;
  stateName: (value: unknown) => string;
  operationalTests: () => AnyRec[];
  operationalLevels: (test: AnyRec) => AnyRec[];
  operationalLotGroupForTest: (test: AnyRec) => AnyRec;
  operationalTestOrder: (test: AnyRec) => number;
  activeWestgard: (test: AnyRec) => AnyRec;
  parallelWestgard: (test: AnyRec, column: AnyRec) => AnyRec;
  entryColumns: (test: AnyRec) => AnyRec[];
  entryColumnPoints: (test: AnyRec, column: AnyRec, includeVoided?: boolean) => AnyRec[];
  pointsForLot: (testId: string, level: unknown, lotNo: string) => AnyRec[];
  pointsOf: (testId: unknown, level: unknown) => AnyRec[];
  acceptedLotPoints: (test: AnyRec, level: unknown) => AnyRec[];
  previousLotSeries: (test: AnyRec, level: unknown) => AnyRec[];
  testRuleOnWithin: (test: AnyRec, rule: string) => boolean;
  ruleResultLevel: (test: AnyRec, rules: string[]) => string;
  qcVerdictLabel: (level: string) => string;
  canEnterQcForLevel: (test: AnyRec, level: unknown) => boolean;
  rangeCandidate: (testId: string, level: unknown) => AnyRec;
  rangeActions: (testId: string, level: unknown, eligible: unknown, applied: unknown) => string;
  errorType: (rules: string[]) => string;
  qcPointWarnings: (test: AnyRec, cfg: AnyRec, date: string, runId: string, value: unknown) => string[];
  qcValueDecimals: (value: unknown) => number;
  currentStaff: () => AnyRec;
  uid: () => string;
  nextNceId: (today: string) => string;
  nceDueDate: (days: number) => string;
  pointVoidVerdict: (test: AnyRec, point: AnyRec) => AnyRec;
  pointRunNo: (point: AnyRec) => number;
  pointStaff: (point: AnyRec) => AnyRec;
  stats: (values: number[]) => AnyRec;
  lvlCfg: (test: AnyRec, level: unknown) => AnyRec;
  QCCore: {
    westgardByPoint: (points: AnyRec[], mean: number, sd: number, ruleOn: (rule: string) => boolean) => AnyRec;
    cleanText: (value: unknown, maxLength?: number) => string;
  };
  EntryService: AnyRec;
  EntryRecordWorkflowCommand: AnyRec;
  EntryVoidWorkflowCommand: AnyRec;
  EntryDateNoteWorkflowCommand: AnyRec;
  /* ~25 hàm thuật toán/state thuần (TypeScript) entryModel() còn dùng, cộng 2
     hàm HTML modal (entryVoidModalHtml/entryPreSaveWarningModalHtml — ngoài
     tầm React), gom một chỗ thay vì khai kiểu từng cái — khớp cách
     reagent-page-controller.ts/manage-page-controller.ts đã làm. Danh sách đủ
     nằm trong tests/entry-render-bridge.test.js. */
  pres: AnyRec;
}) {
  const state = () => deps.getState();
  const ui = () => deps.ui();
  const doc = () => deps.document();
  const win = () => deps.window();

  const ENTRY_TABLE_INITIAL_ROWS = 180;

  const entryWindowFor = (testId: unknown, level: unknown, endOverride?: string, startOverride?: string) =>
    deps.EntryService.buildEntryWindow({ points: deps.pointsOf(testId, level), days: ui().entryDays, start: startOverride, end: endOverride, today: deps.isoToday() });
  const entryWindow = () => entryWindowFor(ui().entrySel.testId, ui().entrySel.level, ui().entryEnd, ui().entryStart);
  const entryRowsWindow = (rows: AnyRec[], key: string) => deps.pres.entryRowsWindowTs(rows, ui().entryExpandedTables.has(key), ENTRY_TABLE_INITIAL_ROWS);
  const entryToggleRows = (key: string) => {
    const next = deps.pres.entryExpandedTablesToggle(ui().entryExpandedTables, key, 24);
    ui().entryExpandedTables.clear();
    next.forEach((value: string) => ui().entryExpandedTables.add(value));
    entryRenderKeepScroll();
  };
  const entryDetailToggled = (key: string, open: boolean) => { if (open) ui().entryDetailOpen.add(key); else ui().entryDetailOpen.delete(key); };
  const entryTreeIsCollapsed = (): boolean => {
    if (ui().entryTreeCollapsed !== null) return !!ui().entryTreeCollapsed;
    ui().entryTreeCollapsed = deps.pres.entryTreeCollapsePreference.read(() => deps.localStorage().getItem('qclab_entry_tree_collapsed'));
    return !!ui().entryTreeCollapsed;
  };

  /* entryModel(): dữ liệu thuần cho trang React (src/react/pages/EntryPage.tsx), song
     song với pageEntry() bên dưới — cùng logic đọc/chuẩn hóa state (kể cả các side-effect
     trên ui(): entrySheetMonth mặc định, entrySel rơi về xét nghiệm đầu khi không hợp lệ,
     treeOpen tự mở nhánh đang chọn, entryLjRenderCache để afterRender() vẽ canvas LJ) —
     nhưng LUÔN tính trọn vẹn cả cây lẫn panel phải, không cần bản rút gọn "rightOnly" (bản
     đó chỉ phục vụ entryRenderKeepScroll() dán innerHTML thủ công, không cần dưới React).
     treeNodes trả về là MỘT MẢNG PHẲNG theo đúng thứ tự anh/em (machine → nhóm lô → xét
     nghiệm) vì entryTreeKey()'s ArrowUp/ArrowDown/Home/End dựa vào thứ tự DOM thật của các
     .tnode — JSX phải render đúng thứ tự này, không được nhóm lại theo key React. */
  const entryModel = (): AnyRec => {
    const s = state();
    const today = deps.isoToday();
    if (!s.tests.length) {
      return { empty: true, title: 'Chưa có xét nghiệm', message: 'Cần khai báo xét nghiệm và mức QC trước khi nhập kết quả.', canAdd: deps.role() === 'admin', addTarget: 'manage' };
    }
    const entryTests = deps.operationalTests();
    if (!entryTests.length) {
      return { empty: true, title: 'Chưa có xét nghiệm sẵn sàng nhập', message: 'Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi nhập kết quả.', canAdd: deps.role() === 'admin', addTarget: 'targets' };
    }
    if (!ui().entrySheetMonth) ui().entrySheetMonth = deps.isoMonth();
    let selT = ui().entrySel && entryTests.find((t: AnyRec) => t.id === ui().entrySel.testId);
    if (!selT || !deps.operationalLevels(selT).some((l: AnyRec) => l.level === ui().entrySel.level)) {
      selT = entryTests[0];
      const l0 = deps.operationalLevels(selT)[0];
      ui().entrySel = { testId: selT.id, level: l0.level };
      ui().entryAutoOpenKey = null;
    }
    const treeCollapsed = entryTreeIsCollapsed();

    // ----- cây xét nghiệm -----
    const byMAll = deps.EntryService.groupByMachine(entryTests);
    const machinesAll = [...byMAll.keys()];
    const selM = selT.machine || '(Chưa gán máy)';
    if (ui().entryMachine !== 'all' && !machinesAll.includes(ui().entryMachine)) ui().entryMachine = 'all';
    const selGroup = deps.operationalLotGroupForTest(selT);
    const autoKey = selM + '|' + selGroup.key + '|' + ui().entrySel.testId;
    if (ui().entryAutoOpenKey !== autoKey) {
      ui().treeOpen.add('m:' + selM);
      ui().treeOpen.add('lg:' + selM + '|' + selGroup.key);
      ui().entryAutoOpenKey = autoKey;
    }
    const byM = deps.EntryService.groupByMachine(entryTests.filter((t: AnyRec) => ui().entryMachine === 'all' || (t.machine || '(Chưa gán máy)') === ui().entryMachine));
    const machines = [...byM.keys()];
    const machineOptions = [{ value: 'all', label: 'Tất cả máy' }, ...machinesAll.map((m: string) => ({ value: m, label: m }))];
    const treeNodes: AnyRec[] = [];
    if (!machines.length) treeNodes.push({ kind: 'empty' });
    machines.forEach((mc: string) => {
      const mk = 'm:' + mc, mo = ui().treeOpen.has(mk);
      treeNodes.push({ kind: 'machine', key: mk, open: mo, label: mc });
      const groups = new Map<string, AnyRec>();
      byM.get(mc).forEach((t: AnyRec) => {
        const g = deps.operationalLotGroupForTest(t);
        if (!groups.has(g.key)) groups.set(g.key, { name: g.name, tests: [], order: deps.operationalTestOrder(t) });
        const grp = groups.get(g.key);
        grp.tests.push(t);
        grp.order = Math.min(grp.order, deps.operationalTestOrder(t));
      });
      [...groups.entries()].sort((a, b) => a[1].order - b[1].order || a[1].name.localeCompare(b[1].name, 'vi')).forEach(([groupKey, grp]) => {
        const gk = 'lg:' + mc + '|' + groupKey, go = ui().treeOpen.has(gk), ord: AnyRec = { none: -1, ok: 0, warn: 1, rej: 2 };
        let groupWorst = 'none';
        const rows = grp.tests.sort((a: AnyRec, b: AnyRec) => deps.operationalTestOrder(a) - deps.operationalTestOrder(b)).map((t: AnyRec) => {
          const levels = deps.operationalLevels(t), on = ui().entrySel.testId === t.id, preferred = levels.find((x: AnyRec) => ui().entrySel.level === x.level) || levels[0], wg = deps.activeWestgard(t);
          let worst = 'none';
          levels.forEach((l: AnyRec) => {
            const pts = deps.pointsForLot(t.id, l.level, l.lot || ''), lastPoint = pts[pts.length - 1], last = (lastPoint && wg.byPoint.get(lastPoint.id)) || null, lastLevel = last ? last.level : 'none';
            if (ord[lastLevel] > ord[worst]) worst = lastLevel;
          });
          if (ord[worst] > ord[groupWorst]) groupWorst = worst;
          const search = deps.searchText([t.name, deps.testDisplayName(t), t.machine, grp.name, ...levels.map((l: AnyRec) => l.lot)].join(' '));
          return { kind: 'assay', testId: t.id, search, selected: on, visible: mo && go, level: preferred ? preferred.level : 1, name: deps.testDisplayName(t), stateClass: worst === 'none' ? '' : worst, stateText: deps.stateName(worst) };
        });
        treeNodes.push({ kind: 'group', key: gk, open: go, parentOpen: mo, search: deps.searchText(grp.name + ' ' + grp.tests.map((t: AnyRec) => t.name).join(' ')), name: grp.name, stateClass: groupWorst === 'none' ? '' : groupWorst, stateText: deps.stateName(groupWorst) });
        treeNodes.push(...rows);
      });
    });

    // ----- panel phải -----
    const t = selT, l = deps.lvlCfg(t, ui().entrySel.level), entryWG = deps.activeWestgard(t), acceptedCache = new Map<string, AnyRec>();
    const entryCols = deps.entryColumns(t), parWGByKey = new Map<string, AnyRec>();
    entryCols.filter((c: AnyRec) => c.parallel).forEach((c: AnyRec) => parWGByKey.set(c.key, deps.parallelWestgard(t, c)));
    const colVerdict = (col: AnyRec, p: AnyRec) => ((col && col.parallel ? (parWGByKey.get(col.key) || { byPoint: new Map() }).byPoint.get(p.id) : entryWG.byPoint.get(p.id)) || { level: 'ok', rules: [] });
    const colPointsIdx = (col: AnyRec) => deps.entryColumnPoints(t, col, true);
    const acceptedForLevel = (level: unknown) => {
      const key = String(level);
      if (!acceptedCache.has(key)) acceptedCache.set(key, deps.acceptedLotPoints(t, level));
      return acceptedCache.get(key);
    };
    const W0 = entryWindow(), acceptedSelected = acceptedForLevel(ui().entrySel.level);
    const W = { ...W0, all: acceptedSelected.filter((p: AnyRec) => (p.lot || '') === (l.lot || '')), pts: acceptedSelected.filter((p: AnyRec) => p.date >= W0.start && p.date <= W0.end && (p.lot || '') === (l.lot || '')) };
    const allSt = deps.stats(W.all.map((p: AnyRec) => p.val));
    const cand = deps.rangeCandidate(t.id, l.level), candStats = cand && cand.c;
    const eligible = cand && cand.eligible;
    const rangeSummaryText = allSt ? `N=${allSt.n} · Mean thực=${deps.fmtTestValue(t, allSt.m)} · SD thực=${deps.fmtTestStat(t, allSt.sd)} · CV=${deps.fmt(allSt.cv)}%` : 'Chưa có dữ liệu';
    const rangeSource = l.applied === 'lab' ? 'PXN tự xây dựng' : 'Nhà sản xuất';
    const rangeSummary = {
      open: ui().entryDetailOpen.has('range'), summary: rangeSummaryText, source: rangeSource, mean: deps.fmtTestValue(t, l.mean), sd: deps.fmtTestValue(t, l.sd),
      eligible: !!eligible, resultCount: candStats ? candStats.n : 0, dayCount: cand ? cand.days : 0,
      proposedMean: candStats ? deps.fmtTestValue(t, candStats.m) : '—', proposedSd: candStats ? deps.fmtTestValue(t, candStats.sd) : '—', proposedCv: candStats ? deps.fmt(candStats.cv) : '—',
      canApply: !!eligible, canRevert: l.applied === 'lab' && deps.canWrite(), testId: t.id, level: l.level,
    };
    const levelViews = entryCols.map((x: AnyRec) => {
      if (x.parallel) return { x, prevView: null };
      const prevSeries = deps.previousLotSeries(t, x.level), prevLot = ui().entryPrevOpen.get(t.id + '|' + x.level) || '';
      return { x, prevView: prevSeries.find((s2: AnyRec) => (s2.lot || '') === prevLot) };
    });
    const tableCards = levelViews.map(({ x, prevView }: AnyRec) => {
      const lvlMean = prevView ? prevView.mean : x.mean, lvlSd = prevView ? prevView.sd : x.sd, lvlLot = prevView ? prevView.lot : x.lot;
      const allIdx = prevView ? prevView.pts : colPointsIdx(x), allPtsIdx = prevView ? allIdx : allIdx.filter((p: AnyRec) => p.date >= W.start && p.date <= W.end), tableKey = `${t.id}|${x.key}|${lvlLot || ''}|${W.start}|${W.end}`, rowWindow = entryRowsWindow(allPtsIdx, tableKey), ptsIdx = rowWindow.rows, cumulativePts = prevView ? allIdx : allIdx.filter((p: AnyRec) => p.date <= W.end), cumulativeSt = deps.stats(cumulativePts.map((p: AnyRec) => p.val));
      const prevWg = prevView ? deps.QCCore.westgardByPoint(ptsIdx, lvlMean, lvlSd, (rule: string) => deps.testRuleOnWithin(t, rule)) : null;
      const rows = ptsIdx.map((p: AnyRec, i: number) => {
        const rawPrev = prevView && prevWg.F[i], verdict = prevView ? (rawPrev ? { ...rawPrev, level: deps.ruleResultLevel(t, rawPrev.rules || []), z: prevWg.zs[i] } : { level: 'ok', rules: [] }) : colVerdict(x, p),
          view = deps.EntryService.buildPointView({ point: p, verdict, mean: lvlMean, sd: lvlSd, previousLot: prevView ? prevView.lot : undefined }),
          lv = deps.qcVerdictLabel(view.level);
        return { rejected: view.level === 'rej', warning: view.level === 'warn', pointId: p.id || '', dateText: deps.vnDate(p.date), valueText: deps.fmtPointValue(p, t), zText: `${view.z >= 0 ? '+' : ''}${deps.fmt(view.z)}s`, verdictLevel: view.level, verdictText: lv, rules: [...new Set(view.rules)] as string[], canVoid: deps.canWrite() };
      });
      const cumulative = { endDateText: deps.vnDate(W.end), count: cumulativeSt ? cumulativeSt.n : 0, mean: cumulativeSt ? deps.fmtTestValue(t, cumulativeSt.m) : '—', sd: cumulativeSt ? deps.fmtTestStat(t, cumulativeSt.sd) : '—', cv: cumulativeSt ? deps.fmt(cumulativeSt.cv) + '%' : '—' };
      const rowControl = rowWindow.limited || (rowWindow.expanded && rowWindow.total > ENTRY_TABLE_INITIAL_ROWS) ? { limited: rowWindow.limited, expanded: rowWindow.expanded && rowWindow.total > ENTRY_TABLE_INITIAL_ROWS, shown: rowWindow.rows.length, total: rowWindow.total, tableKey } : null;
      return { parallel: x.parallel, level: x.level, previousLot: !!prevView, lot: lvlLot || '?', pointCount: allPtsIdx.length, cumulative, rows, rowControl };
    });
    const prevLotByLevel = new Map<unknown, AnyRec>(levelViews.filter((v: AnyRec) => v.prevView).map((v: AnyRec) => [v.x.level, v.prevView.lot]));
    const voidedRows = (s.data[t.id] || []).filter((p: AnyRec) => {
      if (!p.voided) return false;
      const pv = prevLotByLevel.get(p.level);
      return pv != null ? (p.lot || '') === pv : (p.date >= W.start && p.date <= W.end);
    }).sort((a: AnyRec, b: AnyRec) => String(a.date || '').localeCompare(String(b.date || '')) || deps.pointRunNo(a) - deps.pointRunNo(b))
      .map((p: AnyRec) => ({ pointId: p.id || '', dateText: deps.vnDate(p.date), levelLotText: `Mức ${p.level} · Lô ${p.lot || '?'}`, valueText: deps.fmtPointValue(p, t), runId: p.runId || '—', voidedBy: p.voidedBy || '', reason: p.voidReason || '' }));
    const pointsInView = { open: ui().entryDetailOpen.has('points'), endDateText: deps.vnDate(W.end), startDateText: deps.vnDate(W.start), tableCards, voidedRows };
    const dayPresetOptions = [7, 14, 30, 60, 90].map(day => ({ days: day, on: !ui().entryStart && ui().entryDays === day }));
    ui().entryLjRenderCache = { testId: t.id, start: W.start, end: W.end, levels: new Map<string, AnyRec>() };
    const ljStack = entryCols.map((x: AnyRec) => {
      const on = x.level === ui().entrySel.level && !x.parallel,
        curPts = (x.parallel ? deps.entryColumnPoints(t, x) : acceptedForLevel(x.level)).filter((p: AnyRec) => p.date >= W.start && p.date <= W.end && (p.lot || '') === (x.lot || '')),
        prevSeries = x.parallel ? [] : deps.previousLotSeries(t, x.level), prevLot = ui().entryPrevOpen.get(t.id + '|' + x.level) || '', prevView = prevSeries.find((s2: AnyRec) => (s2.lot || '') === prevLot), targetCfg = prevView || entryColumnCfg(t, x.level, x.lot), chartPts = prevView ? prevView.pts : curPts, chartLot = prevView ? prevView.lot : x.lot, chartMean = targetCfg && targetCfg.mean, chartSd = targetCfg && targetCfg.sd, st = deps.stats(chartPts.map((p: AnyRec) => p.val));
      ui().entryLjRenderCache.levels.set(`${x.level}|${chartLot || ''}`, chartPts);
      const metrics = [
        { label: 'Mean thực', value: st ? deps.fmtTestValue(t, st.m) : '—' },
        { label: 'SD thực', value: st ? deps.fmtTestStat(t, st.sd) : '—' },
        { label: 'CV thực', value: st ? deps.fmt(st.cv) + '%' : '—' },
        { label: 'Mean mục tiêu', value: deps.fmtTestValue(t, chartMean), control: true },
        { label: 'SD mục tiêu', value: deps.fmtTestStat(t, chartSd), control: true },
      ];
      const action = x.parallel ? { kind: 'hint', text: 'Đang đánh giá' }
        : prevSeries.length ? (prevView ? { kind: 'showCurrent', level: x.level } : { kind: 'showPrev', level: x.level, lot: prevSeries[0].lot || '' })
        : { kind: 'hint', text: x.applied === 'lab' ? 'Dải PXN' : 'Dải NSX' };
      return { on, parallel: x.parallel, level: x.level, lot: chartLot || '', pointCount: chartPts.length, previousLot: !!prevView, metrics, action, testId: t.id, mean: chartMean, sd: chartSd, start: W.start, end: W.end };
    });
    const levelHeads = entryCols.map((x: AnyRec) => {
      const cfg = entryColumnCfg(t, x.level, x.lot), mean = Number(cfg && cfg.mean), sd = Number(cfg && cfg.sd), limits = Number.isFinite(mean) && Number.isFinite(sd) ? `${deps.fmtTestValue(t, mean - 2 * sd)} – ${deps.fmtTestValue(t, mean + 2 * sd)}` : '—', tooltip = `Mean ${Number.isFinite(mean) ? deps.fmtTestValue(t, mean) : '—'} · SD ${Number.isFinite(sd) ? deps.fmtTestStat(t, sd) : '—'} · ±2SD ${limits}`;
      return { level: x.level, lot: x.lot || '', parallel: x.parallel, tooltip };
    });
    const sheetCalendar = deps.EntryService.buildSheetCalendar(ui().entrySheetMonth, deps.isoToday()), activeSheetMonth = sheetCalendar.activeMonth;
    ui().entrySheetMonth = activeSheetMonth;
    const sheetYear = sheetCalendar.year, sheetMonthNo = sheetCalendar.month, sheetStart = sheetCalendar.start, sheetEnd = sheetCalendar.end;
    const prevPtsByLevel: AnyRec = {}, pointsByLevel: AnyRec = {};
    entryCols.forEach((x: AnyRec) => {
      prevPtsByLevel[x.key] = x.parallel ? [] : deps.previousLotSeries(t, x.level).flatMap((s2: AnyRec) => s2.pts.map((p: AnyRec) => ({ ...p, _prevLot: s2.lot })));
      pointsByLevel[x.key] = colPointsIdx(x);
    });
    const sheetDays = sheetCalendar.days;
    const sheetRowsData = deps.EntryService.buildSheetRowsData({ levels: entryCols, sheetStart, sheetEnd, sheetDays, pointsByLevel, previousPointsByLevel: prevPtsByLevel, pointRunNo: deps.pointRunNo });
    const sheetRows = sheetRowsData.map((dayGroup: AnyRec) => {
      const firstRunNo = () => deps.EntryService.sheetFirstRunNo(dayGroup);
      const levelRuns = (x: AnyRec) => deps.EntryService.sheetLevelRuns(dayGroup, x.key);
      const daySummary = deps.EntryService.summarizeRunStatus(entryCols.filter((x: AnyRec) => !x.parallel).map((x: AnyRec) => dayGroup.runs.map((g: AnyRec) => g.levels[x.key]).filter(Boolean).sort((a: AnyRec, b: AnyRec) => deps.pointRunNo(a) - deps.pointRunNo(b) || (a._idx || 0) - (b._idx || 0))), entryWG.byPoint);
      const { worst, rulesAll, warnRules, rejRules, hasPoint } = daySummary;
      const shouldShowEmptyRun = (x: AnyRec, g: AnyRec) => {
        const runs = levelRuns(x);
        if (!runs.length) return g.runNo === firstRunNo();
        const prev = [...runs].reverse().find((r: AnyRec) => r.runNo < g.runNo);
        if (!prev) return false;
        if (g.runNo !== prev.runNo + 1) return false;
        if (ui().entryExtraRun.has(`${t.id}|${x.key}|${g.date}|${g.runNo}`)) return true;
        const f = colVerdict(x, prev.levels[x.key]);
        return f.level === 'rej';
      };
      const cells = entryCols.map((x: AnyRec, levelIdx: number) => {
        let levelHasPoint = false, emptyShown = false;
        const levelRunNos = levelRuns(x).map((r: AnyRec) => r.runNo), nextLevelRunNo = levelRunNos.length ? Math.max(...levelRunNos) + 1 : 1;
        const runs = dayGroup.runs.map((g: AnyRec) => {
          const p = g.levels[x.key];
          if (!p) {
            if (!shouldShowEmptyRun(x, g)) return null;
            emptyShown = true;
            return { kind: 'empty', editable: deps.canWrite(), title: 'Dùng phím mũi tên để chuyển ô', ariaLabel: `Nhập QC ngày ${deps.vnDate(g.date)}, mức ${x.level}, lô ${x.lot || ''}, lần ${g.runNo}`, date: g.date, runNo: g.runNo, levelIndex: levelIdx, actionArgs: [t.id, x.level, g.date, g.runId || '', x.parallel ? x.lot || '' : ''] };
          }
          levelHasPoint = true;
          const isPrev = !!p._prevLot, pMean = isPrev && Number.isFinite(+p.qcMean) ? +p.qcMean : x.mean, pSd = isPrev && Number.isFinite(+p.qcSd) ? +p.qcSd : x.sd;
          const verdict = isPrev ? { level: 'ok', rules: [] } : colVerdict(x, p), view = deps.EntryService.buildPointView({ point: p, verdict, mean: pMean, sd: pSd, previousLot: isPrev ? p._prevLot : undefined }), lv = deps.qcVerdictLabel(view.level);
          return { kind: 'saved', previousLot: isPrev, previousLotName: p._prevLot || '', valueClass: view.valueClass, title: isPrev ? 'Lô cũ ' + p._prevLot + ' · đã chuyển tiếp · chỉ đọc' : 'Đã lưu, không sửa trực tiếp', valueText: deps.fmtPointValue(p, t), zText: `${view.z >= 0 ? '+' : ''}${deps.fmt(view.z)}s`, verdictText: lv };
        }).filter(Boolean);
        const addRun = deps.canWrite() && levelHasPoint && !emptyShown ? { actionArgs: [t.id, x.key, dayGroup.date, levelIdx, nextLevelRunNo] } : null;
        return { parallel: x.parallel, hasAddButton: !!addRun, runs, addRun };
      });
      const staff = [...new Map(dayGroup.runs.flatMap((g: AnyRec) => Object.values(g.levels)).map((p: AnyRec) => deps.pointStaff(p)).filter((x: AnyRec) => x.code).map((x: AnyRec) => [x.code, x])).values()];
      const autoNote = rulesAll.length ? (worst === 'rej' ? deps.errorType([...new Set(rejRules.length ? rejRules : rulesAll)] as string[]) : 'Theo dõi / cảnh báo') : '';
      const datePoints = dayGroup.runs.flatMap((g: AnyRec) => Object.values(g.levels)).filter(Boolean);
      const manualNote = ((datePoints.find((p: AnyRec) => String(p.note || '').trim())) || ({} as AnyRec)).note || '';
      const note = !hasPoint ? { kind: 'none' } : deps.canWrite() ? { kind: 'editable', value: manualNote, placeholder: autoNote || 'Nhập ghi chú...' } : { kind: 'readonly', text: manualNote || autoNote || '—' };
      const liveCols = entryCols.filter((x: AnyRec) => !x.parallel), doneLevels = liveCols.filter((x: AnyRec) => dayGroup.runs.some((g: AnyRec) => g.levels[x.key])).length, rowCls = [dayGroup.date === today ? 'today' : '', dayGroup.date <= today && doneLevels < liveCols.length ? 'missing' : '', hasPoint ? 'has-data' : ''].filter(Boolean).join(' ');
      return { rowClass: rowCls, date: dayGroup.date, dayOfMonth: deps.dateObj(dayGroup.date).getDate(), today: dayGroup.date === today, cells, staff: staff.map((x: AnyRec) => ({ code: x.code, name: x.name })), warningRules: [...new Set(warnRules)].join(', '), rejectRules: [...new Set(rejRules)].join(', '), status: !hasPoint ? 'none' : worst, note };
    });
    const worksheet = {
      testName: deps.testDisplayName(t), lotLabel: deps.pres.entryLotLabelsTs(entryCols), sheetYear, sheetMonthNo,
      currentIsoMonth: deps.isoMonth(), levelHeads, rows: sheetRows, columnCount: entryCols.length, message: ui().entryLastMsg,
    };
    const ljPanel = {
      startDate: W.start, endDate: W.end, dayPresetOptions, hasCustomRange: !!ui().entryStart,
      rangeText: `${deps.vnDate(W.start)} – ${deps.vnDate(W.end)} · ${deps.operationalLevels(t).length} mức QC`, stack: ljStack,
    };
    return {
      empty: false, treeCollapsed, machineOptions, selectedMachine: ui().entryMachine, query: ui().entryQ, treeNodes,
      testId: t.id, selectedLevel: ui().entrySel.level,
      worksheet, ljPanel, pointsInView, rangeSummary,
    };
  };

  /* Mở/thu nhánh ngay trên DOM, không vẽ lại toàn trang: khung cây có scroll riêng nên
     thay cả `.tree` sẽ đưa scrollTop về 0 và làm người dùng mất vị trí ở danh sách dài. */
  const treeToggle = (k: unknown) => {
    if (ui().treeOpen.has(k)) ui().treeOpen.delete(k); else ui().treeOpen.add(k);
    const open = ui().treeOpen.has(k), node = [...doc().querySelectorAll('.tree .tnode')].find((el: AnyRec) => el.dataset.key === String(k));
    if (node) {
      node.setAttribute('aria-expanded', String(open));
      node.classList.toggle('open', open);
      const caret = node.querySelector('.caret');
      if (caret) caret.textContent = open ? '−' : '+';
    }
    entryFilter(ui().entryQ);
  };
  const toggleEntryTree = () => {
    ui().entryTreeCollapsed = !entryTreeIsCollapsed();
    try { deps.localStorage().setItem('qclab_entry_tree_collapsed', deps.pres.entryTreeCollapsePreference.write(ui().entryTreeCollapsed)); } catch (e) { /* ignore */ }
    const grid = doc().querySelector('.entrygrid');
    if (!grid) { deps.rerender(); return; }
    grid.classList.toggle('tree-collapsed', ui().entryTreeCollapsed);
    const target = grid.querySelector(ui().entryTreeCollapsed ? '.entry-tree-expand' : '.entry-tree-toggle');
    requestAnimationFrame(() => { if (target) target.focus({ preventScroll: true }); });
  };
  /* Pha H2 nhóm (d) lát 3: đọc `this` thay `event.currentTarget` — dispatcher
     gọi qua listener delegate trên `document`, nên `event.currentTarget` lúc
     nào cũng là `document`, không phải phần tử cây thật; `this` (đặt qua
     `fn.apply(el,...)`) mới đúng là phần tử `data-keydown-action` khớp. */
  const entryTreeKey = function (this: AnyRec, event: AnyRec) {
    const item = this, key = event.key;
    const command = deps.pres.entryTreeKeyCommand(key, item.getAttribute('aria-expanded'));
    if (command === 'toggle') { event.preventDefault(); item.click(); return; }
    if (command !== 'navigate') return;
    const items = [...doc().querySelectorAll('.tree .tnode[tabindex="0"]')].filter((el: AnyRec) => el.offsetParent !== null), index = items.indexOf(item);
    if (index < 0 || !items.length) return;
    event.preventDefault();
    deps.pres.entryTreeNavigation.target(items, item, key).focus();
  };
  const entryFilter = (v: unknown) => {
    ui().entryQ = v;
    const q = deps.searchText(ui().entryQ), nodes = [...doc().querySelectorAll('.tree .tnode')], visible = deps.pres.entryTreeVisibility(nodes.map((el: AnyRec) => ({ role: el.dataset.treeRole, key: el.dataset.key, search: el.dataset.search })), q, ui().treeOpen);
    nodes.forEach((el: AnyRec, index: number) => { el.style.display = visible[index] ? '' : 'none'; });
  };
  const entryPick = (tid: unknown, level: unknown) => {
    const next = deps.pres.entrySelectionState.pick(tid, level);
    ui().entrySel = next.selection;
    ui().entryStart = next.start;
    ui().entryEnd = next.end;
    ui().entryLastMsg = next.message;
    doc().querySelectorAll('.tree .tn-config').forEach((row: AnyRec) => {
      const on = row.dataset.testId === String(tid);
      row.classList.toggle('on', on);
      row.setAttribute('aria-current', String(on));
    });
    entryRenderKeepScroll();
  };
  const entryFocusLevel = (level: unknown) => {
    const next = deps.pres.entrySelectionState.focus(ui().entrySel, level);
    if (!next) return;
    ui().entrySel = next;
    entryRenderKeepScroll();
  };
  const entryShowPrevLot = (level: unknown, lot: unknown) => {
    const key = deps.pres.entrySelectionState.previousLotKey(ui().entrySel, level);
    if (!key) return;
    ui().entryPrevOpen.set(key, lot);
    entryRenderKeepScroll();
  };
  const entryShowCurrentLot = (level: unknown) => {
    const key = deps.pres.entrySelectionState.previousLotKey(ui().entrySel, level);
    if (!key) return;
    ui().entryPrevOpen.delete(key);
    entryRenderKeepScroll();
  };
  const entryFocusPendingSheet = () => {
    if (!ui().entryPendingSheetFocus) return;
    const [date, level] = ui().entryPendingSheetFocus.split('|');
    const cands = [...doc().querySelectorAll('.qc-sheet .qc-inline-input')].filter((x: AnyRec) => x.dataset.focusDate === date && x.dataset.focusLevel === level);
    // Prefer the still-empty slot for this date+level (a run just saved may have
    // shifted its run-id, so match on date+level rather than the old full key).
    const el = deps.pres.entrySheetFocus(cands);
    if (el) { el.focus(); el.select(); ui().entryPendingSheetFocus = ''; }
  };
  const entrySheetInputs = () => deps.pres.entrySheetInputOrder([...doc().querySelectorAll('.qc-sheet .qc-inline-input')].filter((el: AnyRec) => !el.disabled && el.offsetParent !== null));
  const entrySheetTarget = (inputs: AnyRec[], current: AnyRec, key: string, shiftKey = false) => deps.pres.entrySheetNavigation.target(inputs, current, key, shiftKey);
  const entrySheetKey = function (this: AnyRec, event: AnyRec) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const supported = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!supported.includes(event.key)) return;
    const cur = this, next = entrySheetTarget(entrySheetInputs(), cur, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    ui().entryPendingSheetFocus = `${next.dataset.focusDate}|${next.dataset.focusLevel}`;
    cur.blur();
    setTimeout(entryFocusPendingSheet, 0);
  };
  /* Trang Entry giờ luôn render qua React (xem entryModel()/src/react/pages/EntryPage.tsx)
     — bản dán innerHTML thủ công từng cần thiết khi render() cổ điển gán lại toàn bộ
     #main.innerHTML (phá scrollTop của .qc-sheet-wrap và focus) đã bị xoá cùng
     pageEntry(): createRoot().render() của React chỉ patch đúng phần DOM thay đổi, tự
     giữ nguyên scrollTop và focus hiện tại (miễn JSX giữ đúng key/cấu trúc), nên gọi
     thẳng rerender() chuẩn là đủ. Vẫn giữ tên hàm này (không đổi 8+ nơi gọi) vì
     tests/entry-service.test.js khoá nguyên văn `entryRenderKeepScroll();` trong thân
     entryPick(). entrySheetKey()/entryFocusPendingSheet() (focus ô kế tiếp) và
     treeToggle()/entryFilter() (thu/mở nhánh, lọc tìm kiếm) đều tự tra lại DOM bằng
     thuộc tính data-focus-.../data-key sau khi vẽ xong nên không cần gọi gì thêm ở đây. */
  const entryRenderKeepScroll = () => {
    deps.rerender();
  };
  const entrySetLastMsg = (html: string) => {
    ui().entryLastMsg = html || '';
    const el = doc().getElementById('entryMsg');
    if (el) el.innerHTML = ui().entryLastMsg;
  };
  const entryUnlockExtraRun = (tid: unknown, colKey: unknown, date: unknown, levelIdx: unknown, runNo: unknown) => {
    if (!deps.requireWrite()) return;
    const request = deps.pres.entryExtraRunRequest(tid, colKey, date, levelIdx, runNo);
    ui().entryExtraRun.add(request.key);
    ui().entryPendingSheetFocus = request.focus;
    entryRenderKeepScroll();
  };
  const entryDateNoteSave = async (tid: unknown, date: string, value: unknown) => {
    if (!deps.requireWrite()) return;
    if (!await deps.requireUnlockedPeriod(date, 'ghi chú QC')) return;
    const result = deps.EntryDateNoteWorkflowCommand.save({ testId: tid, date, value });
    if (!result.ok) {
      const message = deps.pres.entryDateNoteErrorMessage(result.error);
      if (message) entrySetLastMsg('<div class="alert warn">' + deps.esc(message) + '</div>');
      return;
    }
    const note = result.note;
    const feedback = deps.pres.entryDateNoteFeedback(note, deps.vnDate(date));
    entrySetLastMsg(feedback ? `<div class="alert ${feedback.cls}">${deps.esc(feedback.message)}</div>` : note ? `<div class="alert ok">✓ Đã lưu ghi chú ngày ${deps.vnDate(date)}.</div>` : `<div class="alert ok">✓ Đã xóa ghi chú ngày ${deps.vnDate(date)}.</div>`);
  };
  /* cfg dùng khi ghi điểm. Mặc định là cấu hình sống của mức; nếu lotNo trỏ đúng lô
     đang chạy song song thì trả cfg tổng hợp của lô đó (Mean/SD riêng của nó).
     Cố ý không kèm meanSdHistory của mức: cảnh báo "ngày thuộc giai đoạn lô khác"
     trong qcPointWarnings sẽ báo nhầm, vì chạy song song vốn dĩ trùng giai đoạn
     với lô đang dùng. */
  const entryColumnCfg = (t: AnyRec, level: unknown, lotNo: unknown) => deps.pres.entryColumnConfig(t, level, lotNo);
  const entryInlineSave = async (tid: unknown, level: unknown, date: string, value: unknown, runIdHint = '', lotNo = '') => {
    if (!deps.requireWrite()) return;
    const t = state().tests.find((x: AnyRec) => x.id === tid), cfg = entryColumnCfg(t, level, lotNo);
    if (!t || !cfg || !deps.canEnterQcForLevel(t, level)) { entrySetLastMsg('<div class="alert warn">Nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>'); return; }
    if (value == null || String(value).trim() === '') return;
    if (!await deps.requireUnlockedPeriod(date, 'nhập điểm QC')) return;
    const prepared = deps.EntryService.preparePointInput({ tid, level, date, value, runId: runIdHint, cfg });
    if (!prepared.ok) { entrySetLastMsg('<div class="alert warn">Nhập giá trị QC hợp lệ.</div>'); return; }
    const { val, valueDecimals, runId } = prepared.point;
    const preIssues = deps.qcPointWarnings(t, cfg, date, runId, val);
    if (preIssues.some((x: string) => x.includes('SD đang bằng 0'))) { entrySetLastMsg('<div class="alert rej"><b>Không thể lưu.</b> ' + deps.esc(preIssues.join(' ')) + '</div>'); return; }
    if (preIssues.length) {
      // Native confirm()/alert() dialogs leave the Electron renderer's input
      // unresponsive after close (until the window blurs/refocuses), so
      // unusual-data confirmation goes through the app's own modal instead.
      deps.openModal(deps.pres.entryPreSaveWarningModalHtml({ issuesHtml: preIssues.map((x: string) => `<div class="alert warn">${deps.esc(x)}</div>`).join(''), cancelButtonHtml: deps.btn('Hủy', { action: 'entryCloseKeepScroll' }, 'ghost'), saveButtonHtml: deps.btn('Vẫn lưu', { action: 'entryConfirmInlineSave', args: [tid, level, date, val, runId, lotNo, valueDecimals] }, 'teal') }));
      return;
    }
    entryInlineSaveCommit(tid, level, date, val, runId, lotNo, valueDecimals);
  };
  /* Pha H2 nhóm (d) lát 3: `entryInlineSave`'s vị trí tham số cố định (value ở
     giữa) vì `scripts/ui-workflow-check.js` gọi trực tiếp theo đúng thứ tự
     cũ — không đổi được. Wrapper này chỉ đảo lại thứ tự để value luôn ở CUỐI,
     khớp quy ước data-action-on="change" tự nối giá trị sống vào cuối args. */
  const entrySheetRunChanged = (tid: unknown, level: unknown, date: string, runIdHint: string, lotNo: string, value: unknown) => entryInlineSave(tid, level, date, value, runIdHint, lotNo);
  const entryInlineSaveCommit = (tid: unknown, level: unknown, date: string, val: unknown, runId: unknown, lotNo: unknown = '', valueDecimals = deps.qcValueDecimals(val)) => {
    const t = state().tests.find((x: AnyRec) => x.id === tid), cfg = entryColumnCfg(t, level, lotNo);
    // Kiểm tra lại tại thời điểm ghi vì nhóm lô có thể vừa bị dừng trong lúc hộp
    // thoại xác nhận dữ liệu bất thường đang mở hoặc vừa nhận đồng bộ từ máy khác.
    if (!t || !cfg || !deps.canEnterQcForLevel(t, level)) { entrySetLastMsg('<div class="alert warn">Không thể lưu: nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>'); entryRenderKeepScroll(); return; }
    const recorded = deps.EntryRecordWorkflowCommand.execute({ test: t, testId: tid, level, date, value: val, valueDecimals, runId, lotNo, cfg, staff: deps.currentStaff(), id: deps.uid(), activeLot: (deps.lvlCfg(t, level) || {}).lot || '', audit: (result: AnyRec) => ({ action: 'Thêm điểm QC', detail: `Ngày ${deps.vnDate(date)}, M${level}${result.parallel ? ' · lô song song ' + lotNo : ''}, giá trị ${deps.fmtPointValue(result.point, t)}`, target: t.name }) });
    if (!recorded.ok) {
      if (recorded.error === 'not-ready') { entrySetLastMsg('<div class="alert warn">Không thể lưu: nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>'); entryRenderKeepScroll(); return; }
      const message = deps.pres.entryRecordErrorMessage(recorded.error);
      entrySetLastMsg('<div class="alert warn">' + message + '</div>');
      return;
    }
    // Lô song song không nằm trong activeWestgard (chỉ phủ lô đang dùng) — tra bảng
    // đánh giá riêng của chính nó để báo đúng kết luận cho điểm vừa nhập.
    const f = recorded.verdict, rules = recorded.verdict.rules || [];
    const feedback = deps.pres.entrySaveFeedback({ level, lotNo, parallel: recorded.parallel, verdict: f.level, rules, dateText: deps.vnDate(date) }), tag = `Mức ${level}${recorded.parallel ? ' · lô song song ' + deps.esc(lotNo) : ''}`;
    ui().entrySel = recorded.selection;
    ui().entryLastMsg = feedback ? `<div class="alert ${feedback.cls}">${feedback.emphasis ? '<b>' + deps.esc(feedback.message) + '</b>' : deps.esc(feedback.message)}</div>` : f.level === 'rej' ? `<div class="alert rej"><b>⚠ ${tag} vi phạm — ${rules.join(', ')}</b></div>` : f.level === 'warn' ? `<div class="alert warn"><b>${tag} cảnh báo — ${rules.join(', ')}</b></div>` : `<div class="alert ok">✓ Đã lưu ${tag} ngày ${deps.vnDate(date)}.</div>`;
    entryRenderKeepScroll();
  };
  /* Pha H2 (2026-08-20): hai wrapper cho nút trên entryPreSaveWarningModalHtml
     — trước đây onclick="closeModal();fn(...)" gọi 2 lệnh liền, data-action
     chỉ định tuyến một hàm nên gộp lại đây. */
  const entryCloseKeepScroll = () => { deps.closeModal(); entryRenderKeepScroll(); };
  const entryConfirmInlineSave = (tid: unknown, level: unknown, date: string, val: unknown, runId: unknown, lotNo: unknown, valueDecimals: number) => { deps.closeModal(); entryInlineSaveCommit(tid, level, date, val, runId, lotNo, valueDecimals); };
  const syncVoidNceChoice = () => {
    const kind = (doc().getElementById('voidKindInput') || {}).value, box = doc().getElementById('voidOpenNce'), hint = doc().getElementById('voidNceHint'), reasonBox = doc().getElementById('voidReasonBox'), reasonErr = doc().getElementById('voidReasonErr');
    if (!box) return;
    const choice = deps.pres.entryVoidNceChoice(kind);
    box.checked = choice.openNce;
    box.disabled = choice.disabled;
    if (hint) hint.textContent = choice.hint;
    const label = doc().getElementById('voidReasonLabel');
    if (label) label.textContent = choice.reasonLabel;
    if (reasonBox) reasonBox.hidden = false;
    if (reasonErr) reasonErr.style.display = 'none';
  };
  const voidQcPoint = async (tid: unknown, pointId: unknown) => {
    if (!deps.requireWrite()) return;
    const t = state().tests.find((x: AnyRec) => x.id === tid), p = (state().data[tid as string] || []).find((x: AnyRec) => x.id === pointId);
    if (!t || !p || p.voided) return;
    if (!await deps.requireUnlockedPeriod(p.date, 'hủy điểm QC')) return;
    deps.openModal(deps.pres.entryVoidModalHtml({ pointInfoHtml: `Ngày ${deps.vnDate(p.date)} · Mức ${p.level} · Giá trị ${deps.fmtPointValue(p, t)}`, closeButtonHtml: '<button class="modal-close" data-action="closeModal">×</button>', closeFooterButtonHtml: deps.btn('Đóng', { action: 'closeModal' }, 'ghost'), confirmButtonHtml: deps.btn('Xác nhận hủy', { action: 'confirmVoidQcPoint', args: [tid, pointId] }, 'danger') }));
    setTimeout(() => { const e = doc().getElementById('voidKindInput'); if (e) e.focus(); }, 50);
  };
  const confirmVoidQcPoint = async (tid: unknown, pointId: unknown) => {
    const t = state().tests.find((x: AnyRec) => x.id === tid), p = (state().data[tid as string] || []).find((x: AnyRec) => x.id === pointId);
    if (!t || !p || p.voided) { deps.closeModal(); return; }
    const input = doc().getElementById('voidReasonInput'), kind = (doc().getElementById('voidKindInput') || {}).value || 'other', openNce = !!((doc().getElementById('voidOpenNce') || {}).checked), clean = deps.QCCore.cleanText(input ? input.value : '', 1000).trim(), verdict = deps.pointVoidVerdict(t, p), rules = [...new Set(verdict.rules || [])], rule = rules.join(', ') || 'Không có luật Westgard', qcVerdict = ['warn', 'rej'].includes(verdict.level) ? verdict.level : 'invalid', qcErrorType = deps.errorType(rules as string[]);
    if (!deps.pres.entryVoidReasonValid(kind, clean)) {
      const err = doc().getElementById('voidReasonErr');
      if (err) err.style.display = '';
      if (input) input.focus();
      return;
    }
    // confirmDialog() render vào #dialogRoot, tách khỏi #modalRoot đang giữ modal
    // "Hủy điểm QC" phía sau — nên Hủy ở đây không đụng gì tới modal đó, giữ nguyên
    // lý do người dùng đã gõ mà không cần dựng lại.
    const detail = openNce ? 'Điểm vẫn được giữ trong nhật ký; hồ sơ NCE sẽ được lập mới hoặc dùng lại, và yêu cầu QC chạy lại.' : 'Điểm vẫn được giữ trong nhật ký; thao tác này không tự mở hồ sơ NCE.';
    if (!await deps.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Hủy điểm QC', message: 'Hủy điểm QC này khỏi tính toán Westgard/thống kê?', detail, confirmLabel: 'Hủy điểm QC', cancelLabel: 'Quay lại' })) return;
    deps.closeModal();
    const result = deps.EntryVoidWorkflowCommand.execute({ tid, pointId, reason: clean, kind, openNce, rule, errorType: qcErrorType, qcVerdict, staff: deps.currentStaff(), nowIso: new Date().toISOString(), today: deps.isoToday(), id: deps.uid(), nceId: deps.nextNceId(deps.isoToday()), dueDate: deps.nceDueDate(7), formatDate: deps.vnDate, formatNumber: deps.fmt, audit: (result: AnyRec) => ({ action: 'Hủy điểm QC', detail: `Ngày ${deps.vnDate(result.point.date)}, M${result.point.level}, giá trị ${deps.fmtPointValue(result.point, t)} · ${result.reason}`, target: t.name }) });
    if (result && result.error === 'period-locked') { entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể hủy điểm QC.</div>'); return; }
    if (!result || !result.ok) return;
    const followup = result.openNce ? (result.reusedAction ? ' Đã giữ liên kết với hồ sơ NCE đang mở.' : ` Đã mở hồ sơ ${deps.esc((result.action && result.action.nceId) || 'NCE')} để tiếp tục điều tra.`) : ' Không yêu cầu NCE/QC chạy lại.';
    ui().entryLastMsg = `<div class="alert warn">Đã hủy điểm QC ngày ${deps.vnDate(result.point.date)}. Điểm không còn tham gia tính toán.${followup}</div>`;
    entryRenderKeepScroll();
  };
  const entrySetSheetMonth = (v: unknown) => {
    const month = deps.pres.entrySheetMonthValue(v);
    if (!month) return;
    ui().entrySheetMonth = month;
    ui().entryLastMsg = '';
    deps.rerender();
  };
  const entryGoToday = () => {
    ui().entrySheetMonth = deps.isoMonth();
    ui().entryJumpToday = true;
    ui().entryLastMsg = '';
    deps.rerender();
  };
  const entrySetSheetPart = (part: string, value: unknown) => entrySetSheetMonth(deps.pres.entrySheetMonthPart(ui().entrySheetMonth, deps.isoMonth(), part === 'year' ? 'year' : 'month', value));
  /* entrySetMachine(): thiếu hoàn toàn trước đây — bộ lọc "Lọc theo máy xét
     nghiệm" trên cây (EntryPage.tsx) gọi data-action="entrySetMachine" từ
     hồi trang Entry chuyển sang React lần đầu (2026-08-30), nhưng chưa có
     hàm nào mang tên đó ở bất kỳ đâu trong repo — action-dispatcher.ts
     resolve() ra undefined nên select này chưa từng có tác dụng, phát hiện
     khi rà lại toàn bộ data-action của trang lúc chuyển sang onChange thật
     (Giai đoạn 2 gỡ global bridge). entryModel() đã tự reset entryMachine về
     'all' nếu giá trị không hợp lệ (dòng ~156), nên chỉ cần một setter đơn
     giản đúng khuôn mẫu entrySetDays/entrySetSheetMonth ở trên. */
  const entrySetMachine = (value: unknown) => {
    ui().entryMachine = String(value);
    deps.rerender();
  };
  const entrySetDays = (n: unknown) => {
    const range = deps.pres.entryRangePreset(n);
    ui().entryDays = range.days;
    ui().entryStart = range.start;
    ui().entryEnd = range.end;
    deps.rerender();
  };
  const entrySetStart = (v: unknown) => {
    const next = deps.pres.entryDateRangeInput({ start: ui().entryStart, end: ui().entryEnd }, 'start', v);
    ui().entryStart = next.start;
    ui().entryEnd = next.end;
    deps.rerender();
  };
  const entrySetEnd = (v: unknown) => {
    const next = deps.pres.entryDateRangeInput({ start: ui().entryStart, end: ui().entryEnd }, 'end', v);
    ui().entryStart = next.start;
    ui().entryEnd = next.end;
    deps.rerender();
  };

  return {
    entryModel,
    entryWindow, entryWindowFor, entryRowsWindow, entryToggleRows, entryDetailToggled, entryTreeIsCollapsed,
    treeToggle, toggleEntryTree, entryTreeKey, entryFilter, entryPick, entryFocusLevel, entryShowPrevLot, entryShowCurrentLot,
    entryFocusPendingSheet, entrySheetInputs, entrySheetTarget, entrySheetKey,
    entryRenderKeepScroll, entryCloseKeepScroll, entryConfirmInlineSave, entrySetLastMsg, entryUnlockExtraRun, entryDateNoteSave, entryColumnCfg, entryInlineSave, entrySheetRunChanged,
    entryInlineSaveCommit, syncVoidNceChoice, voidQcPoint, confirmVoidQcPoint, entrySetSheetMonth, entryGoToday,
    entrySetSheetPart, entrySetDays, entrySetStart, entrySetEnd, entrySetMachine,
  };
}

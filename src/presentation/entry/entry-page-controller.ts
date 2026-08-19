type AnyRec = any;

/**
 * Trang "Nhập QC" (Entry) — nhập/hủy điểm QC theo ngày, mức QC và lô đang vận
 * hành, trang thao tác dữ liệu nhạy cảm nhất của ứng dụng. Toàn bộ HTML thật
 * nằm trong các hàm `deps.pres.entryXxxHtml()` (TypeScript, đã bridge từ các
 * đợt UI-thuần trước); controller này chỉ còn phần điều phối — đọc state,
 * dựng cây xét nghiệm/bảng nhập/biểu đồ Levey-Jennings, ghi UI state, và gọi
 * đúng workflow command TypeScript khi ghi/hủy điểm QC hay ghi chú ngày.
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
  afterRender: (page: string) => void;
  role: () => string;
  canWrite: () => boolean;
  requireWrite: () => boolean;
  requireUnlockedPeriod: (date: string, action: string) => Promise<boolean>;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  jsq: (value: unknown) => string;
  btn: (label: string, action: string, cls?: string, title?: string, options?: AnyRec) => string;
  headOnly: (title: string, subtitle: string, actions?: string) => string;
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
  /* ~51 hàm dựng HTML/thuật toán thuần (TypeScript) đã bridge từ các đợt
     UI-thuần trước, gom một chỗ thay vì khai kiểu từng cái — khớp cách
     reagent-page-controller.ts/manage-page-controller.ts đã làm. */
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

  const pageEntry = (rightOnly = false): string => {
    const s = state();
    const today = deps.isoToday();
    if (!s.tests.length) {
      return deps.pres.entryEmptyPageHtml({
        title: 'Chưa có xét nghiệm',
        message: 'Cần khai báo xét nghiệm và mức QC trước khi nhập kết quả.',
        actionHtml: deps.role() === 'admin' ? deps.btn('Thêm xét nghiệm', `go('manage')`, 'teal') : '',
      });
    }
    const entryTests = deps.operationalTests();
    if (!entryTests.length) {
      return deps.pres.entryEmptyPageHtml({
        title: 'Chưa có xét nghiệm sẵn sàng nhập',
        message: 'Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi nhập kết quả.',
        actionHtml: deps.role() === 'admin' ? deps.btn('Cấu hình Mean/SD', `go('manage');setManageTab('targets')`, 'teal') : '',
      });
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
    const treePanelIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>';
    let tree = '', treeHead = '';
    if (!rightOnly) {
      const byMAll = deps.EntryService.groupByMachine(entryTests);
      const machinesAll = [...byMAll.keys()];
      const selM = selT.machine || '(Chưa gán máy)';
      if (ui().entryMachine !== 'all' && !machinesAll.includes(ui().entryMachine)) ui().entryMachine = 'all';
      // Tự mở một lần khi đổi test; sau đó để người dùng tự thu/mở cây.
      const selGroup = deps.operationalLotGroupForTest(selT);
      const autoKey = selM + '|' + selGroup.key + '|' + ui().entrySel.testId;
      if (ui().entryAutoOpenKey !== autoKey) {
        ui().treeOpen.add('m:' + selM);
        ui().treeOpen.add('lg:' + selM + '|' + selGroup.key);
        ui().entryAutoOpenKey = autoKey;
      }
      const byM = deps.EntryService.groupByMachine(entryTests.filter((t: AnyRec) => ui().entryMachine === 'all' || (t.machine || '(Chưa gán máy)') === ui().entryMachine));
      const machines = [...byM.keys()];
      const machineOpts = ['<option value="all">Tất cả máy</option>'].concat(machinesAll.map((m: string) =>
        `<option value="${deps.escapeAttr(m)}" ${ui().entryMachine === m ? 'selected' : ''}>${deps.esc(m)}</option>`)).join('');
      /* h4/tree-tools nằm NGOÀI div role="tree" (chỉ bọc quanh các .tnode role="treeitem")
         — ARIA tree chỉ được phép chứa treeitem/group, aria-required-children sẽ báo lỗi
         nếu heading/input/select nằm trực tiếp trong đó. CSS `.tree h4`/`.tree-tools ...`
         vẫn là descendant selector nên không cần đổi gì ở CSS. */
      treeHead = deps.pres.entryTreeHeaderHtml({
        collapseButtonHtml: deps.btn(treePanelIcon, 'toggleEntryTree()', 'ghost icon entry-tree-toggle', 'Ẩn danh mục nội kiểm', { attrs: { 'aria-label': 'Ẩn danh mục nội kiểm', 'aria-controls': 'entryTreePanel', 'aria-expanded': 'true' } }),
        query: ui().entryQ,
        machineOptionsHtml: machineOpts,
      });
      if (!machines.length) tree += deps.pres.entryTreeItemHtml.empty();
      machines.forEach((mc: string) => {
        const mk = 'm:' + mc, mo = ui().treeOpen.has(mk);
        tree += deps.pres.entryTreeItemHtml.machine({ key: mk, open: mo, label: mc, toggleKey: deps.jsq(mk) });
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
            return deps.pres.entryTreeItemHtml.assay({ testId: t.id, search, selected: on, visible: mo && go, level: preferred ? preferred.level : 1, name: deps.testDisplayName(t), stateClass: worst === 'none' ? '' : worst, stateText: deps.stateName(worst) });
          });
          tree += deps.pres.entryTreeItemHtml.group({ key: gk, open: go, parentOpen: mo, search: deps.searchText(grp.name + ' ' + grp.tests.map((t: AnyRec) => t.name).join(' ')), name: grp.name, stateClass: groupWorst === 'none' ? '' : groupWorst, stateText: deps.stateName(groupWorst), toggleKey: deps.jsq(gk) });
          tree += rows.join('');
        });
      });
    }
    // panel phải
    const t = selT, l = deps.lvlCfg(t, ui().entrySel.level), entryWG = deps.activeWestgard(t), acceptedCache = new Map<string, AnyRec>();
    /* Cột nhập = (mức, lô): mức đang chạy song song có 2 cột. Lô song song được
       đánh giá bằng bảng Westgard riêng của nó (parallelWestgard), tách hẳn khỏi
       entryWG của lô đang vận hành. */
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
    // thống kê toàn bộ + dải QC
    const allSt = deps.stats(W.all.map((p: AnyRec) => p.val));
    const cand = deps.rangeCandidate(t.id, l.level), candStats = cand && cand.c;
    const eligible = cand && cand.eligible;
    const rangeSummary = allSt ? `N=${allSt.n} · Mean thực=${deps.fmtTestValue(t, allSt.m)} · SD thực=${deps.fmtTestStat(t, allSt.sd)} · CV=${deps.fmt(allSt.cv)}%` : 'Chưa có dữ liệu';
    const rangeSource = l.applied === 'lab' ? 'PXN tự xây dựng' : 'Nhà sản xuất';
    const rangeBox = deps.pres.entryRangeSummaryHtml({ open: ui().entryDetailOpen.has('range'), summary: rangeSummary, source: rangeSource, mean: deps.fmtTestValue(t, l.mean), sd: deps.fmtTestValue(t, l.sd), eligible, resultCount: candStats ? candStats.n : 0, dayCount: cand ? cand.days : 0, proposedMean: candStats ? deps.fmtTestValue(t, candStats.m) : '—', proposedSd: candStats ? deps.fmtTestValue(t, candStats.sd) : '—', proposedCv: candStats ? deps.fmt(candStats.cv) : '—', actionsHtml: deps.rangeActions(t.id, l.level, eligible, l.applied) });
    // Lô cũ (đã chuyển tiếp) chỉ gắn với cột lô đang dùng, không áp cho cột song song.
    const levelViews = entryCols.map((x: AnyRec) => {
      if (x.parallel) return { x, prevView: null };
      const prevSeries = deps.previousLotSeries(t, x.level), prevLot = ui().entryPrevOpen.get(t.id + '|' + x.level) || '';
      return { x, prevView: prevSeries.find((s: AnyRec) => (s.lot || '') === prevLot) };
    });
    const tableCards = levelViews.map(({ x, prevView }: AnyRec) => {
      const lvlMean = prevView ? prevView.mean : x.mean, lvlSd = prevView ? prevView.sd : x.sd, lvlLot = prevView ? prevView.lot : x.lot;
      const allIdx = prevView ? prevView.pts : colPointsIdx(x), allPtsIdx = prevView ? allIdx : allIdx.filter((p: AnyRec) => p.date >= W.start && p.date <= W.end), tableKey = `${t.id}|${x.key}|${lvlLot || ''}|${W.start}|${W.end}`, rowWindow = entryRowsWindow(allPtsIdx, tableKey), ptsIdx = rowWindow.rows, cumulativePts = prevView ? allIdx : allIdx.filter((p: AnyRec) => p.date <= W.end), cumulativeSt = deps.stats(cumulativePts.map((p: AnyRec) => p.val));
      const prevWg = prevView ? deps.QCCore.westgardByPoint(ptsIdx, lvlMean, lvlSd, (rule: string) => deps.testRuleOnWithin(t, rule)) : null;
      const rows = ptsIdx.map((p: AnyRec, i: number) => {
        const rawPrev = prevView && prevWg.F[i], verdict = prevView ? (rawPrev ? { ...rawPrev, level: deps.ruleResultLevel(t, rawPrev.rules || []), z: prevWg.zs[i] } : { level: 'ok', rules: [] }) : colVerdict(x, p),
          view = deps.EntryService.buildPointView({ point: p, verdict, mean: lvlMean, sd: lvlSd, previousLot: prevView ? prevView.lot : undefined }),
          lv = deps.qcVerdictLabel(view.level),
          voidBtn = deps.canWrite() ? deps.btn('Hủy', `voidQcPoint('${t.id}','${p.id}')`, 'danger sm', 'Hủy điểm QC có ghi lý do') : '',
          rulesHtml = [...new Set(view.rules)].map((r: unknown) => `<span class="pill">${r}</span>`).join('') || '—';
        return deps.pres.entryPointTableRowHtml({ rejected: view.level === 'rej', warning: view.level === 'warn', pointId: deps.escapeAttr(p.id || ''), dateText: deps.vnDate(p.date), valueText: deps.fmtPointValue(p, t), zText: `${view.z >= 0 ? '+' : ''}${deps.fmt(view.z)}s`, verdictLevel: view.level, verdictText: lv, rulesHtml, voidButtonHtml: voidBtn });
      }).join('');
      const cumulative = deps.pres.entryCumulativeStatsHtml({ endDateText: deps.vnDate(W.end), count: cumulativeSt ? cumulativeSt.n : 0, mean: cumulativeSt ? deps.fmtTestValue(t, cumulativeSt.m) : '—', sd: cumulativeSt ? deps.fmtTestStat(t, cumulativeSt.sd) : '—', cv: cumulativeSt ? deps.fmt(cumulativeSt.cv) + '%' : '—' });
      const rowControl = deps.pres.entryTableWindowNoteHtml({ limited: rowWindow.limited, expanded: rowWindow.expanded && rowWindow.total > ENTRY_TABLE_INITIAL_ROWS, shown: rowWindow.rows.length, total: rowWindow.total, actionButtonHtml: deps.btn(rowWindow.limited ? 'Hiện toàn bộ' : 'Thu gọn', `entryToggleRows('${deps.jsq(tableKey)}')`, 'ghost sm') });
      return deps.pres.entryPointTableCardHtml({ parallel: x.parallel, level: x.level, previousLot: !!prevView, lot: deps.esc(lvlLot || '?'), pointCount: allPtsIdx.length, bodyHtml: `${cumulative}${ptsIdx.length ? `<table><thead><tr><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>${rowControl}` : '<div class="empty qc-table-empty">Chưa có điểm nào trong khoảng này.</div>'}` });
    }).join('');
    const prevLotByLevel = new Map<unknown, AnyRec>(levelViews.filter((v: AnyRec) => v.prevView).map((v: AnyRec) => [v.x.level, v.prevView.lot]));
    const voidedRows = (s.data[t.id] || []).filter((p: AnyRec) => {
      if (!p.voided) return false;
      const pv = prevLotByLevel.get(p.level);
      return pv != null ? (p.lot || '') === pv : (p.date >= W.start && p.date <= W.end);
    }).sort((a: AnyRec, b: AnyRec) => String(a.date || '').localeCompare(String(b.date || '')) || deps.pointRunNo(a) - deps.pointRunNo(b))
      .map((p: AnyRec) => deps.pres.entryVoidedPointRowHtml({ pointId: deps.escapeAttr(p.id || ''), dateText: deps.vnDate(p.date), levelLotText: `Mức ${p.level} · Lô ${deps.esc(p.lot || '?')}`, valueText: deps.fmtPointValue(p, t), runId: deps.esc(p.runId || '—'), voidedBy: deps.esc(p.voidedBy || ''), reason: deps.esc(p.voidReason || '') })).join('');
    const voidedBox = deps.pres.entryVoidedPointsHtml(voidedRows);
    const pointsInView = deps.pres.entryPointsPanelHtml({ open: ui().entryDetailOpen.has('points'), endDateText: deps.vnDate(W.end), startDateText: deps.vnDate(W.start), tableCardsHtml: tableCards, voidedBoxHtml: voidedBox });
    const dayBtns = deps.pres.entryDayPresetButtons(ui().entryDays, !!ui().entryStart);
    ui().entryLjRenderCache = { testId: t.id, start: W.start, end: W.end, levels: new Map<string, AnyRec>() };
    const ljStack = entryCols.map((x: AnyRec) => {
      const on = x.level === ui().entrySel.level && !x.parallel,
        // Lô song song dùng chính điểm của nó (không qua acceptedLotPoints — helper đó
        // chọn 1 lần chạy lại/ngày cho lô đang vận hành, không áp dụng cho lô đang đánh giá).
        curPts = (x.parallel ? deps.entryColumnPoints(t, x) : acceptedForLevel(x.level)).filter((p: AnyRec) => p.date >= W.start && p.date <= W.end && (p.lot || '') === (x.lot || '')),
        prevSeries = x.parallel ? [] : deps.previousLotSeries(t, x.level), prevLot = ui().entryPrevOpen.get(t.id + '|' + x.level) || '', prevView = prevSeries.find((s2: AnyRec) => (s2.lot || '') === prevLot), targetCfg = prevView || deps.pres.entryColumnConfig(t, x.level, x.lot), chartPts = prevView ? prevView.pts : curPts, chartLot = prevView ? prevView.lot : x.lot, chartMean = targetCfg && targetCfg.mean, chartSd = targetCfg && targetCfg.sd, st = deps.stats(chartPts.map((p: AnyRec) => p.val));
      ui().entryLjRenderCache.levels.set(`${x.level}|${chartLot || ''}`, chartPts);
      const metrics = [
        { label: 'Mean thực', value: st ? deps.fmtTestValue(t, st.m) : '—' },
        { label: 'SD thực', value: st ? deps.fmtTestStat(t, st.sd) : '—' },
        { label: 'CV thực', value: st ? deps.fmt(st.cv) + '%' : '—' },
        { label: 'Mean mục tiêu', value: deps.fmtTestValue(t, chartMean), control: true },
        { label: 'SD mục tiêu', value: deps.fmtTestStat(t, chartSd), control: true },
      ];
      const prevBtn = x.parallel ? '<span class="hint">Đang đánh giá</span>' : prevSeries.length ? (prevView ? deps.btn('Xem lô mới', `event.stopPropagation();entryShowCurrentLot(${x.level})`, 'teal sm') : deps.btn('Xem lô cũ', `event.stopPropagation();entryShowPrevLot(${x.level},'${deps.jsq(prevSeries[0].lot || '')}')`, 'ghost sm')) : `<span class="hint">${x.applied === 'lab' ? 'Dải PXN' : 'Dải NSX'}</span>`;
      return deps.pres.entryLeveyJenningsMiniHtml({ on, parallel: x.parallel, level: x.level, lot: chartLot || '', pointCount: chartPts.length, previousLot: !!prevView, metrics, actionHtml: prevBtn, testId: t.id, mean: chartMean, sd: chartSd, start: W.start, end: W.end });
    }).join('');
    const levelHead = deps.pres.entrySheetLevelHeads(entryCols.map((x: AnyRec) => {
      const cfg = deps.pres.entryColumnConfig(t, x.level, x.lot), mean = Number(cfg && cfg.mean), sd = Number(cfg && cfg.sd), limits = Number.isFinite(mean) && Number.isFinite(sd) ? `${deps.fmtTestValue(t, mean - 2 * sd)} – ${deps.fmtTestValue(t, mean + 2 * sd)}` : '—', tooltip = `Mean ${Number.isFinite(mean) ? deps.fmtTestValue(t, mean) : '—'} · SD ${Number.isFinite(sd) ? deps.fmtTestStat(t, sd) : '—'} · ±2SD ${limits}`;
      return { level: x.level, lot: x.lot || '', parallel: x.parallel, tooltip };
    }));
    const sheetCalendar = deps.EntryService.buildSheetCalendar(ui().entrySheetMonth, deps.isoToday()), activeSheetMonth = sheetCalendar.activeMonth;
    ui().entrySheetMonth = activeSheetMonth;
    const sheetYear = sheetCalendar.year, sheetMonthNo = sheetCalendar.month, sheetStart = sheetCalendar.start, sheetEnd = sheetCalendar.end;
    const sheetMonthOptions = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${sheetMonthNo === i + 1 ? 'selected' : ''}>Tháng ${i + 1}</option>`).join('');
    const sheetYearOptions = Array.from({ length: sheetCalendar.yearMax - sheetCalendar.yearMin + 1 }, (_, i) => sheetCalendar.yearMin + i).map((y: number) => `<option value="${y}" ${sheetYear === y ? 'selected' : ''}>${y}</option>`).join('');
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
      // Kết luận của NGÀY chỉ tính trên các lô đang vận hành: lô đang đánh giá song
      // song không được phép làm ngày đó thành "loại bỏ" cho kết quả bệnh nhân.
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
        const levelRunNos = levelRuns(x).map((r: AnyRec) => r.runNo), nextLevelRunNo = levelRunNos.length ? Math.max(...levelRunNos) + 1 : 1, lotArg = deps.jsq(x.parallel ? x.lot || '' : '');
        const runInputs = dayGroup.runs.map((g: AnyRec) => {
          const p = g.levels[x.key], runArg = deps.jsq(g.runId || '');
          if (!p) {
            if (!shouldShowEmptyRun(x, g)) return '';
            emptyShown = true;
            return deps.pres.entrySheetEmptyRunHtml({ editable: deps.canWrite(), title: 'Dùng phím mũi tên để chuyển ô', ariaLabel: `Nhập QC ngày ${deps.vnDate(g.date)}, mức ${x.level}, lô ${deps.escapeAttr(x.lot || '')}, lần ${g.runNo}`, date: deps.escapeAttr(g.date), runNo: g.runNo, levelIndex: levelIdx, changeAction: `entryInlineSave('${t.id}',${x.level},'${g.date}',this.value,'${runArg}','${lotArg}')` });
          }
          levelHasPoint = true;
          const isPrev = !!p._prevLot, pMean = isPrev && Number.isFinite(+p.qcMean) ? +p.qcMean : x.mean, pSd = isPrev && Number.isFinite(+p.qcSd) ? +p.qcSd : x.sd;
          const verdict = isPrev ? { level: 'ok', rules: [] } : colVerdict(x, p), view = deps.EntryService.buildPointView({ point: p, verdict, mean: pMean, sd: pSd, previousLot: isPrev ? p._prevLot : undefined }), lv = deps.qcVerdictLabel(view.level);
          return deps.pres.entrySheetSavedRunHtml({ previousLot: isPrev, previousLotName: deps.esc(p._prevLot || ''), valueClass: view.valueClass, title: isPrev ? 'Lô cũ ' + deps.escapeAttr(p._prevLot) + ' · đã chuyển tiếp · chỉ đọc' : 'Đã lưu, không sửa trực tiếp', valueText: deps.fmtPointValue(p, t), zText: `${view.z >= 0 ? '+' : ''}${deps.fmt(view.z)}s`, verdictText: lv });
        }).join('');
        const addRunBtn = deps.pres.entrySheetAddRunHtml({ visible: deps.canWrite() && levelHasPoint && !emptyShown, action: `entryUnlockExtraRun('${t.id}','${deps.jsq(x.key)}','${dayGroup.date}',${levelIdx},${nextLevelRunNo})` });
        return deps.pres.entrySheetCellHtml({ parallel: x.parallel, hasAddButton: !!addRunBtn, runInputsHtml: runInputs, addRunButtonHtml: addRunBtn });
      }).join('');
      const staff = [...new Map(dayGroup.runs.flatMap((g: AnyRec) => Object.values(g.levels)).map((p: AnyRec) => deps.pointStaff(p)).filter((x: AnyRec) => x.code).map((x: AnyRec) => [x.code, x])).values()];
      const staffCell = deps.pres.entrySheetDaySummaryHtml.staff(staff);
      const status = deps.pres.entrySheetDaySummaryHtml.status(hasPoint, worst);
      const autoNote = rulesAll.length ? (worst === 'rej' ? deps.errorType([...new Set(rejRules.length ? rejRules : rulesAll)] as string[]) : 'Theo dõi / cảnh báo') : '';
      const datePoints = dayGroup.runs.flatMap((g: AnyRec) => Object.values(g.levels)).filter(Boolean);
      const manualNote = ((datePoints.find((p: AnyRec) => String(p.note || '').trim())) || ({} as AnyRec)).note || '';
      const note = deps.pres.entrySheetNoteHtml({ hasPoint, writable: deps.canWrite(), placeholder: deps.escapeAttr(autoNote || 'Nhập ghi chú...'), changeAction: `entryDateNoteSave('${t.id}','${dayGroup.date}',this.value)`, manualNote: deps.esc(manualNote), autoNote });
      const liveCols = entryCols.filter((x: AnyRec) => !x.parallel), doneLevels = liveCols.filter((x: AnyRec) => dayGroup.runs.some((g: AnyRec) => g.levels[x.key])).length, rowCls = [dayGroup.date === today ? 'today' : '', dayGroup.date <= today && doneLevels < liveCols.length ? 'missing' : '', hasPoint ? 'has-data' : ''].filter(Boolean).join(' ');
      return deps.pres.entrySheetDayRowHtml({ rowClass: rowCls, date: dayGroup.date, dayOfMonth: deps.dateObj(dayGroup.date).getDate(), today: dayGroup.date === today, cellsHtml: cells, staffHtml: staffCell, warningRules: [...new Set(warnRules)].join(', '), rejectRules: [...new Set(rejRules)].join(', '), statusHtml: status, noteHtml: note });
    }).join('');
    const worksheet = deps.pres.entryWorksheetHtml({ testName: deps.esc(deps.testDisplayName(t)), lotLabel: deps.esc(deps.pres.entryLotLabelsTs(entryCols)), monthOptionsHtml: sheetMonthOptions, yearOptionsHtml: sheetYearOptions, currentMonthButtonHtml: deps.btn('Tháng hiện tại', 'entrySetSheetMonth(isoMonth())', 'ghost sm qc-current-month'), todayButtonHtml: deps.btn('Tới hôm nay', 'entryGoToday()', 'teal sm qc-today-jump'), levelHeadHtml: levelHead, rowsHtml: sheetRows, columnCount: entryCols.length, messageHtml: ui().entryLastMsg });
    const right = `${worksheet}${deps.pres.entryLeveyPanelHtml({ startDateHtml: deps.dateBox('entryStartDate', W.start, '', 'onchange="entrySetStart(this.value)"'), endDateHtml: deps.dateBox('entryEndDate', W.end, '', 'onchange="entrySetEnd(this.value)"'), dayButtonsHtml: dayBtns, rangeText: `${deps.vnDate(W.start)} – ${deps.vnDate(W.end)} · ${deps.operationalLevels(t).length} mức QC`, stackHtml: ljStack })}${pointsInView}${rangeBox}`;
    ui().entryPartialRenderCache = { testId: t.id, right };
    if (rightOnly) return right;
    return deps.pres.entryPageLayoutHtml({ pageHeadHtml: deps.headOnly('Nhập QC', 'Ghi nhận kết quả theo ngày, mức QC và lô đang vận hành'), treeCollapsed, expandButtonHtml: deps.btn(treePanelIcon, 'toggleEntryTree()', 'teal icon entry-tree-expand', 'Hiện danh mục nội kiểm', { attrs: { 'aria-label': 'Hiện danh mục nội kiểm', 'aria-controls': 'entryTreePanel', 'aria-expanded': 'false' } }), treeHeadHtml: treeHead, treeHtml: tree, rightHtml: right });
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
  const entryTreeKey = (event: AnyRec) => {
    const item = event.currentTarget, key = event.key;
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
  const entrySheetKey = (event: AnyRec) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const supported = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!supported.includes(event.key)) return;
    const cur = event.currentTarget, next = entrySheetTarget(entrySheetInputs(), cur, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    ui().entryPendingSheetFocus = `${next.dataset.focusDate}|${next.dataset.focusLevel}`;
    cur.blur();
    setTimeout(entryFocusPendingSheet, 0);
  };
  const entryLatestTreeState = (t: AnyRec) => deps.pres.entryTreeState(t);
  const entrySyncTreeState = (testId: unknown) => {
    const row = [...doc().querySelectorAll('.tree .tn-config[data-test-id]')].find((el: AnyRec) => el.dataset.testId === String(testId || ''));
    if (!row) return;
    const apply = (el: AnyRec, value: string) => {
      const badge = el && el.querySelector('.state');
      if (!badge) return;
      badge.className = 'state' + (value === 'none' ? '' : ' ' + value);
      badge.textContent = deps.stateName(value);
    };
    apply(row, entryLatestTreeState(state().tests.find((t: AnyRec) => t.id === testId)));
    let group = row.previousElementSibling;
    while (group && group.dataset.treeRole !== 'group') group = group.previousElementSibling;
    if (!group) return;
    const states: string[] = [];
    for (let item = group.nextElementSibling; item && item.dataset.treeRole === 'assay'; item = item.nextElementSibling) {
      const badge = item.querySelector('.state'), value = (badge && ['ok', 'warn', 'rej'].find((x: string) => badge.classList.contains(x))) || 'none';
      states.push(value);
    }
    const worst = deps.pres.entryTreeGroupState(states);
    apply(group, worst);
  };
  const entryRenderKeepScroll = () => {
    const w = win();
    const pageX = w.scrollX, pageY = w.scrollY, wrap = doc().querySelector('.qc-sheet-wrap'), sheetTop = wrap ? wrap.scrollTop : 0, sheetLeft = wrap ? wrap.scrollLeft : 0;
    const current = doc().querySelector('.entry-main');
    if (deps.currentPage() === 'entry' && current) {
      deps.analysisUi().statusMemo = new Map();
      pageEntry(true);
      const cache = ui().entryPartialRenderCache;
      if (cache && cache.testId === ui().entrySel.testId) {
        current.innerHTML = cache.right;
        entrySyncTreeState(ui().entrySel.testId);
        deps.afterRender(deps.currentPage());
      } else deps.rerender();
    } else deps.rerender();
    requestAnimationFrame(() => {
      w.scrollTo(pageX, pageY);
      const nextWrap = doc().querySelector('.qc-sheet-wrap');
      if (nextWrap) { nextWrap.scrollTop = sheetTop; nextWrap.scrollLeft = sheetLeft; }
      entryFocusPendingSheet();
    });
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
      deps.openModal(deps.pres.entryPreSaveWarningModalHtml({ issuesHtml: preIssues.map((x: string) => `<div class="alert warn">${deps.esc(x)}</div>`).join(''), cancelButtonHtml: deps.btn('Hủy', 'closeModal();entryRenderKeepScroll()', 'ghost'), saveButtonHtml: deps.btn('Vẫn lưu', `closeModal();entryInlineSaveCommit('${deps.jsq(tid)}',${level},'${deps.jsq(date)}',${val},'${deps.jsq(runId)}','${deps.jsq(lotNo)}',${valueDecimals})`, 'teal') }));
      return;
    }
    entryInlineSaveCommit(tid, level, date, val, runId, lotNo, valueDecimals);
  };
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
    deps.openModal(deps.pres.entryVoidModalHtml({ pointInfoHtml: `Ngày ${deps.vnDate(p.date)} · Mức ${p.level} · Giá trị ${deps.fmtPointValue(p, t)}`, closeButtonHtml: '<button class="modal-close" onclick="closeModal()">×</button>', closeFooterButtonHtml: deps.btn('Đóng', 'closeModal()', 'ghost'), confirmButtonHtml: deps.btn('Xác nhận hủy', `confirmVoidQcPoint('${tid}','${pointId}')`, 'danger') }));
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
    pageEntry, entryWindow, entryWindowFor, entryRowsWindow, entryToggleRows, entryDetailToggled, entryTreeIsCollapsed,
    treeToggle, toggleEntryTree, entryTreeKey, entryFilter, entryPick, entryFocusLevel, entryShowPrevLot, entryShowCurrentLot,
    entryFocusPendingSheet, entrySheetInputs, entrySheetTarget, entrySheetKey, entryLatestTreeState, entrySyncTreeState,
    entryRenderKeepScroll, entrySetLastMsg, entryUnlockExtraRun, entryDateNoteSave, entryColumnCfg, entryInlineSave,
    entryInlineSaveCommit, syncVoidNceChoice, voidQcPoint, confirmVoidQcPoint, entrySetSheetMonth, entryGoToday,
    entrySetSheetPart, entrySetDays, entrySetStart, entrySetEnd,
  };
}

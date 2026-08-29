type AnyRec = any;

const WG_TABLE_INITIAL_ROWS = 120;

export function createWestgardPageController(deps: {
  document: Document;
  getState: () => AnyRec;
  ui: () => AnyRec;
  rerender: () => void;
  ruleRegistry: () => AnyRec[];
  wgOn: (rule: string) => boolean;
  searchText: (value: unknown) => string;
  esc: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  vnDate: (value: unknown) => string;
  role: () => string;
  canWrite: () => boolean;
  fmtTestValue: (test: AnyRec, value: unknown) => string;
  operationalTests: () => AnyRec[];
  operationalTestOrder: (test: AnyRec) => number;
  levelsForLotGroup: (group: AnyRec) => AnyRec[];
  lotPointsByNo: (testId: string, level: number, lotNo: string) => AnyRec[];
  testDisplayName: (test: AnyRec) => string;
  instrumentName: (test: AnyRec) => string;
  activeWestgard: (test: AnyRec) => AnyRec;
  testSelectLabel: (test: AnyRec) => string;
  previousLotSeries: (test: AnyRec, level: number) => AnyRec[];
  levelTargetOk: (level: AnyRec) => boolean;
  testCusumConfig: (test: AnyRec) => AnyRec;
  scheduleSearchRender: (owner: AnyRec, apply: () => void, focusId?: string) => void;
  replaceSelectItems: (select: AnyRec, items: AnyRec[], emptyText?: string) => void;
  westgardViewModel: { buildPointRows: (input: AnyRec) => AnyRec };
  qcLotById: (id: string) => AnyRec;
  westgardMultiViews: (test: AnyRec, prevOpen: AnyRec) => AnyRec[];
  westgardUiState: AnyRec;
  westgardArchivedGroups: (groups: AnyRec[]) => AnyRec[];
  westgardCusumLevels: (test: AnyRec) => AnyRec[];
  westgardRowsWindow: (rows: AnyRec[], visibleCount: number, initial: number) => AnyRec;
  westgardArchivedMultiViews: (rows: AnyRec[], points: (t: AnyRec, level: AnyRec, lotNo: AnyRec) => AnyRec[]) => AnyRec[];
  westgardArchivedGroupMatches: (group: AnyRec, q: string, searchText: (v: AnyRec) => string, lotById: (id: AnyRec) => AnyRec) => boolean;
  westgardArchivedTestSelection: (entries: AnyRec[], q: string, selected: string, deps: AnyRec) => AnyRec;
  westgardTestSearch: { select: (tests: AnyRec[], q: string, selected: string) => AnyRec };
  /* Chỉ dùng bởi westgardModel() (trang React) — tách riêng khỏi các hàm dựng
     HTML cổ điển ở trên vì model trả DỮ LIỆU cho từng dòng điểm QC thay vì
     chuỗi HTML, dùng lại đúng các hàm thuần đã có (không tính lại logic mới). */
  qcVerdictLabel: (level: unknown) => string;
  errorTypeDetailParts: (rules: string[]) => { type: string; desc: string };
  fmt: (value: unknown, decimals?: number) => string;
  qcWestgardByPoint: (points: AnyRec[], mean: number, sd: number, ruleOnWithin: (rule: string) => boolean) => { F: AnyRec[]; zs: number[] };
  testRuleOnWithin: (test: AnyRec, rule: string) => boolean;
  ruleResultLevel: (test: AnyRec, rules: string[]) => string;
}) {
  const wgMultiViews = (t: AnyRec) => deps.westgardMultiViews(t, deps.ui().wgPrevOpen);
  const wgTogglePrevLot = (level: number) => { deps.ui().wgPrevOpen = deps.westgardUiState.toggleOpen(deps.ui().wgPrevOpen, deps.ui().selTest + '|' + level); deps.rerender(); };
  const wgArchivedGroups = () => deps.westgardArchivedGroups(deps.getState().lotGroups);
  const wgSetViewMode = (mode: string) => { deps.ui().wgViewMode = deps.westgardUiState.viewMode(mode); deps.rerender(); };
  const wgSetChartMode = (mode: string) => { deps.ui().wgChartMode = deps.westgardUiState.chartMode(mode); deps.rerender(); };
  const wgSetArchivedGroup = (id: string) => { const next = deps.westgardUiState.archivedGroup(id); deps.ui().wgArchivedGroupId = next.groupId; deps.ui().wgArchivedTestId = next.testId; deps.rerender(); };
  const wgSetArchivedTest = (id: string) => { if (!id) return; const next = deps.westgardUiState.archivedTest(id); deps.ui().wgArchivedTestId = next.testId; deps.rerender(); };
  const wgRowsWindow = (rows: AnyRec[], key: string) => deps.westgardRowsWindow(rows, deps.ui().wgVisibleRows.get(key) || WG_TABLE_INITIAL_ROWS, WG_TABLE_INITIAL_ROWS);
  const wgLoadMoreRows = (key: string, next: number) => { const ui = deps.ui(); if (next <= WG_TABLE_INITIAL_ROWS) ui.wgVisibleRows.delete(key); else ui.wgVisibleRows.set(key, next); deps.rerender(); };
  const wgArchivedMultiViews = (rows: AnyRec[]) => deps.westgardArchivedMultiViews(rows, (t: AnyRec, level: number, lotNo: string) => deps.lotPointsByNo(t.id, level, lotNo));
  const wgArchivedGroupMatches = (g: AnyRec, q: string) => deps.westgardArchivedGroupMatches(g, q, deps.searchText, (id: string) => deps.qcLotById(id));

  const wgFilterTests = (v: string) => {
    deps.ui().wgTestQ = deps.westgardUiState.query(v);
    deps.scheduleSearchRender(wgFilterTests, () => {
      const ui = deps.ui();
      const tests = deps.operationalTests(), result = deps.westgardTestSearch.select(tests, ui.wgTestQ, ui.selTest), matches = result.matches;
      if (result.changed) { ui.selTest = result.selected; deps.rerender(); return; }
      const select = deps.document.getElementById('wgTestSelect') as AnyRec, count = deps.document.getElementById('wgTestCount');
      deps.replaceSelectItems(select, matches.map((x: AnyRec) => ({ value: x.id, label: deps.testSelectLabel(x) })), 'Không tìm thấy xét nghiệm phù hợp');
      if (select && matches.some((x: AnyRec) => x.id === ui.selTest)) select.value = ui.selTest;
      if (count) count.textContent = `(${matches.length}/${tests.length})`;
    }, 'wgTestSearch');
  };

  const wgFilterArchivedTests = (v: string) => {
    deps.ui().wgArchivedTestQ = deps.westgardUiState.query(v);
    deps.scheduleSearchRender(wgFilterArchivedTests, () => { deps.rerender(); }, 'wgArchivedTestSearch');
  };

  /* westgardModel(): dữ liệu thuần cho trang React (src/react/pages/WestgardPage.tsx),
     đã thay thế hẳn pageWestgard()/pageWestgardArchived() (HTML cổ điển đã xoá
     sau khi qua kiểm chứng song song). Canvas Levey-Jennings/CUSUM KHÔNG có
     trong model này — chúng vẫn chỉ là thẻ <canvas> rỗng, y hệt HTML cổ điển,
     và afterRender() (rAF, quét theo class/dataset) vẽ trực tiếp vào đó sau
     khi React mount/rerender, giống cách sgRefresh()/rcCompute() vá DOM ở
     trang Sigma/Reagent. */
  const wgRowData = (test: AnyRec, raw: AnyRec[]) => raw.map((r: AnyRec) => {
    const error = r.rules.length ? deps.errorTypeDetailParts(r.rules) : null;
    const z = Number.isFinite(r.z) ? `${r.z >= 0 ? '+' : ''}${deps.fmt(r.z)}s` : '—';
    return {
      index: r.index, date: deps.vnDate(r.date), value: deps.fmtTestValue(test, r.value), z,
      verdictClass: r.level, verdictLabel: deps.qcVerdictLabel(r.level),
      rules: (r.rules || []) as string[], supportRules: (r.supportRules || []) as string[],
      errorType: error ? error.type : '—', errorDesc: error ? error.desc : '',
    };
  });
  const wgPointsBlock = (test: AnyRec, raw: AnyRec[], key: string) => {
    const view = wgRowsWindow(raw, key);
    const rowsControl = view.total <= WG_TABLE_INITIAL_ROWS ? null : (() => {
      const hasMore = view.visibleCount < view.total;
      const next = hasMore ? Math.min(view.visibleCount + WG_TABLE_INITIAL_ROWS, view.total) : WG_TABLE_INITIAL_ROWS;
      const label = hasMore ? `Tải thêm ${next - view.visibleCount} điểm` : `Thu gọn còn ${WG_TABLE_INITIAL_ROWS} điểm`;
      return { shownCount: view.rows.length, total: view.total, suffix: hasMore ? ' mới nhất' : '', label, next };
    })();
    return { key, rowsControl, rows: wgRowData(test, view.rows) };
  };
  const wgLotBlockModel = (test: AnyRec, level: number, lotNo: string, mean: number, sd: number, points: AnyRec[], badgeText: string, title: string, lotLabel: string) => {
    if (!points.length) return { kind: 'empty' as const, title, lotLabel, badgeText, meanText: deps.fmtTestValue(test, mean), sdText: deps.fmtTestValue(test, sd), pointCount: 0, emptyTitle: 'Chưa có dữ liệu', emptyMessage: 'Không tìm thấy điểm QC nào cho lô này.' };
    const wgP = deps.qcWestgardByPoint(points, mean, sd, (rule: string) => deps.testRuleOnWithin(test, rule));
    const raw = deps.westgardViewModel.buildPointRows({ points, verdicts: wgP.F.map((f: AnyRec) => ({ rules: f.rules, supportRules: f.supportRules, level: deps.ruleResultLevel(test, f.rules) })), zs: wgP.zs, mean, sd });
    const block = wgPointsBlock(test, raw, `lot:${test.id}|${level}|${lotNo}`);
    return { kind: 'points' as const, title, lotLabel, badgeText, meanText: deps.fmtTestValue(test, mean), sdText: deps.fmtTestValue(test, sd), pointCount: points.length, ...block };
  };

  const westgardCurrentModel = (tests: AnyRec[], archivedCount: number) => {
    const ui = deps.ui();
    if (!ui.selTest || !tests.find((x: AnyRec) => x.id === ui.selTest)) ui.selTest = tests[0].id;
    const t = tests.find((x: AnyRec) => x.id === ui.selTest);
    const q = deps.searchText(ui.wgTestQ), matched = tests.filter((x: AnyRec) => !q || deps.searchText(deps.testSelectLabel(x)).includes(q));
    const wg = deps.activeWestgard(t), levelViews = wg.views.map((v: AnyRec) => ({ l: v.l, pts: v.pts, cfg: { mean: v.l.mean, sd: v.l.sd }, single: v.single }));
    const showMultiChart = wgMultiViews(t).length >= 2;
    const levels = levelViews.map((v: AnyRec) => {
      const { l, pts, cfg } = v;
      const prevSeries = deps.previousLotSeries(t, l.level), hasPrev = prevSeries.length > 0, prevOpen = ui.wgPrevOpen.has(t.id + '|' + l.level);
      const prevToggle = hasPrev ? { label: prevOpen ? 'Xem lô mới' : 'Xem lô cũ', level: l.level } : null;
      if (prevOpen && hasPrev) {
        const s = prevSeries[0];
        return { level: l.level, prevToggle, ...wgLotBlockModel(t, l.level, s.lot, s.mean, s.sd, s.pts, 'Đã chuyển tiếp', `Mức ${l.level}`, `Lô cũ ${s.lot}`) };
      }
      const base = { level: l.level, lotLabel: `Lô ${l.lot || '?'}`, prevToggle, meanText: deps.fmtTestValue(t, cfg.mean), sdText: deps.fmtTestValue(t, cfg.sd), pointCount: pts.length };
      if (!pts.length) return { ...base, kind: 'empty' as const, emptyTitle: 'Chưa có dữ liệu', emptyMessage: 'LOT đang dùng chưa có điểm QC. Bạn có thể chọn LOT cũ hoặc nhập điểm mới.', emptyActionArgs: [t.id, l.level] };
      const { zs } = v.single, key = `current:${t.id}|${l.level}|${l.lot || ''}`;
      const raw = deps.westgardViewModel.buildPointRows({ points: pts, verdicts: wg.byPoint, zs, mean: cfg.mean, sd: cfg.sd });
      const targetOk = deps.levelTargetOk(l);
      if (!targetOk) raw.forEach((r: AnyRec) => { r.level = 'none'; r.rules = []; r.supportRules = []; });
      return { ...base, kind: 'points' as const, targetOk, ...wgPointsBlock(t, raw, key) };
    });
    const cusumCfg = deps.testCusumConfig(t), cusumLevels = deps.westgardCusumLevels(t);
    return {
      query: ui.wgTestQ, tests: matched.map((x: AnyRec) => ({ id: x.id, label: deps.testSelectLabel(x) })), totalCount: tests.length, matchedCount: matched.length,
      selectedTestId: t.id, chartMode: ui.wgChartMode as string,
      ruleRegistry: deps.ruleRegistry().map((r: AnyRec) => ({ id: r.id, on: deps.wgOn(r.id) })),
      showMultiChart, multiChartTestId: t.id, levels,
      cusum: { on: !!cusumCfg.on, testId: t.id, k: cusumCfg.k, h: cusumCfg.h, levels: cusumLevels.map((l: AnyRec) => ({ level: l.level, lot: l.lot, meanText: deps.fmtTestValue(t, l.mean), sdText: deps.fmtTestValue(t, l.sd), pointCount: (l.pts || []).length })) },
    };
  };

  const westgardArchivedModel = (archivedGroups: AnyRec[]) => {
    const ui = deps.ui();
    const q = deps.searchText(ui.wgArchivedTestQ);
    const matchedGroups = archivedGroups.filter((g: AnyRec) => wgArchivedGroupMatches(g, q));
    const groupList = matchedGroups.length ? matchedGroups : archivedGroups;
    if (matchedGroups.length && !matchedGroups.some((g: AnyRec) => g.id === ui.wgArchivedGroupId)) { ui.wgArchivedGroupId = matchedGroups[0].id; ui.wgArchivedTestId = ''; }
    else if (!ui.wgArchivedGroupId || !archivedGroups.some((g: AnyRec) => g.id === ui.wgArchivedGroupId)) ui.wgArchivedGroupId = archivedGroups[0].id;
    const group = archivedGroups.find((g: AnyRec) => g.id === ui.wgArchivedGroupId);
    const groups = groupList.map((g: AnyRec) => ({ id: g.id, label: `${g.name}${g.active === false ? ' · đã lưu trữ' : ' · đã dừng'}${g.stoppedAt ? ' ' + deps.vnDate(g.stoppedAt) : ''}` }));
    const badgeText = group.active === false ? 'Đã lưu trữ' : 'Đã dừng';
    const rows = deps.levelsForLotGroup(group);
    const byTest = new Map<string, AnyRec>();
    rows.forEach((r: AnyRec) => { if (!byTest.has(r.t.id)) byTest.set(r.t.id, { t: r.t, rows: [] }); byTest.get(r.t.id).rows.push(r); });
    const testEntries = [...byTest.values()].sort((a, b) => deps.operationalTestOrder(a.t) - deps.operationalTestOrder(b.t) || String(a.t.name || '').localeCompare(String(b.t.name || ''), 'vi'));
    const groupQuery = ui.wgArchivedTestQ;
    if (!testEntries.length) return { groups, selectedGroupId: group.id, query: groupQuery, empty: true as const, tests: [] as AnyRec[], selectedTestId: '' };
    const selection = deps.westgardArchivedTestSelection(testEntries, q, ui.wgArchivedTestId, { searchText: deps.searchText, testDisplayName: deps.testDisplayName, instrumentName: deps.instrumentName });
    const matchedTests = selection.matched;
    const testList = selection ? selection.list : (matchedTests.length ? matchedTests : testEntries);
    ui.wgArchivedTestId = selection.selected;
    const entry = selection.entry;
    const sortedRows = entry.rows.slice().sort((a: AnyRec, b: AnyRec) => a.l.level - b.l.level);
    const showMultiChart = sortedRows.length >= 2;
    const blocks = sortedRows.map(({ t, l, lot, mean, sd }: AnyRec) => ({ level: l.level, ...wgLotBlockModel(t, l.level, lot.lotNo, mean, sd, deps.lotPointsByNo(t.id, l.level, lot.lotNo), badgeText, `Mức ${l.level}`, `Lô ${lot.lotNo}`) }));
    return {
      groups, selectedGroupId: group.id, query: groupQuery, empty: false as const,
      tests: testList.map((e: AnyRec) => ({ id: e.t.id, label: deps.testDisplayName(e.t) })), totalCount: testEntries.length, selectedTestId: entry.t.id,
      badgeText, showMultiChart, multiChartGroupId: group.id, multiChartTestId: entry.t.id, blocks,
    };
  };

  const westgardModel = (): AnyRec => {
    const ui = deps.ui();
    const tests = deps.operationalTests(), archivedGroups = wgArchivedGroups();
    const isAdmin = deps.role() === 'admin';
    if (!tests.length && !archivedGroups.length) return { empty: true, isAdmin };
    if (ui.wgViewMode === 'archived' && !archivedGroups.length) ui.wgViewMode = 'current';
    if (ui.wgViewMode === 'current' && !tests.length && archivedGroups.length) ui.wgViewMode = 'archived';
    const viewMode = ui.wgViewMode === 'archived' ? 'archived' : 'current';
    return {
      empty: false, isAdmin, canWrite: deps.canWrite(), viewMode, archivedCount: archivedGroups.length,
      current: viewMode === 'current' ? westgardCurrentModel(tests, archivedGroups.length) : null,
      archived: viewMode === 'archived' ? westgardArchivedModel(archivedGroups) : null,
    };
  };

  return { wgMultiViews, wgTogglePrevLot, wgArchivedGroups, wgSetViewMode, wgSetChartMode, wgSetArchivedGroup, wgSetArchivedTest, wgRowsWindow, wgLoadMoreRows, wgArchivedMultiViews, wgArchivedGroupMatches, wgFilterTests, wgFilterArchivedTests, westgardModel };
}

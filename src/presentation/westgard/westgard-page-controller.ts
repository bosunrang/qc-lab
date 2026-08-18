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
  headOnly: (title: string, subtitle: string, actions?: string) => string;
  emptyState: (title: string, body: string, actions?: string) => string;
  button: (label: string, action: string, cls?: string, title?: string, options?: AnyRec) => string;
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
  westgardModeTabs: { chart: (mode: string) => string; view: (mode: string, count: number) => string };
  westgardCusumLevels: (test: AnyRec) => AnyRec[];
  westgardCusumPageHtml: (input: AnyRec) => string;
  westgardRowsWindow: (rows: AnyRec[], expanded: boolean, initial: number) => AnyRec;
  westgardRowsControl: (view: AnyRec, key: string, initial: number) => string;
  westgardLotBlockHtml: (input: AnyRec) => string;
  westgardArchivedMultiViews: (rows: AnyRec[], points: (t: AnyRec, level: AnyRec, lotNo: AnyRec) => AnyRec[]) => AnyRec[];
  westgardArchivedGroupMatches: (group: AnyRec, q: string, searchText: (v: AnyRec) => string, lotById: (id: AnyRec) => AnyRec) => boolean;
  westgardArchivedTestSelection: (entries: AnyRec[], q: string, selected: string, deps: AnyRec) => AnyRec;
  westgardPointRowsHtml: (rows: AnyRec[], test: AnyRec) => string;
  westgardRuleTogglesHtml: (registry: AnyRec[], wgOn: (rule: string) => boolean, canWrite: boolean) => string;
  westgardExportActionsHtml: (chartMode: string) => string;
  westgardRuleGuideHtml: (registry: AnyRec[]) => string;
  westgardTestSearch: { select: (tests: AnyRec[], q: string, selected: string) => AnyRec };
}) {
  const wgMultiViews = (t: AnyRec) => deps.westgardMultiViews(t, deps.ui().wgPrevOpen);
  const wgTogglePrevLot = (level: number) => { deps.ui().wgPrevOpen = deps.westgardUiState.toggleOpen(deps.ui().wgPrevOpen, deps.ui().selTest + '|' + level); deps.rerender(); };
  const wgArchivedGroups = () => deps.westgardArchivedGroups(deps.getState().lotGroups);
  const wgSetViewMode = (mode: string) => { deps.ui().wgViewMode = deps.westgardUiState.viewMode(mode); deps.rerender(); };
  const wgSetChartMode = (mode: string) => { deps.ui().wgChartMode = deps.westgardUiState.chartMode(mode); deps.rerender(); };
  const wgChartModeTabs = () => deps.westgardModeTabs.chart(deps.ui().wgChartMode);
  const pageWestgardCusum = (t: AnyRec) => { const cfg = deps.testCusumConfig(t), levels = deps.westgardCusumLevels(t); return deps.westgardCusumPageHtml({ test: t, cfg, levels, canWrite: deps.canWrite() }); };
  const wgSetArchivedGroup = (id: string) => { const next = deps.westgardUiState.archivedGroup(id); deps.ui().wgArchivedGroupId = next.groupId; deps.ui().wgArchivedTestId = next.testId; deps.rerender(); };
  const wgSetArchivedTest = (id: string) => { const next = deps.westgardUiState.archivedTest(id); deps.ui().wgArchivedTestId = next.testId; deps.rerender(); };
  const wgViewModeTabs = (archivedGroups: AnyRec[]) => deps.westgardModeTabs.view(deps.ui().wgViewMode, archivedGroups.length);
  const wgRowsWindow = (rows: AnyRec[], key: string) => deps.westgardRowsWindow(rows, deps.ui().wgExpandedRows.has(key), WG_TABLE_INITIAL_ROWS);
  const wgToggleRows = (key: string) => { deps.ui().wgExpandedRows = deps.westgardUiState.toggleOpen(deps.ui().wgExpandedRows, key); deps.rerender(); };
  const wgRowsControl = (view: AnyRec, key: string) => deps.westgardRowsControl(view, key, WG_TABLE_INITIAL_ROWS);
  const wgLotBlock = (t: AnyRec, level: number, lotNo: string, mean: number, sd: number, pts: AnyRec[], badge: string, titleMain: string, lotLabel: string, extraMeta = '') =>
    deps.westgardLotBlockHtml({ test: t, level, lotNo, mean, sd, points: pts, badge, title: titleMain, lotLabel, extraMeta });
  const wgArchivedMultiViews = (rows: AnyRec[]) => deps.westgardArchivedMultiViews(rows, (t: AnyRec, level: number, lotNo: string) => deps.lotPointsByNo(t.id, level, lotNo));
  const wgArchivedGroupMatches = (g: AnyRec, q: string) => deps.westgardArchivedGroupMatches(g, q, deps.searchText, (id: string) => deps.qcLotById(id));

  const pageWestgardArchived = (archivedGroups: AnyRec[]) => {
    const ui = deps.ui();
    const q = deps.searchText(ui.wgArchivedTestQ);
    const matchedGroups = archivedGroups.filter((g: AnyRec) => wgArchivedGroupMatches(g, q));
    const groupList = matchedGroups.length ? matchedGroups : archivedGroups;
    if (matchedGroups.length && !matchedGroups.some((g: AnyRec) => g.id === ui.wgArchivedGroupId)) { ui.wgArchivedGroupId = matchedGroups[0].id; ui.wgArchivedTestId = ''; }
    else if (!ui.wgArchivedGroupId || !archivedGroups.some((g: AnyRec) => g.id === ui.wgArchivedGroupId)) ui.wgArchivedGroupId = archivedGroups[0].id;
    const group = archivedGroups.find((g: AnyRec) => g.id === ui.wgArchivedGroupId);
    const groupOpts = groupList.map((g: AnyRec) => `<option value="${g.id}" ${g.id === ui.wgArchivedGroupId ? 'selected' : ''}>${deps.esc(g.name)}${g.active === false ? ' · đã lưu trữ' : ' · đã dừng'}${g.stoppedAt ? ' ' + deps.vnDate(g.stoppedAt) : ''}</option>`).join('');
    const badge = group.active === false ? 'Đã lưu trữ' : 'Đã dừng';
    const groupPicker = `<div><label>Nhóm lô đã dừng/lưu trữ <span class="hint">(${groupList.length}/${archivedGroups.length})</span></label><select onchange="wgSetArchivedGroup(this.value)">${groupOpts}</select></div>`;
    const searchBox = `<div><label>Tìm nhanh</label><input id="wgArchivedTestSearch" type="search" placeholder="Tên xét nghiệm, máy hoặc số lô..." value="${deps.escapeAttr(ui.wgArchivedTestQ)}" oninput="wgFilterArchivedTests(this.value)"></div>`;
    const rows = deps.levelsForLotGroup(group);
    const byTest = new Map<string, AnyRec>();
    rows.forEach((r: AnyRec) => { if (!byTest.has(r.t.id)) byTest.set(r.t.id, { t: r.t, rows: [] }); byTest.get(r.t.id).rows.push(r); });
    const testEntries = [...byTest.values()].sort((a, b) => deps.operationalTestOrder(a.t) - deps.operationalTestOrder(b.t) || String(a.t.name || '').localeCompare(String(b.t.name || ''), 'vi'));
    if (!testEntries.length) return deps.headOnly('Phân tích Westgard', 'Xem lại Westgard theo nhóm lô đã dừng/lưu trữ') +
      `<div class="panel"><h2 class="panel-title">Thiết lập phân tích</h2>${wgViewModeTabs(archivedGroups)}<div class="wg-test-picker">${searchBox}${groupPicker}</div></div>
     <div class="panel">${deps.emptyState('Không tìm thấy xét nghiệm nào', 'Nhóm lô này không gắn với xét nghiệm/mức nào có Mean/SD hợp lệ.')}</div>`;
    const archiveTestSelection = deps.westgardArchivedTestSelection(testEntries, q, ui.wgArchivedTestId, { searchText: deps.searchText, testDisplayName: deps.testDisplayName, instrumentName: deps.instrumentName });
    const matchedTests = archiveTestSelection.matched;
    const testList = archiveTestSelection ? archiveTestSelection.list : (matchedTests.length ? matchedTests : testEntries);
    ui.wgArchivedTestId = archiveTestSelection.selected;
    const testOpts = testList.map((e: AnyRec) => `<option value="${e.t.id}" ${e.t.id === ui.wgArchivedTestId ? 'selected' : ''}>${deps.esc(deps.testDisplayName(e.t))}</option>`).join('');
    const testPicker = `<div><label>Chọn xét nghiệm <span class="hint">(${testList.length}/${testEntries.length})</span></label><select onchange="if(this.value){wgSetArchivedTest(this.value)}">${testOpts}</select></div>`;
    const entry = archiveTestSelection.entry;
    const sortedRows = entry.rows.slice().sort((a: AnyRec, b: AnyRec) => a.l.level - b.l.level);
    const multiChart = sortedRows.length >= 2 ? `<div class="panel"><h2 class="panel-title">Levey-Jennings tổng hợp</h2>
    <div class="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm.</div>
    <div class="chart-scroll" tabindex="0"><canvas class="wgLJMultiArchived" data-group="${group.id}" data-test="${entry.t.id}" width="1400" height="430"></canvas></div></div>` : '';
    const blocks = sortedRows.map(({ t, l, lot, mean, sd }: AnyRec) => wgLotBlock(t, l.level, lot.lotNo, mean, sd, deps.lotPointsByNo(t.id, l.level, lot.lotNo), badge, `Mức ${l.level}`, `Lô ${deps.esc(lot.lotNo)}`)).join('');
    return deps.headOnly('Phân tích Westgard', 'Xem lại Westgard theo nhóm lô đã dừng/lưu trữ') +
     `<div class="panel"><h2 class="panel-title">Thiết lập phân tích</h2>${wgViewModeTabs(archivedGroups)}
     <div class="wg-test-picker wg-test-picker-3">${searchBox}${testPicker}${groupPicker}</div>
     <div class="hint flow-item">Đánh giá dưới đây dùng bộ luật Westgard đang bật hiện nay, không phải cấu hình luật tại thời điểm nhóm lô này còn hoạt động.</div></div>${multiChart}${blocks}`;
  };

  const pageWestgard = () => {
    const ui = deps.ui();
    const tests = deps.operationalTests(), archivedGroups = wgArchivedGroups();
    if (!tests.length && !archivedGroups.length) return deps.headOnly('Phân tích Westgard', '') + `<div class="panel">${deps.emptyState('Chưa có xét nghiệm đang vận hành', 'Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi phân tích Westgard.', deps.role() === 'admin' ? deps.button('Cấu hình Mean/SD', `go('manage');setManageTab('targets')`, 'teal') : '')}</div>`;
    if (ui.wgViewMode === 'archived' && !archivedGroups.length) ui.wgViewMode = 'current';
    if (ui.wgViewMode === 'current' && !tests.length && archivedGroups.length) ui.wgViewMode = 'archived';
    if (ui.wgViewMode === 'archived') return pageWestgardArchived(archivedGroups);
    if (!ui.selTest || !tests.find((t: AnyRec) => t.id === ui.selTest)) ui.selTest = tests[0].id;
    const t = tests.find((t: AnyRec) => t.id === ui.selTest);
    const q = deps.searchText(ui.wgTestQ), matched = tests.filter((x: AnyRec) => !q || deps.searchText(deps.testSelectLabel(x)).includes(q)), opts = matched.length ? matched.map((x: AnyRec) => `<option value="${x.id}" ${x.id === ui.selTest ? 'selected' : ''}>${deps.esc(deps.testSelectLabel(x))}</option>`).join('') : '<option value="">Không tìm thấy xét nghiệm phù hợp</option>';
    const wg = deps.activeWestgard(t), levelViews = wg.views.map((v: AnyRec) => ({ l: v.l, pts: v.pts, cfg: { mean: v.l.mean, sd: v.l.sd }, single: v.single, lotPicker: `<span class="wg-lot-name">Lô ${deps.esc(v.l.lot || '?')}</span>` }));
    const multiChart = wgMultiViews(t).length >= 2 ? `<div class="panel"><h2 class="panel-title">Levey-Jennings tổng hợp</h2>
    <div class="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm. Bật "Xem lô cũ" ở mức tương ứng để thêm đường của lô đã chuyển tiếp.</div>
    <div class="chart-scroll" tabindex="0"><canvas class="wgLJMulti" data-test="${t.id}" width="1400" height="430"></canvas></div></div>` : '';
    const blocks = levelViews.map((v: AnyRec) => {
      const { l, pts, cfg, lotPicker } = v;
      const prevSeries = deps.previousLotSeries(t, l.level), hasPrev = prevSeries.length > 0, prevOpen = ui.wgPrevOpen.has(t.id + '|' + l.level);
      const prevBtn = hasPrev ? deps.button(prevOpen ? 'Xem lô mới' : 'Xem lô cũ', `wgTogglePrevLot(${l.level})`, 'ghost sm wg-prev-toggle') : '';
      if (prevOpen && hasPrev) { const s = prevSeries[0]; return wgLotBlock(t, l.level, s.lot, s.mean, s.sd, s.pts, 'Đã chuyển tiếp', `Mức ${l.level}`, `Lô cũ ${deps.esc(s.lot)}`, prevBtn); }
      const title = `<h3><span class="wg-level-title"><span>Mức ${l.level}</span>${lotPicker}</span><span class="wg-level-meta"><span>Mean ${deps.fmtTestValue(t, cfg.mean)}</span><span>SD ${deps.fmtTestValue(t, cfg.sd)}</span><span>${pts.length} điểm</span>${prevBtn}</span></h3>`;
      if (!pts.length) return `<div class="panel">${title}${deps.emptyState('Chưa có dữ liệu', 'LOT đang dùng chưa có điểm QC. Bạn có thể chọn LOT cũ hoặc nhập điểm mới.', deps.button('Nhập QC', `entrySel={testId:'${t.id}',level:${l.level}};entryStart=null;entryEnd=null;go('entry')`, 'teal'))}</div>`;
      const { zs } = v.single, rows = deps.westgardViewModel.buildPointRows({ points: pts, verdicts: wg.byPoint, zs, mean: cfg.mean, sd: cfg.sd }), key = `current:${t.id}|${l.level}|${l.lot || ''}`, view = wgRowsWindow(rows, key);
      const targetOk = deps.levelTargetOk(l), targetWarn = targetOk ? '' : `<div class="alert warn wg-target-warning">Mức này <b>chưa có Mean/SD hợp lệ</b> — các điểm QC không được đánh giá Westgard; bảng dưới chỉ liệt kê giá trị, không có kết luận Đạt/Cảnh báo/Loại bỏ. ${deps.role() === 'admin' ? deps.button('Cấu hình Mean/SD', `go('manage');setManageTab('targets')`, 'teal sm') : ''}</div>`;
      if (!targetOk) view.rows.forEach((r: AnyRec) => { r.level = 'none'; r.rules = []; r.supportRules = []; });
      const rowsHtml = deps.westgardPointRowsHtml(view.rows, t);
      return `<div class="panel">${title}${targetWarn}${wgRowsControl(view, key)}<table class="wg-table"><thead><tr><th>#</th><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
    }).join('');
    const ruleToggles = deps.westgardRuleTogglesHtml(deps.ruleRegistry(), deps.wgOn, deps.canWrite());
    const exportActions = deps.westgardExportActionsHtml(ui.wgChartMode);
    return deps.headOnly('Phân tích Westgard', 'Đối chiếu luật theo mức QC, lô và lần chạy') +
     `<div class="panel"><h2 class="panel-title">Thiết lập phân tích</h2>${wgViewModeTabs(archivedGroups)}<div class="wg-test-picker${exportActions ? ' wg-test-picker-3' : ''}"><div><label>Tìm nhanh</label><input id="wgTestSearch" type="search" placeholder="Tên xét nghiệm, LOT hoặc máy..." value="${deps.escapeAttr(ui.wgTestQ)}" oninput="wgFilterTests(this.value)"></div><div><label>Chọn xét nghiệm <span id="wgTestCount" class="hint">(${matched.length}/${tests.length})</span></label><select id="wgTestSelect" aria-label="Chọn xét nghiệm" ${matched.length ? '' : 'disabled'} onchange="if(this.value){selTest=this.value;rerender()}">${opts}</select></div>${exportActions}</div>
     <div class="wg-rules"><b style="font-size:var(--type-meta)">Cấu hình chung của luật</b><div class="flow-note">${ruleToggles}</div></div>
     ${deps.westgardRuleGuideHtml(deps.ruleRegistry())}${wgChartModeTabs()}</div>${ui.wgChartMode === 'cusum' ? pageWestgardCusum(t) : multiChart + blocks}`;
  };

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

  return { wgMultiViews, wgTogglePrevLot, wgArchivedGroups, wgSetViewMode, wgSetChartMode, wgChartModeTabs, pageWestgardCusum, wgSetArchivedGroup, wgSetArchivedTest, wgViewModeTabs, wgRowsWindow, wgToggleRows, wgRowsControl, wgLotBlock, wgArchivedMultiViews, wgArchivedGroupMatches, pageWestgardArchived, pageWestgard, wgFilterTests, wgFilterArchivedTests };
}

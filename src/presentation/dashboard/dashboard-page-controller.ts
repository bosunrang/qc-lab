type AnyRec = any;

export function createDashboardPageController(deps: {
  operationalTests: () => AnyRec[];
  isWestgardMemoized: (testId: string) => boolean;
  scheduleWestgardPrewarm: (tests: AnyRec[]) => boolean;
  isoToday: () => string;
  stateData: () => Record<string, AnyRec[]>;
  stateLab: () => AnyRec;
  stateActions: () => AnyRec[];
  stateTests: () => AnyRec[];
  role: () => string;
  vnDate: (iso: string) => string;
  levelsMissingTarget: (test: AnyRec) => AnyRec[];
  daysToExp: (value: unknown) => number | null;
  dashboardTestItems: (tests: AnyRec[], today: string) => AnyRec[];
  dashboardKpis: (items: AnyRec[], testCount: number) => AnyRec;
  dashboardMissingTargetItems: (items: AnyRec[], levelsMissingTarget: (test: AnyRec) => AnyRec[]) => AnyRec[];
  dashboardWestgardAlerts: (views: AnyRec[]) => { urgent: AnyRec[]; watch: AnyRec[] };
  dashboardExpiringLotItems: (items: AnyRec[], daysToExp: (value: unknown) => number | null) => AnyRec[];
  dashboardExpiringLots: (items: AnyRec[]) => Map<string, AnyRec>;
  dashboardQcFollowupListHtml: (items: AnyRec[], limit: number, kind: string) => string;
  dashboardOverdueActions: (actions: AnyRec[], today: string) => AnyRec[];
  dashboardOverdueActionListHtml: (items: AnyRec[], tests: AnyRec[]) => string;
  dashboardMissingTargetListHtml: (items: AnyRec[]) => string;
  dashboardFollowupPanelHtml: (urgent: string, overdue: string, missingTarget: string, watch: string) => string;
  dashboardExpiringLotsHtml: (values: IterableIterator<AnyRec>) => string;
  dashboardStatusTabsHtml: (items: AnyRec[], status: string) => string;
  dashboardStatusFilter: { matches: (item: AnyRec, status: unknown) => boolean; normalize: (value: unknown) => string };
  dashboardTestRowsHtml: (items: AnyRec[]) => string;
  dashboardTestListHtml: (visibleCount: number, rowsHtml: string) => string;
  dashboardShiftStatus: (input: AnyRec) => { mood: string; text: string };
  dashboardHeadHtml: (lab: AnyRec) => string;
  dashboardProgressHtml: (completeTests: number, testCount: number, percent: number) => string;
  dashboardKpisHtml: (items: AnyRec[]) => string;
  dashboardKpiItems: (input: AnyRec) => AnyRec[];
  dashboardTestPanelHtml: (input: AnyRec) => string;
  dashboardEmptyTestsHtml: (isAdmin: boolean) => string;
  dashboardPageHtml: (input: AnyRec) => string;
  dashboardLoadingPresentation: (tests: AnyRec[], pending: number, data: AnyRec, lab: AnyRec) => string;
  dashTestQ: () => string;
  dashTestStatus: () => string;
  setDashTestQ: (value: string) => void;
  setDashTestStatus: (value: string) => void;
  liveRowFilter: (selector: string, query: string, opts: { countId: string; emptyId: string }) => void;
  rerender: () => void;
}) {
  const pageDashLoading = (tests: AnyRec[], pending: number) => deps.dashboardLoadingPresentation(tests, pending, deps.stateData(), deps.stateLab());

  const pageDash = () => {
    const tests = deps.operationalTests(), missingWestgard = tests.filter(t => !deps.isWestgardMemoized(t.id));
    if (missingWestgard.length && deps.scheduleWestgardPrewarm(missingWestgard)) return pageDashLoading(tests, missingWestgard.length);
    const today = deps.isoToday();
    const dashItems = deps.dashboardTestItems(tests, today);
    const dashboardKpi = deps.dashboardKpis(dashItems, tests.length), { totalPoints: totalPts, todayPoints: todayPts, rejected: rej, warnings: warn, missingToday: missingTodayCount, completeTests: doneTests, completionPercent: pct } = dashboardKpi;
    const noTarget = deps.dashboardMissingTargetItems(dashItems, deps.levelsMissingTarget);
    const { urgent, watch } = deps.dashboardWestgardAlerts(dashItems.map(item => ({ test: item.t, alerts: item.alerts })));
    const exp = deps.dashboardExpiringLotItems(dashItems, deps.daysToExp);
    // Nhiều xét nghiệm có thể dùng chung 1 lô (VD panel điện giải) -> gộp theo
    // lô+mức, chỉ hiện 1 dòng/lô kèm số xét nghiệm dùng chung, thay vì lặp lại
    // dòng cảnh báo hết hạn cho từng xét nghiệm riêng lẻ.
    const expByLot = deps.dashboardExpiringLots(exp);
    const urgentHtml = deps.dashboardQcFollowupListHtml(urgent, 5, 'rej');
    const watchHtml = deps.dashboardQcFollowupListHtml(watch, 4, 'warn');
    // Hồ sơ NCE quá hạn: lọc thô theo dueDate trước rồi mới gọi actionOverdue() — hàm đó
    // phải chạy actionWorkflowStatus()/actionRerunStatus() nên chỉ đáng trả giá cho vài
    // hồ sơ thật sự đã qua hạn, không phải cho toàn bộ nhật ký ở mỗi lần vẽ dashboard.
    const overdue = deps.dashboardOverdueActions(deps.stateActions(), today);
    const overdueHtml = deps.dashboardOverdueActionListHtml(overdue, deps.stateTests());
    const noTargetHtml = deps.dashboardMissingTargetListHtml(noTarget);
    const followHtml = deps.dashboardFollowupPanelHtml(urgentHtml, overdueHtml, noTargetHtml, watchHtml);
    const expHtml = deps.dashboardExpiringLotsHtml(expByLot.values());
    const dashTestStatus = deps.dashTestStatus();
    const dashStatusTabs = deps.dashboardStatusTabsHtml(dashItems, dashTestStatus);
    const statusItems = dashItems.filter(item => deps.dashboardStatusFilter.matches(item, dashTestStatus));
    const testRows = deps.dashboardTestRowsHtml(statusItems);
    const testListHtml = deps.dashboardTestListHtml(statusItems.length, testRows);
    const done = todayPts;
    const shift = deps.dashboardShiftStatus({ rejected: rej, overdueActions: overdue.length, warnings: warn, missingToday: missingTodayCount }), mood = shift.mood, moodText = shift.text;
    const headHtml = deps.dashboardHeadHtml(deps.stateLab()), progressHtml = deps.dashboardProgressHtml(doneTests, tests.length, pct), kpisHtml = deps.dashboardKpisHtml(deps.dashboardKpiItems({ tests: tests.length, totalPoints: totalPts, rejected: rej, todayPoints: done })), testsPanelHtml = deps.dashboardTestPanelHtml({ testsCount: tests.length, statusTabs: dashStatusTabs, query: deps.dashTestQ(), filteredCount: statusItems.length, testListHtml, emptyHtml: deps.dashboardEmptyTestsHtml(deps.role() === 'admin') });
    return deps.dashboardPageHtml({ headHtml, todayText: deps.vnDate(today), mood, moodText, progressHtml, kpisHtml, followHtml, expiringLotsHtml: expHtml, testsPanelHtml });
  };

  const dashTestFilter = (value: string) => {
    deps.setDashTestQ(value);
    deps.liveRowFilter('.dash-test-list tbody tr', value, { countId: 'dashTestCount', emptyId: 'dashTestEmpty' });
  };

  const dashTestSetStatus = (value: string) => {
    deps.setDashTestStatus(deps.dashboardStatusFilter.normalize(value));
    deps.rerender();
  };

  return { pageDash, pageDashLoading, dashTestFilter, dashTestSetStatus };
}

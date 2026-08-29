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
  dashboardOverdueActions: (actions: AnyRec[], today: string) => AnyRec[];
  dashboardStatusFilter: { matches: (item: AnyRec, status: unknown) => boolean; normalize: (value: unknown) => string };
  dashboardShiftStatus: (input: AnyRec) => { mood: string; text: string };
  dashTestQ: () => string;
  dashTestStatus: () => string;
  setDashTestStatus: (value: string) => void;
  rerender: () => void;
}) {
  const dashTestSetStatus = (value: string) => {
    deps.setDashTestStatus(deps.dashboardStatusFilter.normalize(value));
    deps.rerender();
  };

  /* Mô hình dữ liệu thuần (không HTML) cho trang Tổng quan — dùng bởi
     src/react/pages/DashboardPage.tsx (xem docs/REACT-ADOPTION-PLAN.md). Đây
     là hàm duy nhất còn lại của controller này kể từ khi bản HTML cổ điển
     (pageDash/pageDashLoading) bị xoá sau bước kiểm chứng song song
     (scripts/react-migration-parity-check.js). */
  const dashboardModel = () => {
    const tests = deps.operationalTests(), missingWestgard = tests.filter(t => !deps.isWestgardMemoized(t.id));
    if (missingWestgard.length && deps.scheduleWestgardPrewarm(missingWestgard)) return { loading: true as const, tests, pending: missingWestgard.length, data: deps.stateData(), lab: deps.stateLab() };
    const today = deps.isoToday();
    const dashItems = deps.dashboardTestItems(tests, today);
    const kpi = deps.dashboardKpis(dashItems, tests.length);
    const noTarget = deps.dashboardMissingTargetItems(dashItems, deps.levelsMissingTarget);
    const { urgent, watch } = deps.dashboardWestgardAlerts(dashItems.map(item => ({ test: item.t, alerts: item.alerts })));
    const exp = deps.dashboardExpiringLotItems(dashItems, deps.daysToExp);
    const expByLot = deps.dashboardExpiringLots(exp);
    const overdue = deps.dashboardOverdueActions(deps.stateActions(), today);
    const dashTestStatus = deps.dashTestStatus();
    const statusItems = dashItems.filter(item => deps.dashboardStatusFilter.matches(item, dashTestStatus));
    const shift = deps.dashboardShiftStatus({ rejected: kpi.rejected, overdueActions: overdue.length, warnings: kpi.warnings, missingToday: kpi.missingToday });
    return {
      loading: false as const,
      today, todayText: deps.vnDate(today), tests, dashItems, kpi, noTarget, urgent, watch,
      expiringLots: [...expByLot.values()] as AnyRec[], overdue, dashTestStatus, statusItems,
      mood: shift.mood, moodText: shift.text, isAdmin: deps.role() === 'admin',
      lab: deps.stateLab(), stateTests: deps.stateTests(), query: deps.dashTestQ(),
    };
  };

  return { dashTestSetStatus, dashboardModel };
}

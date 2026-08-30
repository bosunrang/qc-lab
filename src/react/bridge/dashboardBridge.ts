import { getKernel } from '../state/kernel';

export type DashboardKpi = {
  totalPoints: number;
  todayPoints: number;
  rejected: number;
  warnings: number;
  missingToday: number;
  completeTests: number;
  completionPercent: number;
};

export type DashboardModel =
  | { loading: true; tests: any[]; pending: number; data: Record<string, any[]>; lab: any }
  | {
      loading: false;
      today: string;
      todayText: string;
      tests: any[];
      dashItems: any[];
      kpi: DashboardKpi;
      noTarget: any[];
      urgent: any[];
      watch: any[];
      expiringLots: any[];
      overdue: any[];
      dashTestStatus: string;
      statusItems: any[];
      mood: string;
      moodText: string;
      isAdmin: boolean;
      lab: any;
      stateTests: any[];
      query: string;
    };

export const dashboardModel = (): DashboardModel => getKernel().dash.dashboardModel();
export const dashboardHeadHtml = (lab: any): string => getKernel().pres.dashboardHeadHtml(lab);
export const testDisplayName = (test: any): string => getKernel().pres.testDisplayName(test);
export const vnDate = (value: unknown): string => getKernel().pres.vnDate(value);
export const fmtPointValue = (point: unknown, test: unknown): string => getKernel().pres.fmtPointValue(point, test);
export const fmt = (value: unknown): string => getKernel().pres.fmt(value);
export const dashTestSetStatus = (status: string) => getKernel().dash.dashTestSetStatus(status);
export const setDashTestQuery = (value: string) => { getKernel().pres.AnalysisUIState.dashTestQ = value; };
export const normalizeSearchText = (value: unknown): string => getKernel().pres.normalizeSearchText(value);
export const levelTargetOk = (level: any): boolean => getKernel().pres.levelTargetOk(level);
export const goManageTargets = (): void => getKernel().pres.goManageTargets();
export const dashboardGoEntryFollowup = (testId: string, level: number): void => getKernel().pres.dashboardGoEntryFollowup(testId, level);
export const dashboardContinueAction = (index: number): void => getKernel().pres.dashboardContinueAction(index);
export const dashViewTestInEntry = (testId: string, level: number): void => getKernel().pres.dashViewTestInEntry(testId, level);

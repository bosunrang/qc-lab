/* Cầu nối sang các global cổ điển (window.X) do modular-pilot.global.ts gán.
   Bundle React (assets/generated/react-pilot.js) và bundle cổ điển
   (assets/generated/modular-pilot.js) là hai IIFE tách biệt, chỉ chia sẻ được
   qua window — không import trực tiếp được như trong cùng cây src (dưới src/).
   Mọi truy cập ở đây PHẢI lười (đọc window.X lúc gọi hàm, không phải lúc module
   này được nạp), vì react-pilot.js chạy TRƯỚC modular-pilot.js theo thứ tự
   script trong index.html. */

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

const w = () => window as any;

export const dashboardModel = (): DashboardModel => w().dashboardModel();
export const dashboardHeadHtml = (lab: any): string => w().dashboardHeadHtml(lab);
export const testDisplayName = (test: any): string => w().testDisplayName(test);
export const vnDate = (value: unknown): string => w().vnDate(value);
export const fmtPointValue = (point: unknown, test: unknown): string => w().fmtPointValue(point, test);
export const fmt = (value: unknown): string => w().fmt(value);
export const dashTestSetStatus = (status: string) => w().dashTestSetStatus(status);
export const setDashTestQuery = (value: string) => { w().AnalysisUIState.dashTestQ = value; };
export const normalizeSearchText = (value: unknown): string => w().normalizeSearchText(value);
export const levelTargetOk = (level: any): boolean => w().levelTargetOk(level);

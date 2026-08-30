import { getKernel } from '../state/kernel';

export type WestgardRow = {
  index: number; date: string; value: string; z: string;
  verdictClass: string; verdictLabel: string;
  rules: string[]; supportRules: string[]; errorType: string; errorDesc: string;
};
export type WestgardRowsControl = { shownCount: number; total: number; suffix: string; label: string; next: number } | null;
export type WestgardBlock = {
  level: number; lotLabel: string; meanText: string; sdText: string; pointCount: number;
  badgeText?: string; prevToggle?: { label: string; level: number } | null; targetOk?: boolean;
} & (
  | { kind: 'empty'; emptyTitle: string; emptyMessage: string; emptyActionArgs?: [string, number] }
  | { kind: 'points'; key: string; rowsControl: WestgardRowsControl; rows: WestgardRow[] }
);
export type WestgardCurrentModel = {
  query: string; tests: { id: string; label: string }[]; totalCount: number; matchedCount: number;
  selectedTestId: string; chartMode: 'lj' | 'cusum';
  ruleRegistry: { id: string; on: boolean }[];
  showMultiChart: boolean; multiChartTestId: string; levels: WestgardBlock[];
  cusum: { on: boolean; testId: string; k: number; h: number; levels: { level: number; lot: string; meanText: string; sdText: string; pointCount: number }[] };
};
export type WestgardArchivedModel =
  | { groups: { id: string; label: string }[]; selectedGroupId: string; query: string; empty: true; tests: { id: string; label: string }[]; selectedTestId: string }
  | {
      groups: { id: string; label: string }[]; selectedGroupId: string; query: string; empty: false;
      tests: { id: string; label: string }[]; totalCount: number; selectedTestId: string;
      badgeText: string; showMultiChart: boolean; multiChartGroupId: string; multiChartTestId: string; blocks: WestgardBlock[];
    };
export type WestgardModel =
  | { empty: true; isAdmin: boolean }
  | { empty: false; isAdmin: boolean; canWrite: boolean; viewMode: 'current' | 'archived'; archivedCount: number; current: WestgardCurrentModel | null; archived: WestgardArchivedModel | null };

export const westgardModel = (): WestgardModel => getKernel().westgard.westgardModel();
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const emptyStateHtml = (title: string, body: string, actions?: string): string => getKernel().pres.emptyState(title, body, actions);
export const afterRender = (page: string): void => getKernel().pres.afterRender(page);
export const ruleGuideRows = (): { id: string; desc: string; alert: boolean; fix: string }[] => getKernel().pres.QCCore.WG_RULE_REGISTRY.map((r: any) => ({ id: r.id, desc: r.desc, alert: r.alert, fix: r.fix }));
export const wgFilterTests = (value: string): void => getKernel().westgard.wgFilterTests(value);
export const wgFilterArchivedTests = (value: string): void => getKernel().westgard.wgFilterArchivedTests(value);
export const goManageTargets = (): void => getKernel().pres.goManageTargets();
export const dashboardGoEntryFollowup = (testId: string, level: number): void => getKernel().pres.dashboardGoEntryFollowup(testId, level);
export const openConfigAssay = (testId: string): void => getKernel().pres.openConfigAssay(testId);
export const wgSetViewMode = (mode: string): void => getKernel().westgard.wgSetViewMode(mode);
export const wgSetChartMode = (mode: string): void => getKernel().westgard.wgSetChartMode(mode);
export const exportWestgardXLSX = (): void => getKernel().dataIo.exportWestgardXLSX();
export const printWestgard = (): void => getKernel().reportPrint.printWestgard();
export const wgSet = (rule: string, on: boolean): void => getKernel().westgard.wgSet(rule, on);
export const wgReset = (): void => getKernel().westgard.wgReset();
export const wgLoadMoreRows = (key: string, next: number): void => getKernel().westgard.wgLoadMoreRows(key, next);
export const wgTogglePrevLot = (level: number): void => getKernel().westgard.wgTogglePrevLot(level);
export const wgSelectTest = (value: string): void => getKernel().westgard.wgSelectTest(value);
export const wgSetArchivedTest = (value: string): void => getKernel().westgard.wgSetArchivedTest(value);
export const wgSetArchivedGroup = (value: string): void => getKernel().westgard.wgSetArchivedGroup(value);

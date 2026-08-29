const w = () => window as any;

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

export const westgardModel = (): WestgardModel => w().westgardModel();
export const headOnlyHtml = (title: string, subtitle: string): string => w().headOnly(title, subtitle);
export const emptyStateHtml = (title: string, body: string, actions?: string): string => w().emptyState(title, body, actions);
export const afterRender = (page: string): void => w().afterRender(page);
export const ruleGuideRows = (): { id: string; desc: string; alert: boolean; fix: string }[] => w().QCCore.WG_RULE_REGISTRY.map((r: any) => ({ id: r.id, desc: r.desc, alert: r.alert, fix: r.fix }));
export const wgFilterTests = (value: string): void => w().wgFilterTests(value);
export const wgFilterArchivedTests = (value: string): void => w().wgFilterArchivedTests(value);

const w = () => window as any;

export type ManageTab = { id: string; label: string; count: string | number };
export type ManageToolbar = { title: string; subtitle?: string; action?: { action: string; args?: unknown[] } | null; actionLabel?: string };
export type ManageModel = {
  tab: string;
  tabs: ManageTab[];
  query: string;
  searchPlaceholder: string;
  body: any;
};

export const manageModel = (): ManageModel => w().manageModel();
export const headOnlyHtml = (title: string, subtitle: string): string => w().headOnly(title, subtitle);
export const manageSearchSet = (value: string): void => w().manageSearchSet(value);
export const setTargetPanel = (id: string): void => w().setTargetPanel(id);
export const setTargetGroup = (id: string): void => w().setTargetGroup(id);
export const setHistoryTest = (id: string): void => w().setHistoryTest(id);

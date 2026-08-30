import { getKernel } from '../state/kernel';

export type ManageTab = { id: string; label: string; count: string | number };
export type ManageToolbar = { title: string; subtitle?: string; action?: { action: string; args?: unknown[] } | null; actionLabel?: string };
export type ManageModel = {
  tab: string;
  tabs: ManageTab[];
  query: string;
  searchPlaceholder: string;
  body: any;
};

export const manageModel = (): ManageModel => getKernel().manage.manageModel();
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const manageSearchSet = (value: string): void => getKernel().manage.manageSearchSet(value);
export const setTargetPanel = (id: string): void => getKernel().manage.setTargetPanel(id);
export const setTargetGroup = (id: string): void => getKernel().manage.setTargetGroup(id);
export const setHistoryTest = (id: string): void => getKernel().manage.setHistoryTest(id);

const w = () => window as any;

export type ReportLock = { ym: string; monthLabel: string; lockedBy: string; lockedAtText: string };
export type ReportLockPanel = {
  isAdmin: boolean; year: number; month: number; months: number[]; years: number[];
  already: boolean; ym: string; locks: ReportLock[];
};
export type ReportModel =
  | { empty: true; isAdmin: boolean; lockPanel: ReportLockPanel }
  | {
      empty: false;
      query: string;
      totalCount: number;
      matched: { id: string; label: string }[];
      selectedId: string;
      start: string; end: string;
      disabled: boolean;
      lockPanel: ReportLockPanel;
    };

export const reportModel = (): ReportModel => w().reportModel();
export const headOnlyHtml = (title: string, subtitle: string): string => w().headOnly(title, subtitle);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => w().dateBox(id, value, cls, attrs);
export const reportActionIcon = (type: string): string => w().reportActionIconPresentation.icon(type);
export const reportSearchSet = (value: string): void => w().reportSearchSet(value);

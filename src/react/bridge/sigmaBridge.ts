const w = () => window as any;

export type SigmaTeaOption = { value: string; label: string };
export type SigmaLevelCell = {
  level: string | number;
  cv: string; bias: string;
  cvMeta: { text: string; title: string } | null;
  result: { classifiable: boolean; sigma: string; color: string; label: string; title: string } | null;
};
export type SigmaPeriod = {
  id: string; selected: boolean; periodLabel: string; month: number; year: number; years: number[];
  levelCells: SigmaLevelCell[]; canExport: boolean; canDelete: boolean;
};
export type SigmaModel =
  | { empty: true; isAdmin: boolean; hasCatalogTests: boolean }
  | { empty: false; isAdmin: boolean; canWrite: boolean; testId: string; tests: { id: string; label: string }[]; noLevels: true; message: string }
  | {
      empty: false; isAdmin: boolean; canWrite: boolean; testId: string; tests: { id: string; label: string }[]; noLevels: false;
      testName: string; unit: string; instrument: string;
      tea: { source: string; value: number; hint: string; options: SigmaTeaOption[]; controlValue: string; eflm: { analyte: string; aps: string; lookupDate: string; ref: string } | null };
      hintText: string;
      levels: (string | number)[];
      periods: SigmaPeriod[];
      combinedExport: boolean;
      biasButtons: { level: string | number; enabled: boolean; periodId: string | null; title: string }[];
      canAddPeriod: boolean;
    };

export const sigmaModel = (): SigmaModel => w().sigmaModel();
export const headOnlyHtml = (title: string, subtitle: string): string => w().headOnly(title, subtitle);
export const emptyStateHtml = (title: string, body: string, actions?: string): string => w().emptyState(title, body, actions);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => w().dateBox(id, value, cls, attrs);
export const icoDownloadHtml = (): string => w().icoDownload();
export const sgRefresh = (): void => w().sgRefresh();
export const sgPickTest = (id: string): void => w().sgPickTest(id);
export const sgSetTeaSource = (value: string): void => w().sgSetTeaSource(value);
export const sgPart = (eid: string, part: string, value: string): void => { w().sgPart(eid, part, value); };

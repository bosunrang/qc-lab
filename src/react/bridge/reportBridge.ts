import { getKernel } from '../state/kernel';

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

export const reportModel = (): ReportModel => getKernel().report.reportModel();
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => getKernel().pres.dateBox(id, value, cls, attrs);
export const reportSearchSet = (value: string): void => getKernel().report.reportSearchSet(value);
export const goManageTargets = (): void => getKernel().pres.goManageTargets();
export const reportUnlockPeriod = (ym: string): void => getKernel().report.reportUnlockPeriod(ym);
export const reportSetLockPart = (part: 'month' | 'year', value: string): void => getKernel().report.reportSetLockPart(part, value);
export const reportLockPeriod = (): void => getKernel().report.reportLockPeriod();
export const printReport = (): void => getKernel().reportPrint.printReport();
export const exportReportXLSX = (): void => getKernel().dataIo.exportReportXLSX();
export const exportReportCSV = (): void => getKernel().dataIo.exportReportCSV();

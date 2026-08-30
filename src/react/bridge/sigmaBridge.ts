import { createElement } from 'react';
import { getKernel } from '../state/kernel';
import { openReactModal } from '../dialogs/modal-store';
import { SigmaAddTestModal } from '../modals/SigmaAddTestModal';
import { SigmaBiasModal } from '../modals/SigmaBiasModal';
import { SigmaMuModal } from '../modals/SigmaMuModal';

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

export const sigmaModel = (): SigmaModel => getKernel().sigma.sigmaModel();
export const icoDownloadHtml = (): string => getKernel().pres.icoDownload();
export const sgRefresh = (): void => getKernel().sigma.sgRefresh();
export const sgPickTest = (id: string): void => getKernel().sigma.sgPickTest(id);
export const sgSetTeaSource = (value: string): void => getKernel().sigma.sgSetTeaSource(value);
export const sgPart = (eid: string, part: string, value: string): void => { getKernel().sigma.sgPart(eid, part, value); };
export const goManageTargets = (): void => getKernel().pres.goManageTargets();
export const sgOpenAddTest = (): void => {
  if (getKernel().sigma.sgOpenAddTestModel()) openReactModal(() => createElement(SigmaAddTestModal));
};
export const sgRemoveTracked = (testId: string): void => { getKernel().sigma.sgRemoveTracked(testId); };
export const sgSetTea = (value: string): void => { getKernel().sigma.sgSetTea(value); };
export const sgSetTeaMeta = (field: string, value: string): void => { getKernel().sigma.sgSetTeaMeta(field, value); };
export const sgSelectPeriod = (eid: string): void => { getKernel().sigma.sgSelectPeriod(eid); };
export const sgCell = (eid: string, level: string | number, field: string, value: string): void => { getKernel().sigma.sgCell(eid, level, field, value); };
export const sgPullCV = (eid: string): void => { getKernel().sigma.sgPullCV(eid); };
export const exportSigmaPeriodXLSX = (eid: string): void => { getKernel().dataIo.exportSigmaPeriodXLSX(eid); };
export const printSigmaPeriod = (eid: string): void => { getKernel().reportPrint.printSigmaPeriod(eid); };
export const sgDelPeriod = (eid: string): void => { getKernel().sigma.sgDelPeriod(eid); };
export const sgOpenBias = (eid: string, level: string | number): void => {
  const model = getKernel().sigma.sgOpenBiasModel(eid, level);
  if (model) openReactModal(() => createElement(SigmaBiasModal, model));
};
export const sgOpenMU = (eid: string): void => {
  const model = getKernel().sigma.sgOpenMUModel(eid);
  if (model) openReactModal(() => createElement(SigmaMuModal, model));
};
export const sgAddPeriod = (): void => { getKernel().sigma.sgAddPeriod(); };
export const exportSigmaPeriodsXLSX = (): void => { getKernel().dataIo.exportSigmaPeriodsXLSX(); };
export const printSigmaPeriods = (): void => { getKernel().reportPrint.printSigmaPeriods(); };

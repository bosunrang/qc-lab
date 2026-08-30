import { createElement } from 'react';
import { getKernel } from '../state/kernel';
import { openReactModal } from '../dialogs/modal-store';
import { ReagentPickerModal } from '../modals/ReagentPickerModal';

export type ReagentRow = { index: number; old: unknown; new: unknown; avg: string; dif: string; difNeg: boolean };
export type ReagentModel =
  | { empty: true }
  | {
      empty: false;
      currentId: string;
      comparisons: { id: string; label: string }[];
      canWrite: boolean;
      oldLotHead: string;
      newLotHead: string;
      reagent: unknown; unit: unknown; lotOld: unknown; lotNew: unknown; date: unknown;
      operator: unknown; sampleType: unknown; biasTarget: unknown; alpha: unknown;
      coverageConfirmed: boolean;
      rows: ReagentRow[];
      minPairs: number;
    };

export const reagentModel = (): ReagentModel => getKernel().reagent.reagentModel();
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => getKernel().pres.dateBox(id, value, cls, attrs);
export const rcToolIcon = (type: string): string => getKernel().pres.reagentToolIconPresentation.icon(type);
export const rcCompute = (): void => getKernel().reagent.rcCompute();
export const rcSwitch = (id: string): void => getKernel().reagent.rcSwitch(id);
export const openRcCreateModal = (): void => getKernel().reagent.openRcCreateModal();
export const rcDeleteCurrent = (): void => { getKernel().reagent.rcDeleteCurrent(); };
export const openRcModal = (): void => { openReactModal(() => createElement(ReagentPickerModal)); };
export const rcPrint = (): void => { getKernel().reagent.rcPrint(); };
export const rcPrintSummary = (): void => { getKernel().reagent.rcPrintSummary(); };
export const rcMeta = (key: string, value: unknown): void => getKernel().reagent.rcMeta(key, value);
export const rcMetaFocus = (key: string): void => getKernel().reagent.rcMetaFocus(key);
export const rcMetaLog = (key: string): void => getKernel().reagent.rcMetaLog(key);
export const rcOpenQuick = (type: string): void => getKernel().reagent.rcOpenQuick(type);
export const rcCell = (i: number, column: number | string, value: unknown): void => getKernel().reagent.rcCell(i, column, value);
export const rcRmRow = (i: number): void => getKernel().reagent.rcRmRow(i);
export const rcAddRow = (): void => getKernel().reagent.rcAddRow();
export const rcClearRows = (): void => getKernel().reagent.rcClearRows();

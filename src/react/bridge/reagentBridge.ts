import { getKernel } from '../state/kernel';

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
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => getKernel().pres.dateBox(id, value, cls, attrs);
export const rcToolIcon = (type: string): string => getKernel().pres.reagentToolIconPresentation.icon(type);
export const rcCompute = (): void => getKernel().reagent.rcCompute();

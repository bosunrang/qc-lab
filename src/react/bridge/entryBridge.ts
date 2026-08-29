const w = () => window as any;

export type EntryTreeNode =
  | { kind: 'empty' }
  | { kind: 'machine'; key: string; open: boolean; label: string }
  | { kind: 'group'; key: string; open: boolean; parentOpen: boolean; search: string; name: string; stateClass: string; stateText: string }
  | { kind: 'assay'; testId: string; search: string; selected: boolean; visible: boolean; level: number; name: string; stateClass: string; stateText: string };

export type EntryRunSlot =
  | { kind: 'empty'; editable: boolean; title: string; ariaLabel: string; date: string; runNo: number; levelIndex: number; actionArgs: [string, number, string, string, string] }
  | { kind: 'saved'; previousLot: boolean; previousLotName: string; valueClass: string; title: string; valueText: string; zText: string; verdictText: string };

export type EntrySheetCellModel = { parallel: boolean; hasAddButton: boolean; runs: EntryRunSlot[]; addRun: null | { actionArgs: [string, string, string, number, number] } };
export type EntrySheetNote = { kind: 'none' } | { kind: 'readonly'; text: string } | { kind: 'editable'; value: string; placeholder: string };
export type EntrySheetRow = {
  rowClass: string; date: string; dayOfMonth: number; today: boolean; cells: EntrySheetCellModel[];
  staff: { code: string; name: string }[]; warningRules: string; rejectRules: string; status: 'none' | 'rej' | 'warn' | 'ok'; note: EntrySheetNote;
};
export type EntryLevelHead = { level: number; lot: string; parallel: boolean; tooltip: string };
export type EntryWorksheet = {
  testName: string; lotLabel: string; sheetYear: number; sheetMonthNo: number; currentIsoMonth: string;
  levelHeads: EntryLevelHead[]; rows: EntrySheetRow[]; columnCount: number; message: string;
};
export type EntryLjMetric = { label: string; value: string; control?: boolean };
export type EntryLjAction = { kind: 'hint'; text: string } | { kind: 'showPrev'; level: number; lot: string } | { kind: 'showCurrent'; level: number };
export type EntryLjPanelItem = {
  on: boolean; parallel: boolean; level: number; lot: string; pointCount: number; previousLot: boolean;
  metrics: EntryLjMetric[]; action: EntryLjAction; testId: string; mean: number; sd: number; start: string; end: string;
};
export type EntryLjPanel = { startDate: string; endDate: string; dayPresetOptions: { days: number; on: boolean }[]; hasCustomRange: boolean; rangeText: string; stack: EntryLjPanelItem[] };
export type EntryTableRow = { rejected: boolean; warning: boolean; pointId: string; dateText: string; valueText: string; zText: string; verdictLevel: string; verdictText: string; rules: string[]; canVoid: boolean };
export type EntryTableCard = {
  parallel: boolean; level: number; previousLot: boolean; lot: string; pointCount: number;
  cumulative: { endDateText: string; count: number; mean: string; sd: string; cv: string };
  rows: EntryTableRow[]; rowControl: { limited: boolean; expanded: boolean; shown: number; total: number; tableKey: string } | null;
};
export type EntryVoidedRow = { pointId: string; dateText: string; levelLotText: string; valueText: string; runId: string; voidedBy: string; reason: string };
export type EntryPointsInView = { open: boolean; endDateText: string; startDateText: string; tableCards: EntryTableCard[]; voidedRows: EntryVoidedRow[] };
export type EntryRangeSummary = {
  open: boolean; summary: string; source: string; mean: string; sd: string; eligible: boolean; resultCount: number; dayCount: number;
  proposedMean: string; proposedSd: string; proposedCv: string; canApply: boolean; canRevert: boolean; testId: string; level: number;
};
export type EntryModel =
  | { empty: true; title: string; message: string; canAdd: boolean; addTarget: 'manage' | 'targets' }
  | {
      empty: false; treeCollapsed: boolean; machineOptions: { value: string; label: string }[]; selectedMachine: string;
      query: string; treeNodes: EntryTreeNode[]; testId: string; selectedLevel: number;
      worksheet: EntryWorksheet; ljPanel: EntryLjPanel; pointsInView: EntryPointsInView; rangeSummary: EntryRangeSummary;
    };

export const entryModel = (): EntryModel => w().entryModel();
export const headOnlyHtml = (title: string, subtitle: string): string => w().headOnly(title, subtitle);
export const emptyStateHtml = (title: string, body: string, actions?: string): string => w().emptyState(title, body, actions);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => w().dateBox(id, value, cls, attrs);
export const afterRender = (page: string): void => w().afterRender(page);
export const entryFocusPendingSheet = (): void => w().entryFocusPendingSheet();

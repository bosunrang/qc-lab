import { getKernel } from '../state/kernel';

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

export const entryModel = (): EntryModel => getKernel().entry.entryModel();
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const emptyStateHtml = (title: string, body: string, actions?: string): string => getKernel().pres.emptyState(title, body, actions);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => getKernel().pres.dateBox(id, value, cls, attrs);
export const afterRender = (page: string): void => getKernel().pres.afterRender(page);
export const entryFocusPendingSheet = (): void => getKernel().entry.entryFocusPendingSheet();
export const go = (page: string): void => getKernel().pres.go(page);
export const goManageTargets = (): void => getKernel().pres.goManageTargets();
export const treeToggle = (key: string): void => getKernel().entry.treeToggle(key);
export const toggleEntryTree = (): void => getKernel().entry.toggleEntryTree();
export const entryTreeKey = (el: HTMLElement, event: unknown): void => { getKernel().entry.entryTreeKey.call(el, event); };
export const entrySheetKey = (el: HTMLElement, event: unknown): void => { getKernel().entry.entrySheetKey.call(el, event); };
export const entryFilter = (value: string): void => getKernel().entry.entryFilter(value);
export const entrySetMachine = (value: string): void => getKernel().entry.entrySetMachine(value);
export const entryPick = (testId: string, level: number): void => getKernel().entry.entryPick(testId, level);
export const entryFocusLevel = (level: number): void => getKernel().entry.entryFocusLevel(level);
export const entryShowPrevLot = (level: number, lot: string): void => getKernel().entry.entryShowPrevLot(level, lot);
export const entryShowCurrentLot = (level: number): void => getKernel().entry.entryShowCurrentLot(level);
export const entrySheetRunChanged = (tid: string, level: number, date: string, runIdHint: string, lotNo: string, value: string): void => { getKernel().entry.entrySheetRunChanged(tid, level, date, runIdHint, lotNo, value); };
export const entryUnlockExtraRun = (tid: string, colKey: string, date: string, levelIdx: number, runNo: number): void => getKernel().entry.entryUnlockExtraRun(tid, colKey, date, levelIdx, runNo);
export const entryDateNoteSave = (tid: string, date: string, value: string): void => { getKernel().entry.entryDateNoteSave(tid, date, value); };
export const entrySetSheetPart = (part: string, value: string): void => getKernel().entry.entrySetSheetPart(part, value);
export const entrySetSheetMonth = (value: string): void => getKernel().entry.entrySetSheetMonth(value);
export const entryGoToday = (): void => getKernel().entry.entryGoToday();
export const entrySetDays = (n: number): void => getKernel().entry.entrySetDays(n);
export const entrySetStart = (value: string): void => getKernel().entry.entrySetStart(value);
export const entrySetEnd = (value: string): void => getKernel().entry.entrySetEnd(value);
export const voidQcPoint = (tid: string, pointId: string): void => { getKernel().entry.voidQcPoint(tid, pointId); };
export const entryToggleRows = (key: string): void => getKernel().entry.entryToggleRows(key);
export const entryDetailToggled = (key: string, open: boolean): void => getKernel().entry.entryDetailToggled(key, open);
export const openRangeWorkflow = (testId: string, level: number): void => getKernel().entry.openRangeWorkflow(testId, level);
export const revertRange = (testId: string, level: number): void => getKernel().entry.revertRange(testId, level);

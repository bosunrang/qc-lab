import { createElement } from 'react';
import { getKernel } from '../state/kernel';
import { openReactModal } from '../dialogs/modal-store';
import { ActionGuideModal } from '../modals/ActionGuideModal';
import { ActionDetailModal } from '../modals/ActionDetailModal';

export type ActionSideChip = { cls: string; label: string };

export type ActionIssueAction =
  | { kind: 'continue'; index: number }
  | { kind: 'create'; testId: string; level: number; rules: string; error: string; hint: string; pointId: string; date: string };
export type ActionIssueItem = {
  severity: string; level: string; state: string; value: string; unit: string; rules: string; error: string;
  workflowClass: string; workflowLabel: string; sideChips: ActionSideChip[]; footer: string;
  action: ActionIssueAction | null;
};
export type ActionIssueGroup = { severity: string; title: string; date: string; count: number; countLabel: string; items: ActionIssueItem[] };
export type ActionOpenItem = {
  severity: 'rej' | 'warn'; title: string; context: string; date: string; verdict?: string; rule: string; errorType: string;
  workflowClass: string; workflowLabel: string; sideChips: ActionSideChip[]; primary: string; owner: string; dueDate?: string; editable: boolean; index: number;
};
export type ActionOpenGroup = { severity: string; title: string; date: string; count: number; countLabel: string; items: ActionOpenItem[] };
export type ActionLogRow = {
  index: number; date: string; openedAt?: string; identity: string; sub: string; rule: string; primary: string; owner: string; dueDate?: string;
  workflowClass: string; workflowLabel: string; sideChips: ActionSideChip[];
  approvalTag: { cls: string; label: string } | null;
  approvalMeta: { by: string; at: string; note: string } | null;
  buttons: { edit?: boolean; escalate?: boolean; approve?: boolean; returnForRevision?: boolean; reopen?: boolean; cancel?: boolean };
};
export type ActionsModel = { violationGroups: ActionIssueGroup[]; openActionGroup: ActionOpenGroup | null; logRows: ActionLogRow[]; issueCount: number };

export const actionsModel = (): ActionsModel => getKernel().actions.actionsModel();
export const actionCausePhrases = (category: string): string[] => getKernel().actionForm.actionCausePhrases(category);
export const actionActionPhrases = (errorType: string): string[] => getKernel().actionForm.actionActionPhrases(errorType);

export type ActionFormSelectOption = { value: string; label: string };
export type ActionFormChip = { cls: string; label: string; title?: string };
export type ActionFormInvestigationItem = {
  statusId: string; noteId: string; title: string; hint: string; stateClass: string; stateLabel: string; value: string;
  options: ActionFormSelectOption[]; choices: (ActionFormSelectOption & { active: boolean })[]; noteValue: string; suggestPhrases: string[];
};
export type ActionFormOpenModel = {
  open: true; canWrite: boolean; editing: boolean; title: string; incidentBanner: string | null; formKey: string;
  nceId: string; qcBound: boolean; testOptions: { id: string; label: string }[]; selectedTestId: string; testDisabled: boolean;
  pointId: string; level: string | number; levelLabel: string | null; date: string;
  ruleOptions: ActionFormSelectOption[]; selectedRule: string;
  sourceOptions: ActionFormSelectOption[]; selectedSource: string;
  phaseOptions: ActionFormSelectOption[]; selectedPhase: string;
  errOptions: ActionFormSelectOption[]; selectedErr: string;
  by: string; staffNames: string[]; dueDate: string;
  evidenceTimelineHtml: string; openSections: string[];
  sections: {
    immediate: { chip: ActionFormChip; containmentOptions: ActionFormSelectOption[]; containmentStatus: string; containmentNote: string; containmentNoteSuggest: string[]; correction: string; correctionSuggest: string[] };
    risk: { chip: ActionFormChip; severityOptions: ActionFormSelectOption[]; severity: number | string; occurrenceOptions: ActionFormSelectOption[]; occurrence: number | string; detectOptions: ActionFormSelectOption[]; detectability: number | string; levelOptions: ActionFormSelectOption[]; level: string; scoreClass: string; score: number | string; basis: string; basisSuggest: string[] };
    check: { chip: ActionFormChip; items: ActionFormInvestigationItem[] };
    cause: { chip: ActionFormChip; causeCategoryOptions: ActionFormSelectOption[]; causeCategory: string; cause: string; causeSuggest: string[]; action: string; actionSuggest: string[]; completedDate: string; biasBefore: string; biasAfter: string; sigmaBiasChip: { period: string; value: number; valueText: string } | null; thresholdHtml: string; rerunEvidenceHtml: string; containmentHeld: boolean; releaseOptions: ActionFormSelectOption[]; releaseStatus: string; releaseDate: string; releaseBy: string; releaseNote: string; releaseSuggest: string[] };
    patient: { chip: ActionFormChip; referenceHtml: string; impactOptions: ActionFormSelectOption[]; impact: string; action: string; actionSuggest: string[] };
    eff: { chip: ActionFormChip; statusOptions: ActionFormSelectOption[]; status: string; date: string; note: string; noteSuggest: string[]; severityOptions: ActionFormSelectOption[]; severity: number | string; occurrenceOptions: ActionFormSelectOption[]; occurrence: number | string; detectOptions: ActionFormSelectOption[]; detectability: number | string; levelOptions: ActionFormSelectOption[]; level: string; scoreClass: string; score: number | string; basis: string; basisSuggest: string[] };
  };
};
export type ActionFormModel = { open: false; canWrite: boolean; closed: { title: string; message: string } } | ActionFormOpenModel;

export const actionFormViewModel = (issueCount: number): ActionFormModel => getKernel().actionForm.actionFormViewModel(issueCount);

export const editAction = (i: number): void => { getKernel().actionForm.editAction(i); };
export const beginActionFromIssue = (tid: unknown, level: unknown, rule: unknown, err: unknown, act: unknown, pointId: string, pointDate: string): void => getKernel().actionForm.beginActionFromIssue(tid, level, rule, err, act, pointId, pointDate);
export const viewActionDetail = (i: number): void => {
  const model = getKernel().actions.viewActionDetailModel(i);
  if (model) openReactModal(() => createElement(ActionDetailModal, model));
};
export const escalateAction = (i: number): void => { getKernel().actions.escalateAction(i); };
export const approveAction = (i: number): void => { getKernel().actions.approveAction(i); };
export const returnAction = (i: number): void => { getKernel().actions.returnAction(i); };
export const reopenAction = (i: number): void => { getKernel().actions.reopenAction(i); };
export const cancelAction = (i: number): void => { getKernel().actions.cancelAction(i); };
export const exportActionsCSV = (): void => getKernel().dataIo.exportActionsCSV();
export const actionInsertSuggestion = (targetId: string, phrase: string): void => getKernel().actionForm.actionInsertSuggestion(targetId, phrase);
export const actionSectionToggled = (key: string, open: boolean): void => getKernel().actionForm.actionSectionToggled(key, open);
export const actionInvestigationSync = (statusId: string): void => getKernel().actionForm.actionInvestigationSync(statusId);
export const actionInvestigationChoose = (statusId: string, value: string): void => getKernel().actionForm.actionInvestigationChoose(statusId, value);
export const beginActionManual = (): void => getKernel().actionForm.beginActionManual();
export const actionUpdateBiasHint = (): void => getKernel().actionForm.actionUpdateBiasHint();
export const actionFillBias = (targetId: string, value: unknown): void => getKernel().actionForm.actionFillBias(targetId, value);
export const closeActionForm = (): void => getKernel().actionForm.closeActionForm();
export const addAction = (): void => { getKernel().actionForm.addAction(); };
export const openActionGuide = (): void => { openReactModal(() => createElement(ActionGuideModal, { steps: getKernel().actions.actionGuideSteps })); };
export const syncActLevels = (): void => getKernel().actionForm.syncActLevels();
export const syncActionRiskScore = (): void => getKernel().actionForm.syncActionRiskScore();
export const syncActionResidualRiskScore = (): void => getKernel().actionForm.syncActionResidualRiskScore();
export const actionFormChanged = (): void => getKernel().actionForm.actionFormChanged();

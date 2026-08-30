import { getKernel } from '../state/kernel';

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
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => getKernel().pres.dateBox(id, value, cls, attrs);
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

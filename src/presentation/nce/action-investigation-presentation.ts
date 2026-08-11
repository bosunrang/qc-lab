export type ActionInvestigationState = 'is-empty' | 'is-ok' | 'is-abnormal' | 'is-na';

export function actionInvestigationChoiceLabel(value: unknown, label: string): string {
  return value === 'not-needed' ? 'Không cần'
    : value === 'checked-ok' ? 'Đạt'
      : value === 'checked-abnormal' ? 'Bất thường'
        : label;
}

export function actionInvestigationStateClass(value: unknown): ActionInvestigationState {
  return ['ok', 'checked-ok'].includes(String(value)) ? 'is-ok'
    : ['abnormal', 'checked-abnormal'].includes(String(value)) ? 'is-abnormal'
      : ['na', 'not-needed'].includes(String(value)) ? 'is-na'
        : 'is-empty';
}

export const actionInvestigationPresentation = Object.freeze({
  choiceLabel: actionInvestigationChoiceLabel,
  stateClass: actionInvestigationStateClass,
});

export type ActionInvestigationPresentation = typeof actionInvestigationPresentation;

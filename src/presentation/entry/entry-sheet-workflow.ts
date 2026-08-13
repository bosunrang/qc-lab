type MonthState = { month: string; jumpToday: boolean; message: string } | null;
type KeyPlan = { handle: boolean };

export function createEntrySheetWorkflow<T>(deps: {
  monthValue: (value: unknown) => string | null;
  monthState: (month: string | null) => MonthState;
  todayState: (month: string) => Exclude<MonthState, null>;
  monthPart: (current: unknown, fallback: string, part: 'year' | 'month', value: unknown) => string;
  keyPlan: (event: { isComposing?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; key?: string }) => KeyPlan;
  orderInputs: (inputs: readonly T[]) => T[];
  navigationTarget: (inputs: readonly T[] | null | undefined, current: T, key: 'ArrowLeft' | 'ArrowRight' | 'Tab' | 'ArrowUp' | 'ArrowDown' | 'Enter', shiftKey?: boolean) => T | null;
  pendingFocus: (pending: unknown, candidates: readonly T[]) => T | null;
  focus: (candidates: readonly T[] | null | undefined) => T | null;
}) {
  return Object.freeze({
    setMonth: (value: unknown) => deps.monthState(deps.monthValue(value)),
    today: deps.todayState,
    setPart: deps.monthPart,
    keyPlan: deps.keyPlan,
    orderInputs: deps.orderInputs,
    targetInput: deps.navigationTarget,
    pendingFocus: deps.pendingFocus,
    focus: deps.focus,
  });
}

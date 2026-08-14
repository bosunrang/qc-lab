export function actionBiasContext<T extends { id?: string }, F extends { testId?: string; level?: string | number }, E extends { testId?: string; level?: string | number }>(form: F, editing: E | null | undefined, tests: T[], levelConfig: (test: T, level: number) => unknown) {
  const testId=editing ? editing.testId : form.testId;
  const level=editing ? editing.level : form.level;
  const test=tests.find(item=>item.id===testId);
  return {t:test,l:test&&level ? levelConfig(test,+level) : null};
}

type Value = Record<string, any>;

export function createSigmaTeaEditService(deps: { cleanText: (value: unknown, maximumLength?: number) => string; parseDate: (value: unknown) => string }) {
  const setValue = (test: Value, value: unknown) => {
    const text = String(value ?? '').trim(), number = Number(text);
    test.tea = text && Number.isFinite(number) && number > 0 ? number : 0;
    return test.tea;
  };
  const setSource = (test: Value, value: unknown, sourceIds: string[]) => {
    test.teaSource = sourceIds.includes(String(value)) ? String(value) : 'ricos';
    if (test.teaSource === 'eflm') { if (!test.eflmAnalyte) test.eflmAnalyte = test.name || ''; if (!test.eflmAps) test.eflmAps = 'desirable'; }
    return test.teaSource;
  };
  const setMeta = (test: Value, field: string, value: unknown) => {
    if (field === 'eflmLookupDate') test[field] = deps.parseDate(value) || '';
    else if (field === 'eflmAps') test[field] = ['minimum', 'desirable', 'optimum'].includes(String(value)) ? value : 'desirable';
    else if (['eflmAnalyte', 'eflmRef'].includes(field)) test[field] = deps.cleanText(value, field === 'eflmRef' ? 500 : 160);
    return test;
  };
  return Object.freeze({ setValue, setSource, setMeta });
}
export type SigmaTeaEditService = ReturnType<typeof createSigmaTeaEditService>;

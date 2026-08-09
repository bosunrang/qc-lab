type Value = Record<string, any>;

export function createSigmaTrackedTestService(deps: { orderedTracked: (tests: Value[]) => Value[] }) {
  const select = (tests: Value[], id: string) => tests.find(test => test.id === id && test.sgTracked) || null;
  const track = (tests: Value[], id: string) => {
    const test = tests.find(item => item.id === id);
    if (!test) return { tracked: false, selected: null };
    test.sgTracked = true;
    return { tracked: true, selected: test.id };
  };
  const remove = (tests: Value[], id: string, selectedId: string | null) => {
    const test = tests.find(item => item.id === id);
    if (!test) return { removed: false, selected: selectedId };
    test.sgTracked = false;
    const selected = selectedId === id ? (deps.orderedTracked(tests)[0]?.id || null) : selectedId;
    return { removed: true, selected };
  };
  return Object.freeze({ select, track, remove });
}
export type SigmaTrackedTestService = ReturnType<typeof createSigmaTrackedTestService>;

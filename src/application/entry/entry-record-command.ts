type Item = Record<string, any>;

export type EntryRecordCommandDeps = {
  recordPoint: (state: Item, input: Item) => { ok: boolean; error?: string; point?: Item };
  canEnter: (test: Item, level: number) => boolean;
  pointContext: (testId: string, level: number, lot: string, activeLot: string) => { parallel?: boolean; selection?: Item };
  verdict: (test: Item, input: Item, point: Item, parallel: boolean) => { level?: string; rules?: string[] };
};

/* Commit của một điểm QC: kiểm tra cấu hình còn vận hành, ghi record, tính verdict và
   trả effect plan. Route chỉ lo modal cảnh báo, thông báo và cập nhật DOM. */
export function createEntryRecordCommand(deps: EntryRecordCommandDeps) {
  const execute = (input: { state: Item; test: Item | null; testId: string; level: number; date: string; value: number; valueDecimals: number; runId: string; lotNo?: string; cfg: Item | null; staff: Item; id: string; activeLot?: string }) => {
    const { test, cfg } = input;
    if (!test || !cfg || !deps.canEnter(test, input.level)) return { ok: false as const, error: 'not-ready' as const };
    const recorded = deps.recordPoint(input.state, { tid: input.testId, level: input.level, date: input.date, value: input.value, valueDecimals: input.valueDecimals, runId: input.runId, cfg, staff: input.staff, id: input.id });
    if (!recorded.ok || !recorded.point) return { ok: false as const, error: recorded.error || 'save-failed' };
    const context = deps.pointContext(input.testId, input.level, input.lotNo || '', input.activeLot || '');
    const parallel = !!context.parallel, verdict = deps.verdict(test, input, recorded.point, parallel) || {};
    return { ok: true as const, point: recorded.point, parallel, selection: context.selection, verdict: { level: verdict.level || 'ok', rules: [...new Set(verdict.rules || [])] }, effects: { save: { clearDerived: false, testId: input.testId } } };
  };
  return Object.freeze({ execute });
}

export type EntryRecordCommand = ReturnType<typeof createEntryRecordCommand>;

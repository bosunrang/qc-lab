type Item = Record<string, any>;

export type EntryVoidCommandDeps = {
  voidPoint: (state: Item, input: Item) => Item | null;
  clearDerived: (testId: string) => void;
};

/* Hủy điểm QC là một transaction: đánh dấu void, có thể mở NCE, rồi xóa cache tính
   toán trước khi route ghi audit/save. Không để route tự ghép các mutation này. */
export function createEntryVoidCommand(deps: EntryVoidCommandDeps) {
  const execute = (input: Item) => {
    const result = deps.voidPoint(input.state, input);
    if (!result || result.error) return { ok: false as const, error: result && result.error || 'not-found' };
    deps.clearDerived(input.tid);
    return { ok: true as const, ...result, effects: { save: { clearDerived: false, testId: input.tid } } };
  };
  return Object.freeze({ execute });
}

export type EntryVoidCommand = ReturnType<typeof createEntryVoidCommand>;

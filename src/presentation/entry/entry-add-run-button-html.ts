type EntryAddRunButtonInput = { action: string };

type EntryAddRunButtonDependencies = { escape: (value: unknown) => string };

export function createEntryAddRunButtonHtml(deps: EntryAddRunButtonDependencies) {
  return (input: EntryAddRunButtonInput) => !input.action ? '' : `<button type="button" class="qc-add-run-btn" title="Thêm lần chạy bổ sung" onclick="${deps.escape(input.action)}"><span class="qc-add-run-icon">+</span><span class="qc-add-run-label">Thêm</span></button>`;
}

const ENTRY_SHEET_KEYS = new Set(['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function entrySheetKeyPlan(input: { isComposing?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; key?: string }) {
  const blocked = !!input.isComposing || !!input.altKey || !!input.ctrlKey || !!input.metaKey;
  return { handle: !blocked && ENTRY_SHEET_KEYS.has(String(input.key || '')) };
}

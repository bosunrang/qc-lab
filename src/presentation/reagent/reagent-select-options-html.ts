type ReagentComparison = Record<string, any>;

export function createReagentSelectOptionsHtml() {
  return (items: unknown, selectedId: unknown, escAttr: (value: unknown) => string, label: (item: ReagentComparison) => string) =>
    (Array.isArray(items) ? items : []).map((item: ReagentComparison) =>
      `<option value="${escAttr(item.id)}"${item.id === selectedId ? ' selected' : ''}>${label(item)}</option>`).join('');
}

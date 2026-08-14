type ReagentPickerRow = { id: string; labelHtml: string; unitHtml: string; rowCount: number; selected: boolean };
type ReagentPickerRowsInput = { items: ReagentPickerRow[]; canWrite: boolean; selectButtonHtml: (id: string, selected: boolean) => string };

export function reagentPickerRowsHtml(input: ReagentPickerRowsInput): string {
  if (!input.items.length) return '<div class="empty">Không có phép so sánh phù hợp.</div>';
  return input.items.map(item => `<div class="mrow ${item.selected ? 'on' : ''}"><span><b>${item.labelHtml}</b><div class="hint flow-tight">${item.unitHtml} ${item.rowCount ? '· ' + item.rowCount + ' dòng' : ''}</div></span><span class="acts">${input.selectButtonHtml(item.id, item.selected)}${input.canWrite ? `<button class="x" onclick="rcDeleteFromModal('${item.id}')" title="Xóa">✕</button>` : ''}</span></div>`).join('');
}

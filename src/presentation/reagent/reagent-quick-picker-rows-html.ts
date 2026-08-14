type ReagentQuickPickerRowsInput = { items: string[]; labelHtml: string; esc: (value: unknown) => string; selectButtonHtml: (index: number) => string };

export function reagentQuickPickerRowsHtml(input: ReagentQuickPickerRowsInput): string {
  if (!input.items.length) return `<div class="empty">Chưa có ${input.labelHtml} trong danh sách.</div>`;
  return input.items.map((name, index) => `<div class="mrow"><span><b>${input.esc(name)}</b></span><span class="acts">${input.selectButtonHtml(index)}<button class="x" onclick="rcDelQuick(${index})" title="Xóa">✕</button></span></div>`).join('');
}

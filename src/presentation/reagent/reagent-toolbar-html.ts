type ReagentToolbarInput = { selectOptionsHtml: string; primaryActionsHtml: string; secondaryActionsHtml: string };

export function reagentToolbarHtml(input: ReagentToolbarInput): string {
  return `<div class="panel rc-toolbar-panel"><h2 class="panel-title">Thiết lập so sánh</h2><div class="rc-toolbar">
     <div class="rc-toolbar-selcol"><label>Chọn hóa chất</label><select id="rcSel" aria-label="Chọn hóa chất" onchange="rcSwitch(this.value)">${input.selectOptionsHtml}</select></div>
     ${input.primaryActionsHtml ? `<div class="rc-toolbar-primary"><div>${input.primaryActionsHtml}</div></div>` : ''}
     <div class="rc-toolbar-secondary">${input.secondaryActionsHtml}</div></div></div>`;
}

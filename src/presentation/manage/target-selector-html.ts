export function targetSelectorHtml(panelOptionsHtml: string, groupOptionsHtml: string) {
  return `<div class="target-selector">
      <div><label>Panel QC</label><select onchange="setTargetPanel(this.value)">${panelOptionsHtml || '<option value="">Chưa có panel</option>'}</select></div>
      <div><label>Nhóm lô QC</label><select onchange="setTargetGroup(this.value)">${groupOptionsHtml}</select></div>
    </div>`;
}

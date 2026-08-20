export function targetSelectorHtml(panelOptionsHtml: string, groupOptionsHtml: string) {
  return `<div class="target-selector">
      <div><label>Panel QC</label><select data-action="setTargetPanel" data-action-on="change">${panelOptionsHtml || '<option value="">Chưa có panel</option>'}</select></div>
      <div><label>Nhóm lô QC</label><select data-action="setTargetGroup" data-action-on="change">${groupOptionsHtml}</select></div>
    </div>`;
}

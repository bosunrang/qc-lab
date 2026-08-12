export function targetPanelLabel(panels: Array<{ id: string; name?: string }>, panelId: string) {
  return panels.find(panel => panel.id === panelId)?.name || 'Panel QC';
}

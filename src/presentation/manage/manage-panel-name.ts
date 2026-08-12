export function managePanelName(panels: Array<{ id: string; name?: string }>, id: string) {
  return panels.find(item => item.id === id)?.name || 'Chưa chọn Panel QC';
}

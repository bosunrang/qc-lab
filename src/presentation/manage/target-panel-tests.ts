export function targetPanelTests<T extends { id: string }>(panels: Array<{ id: string; testIds?: string[] }>, tests: T[], panelId: string) {
  const panel = panels.find(item => item.id === panelId);
  return (panel?.testIds || []).map(id => tests.find(test => test.id === id)).filter((test): test is T => !!test);
}

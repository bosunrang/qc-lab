const MANAGE_TABS = new Set(['lots','panels','targets','history','transitions','assays','instruments','tearefs']);

export function createManageNavigationWorkflow() {
  return Object.freeze({
    tab: (tab: unknown) => MANAGE_TABS.has(String(tab)) ? String(tab) : 'instruments',
    targetPanel: (id: unknown) => id,
    targetGroup: (id: unknown) => id,
    targetLevel: (level: unknown) => String(level || ''),
    historyTest: (id: unknown) => id,
    targetMatrix: (current: { panel: unknown; group: unknown }, panel: unknown, group: unknown) => ({panel:panel||current.panel,group:group||current.group,tab:'targets'}),
  });
}

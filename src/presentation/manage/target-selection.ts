export function targetSelection<TPanel extends { id: string }, TGroup extends { id: string; active?: boolean }>(
  panels: TPanel[],
  groups: TGroup[],
  selectedPanelId: string,
  selectedGroupId: string,
  lotsOf: (group: TGroup) => unknown[],
) {
  const panelId = panels.some(panel => panel.id === selectedPanelId) ? selectedPanelId : panels[0]?.id || '';
  const availableGroups = groups.filter(group => group.active !== false && lotsOf(group).length);
  const groupId = availableGroups.some(group => group.id === selectedGroupId) ? selectedGroupId : availableGroups[0]?.id || '';
  return { panelId, groupId };
}

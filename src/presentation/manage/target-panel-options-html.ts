export function targetPanelOptionsHtml(
  panels: Array<{ id: string; name?: string; instrumentId?: string }>,
  panelId: string,
  instrumentName: (id: string | undefined) => string,
  escape: (value: unknown) => string,
) {
  return panels.map(panel => `<option value="${panel.id}" ${panel.id === panelId ? 'selected' : ''}>${escape(panel.name)} · ${escape(instrumentName(panel.instrumentId))}</option>`).join('');
}

export type ConfigPanelInstrumentOption = { id: string; selected: boolean; label: string };

export function configPanelInstrumentOptionsHtml(options: ConfigPanelInstrumentOption[]) {
  return options.map(option=>`<option value="${option.id}" ${option.selected?'selected':''}>${option.label}</option>`).join('');
}

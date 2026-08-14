export type ConfigAssayInstrumentOption = { id: string; selected: boolean; section: string; label: string };

export function configAssayInstrumentOptionsHtml(options: ConfigAssayInstrumentOption[]) {
  return options.map(option=>`<option value="${option.id}" ${option.selected?'selected':''} data-section="${option.section}">${option.label}</option>`).join('');
}

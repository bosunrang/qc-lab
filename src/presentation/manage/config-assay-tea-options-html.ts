export type ConfigAssayTeaOption = { value: string; label: string };

export function configAssayTeaOptionsHtml(options: ConfigAssayTeaOption[]) {
  return options.map(option=>`<option value="${option.value}" label="${option.label}"></option>`).join('');
}

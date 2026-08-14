export type SigmaTrackedOption = { id: string; labelHtml: string };

export function sigmaTrackedOptionsHtml(options: SigmaTrackedOption[], selectedId: string) {
  return options.map(option=>`<option value="${option.id}" ${option.id===selectedId?'selected':''}>${option.labelHtml}</option>`).join('');
}

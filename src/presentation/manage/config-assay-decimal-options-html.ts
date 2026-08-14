export function configAssayDecimalOptionsHtml(selected: string) {
  return [0,1,2,3,4,5,6].map(value=>`<option value="${value}" ${selected===String(value)?'selected':''}>${value}</option>`).join('');
}

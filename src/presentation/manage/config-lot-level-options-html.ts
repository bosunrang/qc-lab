export function configLotLevelOptionsHtml(selected: number) {
  return [1,2,3,4,5,6].map(level=>`<option${selected===level?' selected':''}>${level}</option>`).join('');
}

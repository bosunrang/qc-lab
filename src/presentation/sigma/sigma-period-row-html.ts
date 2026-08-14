export type SigmaPeriodRowInput = { id: string; selected: boolean; periodLabelHtml: string; periodSelectHtml: string; levelCellsHtml: string; actionHtml: string };

export function sigmaPeriodRowHtml(input: SigmaPeriodRowInput) {
  const selectedClass=input.selected?' sg-period-selected':'';
  const selectedValue=input.selected?'true':'false';
  return `<tr data-sg-period-id="${input.id}" class="sg-period-row${selectedClass}" tabindex="0" aria-selected="${selectedValue}" aria-label="Chọn kỳ ${input.periodLabelHtml} để xem tình trạng" onclick="sgSelectPeriod('${input.id}')" onkeydown="if((event.key==='Enter'||event.key===' ')&&event.target===event.currentTarget){event.preventDefault();sgSelectPeriod('${input.id}')}"><td class="sg-period-cell"><div class="sg-period-select-wrap">${input.periodSelectHtml}</div></td>${input.levelCellsHtml}<td class="sg-row-action sg-action-col"><div class="sg-row-action-buttons">${input.actionHtml}</div></td></tr>`;
}

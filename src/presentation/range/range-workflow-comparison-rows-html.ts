export type RangeWorkflowComparisonRow = { label: string; mean: string; sd: string; cv: string; limits: string; proposed?: boolean };

export function rangeWorkflowComparisonRowsHtml(current: RangeWorkflowComparisonRow, proposed?: RangeWorkflowComparisonRow|null) {
  const row=(value: RangeWorkflowComparisonRow)=>`<tr><td>${value.proposed?`<b>${value.label}</b>`:value.label}</td><td class="num">${value.proposed?`<b>${value.mean}</b>`:value.mean}</td><td class="num">${value.proposed?`<b>${value.sd}</b>`:value.sd}</td><td class="num">${value.proposed?`<b>${value.cv}</b>`:value.cv}</td><td class="num">${value.proposed?`<b>${value.limits}</b>`:value.limits}</td></tr>`;
  return row(current)+(proposed?row(proposed):'');
}

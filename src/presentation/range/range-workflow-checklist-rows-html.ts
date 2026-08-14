export type RangeWorkflowChecklistRow = { condition: string; current: string|number; requirement: string; passed: boolean };

export function rangeWorkflowChecklistRowsHtml(rows: RangeWorkflowChecklistRow[]) {
  return rows.map(row=>`<tr><td>${row.condition}</td><td class="num">${row.current}</td><td>${row.requirement}</td><td><span class="tag ${row.passed?'ok':'rej'}">${row.passed?'Đạt':'Chưa đạt'}</span></td></tr>`).join('');
}

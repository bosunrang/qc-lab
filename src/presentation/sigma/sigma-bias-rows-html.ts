export type SigmaBiasRow = { index: number; labValue: string; targetValue: string; biasText: string; deleteButtonHtml: string };

export function sigmaBiasRowsHtml(rows: SigmaBiasRow[]) {
  return rows.map(row=>`<tr class="sg-eqa-row"><td class="sg-eqa-index">${row.index}</td><td><input type="number" step="any" data-f="lab" value="${row.labValue}" placeholder="—" oninput="sgBiasUpdateSummary()"></td><td><input type="number" step="any" data-f="target" value="${row.targetValue}" placeholder="—" oninput="sgBiasUpdateSummary()"></td><td class="sg-eqa-bias" data-bias>${row.biasText}</td><td>${row.deleteButtonHtml}</td></tr>`).join('');
}

export type QcHistoryMeanSdRow = { lot: string; mean: string; sd: string; cumulativeMean: string; cumulativeSd: string; cumulativeCv: string; period: string; source: string };
export type QcHistoryPointRow = { date: string; run: string; value: string; z: string; mean: string; sd: string; verdict: string; verdictClass: string; staffCode: string };

export function qcHistoryMeanSdRowsHtml(rows: QcHistoryMeanSdRow[]) {
  return rows.map(row=>`<tr><td><b>${row.lot}</b></td><td class="num">${row.mean}</td><td class="num">${row.sd}</td><td class="num">${row.cumulativeMean}</td><td class="num">${row.cumulativeSd}</td><td class="num">${row.cumulativeCv}</td><td>${row.period}</td><td>${row.source}</td></tr>`).join('');
}

export function qcHistoryPointRowsHtml(rows: QcHistoryPointRow[]) {
  return rows.map(row=>`<tr><td>${row.date}</td><td>${row.run}</td><td class="num">${row.value}</td><td class="num">${row.z}</td><td class="num">${row.mean}</td><td class="num">${row.sd}</td><td><span class="tag ${row.verdictClass}">${row.verdict}</span></td><td>${row.staffCode}</td></tr>`).join('');
}

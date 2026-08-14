export type SigmaFrequencyRow = { level: number; hasResult: boolean; eligible?: boolean; sigmaText?: string; color?: string; opspecHtml?: string; readinessHtml?: string; riskText?: string; planText?: string };

export function sigmaFrequencyRowsHtml(rows: SigmaFrequencyRow[]) {
  return rows.map(row=>{
    if(!row.hasResult)return `<tr><td>Mức ${row.level}</td><td class="num">—</td><td>—</td><td>Chưa đủ CV/Bias</td><td>Chưa đánh giá</td></tr>`;
    if(!row.eligible)return `<tr><td>Mức ${row.level}</td><td class="num">${row.sigmaText}</td><td><span class="muted">Chưa đủ dữ liệu</span></td><td>${row.readinessHtml}</td><td>Không dùng để đề xuất QC</td></tr>`;
    return `<tr><td>Mức ${row.level}</td><td class="num" style="color:${row.color};font-weight:800">${row.sigmaText}</td><td>${row.opspecHtml}</td><td>${row.riskText||'—'}</td><td>${row.planText||'Xây dựng theo SOP'}</td></tr>`;
  }).join('');
}

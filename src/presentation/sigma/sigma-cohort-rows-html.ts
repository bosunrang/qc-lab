export type SigmaCohortRow = { level: number; showLevel: boolean; lotHtml: string; startText: string; endText: string; count: number; cvText: string; statusHtml: string; checked: boolean };
export type SigmaCohortGroup = { level: number; missingLotCount: number; rows: SigmaCohortRow[] };

export function sigmaCohortRowsHtml(groups: SigmaCohortGroup[]) {
  return groups.map(group=>{
    if(!group.rows.length)return `<tr><td>Mức ${group.level}</td><td colspan="5" class="muted">${group.missingLotCount?`Có ${group.missingLotCount} điểm IQC chưa gắn mã lô QC — hãy gắn mã lô cho điểm QC để dùng làm CV.`:'Không có nhóm dữ liệu IQC đã gắn mã lô trong kỳ đánh giá.'}</td></tr>`;
    return group.rows.map(row=>`<tr><td>${row.showLevel?`Mức ${row.level}`:''}</td><td><label><input type="radio" name="sgCohort_${row.level}" value="${row.lotHtml}" ${row.checked?'checked':''}> Lô ${row.lotHtml}</label></td><td>${row.startText}–${row.endText}</td><td class="num">${row.count}</td><td class="num">${row.cvText}</td><td>${row.statusHtml}</td></tr>`).join('');
  }).join('');
}

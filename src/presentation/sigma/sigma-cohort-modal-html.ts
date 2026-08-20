export type SigmaCohortModalInput = { testName: string; cutoffDate: string; sectionsHtml: string; cancelButtonHtml: string; applyButtonHtml: string };

export function sigmaCohortModalHtml(input: SigmaCohortModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Chọn dữ liệu CV IQC theo lô — ${input.testName}</h3><button class="modal-close" data-action="sgCohortClose">✕</button></div><div class="modal-b"><div class="hint space-after-control">Dữ liệu IQC được gom xuyên tháng nhưng luôn tách theo lô và mức QC. Nếu Mean/SD mục tiêu thay đổi, nhóm dữ liệu sẽ được đánh dấu không ổn định. Dữ liệu được tính đến ${input.cutoffDate}.</div><table><thead><tr><th>Mức</th><th>Lô QC</th><th>Khoảng dữ liệu</th><th class="num">n</th><th class="num">CV</th><th>Trạng thái</th></tr></thead><tbody>${input.sectionsHtml}</tbody></table></div><div class="modal-f">${input.cancelButtonHtml}${input.applyButtonHtml}</div></div>`;
}

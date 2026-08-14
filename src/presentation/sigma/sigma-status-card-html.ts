export type SigmaStatusCardInput = { level: number; color: string; sigmaText: string; label?: string; provisional: boolean; detailHtml: string };

export function sigmaStatusCardHtml(input: SigmaStatusCardInput) {
  const heading=`Mức ${input.level}${input.provisional?' — Sigma tạm tính':' — Sigma'}`;
  return `<div class="sgbig" style="background:${input.color}"><div class="lab">${heading}</div><div class="v">${input.sigmaText}</div>${input.label?`<div class="grade">${input.label}</div>`:''}<div class="sub">${input.detailHtml}</div></div>`;
}

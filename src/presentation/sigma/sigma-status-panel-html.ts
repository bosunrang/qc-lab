export type SigmaStatusPanelInput = { periodLabel: string; testName: string; teaText: string; cardsHtml: string; tipsHtml: string };

export function sigmaStatusPanelHtml(input: SigmaStatusPanelInput) {
  return `<div class="hint space-after-item">Kỳ đang xem: <b>${input.periodLabel}</b> · ${input.testName} · TEa ${input.teaText}%</div><div class="sgcards">${input.cardsHtml}</div>${input.tipsHtml}`;
}

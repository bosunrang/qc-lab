export type ActionFormSectionInput = { keyHtml: string; key: string; open: boolean; badgeHtml: string; titleHtml: string; hintHtml: string; chipHtml: string; bodyHtml: string };

export function actionFormSectionHtml(input: ActionFormSectionInput) {
  return `<details class="action-form-section" data-action-section="${input.keyHtml}" ${input.open?'open':''} data-toggle-action="actionSectionToggled" data-toggle-args='${JSON.stringify([input.key])}'><summary class="action-form-section-title"><span>${input.badgeHtml}</span><div><b>${input.titleHtml}</b><small>${input.hintHtml}</small></div>${input.chipHtml}</summary>${input.bodyHtml}</details>`;
}

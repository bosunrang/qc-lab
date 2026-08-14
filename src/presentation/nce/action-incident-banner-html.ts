export type ActionIncidentBannerInput = { titleHtml: string; detailsHtml: string };

export function actionIncidentBannerHtml(input: ActionIncidentBannerInput) {
  return `<div class="action-incident-banner"><b>${input.titleHtml}</b><div>${input.detailsHtml}</div></div>`;
}

export type ActionFormClosedInput = { title: string; message: string; actionHtml: string };

export function actionFormClosedHtml(input: ActionFormClosedInput) {
  return `<div class="empty"><b>${input.title}</b><p>${input.message}</p>${input.actionHtml}</div>`;
}

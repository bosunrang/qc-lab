export function actionSuggestBoxHtml(labelHtml: string, rowHtml: string) {
  return `<details class="action-suggestions"><summary>+ ${labelHtml}</summary>${rowHtml}</details>`;
}

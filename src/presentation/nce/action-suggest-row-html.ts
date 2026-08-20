export type ActionSuggestPhrase = { phraseHtml: string; phrase: string };

function escapeAttribute(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function actionSuggestRowHtml(targetIdHtml: string, targetId: string, phrases: ActionSuggestPhrase[]) {
  if(!phrases.length)return '';
  const chips=phrases.map(phrase=>`<button type="button" class="sugg-chip" data-action="actionInsertSuggestion" data-args="${escapeAttribute(JSON.stringify([targetId, phrase.phrase]))}">${phrase.phraseHtml}</button>`).join('');
  return `<div class="sugg-row" id="sugg-${targetIdHtml}">${chips}</div>`;
}

export type ActionSuggestPhrase = { phraseHtml: string; phraseJs: string };

export function actionSuggestRowHtml(targetIdHtml: string, targetIdJs: string, phrases: ActionSuggestPhrase[]) {
  if(!phrases.length)return '';
  const chips=phrases.map(phrase=>`<button type="button" class="sugg-chip" onclick="actionInsertSuggestion('${targetIdJs}','${phrase.phraseJs}')">${phrase.phraseHtml}</button>`).join('');
  return `<div class="sugg-row" id="sugg-${targetIdHtml}">${chips}</div>`;
}

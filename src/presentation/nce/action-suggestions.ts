type SuggestionMap = Record<string, readonly string[]>;

type ActionSuggestionsDependencies = {
  escape: (value: unknown) => string;
  quote: (value: unknown) => string;
};

export type ActionSuggestionsApi = {
  configure: (causeSuggestions: SuggestionMap, actionSuggestions: SuggestionMap) => void;
  causePhrases: (category: unknown) => readonly string[];
  actionPhrases: (errorType: unknown) => readonly string[];
  row: (targetId: string, phrases: readonly string[]) => string;
};

export function createActionSuggestions(deps: ActionSuggestionsDependencies): ActionSuggestionsApi {
  let causeSuggestions: SuggestionMap = {};
  let actionSuggestions: SuggestionMap = {};
  const configure = (nextCauseSuggestions: SuggestionMap, nextActionSuggestions: SuggestionMap) => {
    causeSuggestions = nextCauseSuggestions;
    actionSuggestions = nextActionSuggestions;
  };
  const causePhrases = (category: unknown) => causeSuggestions[String(category || '')]
    || Object.values(causeSuggestions).flat().slice(0, 4);
  const actionPhrases = (errorType: unknown) => actionSuggestions[String(errorType || '').slice(0, 2)]
    || actionSuggestions[''] || [];
  const row = (targetId: string, phrases: readonly string[]) => !phrases.length ? ''
    : `<div class="sugg-row" id="sugg-${deps.escape(targetId)}">${phrases.map(phrase => `<button type="button" class="sugg-chip" onclick="actionInsertSuggestion('${deps.quote(targetId)}','${deps.quote(phrase)}')">${deps.escape(phrase)}</button>`).join('')}</div>`;
  return { configure, causePhrases, actionPhrases, row };
}

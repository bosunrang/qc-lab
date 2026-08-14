export function actionCausePhrases(category: string, phrases: Record<string, string[]>) {
  return phrases[category]||Object.values(phrases).flat().slice(0,4);
}

export function actionPhrases(errorType: string, phrases: Record<string, string[]>) {
  return phrases[String(errorType||'').slice(0,2)]||phrases['']||[];
}

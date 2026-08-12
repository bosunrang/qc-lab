export function targetLevelSelection(lots: Array<{ level?: number | string }>, selectedLevel: string) {
  const levels = [...new Set(lots.map(lot => Number(lot.level)).filter(Number.isFinite))].sort((left, right) => left - right);
  const level = levels.map(String).includes(String(selectedLevel)) ? String(selectedLevel) : levels[0] != null ? String(levels[0]) : '';
  return { levels, level };
}

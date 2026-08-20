export function targetLevelTabsHtml(levels: number[], selectedLevel: string) {
  return levels.map(level => `<button class="${String(level) === String(selectedLevel) ? 'on' : ''}" data-action="setTargetLevel" data-args="[${level}]">Mức ${level}</button>`).join('');
}

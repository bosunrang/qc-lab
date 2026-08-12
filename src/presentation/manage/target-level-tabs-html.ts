export function targetLevelTabsHtml(levels: number[], selectedLevel: string, setLevelAction = 'setTargetLevel') {
  return levels.map(level => `<button class="${String(level) === String(selectedLevel) ? 'on' : ''}" onclick="${setLevelAction}(${level})">Mức ${level}</button>`).join('');
}

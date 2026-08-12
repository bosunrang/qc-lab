export function targetLevelLots<T extends { level?: number | string; depleted?: boolean }>(lots: T[], selectedLevel: string | number) {
  const levelLots = lots.filter(lot => Number(lot.level) === Number(selectedLevel));
  return { levelLots, depletedLots: levelLots.filter(lot => !!lot.depleted) };
}

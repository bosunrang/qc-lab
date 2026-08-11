export function createWestgardCusumLevels<T extends Record<string, any>, L extends Record<string, any>, P>(deps: {
  levels: (test: T) => L[];
  points: (test: T, level: unknown) => P[];
}) {
  return (test: T) => deps.levels(test).map(level => ({ ...level, pts: deps.points(test, level.level) }));
}

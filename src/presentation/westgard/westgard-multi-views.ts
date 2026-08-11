export function createWestgardMultiViews<T extends Record<string, any>, L extends Record<string, any>>(deps: {
  levels: (test: T) => L[];
  points: (test: T, level: unknown) => unknown[];
  previous: (test: T, level: unknown) => unknown;
  build: (input: { levels: Array<L & { pts: unknown[] }>; previousByLevel: Map<unknown, unknown>; openLevels: unknown[] }) => unknown;
}) {
  return (test: T, openKeys: ReadonlySet<string>) => {
    const levels = deps.levels(test).map(level => ({ ...level, pts: deps.points(test, level.level) }));
    const previousByLevel = new Map(levels.map(level => [level.level, deps.previous(test, level.level)]));
    const openLevels = levels.filter(level => openKeys.has(`${test.id}|${level.level}`)).map(level => level.level);
    return deps.build({ levels, previousByLevel, openLevels });
  };
}

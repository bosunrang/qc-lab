type TestLike = Record<string, any>;
type LevelLike = { l: { level: unknown; lot?: string } };

export function createDashboardTestSearchText(deps: { normalize: (value: unknown) => string; label: (test: TestLike) => string }) {
  return (test: TestLike, levels: LevelLike[]) => deps.normalize([test.name, deps.label(test), test.machine, test.section, test.method, test.unit, ...levels.map(item => `M${item.l.level} ${item.l.lot || ''}`)].join(' '));
}

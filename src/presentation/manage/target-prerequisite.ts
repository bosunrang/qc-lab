export type TargetPrerequisite = 'tests' | 'panels' | 'lots' | 'groups' | null;

export function targetPrerequisite(counts: { tests: number; panels: number; lots: number; groups: number }): TargetPrerequisite {
  if (!counts.tests) return 'tests';
  if (!counts.panels) return 'panels';
  if (!counts.lots) return 'lots';
  if (!counts.groups) return 'groups';
  return null;
}

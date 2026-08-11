export type WestgardArchivedGroup = { active?: boolean; status?: string; stoppedAt?: string; name?: string };

export function westgardArchivedGroups<T extends WestgardArchivedGroup>(groups: readonly T[] | null | undefined): T[] {
  return (groups || []).filter(group => group?.active === false || group?.status === 'stopped').slice().sort((left, right) =>
    String(right.stoppedAt || '').localeCompare(String(left.stoppedAt || '')) || String(left.name || '').localeCompare(String(right.name || ''), 'vi'));
}

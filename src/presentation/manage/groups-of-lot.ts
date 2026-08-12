export function groupsOfLot<T extends { lotIds?: string[] }>(groups: T[], lotId: string) {
  return groups.filter(group => (group.lotIds || []).includes(lotId));
}

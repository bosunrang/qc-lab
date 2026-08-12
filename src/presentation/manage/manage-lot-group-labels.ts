export function manageLotGroupLabels(groups: Array<{ name?: string; lotIds?: string[] }>, lotId: string) {
  const names = groups.filter(group => (group.lotIds || []).includes(lotId)).map(group => group.name || '');
  return names.length ? names.join(', ') : 'Chưa thuộc nhóm';
}

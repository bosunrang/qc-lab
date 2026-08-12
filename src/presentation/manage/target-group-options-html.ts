export function targetGroupOptionsHtml<T extends { id: string }>(
  groups: T[],
  selectedId: string,
  lotsOf: (group: T) => unknown[],
  labelOf: (group: T) => string,
  statusSuffix: (group: T) => string,
  escape: (value: unknown) => string,
) {
  const available = groups.filter(group => lotsOf(group).length);
  return available.length
    ? available.map(group => `<option value="${group.id}" ${group.id === selectedId ? 'selected' : ''}>${escape(labelOf(group) + statusSuffix(group))}</option>`).join('')
    : '<option value="">Không tìm thấy nhóm lô QC phù hợp</option>';
}

export function targetGroupStatusSuffix(group?: { status?: string }) {
  if (group?.status === 'stopped') return ' · Đã dừng';
  if (group?.status === 'planned') return ' · Dự kiến';
  return '';
}

export function qcLotGroupOperational(group: Record<string, any> | null | undefined): boolean {
  return !!group && group.active !== false && group.status !== 'stopped' && group.status !== 'planned';
}

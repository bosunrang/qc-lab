export function selectUserPermissions(selectedIds: unknown, allowedIds: unknown): string[] {
  const allowed = new Set(Array.isArray(allowedIds) ? allowedIds.map(value => String(value)) : []);
  const selected = Array.isArray(selectedIds) ? selectedIds : [];
  return [...new Set(selected.map(value => String(value)).filter(id => allowed.has(id)))];
}

type TeaReferenceRow = { section?: string; displayName?: string };

export function sortTeaReferences<T extends TeaReferenceRow>(rows: T[]) {
  return rows.sort((left, right) => String(left.section || '').localeCompare(String(right.section || ''), 'vi') || String(left.displayName || '').localeCompare(String(right.displayName || ''), 'vi'));
}

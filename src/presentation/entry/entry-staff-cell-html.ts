type EntryStaff = { code?: string; name?: string };

type EntryStaffCellDependencies = { escape: (value: unknown) => string };

export function createEntryStaffCellHtml(deps: EntryStaffCellDependencies) {
  return (staff: readonly EntryStaff[]) => !staff.length ? '—' : staff.map(person => `<span class="qc-staff" title="${deps.escape(person.name || person.code || '')}">${deps.escape(person.code || '')}</span>`).join('<span class="qc-staff-sep">/</span>');
}

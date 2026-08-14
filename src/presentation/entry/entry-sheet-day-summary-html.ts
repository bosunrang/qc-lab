type EntrySheetStaff = { code?: unknown; name?: unknown };

export function createEntrySheetDaySummaryHtml(deps: { escape: (value: unknown) => string; escapeAttribute: (value: unknown) => string }) {
  return Object.freeze({
    staff: (staff: EntrySheetStaff[]) => staff.length ? staff.map(item => `<span class="qc-staff" title="${deps.escapeAttribute(item.name || item.code)}">${deps.escape(item.code)}</span>`).join('<span class="qc-staff-sep">/</span>') : '—',
    status: (hasPoint: boolean, worst: string) => !hasPoint ? '—' : worst === 'rej' ? '<span class="tag rej">R</span>' : worst === 'warn' ? '<span class="tag warn">W(A)</span>' : '<span class="tag ok">A</span>',
  });
}

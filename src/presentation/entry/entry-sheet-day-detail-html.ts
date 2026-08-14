type EntrySheetNoteInput = { hasPoint: boolean; writable: boolean; placeholder: string; changeAction: string; manualNote: string; autoNote: string };
type EntrySheetAddRunInput = { visible: boolean; action: string };

export function entrySheetNoteHtml(input: EntrySheetNoteInput) {
  if (!input.hasPoint) return '—';
  if (input.writable) return `<textarea class="qc-note-input" rows="1" placeholder="${input.placeholder}" onchange="${input.changeAction}">${input.manualNote}</textarea>`;
  return input.manualNote || input.autoNote || '—';
}

export function entrySheetAddRunHtml(input: EntrySheetAddRunInput) {
  return input.visible ? `<button type="button" class="qc-add-run-btn" title="Thêm lần chạy bổ sung" onclick="${input.action}"><span class="qc-add-run-icon">+</span><span class="qc-add-run-label">Thêm</span></button>` : '';
}

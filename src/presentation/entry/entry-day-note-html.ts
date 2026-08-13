type EntryDayNoteInput = {
  hasPoint: boolean;
  canWrite: boolean;
  testId: string;
  date: string;
  automaticNote: string;
  manualNote: string;
};

type EntryDayNoteDependencies = { escape: (value: unknown) => string };

export function createEntryDayNoteHtml(deps: EntryDayNoteDependencies) {
  return (input: EntryDayNoteInput) => {
    if (!input.hasPoint) return '—';
    if (!input.canWrite) return input.manualNote ? deps.escape(input.manualNote) : deps.escape(input.automaticNote || '—');
    return `<textarea class="qc-note-input" rows="1" placeholder="${deps.escape(input.automaticNote || 'Nhập ghi chú...')}" onchange="entryDateNoteSave('${deps.escape(input.testId)}','${deps.escape(input.date)}',this.value)">${deps.escape(input.manualNote)}</textarea>`;
  };
}

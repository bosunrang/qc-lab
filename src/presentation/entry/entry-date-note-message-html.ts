type EntryDateNoteFeedback = { cls: string; message: string } | null;

export function createEntryDateNoteMessageHtml(deps: { escape: (value: unknown) => string }) {
  return (input: { feedback: EntryDateNoteFeedback; note: string; dateText: string }) => {
    if (input.feedback) return `<div class="alert ${deps.escape(input.feedback.cls)}">${deps.escape(input.feedback.message)}</div>`;
    const message = input.note ? `✓ Đã lưu ghi chú ngày ${input.dateText}.` : `✓ Đã xóa ghi chú ngày ${input.dateText}.`;
    return `<div class="alert ok">${deps.escape(message)}</div>`;
  };
}

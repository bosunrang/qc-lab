export function entryDateNoteFeedback(note: unknown, dateText: string) {
  return note
    ? { cls: 'ok', message: `✓ Đã lưu ghi chú ngày ${dateText}.` }
    : { cls: 'ok', message: `✓ Đã xóa ghi chú ngày ${dateText}.` };
}

export function entryDateNoteErrorMessage(error: unknown) {
  return error === 'period-locked' ? 'Kỳ này đã chốt, không thể sửa ghi chú.' : '';
}

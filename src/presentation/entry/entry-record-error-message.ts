export function entryRecordErrorMessage(error: unknown) {
  return error === 'period-locked'
    ? 'Kỳ này đã chốt, không thể nhập điểm QC.'
    : 'Không thể lưu điểm QC không hợp lệ.';
}

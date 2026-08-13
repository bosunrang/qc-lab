export function entryVoidConfirmDialog(detail: string) {
  return {
    kicker: 'Thao tác không thể hoàn tác',
    title: 'Hủy điểm QC',
    message: 'Hủy điểm QC này khỏi tính toán Westgard/thống kê?',
    detail,
    confirmLabel: 'Hủy điểm QC',
    cancelLabel: 'Quay lại',
  };
}

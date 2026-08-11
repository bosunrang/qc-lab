export function entryVoidNceChoice(kind: unknown) {
  if (kind === 'analytical') return {
    openNce: true, disabled: true,
    hint: 'Hệ thống sẽ lập hồ sơ NCE mới, hoặc dùng lại hồ sơ đang mở của điểm này, rồi chờ một kết quả QC chạy lại được chấp nhận.',
    reasonLabel: 'Ghi chú / bằng chứng (khuyến nghị)',
  };
  if (kind === 'data-entry') return {
    openNce: false, disabled: true,
    hint: 'Chỉ lưu dấu vết hủy; không mở NCE và không yêu cầu chạy lại QC.',
    reasonLabel: 'Ghi chú / bằng chứng (khuyến nghị)',
  };
  return {
    openNce: false, disabled: false,
    hint: 'Chọn mục này nếu sự việc cần điều tra và xác nhận QC chạy lại.',
    reasonLabel: 'Lý do hủy (bắt buộc, tối thiểu 5 ký tự)',
  };
}

export function entryVoidReasonValid(kind: unknown, reason: unknown) {
  return kind !== 'other' || String(reason || '').trim().length >= 5;
}

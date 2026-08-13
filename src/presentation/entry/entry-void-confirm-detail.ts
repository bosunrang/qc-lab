export function entryVoidConfirmDetail(openNce: boolean) {
  return openNce
    ? 'Điểm vẫn được giữ trong nhật ký; hồ sơ NCE sẽ được lập mới hoặc dùng lại, và yêu cầu QC chạy lại.'
    : 'Điểm vẫn được giữ trong nhật ký; thao tác này không tự mở hồ sơ NCE.';
}

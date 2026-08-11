export function dashboardShiftStatus(input: { rejected: number; overdueActions: number; warnings: number; missingToday: number }) {
  if (input.rejected) return { mood: 'Cần xử lý ngay', text: 'Có xét nghiệm đang bị loại, ưu tiên kiểm tra và ghi nhận khắc phục.' };
  if (input.overdueActions) return { mood: 'Có hồ sơ NCE quá hạn', text: `${input.overdueActions} hồ sơ khắc phục đã qua hạn xử lý mà chưa khép vòng.` };
  if (input.warnings) return { mood: 'Có cảnh báo cần theo dõi', text: 'Có tín hiệu cảnh báo, nên xem lại biểu đồ và xu hướng trước khi trả kết quả.' };
  if (input.missingToday) return { mood: 'Còn QC cần nhập', text: 'Một số xét nghiệm chưa đủ QC hôm nay, nên hoàn tất trước giờ chạy mẫu.' };
  return { mood: 'Đang trong kiểm soát', text: 'Không có cảnh báo trọng yếu trong dữ liệu hiện tại.' };
}

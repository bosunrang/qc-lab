type Readiness = Record<string, any>;

export function actionApprovalReadinessMessage(readiness: Readiness, afterAuth: boolean) {
  if (readiness.reason === 'cancelled') return 'Hồ sơ đã hủy không thể được duyệt.';
  if (readiness.reason === 'unrecorded') return afterAuth ? 'Chưa có hành động khắc phục thực tế để duyệt.' : 'Chưa có hành động khắc phục thực tế để duyệt. Hãy ghi hành động trước.';
  if (readiness.reason === 'protocol') return (afterAuth ? 'Phiếu điều tra không còn đủ điều kiện duyệt: ' : 'Chưa thể duyệt vì phiếu điều tra còn thiếu: ') + (readiness.missing || []).join(', ') + '.';
  if (readiness.reason === 'rerun') return afterAuth ? 'Kết quả QC chạy lại không còn hợp lệ.' : 'Chưa thể duyệt vì chưa có kết quả QC chạy lại được chấp nhận.';
  if (readiness.reason === 'effectiveness') return afterAuth ? 'Đánh giá hiệu lực không còn đủ điều kiện khép vòng.' : 'Chưa thể duyệt vì hành động chưa được đánh giá là có hiệu lực.';
  if (readiness.reason === 'not-pending') return 'Hồ sơ không còn ở trạng thái chờ duyệt.';
  if (readiness.reason === 'non-independent') return afterAuth ? 'Không thể duyệt hồ sơ do tài khoản này đã tham gia tạo hoặc chỉnh sửa nội dung.' : 'Người ghi nhận hành động không được tự duyệt chính hành động đó. Hãy đăng nhập bằng tài khoản quản trị độc lập.';
  return 'Hồ sơ không còn đủ điều kiện duyệt.';
}

export function actionReviewReadinessMessage(kind: string, readiness: Readiness, afterAuth: boolean) {
  if (kind === 'cancel') {
    if (readiness.reason === 'cancelled') return afterAuth ? '' : 'Hồ sơ này đã được hủy và đang được giữ lại trong nhật ký.';
    if (readiness.reason === 'approved') return afterAuth ? 'Không thể hủy hồ sơ đã duyệt.' : 'Không thể hủy hồ sơ đã duyệt. Nếu cần xử lý tiếp, hãy lập hồ sơ NCE mới.';
    if (readiness.reason === 'follow-up') return afterAuth ? 'Không thể hủy vì hồ sơ này vừa phát sinh một hồ sơ nối tiếp đang hoạt động.' : `Không thể hủy ${readiness.action?.nceId || 'hồ sơ này'} khi hồ sơ nối tiếp ${readiness.followUp?.nceId || readiness.action?.followUpNceId || ''} vẫn đang hoạt động. Hãy xử lý hoặc hủy hồ sơ nối tiếp trước.`;
  }
  if (kind === 'return') {
    if (readiness.reason === 'cancelled') return 'Hồ sơ đã hủy không thể trả lại để chỉnh sửa.';
    if (readiness.reason === 'not-pending') return 'Hồ sơ không còn ở trạng thái chờ duyệt.';
  }
  return actionApprovalReadinessMessage(readiness, afterAuth);
}

export const actionReviewMessages = Object.freeze({ approval: actionApprovalReadinessMessage, review: actionReviewReadinessMessage });

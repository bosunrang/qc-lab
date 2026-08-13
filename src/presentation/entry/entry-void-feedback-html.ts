export function createEntryVoidFeedbackHtml(deps: { escape: (value: unknown) => string }) {
  return (input: { dateText: string; openNce: boolean; reusedAction: boolean; nceId: unknown }) => {
    const followup = !input.openNce ? ' Không yêu cầu NCE/QC chạy lại.'
      : input.reusedAction ? ' Đã giữ liên kết với hồ sơ NCE đang mở.'
      : ` Đã mở hồ sơ ${deps.escape(input.nceId || 'NCE')} để tiếp tục điều tra.`;
    return `<div class="alert warn">Đã hủy điểm QC ngày ${deps.escape(input.dateText)}. Điểm không còn tham gia tính toán.${followup}</div>`;
  };
}

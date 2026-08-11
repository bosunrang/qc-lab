export type ReportNceAppendixApi = ReturnType<typeof createReportNceAppendix>;

export function createReportNceAppendix(deps: { detail: (action: Record<string, any>, test: Record<string, any>) => string }) {
  return (actions: Record<string, any>[], test: Record<string, any>) =>
    '<div class="nce-appendix"><h3>Phụ lục - Hồ sơ NCE chi tiết</h3><p class="nce-appendix-intro">Phụ lục giữ đầy đủ nội dung điều tra, bằng chứng QC chạy lại, đánh giá hiệu lực và phê duyệt. Bảng tổng hợp phía trên chỉ trình bày thông tin trọng yếu.</p>' + actions.map(action => deps.detail(action, test)).join('') + '</div>';
}

type ActionFormShellDependencies = {
  emptyState: (title: string, description: string, action: string) => string;
  button: (label: string, action: string, variant: string) => string;
  escape: (value: unknown) => string;
};

export type ActionFormShellApi = {
  closed: (issueCount: number, canWrite: boolean) => string;
  incidentBanner: (input: { editing: boolean; nceId?: string; details: readonly string[] }) => string;
};

export function createActionFormShell(deps: ActionFormShellDependencies): ActionFormShellApi {
  const closed = (issueCount: number, canWrite: boolean) => {
    const manual = canWrite ? deps.button('Lập hồ sơ từ nguồn khác', 'beginActionManual()', 'ghost') : '';
    return issueCount
      ? deps.emptyState('Chọn một sự cố để lập hồ sơ', `Có ${issueCount} sự cố ở trên — bấm "Lập hồ sơ" ngay trên dòng cần xử lý để hồ sơ được gắn đúng điểm QC và tự theo dõi QC chạy lại.`, manual)
      : deps.emptyState('Không có vi phạm nào cần lập hồ sơ', 'Hồ sơ NCE thường bắt đầu từ một vi phạm ở trên. Nếu sự không phù hợp đến từ EQA, cảnh báo thiết bị, phản hồi lâm sàng hay đánh giá nội bộ thì mở hồ sơ thủ công.', manual);
  };
  const incidentBanner = (input: { editing: boolean; nceId?: string; details: readonly string[] }) => {
    if (!input.details.length) return '';
    const title = input.editing ? `Đang tiếp tục hồ sơ ${input.nceId || 'NCE'}` : 'Đang lập hồ sơ cho vi phạm này';
    return `<div class="action-incident-banner"><b>${deps.escape(title)}</b><div>${input.details.map(deps.escape).join(' · ')}</div></div>`;
  };
  return { closed, incidentBanner };
}

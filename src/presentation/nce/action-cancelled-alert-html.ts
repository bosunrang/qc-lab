export function createActionCancelledAlertHtml(deps: { escape: (value: unknown) => string }) {
  return (model?: { reason?: string; by?: string; at?: string }) => !model ? '' : `<div class="alert warn"><b>Hồ sơ đã hủy — dữ liệu được giữ để truy xuất.</b><div>${deps.escape(model.reason || 'Không có lý do')}${model.by ? ' · ' + deps.escape(model.by) : ''}${model.at ? ' · ' + deps.escape(model.at) : ''}</div></div>`;
}

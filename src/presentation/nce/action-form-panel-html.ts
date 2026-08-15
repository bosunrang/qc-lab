export type ActionFormPanelInput = {
  editing: Record<string, unknown> | null | undefined;
  formOpen: boolean;
  guideButtonHtml: string;
  closedHtml: string;
  formBodyHtml: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Khung ổn định của biểu mẫu NCE; nội dung và handler vẫn do compatibility layer cung cấp. */
export function actionFormPanelHtml(input: ActionFormPanelInput) {
  const editing = input.editing;
  const title = editing
    ? `Tiếp tục hồ sơ ${escapeHtml(editing.nceId || 'NCE')}`
    : 'Lập hồ sơ sự không phù hợp (NCE)';
  return `<div class="panel action-form-panel"><div class="action-form-panel-head"><h2 class="panel-title">${title}</h2>${input.guideButtonHtml}</div>${input.formOpen ? `<div class="action-form-body" oninput="actionFormChanged()" onchange="actionFormChanged()">${input.formBodyHtml}</div>` : input.closedHtml}</div>`;
}

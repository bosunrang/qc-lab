export type ActionCauseDetailModel = { cause?: string; action?: string; completedDate?: string; release?: { status: string; details?: string } };

export function createActionCauseDetailHtml(deps: { escape: (value: unknown) => string }) {
  return (model: ActionCauseDetailModel) => `<li><b>Nguyên nhân, hành động và QC chạy lại</b><div>${deps.escape(model.cause || 'Chưa xác định nguyên nhân')}</div><div>${deps.escape(model.action || 'Chưa ghi hành động khắc phục')}</div>${model.completedDate ? `<div class="hint">Hoàn thành hành động: ${deps.escape(model.completedDate)}</div>` : ''}${model.release ? `<div><b>${deps.escape(model.release.status || 'Chưa cho phép hoạt động/trả kết quả trở lại')}</b></div>${model.release.details ? `<div class="hint">${deps.escape(model.release.details)}</div>` : ''}` : ''}</li>`;
}

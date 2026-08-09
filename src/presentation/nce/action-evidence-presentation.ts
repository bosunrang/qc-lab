type Action = Record<string, any>;
type Point = Record<string, any>;

export type ActionEvidencePresentationDeps = {
  pointForAction: (action: Action) => Point | null;
  eventDate: (action: Action) => string;
  formatDate: (value: unknown) => string;
  formatDateTime: (value: string) => string;
};

export function createActionEvidencePresentation(deps: ActionEvidencePresentationDeps) {
  const time = (value: unknown, dateOnly = false) => {
    if (!value) return '—';
    return dateOnly ? deps.formatDate(value) : (deps.formatDateTime(String(value)) || deps.formatDate(value));
  };
  const timeline = (action: Action, rerunStatus: Record<string, any> | null | undefined) => {
    const point = deps.pointForAction(action), rerun = rerunStatus?.point, eventDate = deps.eventDate(action);
    const voidText = !point ? 'Không áp dụng' : point.voided ? (point.voidedAt ? time(point.voidedAt) : 'Đã hủy · thiếu thời điểm') : 'Chưa hủy';
    const openedText = action.createdAt ? time(action.createdAt) : time(action.date, true);
    return [
      { label: 'Ngày xảy ra', value: time(eventDate, true), note: point?.runId ? `Lần ${point.runId}` : '' },
      { label: 'QC chạy lại', value: !point ? 'Không áp dụng' : rerun ? time(rerun.date, true) : '—', note: !point ? 'Nguồn ngoài IQC' : rerun?.runId ? `Lần ${rerun.runId}` : 'Chưa có điểm phù hợp' },
      { label: 'Hủy điểm', value: voidText, note: point?.voidedBy ? `Bởi ${point.voidedBy}` : '' },
      { label: 'Mở hồ sơ', value: openedText, note: action.nceId || 'NCE' },
    ];
  };
  return Object.freeze({ time, timeline });
}

export type ActionEvidencePresentation = ReturnType<typeof createActionEvidencePresentation>;

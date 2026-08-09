import { nceActionLabels } from './action-labels';

export function createActionDraftStatus(deps: { todayIso: () => string; isRecorded: (action: Record<string, any>) => boolean; pointForAction: (action: Record<string, any>) => Record<string, any> | null }) {
  return (action: Record<string, any> | null | undefined) => {
    if (!action || Number(action.protocolVersion) < 2) { const complete = !!action && deps.isRecorded(action); return { complete, missing: complete ? [] : ['hành động và người thực hiện'], missingKeys: complete ? [] : ['action'] }; }
    const missing: string[] = [], missingKeys: string[] = [], need = (condition: boolean, label: string, key: string) => { if (condition) { missing.push(label); missingKeys.push(key); } };
    need(!!action.date && action.date > deps.todayIso(), 'ngày ghi nhận sự cố không được ở tương lai', 'date');
    need(!nceActionLabels.actionLabels.source[action.eventSource as keyof typeof nceActionLabels.actionLabels.source], 'nguồn phát hiện', 'eventSource');
    need(!nceActionLabels.actionLabels.phase[action.processPhase as keyof typeof nceActionLabels.actionLabels.phase], 'giai đoạn quá trình', 'processPhase');
    need(!nceActionLabels.actionLabels.containment[action.containmentStatus as keyof typeof nceActionLabels.actionLabels.containment], 'kiểm soát tức thời (mục 1)', 'containmentStatus');
    need(String(action.correction || '').trim().length < 5, 'xử lý tức thời đã thực hiện', 'correction');
    need(!String(action.by || '').trim(), 'người phụ trách', 'by'); need(!String(action.dueDate || '').trim(), 'hạn hoàn thành', 'dueDate');
    need(action.eventSource === 'iqc' && !String(action.pointId || '').trim(), 'sự cố nội kiểm IQC phải mở từ dòng vi phạm', 'eventSource');
    need(action.eventSource === 'iqc' && !!String(action.pointId || '').trim() && !deps.pointForAction(action), 'điểm QC liên kết không còn tồn tại hoặc không thuộc đúng xét nghiệm', 'eventSource');
    return { complete: !missing.length, missing, missingKeys };
  };
}

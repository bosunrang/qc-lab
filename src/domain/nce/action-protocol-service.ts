import { actionResidualRiskScore, actionRiskScore } from './action-basics';
import { nceActionLabels } from './action-labels';

type Action = Record<string, any>;
type Status = Record<string, any>;

export type ActionProtocolServiceDeps = {
  todayIso: () => string;
  draftStatus: (action: Action) => { missing: string[]; missingKeys: string[] };
  needsRerun: (action: Action) => boolean;
  rerunStatus: (action: Action) => Status;
  activeFollowUp: (action: Action) => Action | null;
  isCancelled: (action: Action) => boolean;
  formatDate: (value: string) => string;
};

const draftSection: Record<string, string> = {
  date: 'ident', eventSource: 'ident', processPhase: 'ident', by: 'ident', dueDate: 'ident',
  containmentStatus: 'immediate', correction: 'immediate', action: 'cause', actionCompletedDate: 'cause',
};

export function createActionProtocolService(deps: ActionProtocolServiceDeps) {
  const { actionLabels, protocolChecks, riskScale } = nceActionLabels;
  const has = (labels: Record<string, string>, value: unknown) => !!labels[String(value || '')];

  const protocolStatus = (action: Action | null | undefined): Status => {
    if (!action || !action.protocolVersion) return { required: false, complete: true, label: 'Hồ sơ cũ', missing: [], missingBySection: {} };
    const missing: string[] = [], bySection: Record<string, string[]> = { ident: [], immediate: [], risk: [], check: [], cause: [], patient: [] };
    const need = (condition: boolean, label: string, section: string) => { if (condition) { missing.push(label); bySection[section]?.push(label); } };
    if (Number(action.protocolVersion) >= 2) {
      const draft = deps.draftStatus(action);
      draft.missing.forEach((label, index) => { missing.push(label); bySection[draftSection[draft.missingKeys[index]] || 'ident'].push(label); });
      need(!has(actionLabels.risk, action.riskLevel) || ![action.riskSeverity, action.riskOccurrence, action.riskDetectability].every(value => riskScale.includes(Number(value))), 'đánh giá nguy cơ', 'risk');
      need(Number(action.protocolVersion) >= 3 && has(actionLabels.risk, action.riskLevel) && [action.riskSeverity, action.riskOccurrence, action.riskDetectability].every(value => riskScale.includes(Number(value))) && String(action.riskBasis || '').trim().length < 5, 'căn cứ phân loại nguy cơ theo SOP', 'risk');
      need(!!action.date && !!action.dueDate && action.dueDate < action.date, 'hạn hoàn thành không được trước ngày ghi nhận sự cố', 'ident');
    }
    need(Number(action.protocolVersion) < 2 && !has(actionLabels.containment, action.containmentStatus), 'kiểm soát tức thời', 'immediate');
    need(Number(action.protocolVersion) >= 2 && action.containmentStatus === 'held' && String(action.containmentNote || '').trim().length < 3, 'ghi chú phạm vi kiểm soát tức thời', 'immediate');
    protocolChecks.forEach(([key, label]) => {
      const low = label.toLocaleLowerCase('vi'); const value = action[key];
      need(!has(actionLabels.check, value), low, 'check');
      need(has(actionLabels.check, value) && ['abnormal', 'na', 'checked-abnormal'].includes(value) && String(action[key.replace('Status', 'Note')] || '').trim().length < 3, `${low} (ghi chú)`, 'check');
    });
    need(!has(actionLabels.cause, action.causeCategory) || String(action.cause || '').trim().length < 5, 'nguyên nhân', 'cause');
    need(String(action.action || '').trim().length < 5, 'hành động khắc phục', 'cause');
    need(Number(action.protocolVersion) >= 3 && String(action.action || '').trim().length >= 5 && !action.actionCompletedDate, 'ngày hoàn thành hành động khắc phục', 'cause');
    need(!!action.actionCompletedDate && !!action.date && action.actionCompletedDate < action.date, 'ngày hoàn thành hành động không được trước ngày ghi nhận sự cố', 'cause');
    need(!!action.actionCompletedDate && action.actionCompletedDate > deps.todayIso(), 'ngày hoàn thành hành động không được ở tương lai', 'cause');
    const releaseRequired = Number(action.protocolVersion) >= 3 && action.containmentStatus === 'held';
    need(releaseRequired && !has(actionLabels.release, action.releaseStatus), 'quyết định cho phép hoạt động/trả kết quả trở lại', 'cause');
    if (releaseRequired && has(actionLabels.release, action.releaseStatus)) {
      const rerun = deps.needsRerun(action) ? deps.rerunStatus(action) : null;
      need(!action.releaseDate, 'ngày cho phép hoạt động/trả kết quả trở lại', 'cause');
      need(String(action.releaseBy || '').trim().length < 2, 'người cho phép hoạt động/trả kết quả trở lại', 'cause');
      need(String(action.releaseNote || '').trim().length < 5, 'căn cứ cho phép hoạt động/trả kết quả trở lại', 'cause');
      need(!!action.releaseDate && !!action.actionCompletedDate && action.releaseDate < action.actionCompletedDate, 'ngày cho phép trở lại không được trước ngày hoàn thành hành động', 'cause');
      need(!!action.releaseDate && !!rerun?.point?.date && action.releaseDate < rerun.point.date, 'ngày cho phép trở lại không được trước QC chạy lại được dùng làm bằng chứng', 'cause');
      need(!!action.releaseDate && action.releaseDate > deps.todayIso(), 'ngày cho phép trở lại không được ở tương lai', 'cause');
      need(action.releaseStatus === 'released' && deps.needsRerun(action) && !rerun?.ok, 'chỉ được cho phép trở lại sau khi QC chạy lại được chấp nhận', 'cause');
    }
    need(!has(actionLabels.patient, action.patientImpact), 'đánh giá ảnh hưởng bệnh nhân', 'patient');
    need(['held', 'affected'].includes(action.patientImpact) && String(action.patientAction || '').trim().length < 5, 'xử lý kết quả bệnh nhân', 'patient');
    need(action.containmentStatus === 'none' && ['held', 'affected'].includes(action.patientImpact), 'mâu thuẫn giữa mục 1 (không có kết quả liên quan) và mục 7', 'patient');
    const unique = [...new Set(missing)], missingBySection = Object.fromEntries(Object.entries(bySection).map(([key, values]) => [key, [...new Set(values)]]));
    return { required: true, complete: !unique.length, label: unique.length ? `Thiếu: ${unique.join(', ')}` : 'Đã hoàn tất checklist điều tra', missing: unique, missingBySection };
  };

  const effectivenessStatus = (action: Action | null | undefined): Status => {
    if (!action || !(Number(action.protocolVersion) >= 2)) return { required: false, complete: true, effective: true, label: 'Không yêu cầu cho hồ sơ cũ', cls: 'none', escalated: false };
    if (action.effectivenessStatus !== 'pending' && Number(action.protocolVersion) >= 3) {
      if (String(action.effectivenessNote || '').trim().length < 5 || !action.effectivenessDate) return { required: true, complete: false, effective: false, label: 'Cần ngày và bằng chứng đánh giá hiệu lực', cls: 'rej', escalated: false };
      if (!action.actionCompletedDate) return { required: true, complete: false, effective: false, label: 'Cần ngày hoàn thành hành động trước khi đánh giá hiệu lực', cls: 'rej', escalated: false };
      const rerun = deps.needsRerun(action) ? deps.rerunStatus(action) : null;
      const latestPrerequisite = [action.date, action.actionCompletedDate, action.releaseDate, rerun?.point?.date].filter(Boolean).sort().pop() || '';
      if (latestPrerequisite && action.effectivenessDate < latestPrerequisite) return { required: true, complete: false, effective: false, label: 'Ngày đánh giá hiệu lực không được trước hành động, quyết định cho phép hoặc QC chạy lại dùng làm bằng chứng', cls: 'rej', escalated: false };
      if (action.effectivenessDate > deps.todayIso()) return { required: true, complete: false, effective: false, label: 'Ngày đánh giá hiệu lực không được ở tương lai', cls: 'rej', escalated: false };
    }
    if (action.effectivenessStatus === 'effective') {
      if (Number(action.protocolVersion) >= 3) {
        const residual = actionResidualRiskScore(action), initial = actionRiskScore(action);
        if (!residual || !has(actionLabels.risk, action.residualRiskLevel) || String(action.residualRiskBasis || '').trim().length < 5) return { required: true, complete: false, effective: false, label: 'Cần đánh giá đầy đủ nguy cơ còn lại và căn cứ SOP', cls: 'rej', escalated: false };
        if (initial && residual > initial) return { required: true, complete: false, effective: false, label: `RPN còn lại ${residual} cao hơn RPN ban đầu ${initial} — chưa thể kết luận có hiệu lực`, cls: 'rej', escalated: false };
      }
      if (Number(action.protocolVersion) < 3 && (String(action.effectivenessNote || '').trim().length < 5 || !action.effectivenessDate)) return { required: true, complete: false, effective: false, label: 'Chờ đánh giá hiệu lực', cls: 'warn', escalated: false };
      return { required: true, complete: true, effective: true, label: Number(action.protocolVersion) >= 3 ? `Đã xác nhận hiệu lực · RPN còn lại ${actionResidualRiskScore(action)}` : 'Đã xác nhận hiệu lực', cls: 'ok', escalated: false };
    }
    if (action.effectivenessStatus === 'ineffective') {
      const followUp = String(action.followUpNceId || '').trim();
      return followUp && deps.activeFollowUp(action)
        ? { required: true, complete: true, effective: false, label: `Chưa hiệu lực — đã chuyển ${followUp}`, cls: 'warn', escalated: true }
        : { required: true, complete: false, effective: false, label: followUp ? 'Hồ sơ tiếp theo đã hủy hoặc không còn tồn tại — cần mở vòng mới' : 'Chưa hiệu lực — cần mở hồ sơ tiếp theo', cls: 'rej', escalated: false };
    }
    return { required: true, complete: false, effective: false, label: 'Chờ đánh giá hiệu lực', cls: 'warn', escalated: false };
  };

  const protocolSummary = (action: Action | null | undefined): string => {
    if (!action || !action.protocolVersion) return '';
    const checks = protocolChecks.map(([key, label]) => `${label}: ${actionLabels.check[action[key] as keyof typeof actionLabels.check] || 'Chưa ghi'}${action[key.replace('Status', 'Note')] ? ` (${action[key.replace('Status', 'Note')]})` : ''}`);
    const residual = actionResidualRiskScore(action);
    return [
      ...(Number(action.protocolVersion) >= 2 ? [`Mã NCE: ${action.nceId || 'Chưa cấp'} · Nguồn: ${actionLabels.source[action.eventSource as keyof typeof actionLabels.source] || 'Chưa ghi'} · Giai đoạn: ${actionLabels.phase[action.processPhase as keyof typeof actionLabels.phase] || 'Chưa ghi'}`, `Nguy cơ: ${actionLabels.risk[action.riskLevel as keyof typeof actionLabels.risk] || 'Chưa đánh giá'} · S×O×D ${action.riskSeverity || 0}×${action.riskOccurrence || 0}×${action.riskDetectability || 0} = ${actionRiskScore(action)}${action.riskBasis ? ` · Căn cứ: ${action.riskBasis}` : ''}`] : []),
      `Kiểm soát tức thời: ${actionLabels.containment[action.containmentStatus as keyof typeof actionLabels.containment] || 'Chưa ghi'}${action.containmentNote ? ` (${action.containmentNote})` : ''}`,
      ...(Number(action.protocolVersion) >= 2 ? [`Xử lý tức thời: ${action.correction || 'Chưa ghi'}`] : []), ...checks,
      `Nguyên nhân: ${actionLabels.cause[action.causeCategory as keyof typeof actionLabels.cause] || 'Chưa phân loại'}${action.cause ? ` — ${action.cause}` : ''}`,
      ...(Number(action.protocolVersion) >= 3 && action.containmentStatus === 'held' ? [`Cho phép trở lại: ${actionLabels.release[action.releaseStatus as keyof typeof actionLabels.release] || 'Chưa xác nhận'}${action.releaseDate ? ` · ${deps.formatDate(action.releaseDate)}` : ''}${action.releaseBy ? ` · ${action.releaseBy}` : ''}${action.releaseNote ? ` — ${action.releaseNote}` : ''}`] : []),
      `Ảnh hưởng bệnh nhân: ${actionLabels.patient[action.patientImpact as keyof typeof actionLabels.patient] || 'Chưa ghi'}${action.patientAction ? ` — ${action.patientAction}` : ''}`,
      ...(Number(action.protocolVersion) >= 2 ? [`Hiệu lực: ${action.effectivenessStatus === 'effective' ? 'Có hiệu lực' : action.effectivenessStatus === 'ineffective' ? 'Chưa hiệu lực' : 'Chưa đánh giá'}${action.effectivenessDate ? ` · ${deps.formatDate(action.effectivenessDate)}` : ''}${action.effectivenessNote ? ` — ${action.effectivenessNote}` : ''}${action.effectivenessBy ? ` · ${action.effectivenessBy}` : ''}`] : []),
      ...(Number(action.protocolVersion) >= 3 && residual ? [`Nguy cơ còn lại: ${actionLabels.risk[action.residualRiskLevel as keyof typeof actionLabels.risk] || 'Chưa phân loại'} · S×O×D ${action.residualSeverity || 0}×${action.residualOccurrence || 0}×${action.residualDetectability || 0} = ${residual}${action.residualRiskBasis ? ` · Căn cứ: ${action.residualRiskBasis}` : ''}`] : []),
      ...(deps.isCancelled(action) ? [`Hồ sơ đã hủy: ${action.cancelReason || 'Không ghi lý do'}${action.cancelledBy ? ` · ${action.cancelledBy}` : ''}${action.cancelledAt ? ` · ${action.cancelledAt}` : ''}`] : []),
    ].join(' | ');
  };

  return Object.freeze({ protocolStatus, effectivenessStatus, protocolSummary });
}

export type ActionProtocolService = ReturnType<typeof createActionProtocolService>;

export type RerunCandidate = Record<string, any>;
export type ActionRerunEvaluationInput = {
  action: Record<string, any>;
  needed: boolean;
  point: RerunCandidate | null;
  gateDate: string;
  incidentRunNumber: number;
  candidates: RerunCandidate[];
  runNumber: (point: RerunCandidate) => number;
  verdictFor: (pointId: string) => { level?: string };
  formatValue: (point: RerunCandidate) => string;
  formatDate: (value: string) => string;
};

export function evaluateActionRerun(input: ActionRerunEvaluationInput) {
  if (!input.needed) return { needed: false, ok: true, label: 'Không yêu cầu', cls: 'none', point: null };
  const point = input.point;
  if (!point) return { needed: true, ok: false, label: 'Chờ QC chạy lại được chấp nhận', cls: 'warn', point: null };
  if (Number(input.action.protocolVersion) >= 3 && !input.action.actionCompletedDate) {
    return { needed: true, ok: false, label: 'Chờ hoàn thành hành động trước khi xác nhận QC chạy lại', cls: 'warn', point: null };
  }
  const rerun = input.candidates.find(candidate => !candidate.voided && candidate.id !== point.id
    && Number(candidate.level) === Number(point.level) && (candidate.lot || '') === (point.lot || '')
    && candidate.date >= input.gateDate && (candidate.date > point.date || (candidate.date === point.date && input.runNumber(candidate) > input.incidentRunNumber))
    && input.verdictFor(candidate.id).level !== 'rej');
  if (rerun) {
    const warning = input.verdictFor(rerun.id).level === 'warn';
    return { needed: true, ok: true, label: `${warning ? 'QC chấp nhận lại (cảnh báo)' : 'QC đạt lại'}: ${input.formatValue(rerun)} (${rerun.runId || 'lần sau'})`, cls: warning ? 'warn' : 'ok', point: rerun };
  }
  return { needed: true, ok: false, label: `Chờ QC chạy lại được chấp nhận${input.gateDate ? ' từ ' + input.formatDate(input.gateDate) : ''}`, cls: 'warn', point: null };
}

export const nceActionRerunEvaluator = Object.freeze({ evaluateActionRerun });
export type NceActionRerunEvaluator = typeof nceActionRerunEvaluator;

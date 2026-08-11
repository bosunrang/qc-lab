type ActionChecklistRow = { status: unknown; note: unknown };
type ActionChip = { cls: string; label: string; title?: string };

export function createActionChecklistPresentation(deps: {
  checkLabels: Record<string, string>;
  effectivenessStatus: (form: Record<string, any>) => { cls: string; label: string; complete: boolean };
}) {
  const rowComplete = ({ status, note }: ActionChecklistRow): boolean => {
    const normalized = String(status || '');
    const needsNote = ['abnormal', 'na', 'checked-abnormal'].includes(normalized);
    return !!deps.checkLabels[normalized] && (!needsNote || String(note || '').trim().length >= 3);
  };
  const checklist = (rows: ActionChecklistRow[]) => {
    const total = rows.length, done = rows.filter(rowComplete).length;
    return { done, total, complete: done === total };
  };
  const checklistChip = (rows: ActionChecklistRow[]): ActionChip => {
    const progress = checklist(rows);
    return { cls: progress.complete ? 'ok' : 'warn', label: `Đã hoàn tất ${progress.done}/${progress.total}` };
  };
  const sectionChip = (missing: unknown): ActionChip => {
    const items = Array.isArray(missing) ? missing : [];
    return items.length
      ? { cls: 'warn', label: `Còn thiếu ${items.length} mục`, title: `Còn thiếu: ${items.join('; ')}` }
      : { cls: 'ok', label: 'Đã xong', title: 'Không còn mục bắt buộc chưa hoàn thành' };
  };
  const effectivenessChip = (form: Record<string, any>): ActionChip => {
    const effectiveness = deps.effectivenessStatus({ ...form, protocolVersion: form.protocolVersion || 3 });
    return {
      cls: effectiveness.cls === 'none' ? 'none' : effectiveness.cls,
      label: effectiveness.complete ? effectiveness.label : form.effectivenessStatus === 'ineffective' ? effectiveness.label : 'Chưa đánh giá',
      title: effectiveness.label,
    };
  };
  return Object.freeze({ checklist, checklistChip, sectionChip, effectivenessChip });
}

export type ActionChecklistPresentation = ReturnType<typeof createActionChecklistPresentation>;

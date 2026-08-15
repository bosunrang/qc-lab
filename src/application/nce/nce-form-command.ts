import type { ActionRecordService } from './action-record-service';

type NceRecord = Record<string, any>;
type NceUser = { id?: string; username?: string; name?: string };

export type NceFormCommandDeps = {
  todayIso: () => string;
  draftStatus: (record: NceRecord) => { complete: boolean; missing: string[]; missingKeys?: string[] };
  effectivenessStatus: (record: NceRecord) => { complete: boolean; label: string };
  effectivenessMissingKey: (record: NceRecord) => string;
  isCancelled: (record: NceRecord) => boolean;
  approvalStatus: (record: NceRecord) => string;
  records: ActionRecordService;
};

export type NceFormSubmitInput = {
  actions: NceRecord[];
  editId?: string;
  values: NceRecord;
  user: NceUser;
};

export type NceFormSubmitResult =
  | { ok: true; mode: 'create' | 'update'; record: NceRecord }
  | { ok: false; reason: 'draft' | 'due-date' | 'completed-date' | 'effectiveness' | 'cancelled' | 'approved'; missingKey?: string; message: string };

/* Điều phối luồng lưu hồ sơ NCE. UI chỉ đọc form và hiển thị thông báo; toàn bộ cổng
   nghiệp vụ và việc tạo/cập nhật bản ghi đi qua đây để không phân tán giữa route/form. */
export function createNceFormCommand(deps: NceFormCommandDeps) {
  const submit = (input: NceFormSubmitInput): NceFormSubmitResult => {
    const editing = input.editId ? input.actions.find(action => action.id === input.editId) : undefined;
    const candidate = { ...(editing || {}), ...input.values };
    const draft = deps.draftStatus(candidate);
    if (!draft.complete) return { ok: false, reason: 'draft', missingKey: draft.missingKeys?.[0], message: `Còn thiếu để mở hồ sơ: ${draft.missing.join('; ')}.` };
    if (candidate.dueDate && candidate.dueDate < candidate.date) return { ok: false, reason: 'due-date', missingKey: 'dueDate', message: 'Hạn hoàn thành không được trước ngày ghi nhận sự cố.' };
    if (candidate.actionCompletedDate && (candidate.actionCompletedDate < candidate.date || candidate.actionCompletedDate > deps.todayIso())) {
      return { ok: false, reason: 'completed-date', missingKey: 'actionCompletedDate', message: candidate.actionCompletedDate < candidate.date ? 'Ngày hoàn thành hành động không được trước ngày ghi nhận sự cố.' : 'Ngày hoàn thành hành động không được ở tương lai.' };
    }
    if (candidate.effectivenessStatus !== 'pending') {
      const effectiveness = deps.effectivenessStatus(candidate);
      if (!effectiveness.complete) return { ok: false, reason: 'effectiveness', missingKey: deps.effectivenessMissingKey(candidate), message: `${effectiveness.label}.` };
    }
    if (editing) {
      if (deps.isCancelled(editing)) return { ok: false, reason: 'cancelled', message: 'Hồ sơ đã hủy được giữ nguyên để bảo toàn dấu vết và không thể chỉnh sửa. Hãy lập hồ sơ NCE mới nếu sự cố vẫn cần xử lý.' };
      if (deps.approvalStatus(editing) === 'approved') return { ok: false, reason: 'approved', message: 'Hồ sơ đã khép vòng không được sửa. Nếu phát hiện vấn đề tái diễn, hãy mở một hồ sơ NCE mới.' };
      const record = deps.records.update(editing, candidate, input.user);
      if (!record) return { ok: false, reason: 'approved', message: 'Hồ sơ đã thay đổi và không thể cập nhật. Vui lòng mở lại để kiểm tra.' };
      return { ok: true, mode: 'update', record };
    }
    return { ok: true, mode: 'create', record: deps.records.create(input.actions, candidate, input.user) };
  };
  return Object.freeze({ submit });
}

export type NceFormCommand = ReturnType<typeof createNceFormCommand>;

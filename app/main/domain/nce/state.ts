// Máy trạng thái hồ sơ NCE (kế hoạch mục 4). Trạng thái chỉ đổi qua các
// chuyển hợp lệ dưới đây; renderer không tự suy trạng thái từ dữ liệu đã nhập.
// Đường chính: đang xử lý → cho chạy lại → chờ duyệt → đã đóng. Người duyệt
// trả lại thì hồ sơ về bước "đã cho chạy lại"; chỉ hồ sơ đang xử lý mới huỷ.
import type { NceStatus } from './types';

export type NceTransition = 'release' | 'submit' | 'approve' | 'return' | 'cancel';

const TRANSITIONS: Readonly<Record<NceTransition, { from: NceStatus; to: NceStatus }>> = {
  release: { from: 'open', to: 'released' },
  submit: { from: 'released', to: 'pending_approval' },
  approve: { from: 'pending_approval', to: 'closed' },
  return: { from: 'pending_approval', to: 'released' },
  // Hồ sơ đã cho chạy lại không được huỷ: mốc cắt Westgard đã có hiệu lực (D-10).
  cancel: { from: 'open', to: 'cancelled' },
};

/** Trạng thái đích, hoặc `null` khi chuyển không hợp lệ từ trạng thái hiện tại. */
export function nextNceStatus(status: NceStatus, transition: NceTransition): NceStatus | null {
  const rule = TRANSITIONS[transition];
  return rule && rule.from === status ? rule.to : null;
}

/** Các thao tác ghi KHÔNG đổi trạng thái, và trạng thái cho phép chúng. */
export type NceEditOperation =
  | 'update' | 'attachRun' | 'addAction' | 'updateAction' | 'completeAction' | 'cancelAction'
  | 'recordTechnicalAssessment' | 'recordPatientImpact' | 'reviewEffectiveness';

const EDIT_STATES: Readonly<Record<NceEditOperation, readonly NceStatus[]>> = {
  update: ['open', 'released'],
  // Lần chạy hỏng tiếp theo chỉ gắn khi chưa cho chạy lại (D-01); sau mốc cắt
  // là giai đoạn vận hành mới, hỏng nữa là sự kiện mới.
  attachRun: ['open'],
  addAction: ['open', 'released'],
  updateAction: ['open', 'released'],
  completeAction: ['open', 'released'],
  cancelAction: ['open', 'released'],
  // Hồ sơ cũ đã release vẫn được bổ sung đánh giá kỹ thuật trước khi nộp duyệt.
  recordTechnicalAssessment: ['open', 'released'],
  // Thông tin về kết quả đã trả có thể đến muộn, nên vẫn ghi thêm được sau khi
  // cho chạy lại; quyết định là append-only, không sửa quyết định cũ.
  recordPatientImpact: ['open', 'released'],
  // Đánh giá hiệu lực chỉ có nghĩa sau khi hệ thống đã trở lại hoạt động.
  reviewEffectiveness: ['released'],
};

export function canDoNceOperation(status: NceStatus, operation: NceEditOperation): boolean {
  return EDIT_STATES[operation].includes(status);
}

export const NCE_STATUS_LABEL: Readonly<Record<NceStatus, string>> = {
  open: 'Đang xử lý',
  released: 'Đã cho chạy lại',
  pending_approval: 'Chờ duyệt',
  closed: 'Đã đóng',
  cancelled: 'Đã huỷ',
};

export function isTerminalNceStatus(status: NceStatus): boolean { return status === 'closed' || status === 'cancelled'; }

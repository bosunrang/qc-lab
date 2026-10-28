// Quyền nghiệp vụ của hồ sơ NCE (D-09, kế hoạch mục 6). Main gọi các hàm này
// trong cổng quyền của `writeCommand()`; renderer chỉ dùng để ẩn/hiện nút.
//
// - Ghi nội dung hồ sơ: mọi tài khoản có quyền ghi (`canWriteRole`).
// - Cho chạy lại: capability `nce.release`.
// - Duyệt, trả lại: capability `nce.approve`; người duyệt phải độc lập.
// Quản trị viên mặc nhiên có cả hai capability.
import { canWriteRole, roleOf } from '../page-roles';
import type { NceCapability, NceDossier } from './types';
import { isOneOf, NCE_CAPABILITIES } from './types';

export interface NceActorLike { userId: string; role: string; capabilities?: readonly string[] }

export type NceDecision = { ok: true } | { ok: false; code: string; message: string };

const ALLOW: NceDecision = { ok: true };

/** Đọc `users.capabilities_json`; mã lạ bị bỏ, JSON hỏng coi như không có quyền. */
export function parseNceCapabilities(json: unknown): NceCapability[] {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json || '[]') : json;
    return Array.isArray(raw) ? [...new Set(raw.filter((value): value is NceCapability => isOneOf(NCE_CAPABILITIES, value)))] : [];
  } catch { return []; }
}

export function hasNceCapability(actor: NceActorLike, capability: NceCapability): boolean {
  if (roleOf(actor.role) === 'admin') return true;
  return canWriteRole(actor.role) && (actor.capabilities ?? []).includes(capability);
}

export function canWriteNce(actor: NceActorLike): NceDecision {
  return canWriteRole(actor.role) ? ALLOW : { ok: false, code: 'forbidden', message: 'Bạn không có quyền sửa hồ sơ NCE.' };
}

export function canReleaseNce(actor: NceActorLike): NceDecision {
  return hasNceCapability(actor, 'nce.release') ? ALLOW
    : { ok: false, code: 'forbidden-release', message: 'Bạn chưa được cấp quyền cho phép hoạt động trở lại (nce.release).' };
}

/** Nộp duyệt là việc của người phụ trách hoặc người báo cáo. */
export function canSubmitNce(actor: NceActorLike, dossier: Pick<NceDossier, 'ownerUserId' | 'reportedByUserId'>): NceDecision {
  const denied = canWriteNce(actor); if (!denied.ok) return denied;
  return actor.userId === dossier.ownerUserId || actor.userId === dossier.reportedByUserId ? ALLOW
    : { ok: false, code: 'forbidden-submit', message: 'Chỉ người phụ trách hoặc người báo cáo được nộp duyệt hồ sơ.' };
}

/** Hủy (chỉ khi còn `open`): người báo cáo, người phụ trách hoặc người có quyền duyệt. */
export function canCancelNce(actor: NceActorLike, dossier: Pick<NceDossier, 'ownerUserId' | 'reportedByUserId'>): NceDecision {
  const denied = canWriteNce(actor); if (!denied.ok) return denied;
  return actor.userId === dossier.ownerUserId || actor.userId === dossier.reportedByUserId || hasNceCapability(actor, 'nce.approve') ? ALLOW
    : { ok: false, code: 'forbidden-cancel', message: 'Chỉ người báo cáo, người phụ trách hoặc người duyệt được hủy hồ sơ.' };
}

export function canReturnNce(actor: NceActorLike): NceDecision {
  return hasNceCapability(actor, 'nce.approve') ? ALLOW
    : { ok: false, code: 'forbidden-approve', message: 'Bạn chưa được cấp quyền duyệt hồ sơ NCE (nce.approve).' };
}

/** Những vai trò của một người trong hồ sơ làm họ mất tính độc lập khi duyệt. */
export function nceParticipantRoles(userId: string, dossier: Pick<NceDossier, 'reportedByUserId' | 'ownerUserId' | 'release' | 'actions' | 'technicalAssessments' | 'patientImpacts' | 'effectivenessReviews'>): string[] {
  if (!userId) return [];
  const roles: string[] = [];
  if (dossier.reportedByUserId === userId) roles.push('người báo cáo');
  if (dossier.ownerUserId === userId) roles.push('người phụ trách');
  if (dossier.release?.actorUserId === userId) roles.push('người cho chạy lại');
  if (dossier.actions.some((action) => action.status === 'done' && action.doneByUserId === userId)) roles.push('người hoàn thành hành động');
  if (dossier.technicalAssessments.some((assessment) => assessment.actorUserId === userId)) roles.push('người xác minh kỹ thuật');
  if (dossier.patientImpacts.some((impact) => impact.actorUserId === userId)) roles.push('người đánh giá ảnh hưởng bệnh nhân');
  if (dossier.effectivenessReviews.some((review) => review.reviewerUserId === userId)) roles.push('người đánh giá hiệu lực');
  return roles;
}

/** Ngoại lệ phân tách nhiệm vụ cho đơn vị ít người — mặc định tắt; bật phải
 * có mã SOP (cấu hình `app_meta`). */
export interface NceSeparationException { enabled: boolean; sopRef: string }

export type NceApprovalDecision = { ok: true; usedException: boolean; conflicts: string[] } | { ok: false; code: string; message: string };

export function canApproveNce(
  actor: NceActorLike,
  dossier: Pick<NceDossier, 'reportedByUserId' | 'ownerUserId' | 'release' | 'actions' | 'technicalAssessments' | 'patientImpacts' | 'effectivenessReviews'>,
  exception: NceSeparationException = { enabled: false, sopRef: '' },
): NceApprovalDecision {
  const denied = canReturnNce(actor); if (!denied.ok) return denied;
  const conflicts = nceParticipantRoles(actor.userId, dossier);
  if (!conflicts.length) return { ok: true, usedException: false, conflicts };
  if (exception.enabled && exception.sopRef.trim()) return { ok: true, usedException: true, conflicts };
  return { ok: false, code: 'not-independent', message: `Người duyệt phải độc lập; bạn là ${conflicts.join(', ')} của hồ sơ này.` };
}

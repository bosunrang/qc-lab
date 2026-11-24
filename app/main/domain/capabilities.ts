// Quyền nghiệp vụ cấp riêng cho từng tài khoản (`users.capabilities_json`), bổ
// sung cho vai trò. Vai trò quyết định ai được ghi; capability quyết định ai
// được làm những việc cần người có thẩm quyền (ISO 15189:2022 6.2.3).
//
// - `nce.release`, `nce.approve`: quyền của hồ sơ NCE (xem `nce/permissions.ts`).
// - `qc.config`: đặt tiêu chí chấp nhận QC ở các trang KTV dùng hằng ngày —
//   lập dải Mean/SD của phòng xét nghiệm, hoàn về dải nhà sản xuất, cấu hình
//   TEa cho Six Sigma. Đổi giới hạn kiểm soát hay TEa làm thay đổi việc lần
//   chạy nào bị loại, nên không thể để mọi tài khoản ghi tự làm.
//
// Quản trị viên mặc nhiên có mọi capability; tài khoản chỉ xem không giữ
// capability nào. Main là nơi chặn thật; renderer chỉ dùng để ẩn/khoá nút.
import { canWriteRole, roleOf } from './page-roles';
import { NCE_CAPABILITIES } from './nce/types';

export const USER_CAPABILITIES = [...NCE_CAPABILITIES, 'qc.config'] as const;
export type UserCapability = typeof USER_CAPABILITIES[number];

/** Đọc `users.capabilities_json`; mã lạ bị bỏ, JSON hỏng coi như không có quyền. */
export function parseUserCapabilities(json: unknown): UserCapability[] {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json || '[]') : json;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((value): value is UserCapability => (USER_CAPABILITIES as readonly unknown[]).includes(value)))];
  } catch { return []; }
}

export function hasUserCapability(actor: { role: string; capabilities?: readonly string[] } | null | undefined, capability: UserCapability): boolean {
  if (!actor) return false;
  if (roleOf(actor.role) === 'admin') return true;
  return canWriteRole(actor.role) && (actor.capabilities ?? []).includes(capability);
}

export const QC_CONFIG_DENIED_MESSAGE = 'Bạn chưa được cấp quyền cấu hình tiêu chí QC (qc.config). Quản trị viên cấp quyền ở trang Người dùng.';

import { createPublicKey, verify } from 'node:crypto';

export interface LicenseClaims {
  schema: 1; product: 'vn.qclab.desktop'; licenseId: string; licensedTo: string;
  machineCode: string; issuedAt: string; expiresAt: string | null;
}
export type LicenseValidation = { ok: true; claims: LicenseClaims } | { ok: false; code: string; message: string };
const fail = (code: string, message: string): LicenseValidation => ({ ok: false, code, message });
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
export const MACHINE_CODE_PATTERN = /^QC(?:-[A-F0-9]{8}){4}$/;

/** Chỉ khoá công khai được đóng gói. Sửa payload, đổi máy hoặc tự tạo chữ
 * ký đều không tạo được giấy phép hợp lệ nếu không có khoá bí mật của bên cấp. */
export function validateLicenseToken(raw: unknown, publicKey: string, machineCode: string, now = Date.now()): LicenseValidation {
  if (typeof raw !== 'string' || raw.length > 8192) return fail('invalid-license', 'Mã kích hoạt không hợp lệ.');
  const parts = raw.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'QCL1' || !parts.slice(1).every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    return fail('invalid-license', 'Mã kích hoạt không đúng định dạng.');
  }
  let key;
  try { key = createPublicKey(publicKey); } catch { return fail('license-key-missing', 'Bản cài chưa được cấu hình khoá cấp phép.'); }
  if (key.asymmetricKeyType !== 'ed25519') return fail('license-key-missing', 'Khoá cấp phép không đúng loại.');
  const payload = Buffer.from(parts[1], 'base64url'), signature = Buffer.from(parts[2], 'base64url');
  if (payload.toString('base64url') !== parts[1] || signature.toString('base64url') !== parts[2] || signature.length !== 64
    || !verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), key, signature)) {
    return fail('invalid-signature', 'Chữ ký của mã kích hoạt không hợp lệ.');
  }
  let claims: LicenseClaims;
  try { claims = JSON.parse(payload.toString('utf8')) as LicenseClaims; } catch { return fail('invalid-license', 'Không đọc được mã kích hoạt.'); }
  if (!claims || claims.schema !== 1 || claims.product !== 'vn.qclab.desktop'
    || typeof claims.licenseId !== 'string' || !claims.licenseId.trim() || claims.licenseId.length > 100
    || typeof claims.licensedTo !== 'string' || !claims.licensedTo.trim() || claims.licensedTo.length > 200
    || typeof claims.machineCode !== 'string' || !MACHINE_CODE_PATTERN.test(claims.machineCode)
    || !iso(claims.issuedAt) || (claims.expiresAt !== null && !iso(claims.expiresAt))) {
    return fail('invalid-license', 'Thông tin trong mã kích hoạt không hợp lệ.');
  }
  if (claims.machineCode !== machineCode) return fail('wrong-machine', 'Mã kích hoạt được cấp cho máy khác.');
  if (Date.parse(claims.issuedAt) > now + 5 * 60_000) return fail('license-not-yet-valid', 'Kiểm tra ngày giờ của máy: mã kích hoạt chưa có hiệu lực.');
  if (claims.expiresAt && (Date.parse(claims.expiresAt) <= Date.parse(claims.issuedAt) || Date.parse(claims.expiresAt) <= now)) {
    return fail('license-expired', 'Giấy phép đã hết hạn. Liên hệ bên cấp để gia hạn.');
  }
  return { ok: true, claims };
}

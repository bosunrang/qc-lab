import type { SoftwareLicenseStatus } from '../../shared/qc-api';
import type { Db } from '../db/sqlite-like';
import { validateLicenseToken } from './license-token';
import { writeCommand } from '../ipc/write-command';
import { requireAdmin, type Actor, type IpcResult } from '../ipc/shared';

export const LICENSE_META_KEY = 'softwareLicense';
export interface LicenseOptions { required: boolean; machineCode: string; publicKey: string; identityError?: string; now?: () => number }

export function createLicenseService(db: Db, options: LicenseOptions) {
  const now = options.now ?? Date.now;
  const base: SoftwareLicenseStatus = {
    state: 'required', runtime: options.required ? 'desktop' : 'development', machine_code: options.machineCode,
    license_id: '', licensed_to: '', issued_at: '', expires_at: null, message: 'Máy này chưa được kích hoạt.',
  };
  function status(): SoftwareLicenseStatus {
    if (!options.required) return { ...base, state: 'development', message: 'Chế độ phát triển không yêu cầu kích hoạt.' };
    if (options.identityError) return { ...base, state: 'unavailable', message: options.identityError };
    const token = (db.prepare('SELECT value FROM app_meta WHERE key=?').get(LICENSE_META_KEY) as { value: string } | undefined)?.value;
    if (!token) return { ...base };
    const result = validateLicenseToken(token, options.publicKey, options.machineCode, now());
    if (!result.ok) return { ...base, state: result.code === 'license-expired' ? 'expired' : 'invalid', message: result.message };
    const c = result.claims;
    return { ...base, state: 'active', license_id: c.licenseId, licensed_to: c.licensedTo, issued_at: c.issuedAt, expires_at: c.expiresAt, message: 'Phần mềm đã được kích hoạt.' };
  }
  const allowed = () => !options.required || status().state === 'active';
  // Máy chính được nhập mã trước khi tạo tài khoản đầu tiên. Khi đã đăng
  // nhập, chỉ quản trị được thay giấy phép; chữ ký vẫn được kiểm ở main.
  const activate = writeCommand(db, 'activateSoftware', (actor) => {
    if (!actor.userId) return null;
    const fresh = db.prepare('SELECT role,active FROM users WHERE id=?').get(actor.userId) as { role: string; active: number } | undefined;
    return requireAdmin({ ...actor, role: fresh?.active ? fresh.role : '' });
  },
    (w, raw: unknown): IpcResult<SoftwareLicenseStatus> => {
      if (options.identityError) return { ok: false, error: { code: 'machine-unavailable', message: options.identityError } };
      const code = (raw as { data?: { activationCode?: unknown } } | null)?.data?.activationCode;
      const check = validateLicenseToken(code, options.publicKey, options.machineCode, now());
      if (!check.ok) return { ok: false, error: { code: check.code, message: check.message } };
      const token = String(code).trim();
      if ((db.prepare('SELECT value FROM app_meta WHERE key=?').get(LICENSE_META_KEY) as { value: string } | undefined)?.value === token) return w.noChange(status());
      w.commit((tx) => {
        db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(LICENSE_META_KEY, token);
        tx.audit('Kích hoạt phần mềm', `Giấy phép ${check.claims.licenseId} · ${check.claims.licensedTo}${check.claims.expiresAt ? ` · hết hạn ${check.claims.expiresAt}` : ' · vĩnh viễn'}`, options.machineCode);
        tx.changed(['app_meta']);
      });
      return { ok: true, data: status() };
    });
  const activationActor: Actor = { userId: '', username: 'activation', name: 'Kích hoạt tại máy chính', role: '', clientId: 'app-desktop' };
  return { status, allowed, activate, activationActor };
}

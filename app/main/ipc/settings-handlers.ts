// Handler cài đặt tập trung hồ sơ đơn vị, biểu mẫu báo cáo, sao lưu, Firebase
// và LIS Gateway. Các luồng ghi đều dùng chung cổng quyền và nhật ký kiểm toán.
import { dbFileBytes } from './db-file-size';
import type { Db } from '../db/sqlite-like';
import { prepareLabProfile, type LabProfileInput } from '../domain/settings-validation';
import { type Actor, type IpcResult, writeAudit, notifyChanged, requireAdmin } from './shared';

export interface LabProfile {
  id: number; name: string; dept: string; address: string;
  brand_title: string; brand_sub: string; logo_text: string; logo_data: string;
}
export type LoginBrand = Pick<LabProfile, 'brand_title' | 'brand_sub' | 'logo_text' | 'logo_data'>;

export interface StorageInfo {
  dbFileBytes: number;
  path: string;
  engine: 'SQLite';
  sqliteVersion: string;
  schemaVersion: number;
  storageMode: 'file' | 'memory' | 'browser-preview';
}

export function createSettingsHandlers(db: Db, dbPath: string) {
  function getLabProfile(): LabProfile {
    return db.prepare('SELECT * FROM lab WHERE id=1').get() as unknown as LabProfile;
  }

  /** Nhận diện công khai duy nhất cần có trước đăng nhập. Không trả tên đơn
   * vị, địa chỉ hay bất kỳ cài đặt vận hành nào cho máy trạm chưa có phiên. */
  function getLoginBrand(): LoginBrand {
    const { brand_title, brand_sub, logo_text, logo_data } = getLabProfile();
    return { brand_title, brand_sub, logo_text, logo_data };
  }

  function saveLabProfile(input: { data: LabProfileInput }, actor: Actor): IpcResult<LabProfile> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const existing = getLabProfile();
    const { name, dept, address, brandTitle, brandSub, logoText, logoData } = prepareLabProfile(input.data, {
      logoText: existing.logo_text, logoData: existing.logo_data,
    });
    db.prepare('UPDATE lab SET name=?,dept=?,address=?,brand_title=?,brand_sub=?,logo_text=?,logo_data=? WHERE id=1')
      .run(name, dept, address, brandTitle, brandSub, logoText, logoData);
    writeAudit(db, actor, 'Sửa thông tin phòng xét nghiệm', `Cập nhật hồ sơ "${name || brandTitle}"`, name || brandTitle);
    notifyChanged(['lab']);
    return { ok: true, data: getLabProfile() };
  }

  /** Đọc trạng thái trực tiếp từ chính kết nối SQLite thay vì để renderer
   * ghi cứng tên engine/schema. Bản Electron dùng file SQLite trên đĩa;
   * bản preview dùng sql.js/WASM và lưu ảnh database trong IndexedDB;
   * `:memory:` chỉ dành cho test. */
  function getStorageInfo(): StorageInfo {
    const versionRow = db.prepare('SELECT sqlite_version() AS sqlite_version').get() as { sqlite_version?: unknown } | undefined;
    const schemaRow = db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get() as { value?: unknown } | undefined;
    const sqliteVersion = String(versionRow?.sqlite_version ?? '').trim();
    const parsedSchemaVersion = Number(schemaRow?.value);
    if (!sqliteVersion) throw new Error('Kết nối dữ liệu hiện tại không trả về phiên bản SQLite.');
    return {
      dbFileBytes: dbFileBytes(dbPath),
      path: dbPath,
      engine: 'SQLite',
      sqliteVersion,
      schemaVersion: Number.isFinite(parsedSchemaVersion) ? parsedSchemaVersion : 0,
      storageMode: dbPath === ':memory:'
        ? 'memory'
        : dbPath.startsWith('IndexedDB:') ? 'browser-preview' : 'file',
    };
  }

  return { getLabProfile, getLoginBrand, saveLabProfile, getStorageInfo };
}

export type SettingsHandlers = ReturnType<typeof createSettingsHandlers>;


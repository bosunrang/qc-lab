// IPC handler cho trang Cai dat: ho so phong xet nghiem (bang `lab`, 1 dong
// duy nhat id=1 - da duoc chen san boi openDatabase() lan dau) + logo/brand +
// kiem tra dung luong luu tru (kich thuoc file SQLite that tren dia). Pham
// vi rut gon: Firebase connection/LIS Gateway settings/backup-restore vẫn
// CHƯA làm — thuộc Giai đoạn C (docs/APP-V2-PLAN.md), cần đồng bộ Firebase/
// hạ tầng backup thật trước, không phải chỉ thêm form.
import { statSync } from 'node:fs';
import type { Db } from '../db/open-database';
import { prepareLabProfile, type LabProfileInput } from '../domain/settings-validation';
import { type Actor, type IpcResult, writeAudit, notifyChanged, requireAdmin } from './shared';

export interface LabProfile {
  id: number; name: string; dept: string; address: string;
  brand_title: string; brand_sub: string; logo_text: string; logo_data: string;
}

export interface StorageInfo { dbFileBytes: number; path: string }

export function createSettingsHandlers(db: Db, dbPath: string) {
  function getLabProfile(): LabProfile {
    return db.prepare('SELECT * FROM lab WHERE id=1').get() as unknown as LabProfile;
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

  /** Kích thước file SQLite thật trên đĩa — thay cho khái niệm "dung lượng
   * localStorage/IndexedDB" của bản cũ (không còn ý nghĩa ở app-v2, mọi dữ
   * liệu giờ nằm trong 1 file SQLite thật). `:memory:` (test) không có file
   * thật trên đĩa nên trả 0 thay vì ném lỗi. */
  function getStorageInfo(): StorageInfo {
    if (dbPath === ':memory:') return { dbFileBytes: 0, path: dbPath };
    try {
      return { dbFileBytes: statSync(dbPath).size, path: dbPath };
    } catch {
      return { dbFileBytes: 0, path: dbPath };
    }
  }

  return { getLabProfile, saveLabProfile, getStorageInfo };
}

export type SettingsHandlers = ReturnType<typeof createSettingsHandlers>;

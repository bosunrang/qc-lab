// IPC handler cho trang Cai dat: ho so phong xet nghiem (bang `lab`, 1 dong
// duy nhat id=1 - da duoc chen san boi openDatabase() lan dau). Pham vi rut
// gon: chua co brand logo (canvas/FileReader), Firebase connection, LIS
// Gateway settings, backup/restore nhu ban cu - xem CLAUDE.md "con thieu".
import type { Db } from '../db/open-database';
import { prepareLabProfile, type LabProfileInput } from '../domain/settings-validation';
import { type Actor, type IpcResult, writeAudit } from './shared';

export interface LabProfile {
  id: number; name: string; dept: string; address: string;
  brand_title: string; brand_sub: string; logo_text: string; logo_data: string;
}

export function createSettingsHandlers(db: Db) {
  function getLabProfile(): LabProfile {
    return db.prepare('SELECT * FROM lab WHERE id=1').get() as unknown as LabProfile;
  }

  function saveLabProfile(input: { data: LabProfileInput }, actor: Actor): IpcResult<LabProfile> {
    const { name, dept, address, brandTitle, brandSub } = prepareLabProfile(input.data);
    db.prepare('UPDATE lab SET name=?,dept=?,address=?,brand_title=?,brand_sub=? WHERE id=1')
      .run(name, dept, address, brandTitle, brandSub);
    writeAudit(db, actor, 'Sửa thông tin phòng xét nghiệm', `Cập nhật hồ sơ "${name || brandTitle}"`, name || brandTitle);
    return { ok: true, data: getLabProfile() };
  }

  return { getLabProfile, saveLabProfile };
}

export type SettingsHandlers = ReturnType<typeof createSettingsHandlers>;

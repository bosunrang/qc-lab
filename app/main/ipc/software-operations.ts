import type { Db } from '../db/sqlite-like';
import type { createLicenseService } from '../licensing/license-service';
import type { createUpdateService } from '../updates/update-service';
import type { DesktopSession } from './desktop-operations';
import type { OperationTable, SoftwareApiName } from './operations';
import { writeCommandAsync } from './write-command';

export function createSoftwareOperations(db: Db, license: ReturnType<typeof createLicenseService>, updates: ReturnType<typeof createUpdateService>, session: DesktopSession, onActivated: () => void = () => {}): OperationTable<SoftwareApiName> {
  const check = writeCommandAsync(db, 'checkSoftwareUpdate', 'admin', async (w) => {
    const result = await updates.check();
    if (!result.ok) return result;
    w.commit((tx) => { tx.audit('Kiểm tra cập nhật', result.data.available_version || result.data.current_version); tx.changed(['software_update']); });
    return result;
  });
  const download = writeCommandAsync(db, 'downloadSoftwareUpdate', 'admin', async (w) => {
    const result = await updates.download();
    if (!result.ok) return result;
    w.commit((tx) => { tx.audit('Tải bản cập nhật', result.data.available_version); tx.changed(['software_update']); });
    return result;
  });
  const install = writeCommandAsync(db, 'installSoftwareUpdate', 'admin', (w) => updates.install(() => {
    w.commit((tx) => { tx.audit('Cài bản cập nhật', updates.status().available_version); tx.changed(['software_update']); });
  }));
  return {
    getLicenseStatus: { channel: 'software:getLicenseStatus', lan: true, run: () => license.status() },
    activateSoftware: { channel: 'software:activate', lan: false, run: (_ctx, input) => {
      const result = license.activate(input, session.get() ?? license.activationActor);
      if (result.ok) onActivated();
      return result;
    } },
    getSoftwareUpdateStatus: { channel: 'software:getUpdateStatus', lan: true, run: () => updates.status() },
    checkSoftwareUpdate: { channel: 'software:checkUpdate', lan: false, run: (ctx) => check(ctx.actor()) },
    downloadSoftwareUpdate: { channel: 'software:downloadUpdate', lan: false, run: (ctx) => download(ctx.actor()) },
    installSoftwareUpdate: { channel: 'software:installUpdate', lan: false, run: (ctx) => install(ctx.actor()) },
  };
}

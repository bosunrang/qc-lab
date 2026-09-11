import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';
import { openDatabase } from './db/open-database';
import { type Actor, writeAudit, setBroadcastWindow, setCloudChangeNotifier } from './ipc/shared';
import { createConfigHandlers } from './ipc/config-handlers';
import { createEntryHandlers } from './ipc/entry-handlers';
import { createWestgardHandlers } from './ipc/westgard-handlers';
import { createSigmaHandlers } from './ipc/sigma-handlers';
import { createNceHandlers } from './ipc/nce-handlers';
import { createReagentHandlers } from './ipc/reagent-handlers';
import { createAuthHandlers, type PublicUser } from './ipc/auth-handlers';
import { createAuditHandlers } from './ipc/audit-handlers';
import { createSettingsHandlers } from './ipc/settings-handlers';
import { createReportHandlers } from './ipc/report-handlers';
import { buildXlsxBase64, printHtmlToPdf, type ExportTableInput } from './ipc/export-handlers';
import { createBackupHandlers } from './ipc/backup-handlers';
import { createMigrationHandlers } from './ipc/migration-handlers';
import { createLisHandlers } from './ipc/lis-handlers';
import { createFirebaseHandlers } from './ipc/firebase-handlers';

function createWindow(): void {
  const userDataDir = app.getPath('userData');
  const dbPath = path.join(userDataDir, 'qclab.sqlite');
  const db = openDatabase(dbPath);
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgardHandlers = createWestgardHandlers(db);
  const sigmaHandlers = createSigmaHandlers(db);
  const nceHandlers = createNceHandlers(db);
  const reagentHandlers = createReagentHandlers(db);
  const auth = createAuthHandlers(db);
  const audit = createAuditHandlers(db);
  const settings = createSettingsHandlers(db, dbPath);
  const report = createReportHandlers(db);
  const backup = createBackupHandlers(db, userDataDir);
  const migration = createMigrationHandlers(db, userDataDir);
  const lis = createLisHandlers(db);
  const firebase = createFirebaseHandlers(db, userDataDir);
  setCloudChangeNotifier(firebase.onDataChanged);

  // Danh tính đang đăng nhập: app 1 cửa sổ duy nhất nên giữ ngay trong bộ nhớ
  // main process, không cần session token/cookie. requireActor() là ranh
  // giới bắt buộc đăng nhập cho MỌI thao tác ghi ở các module khác — trước
  // khi có module này, các thao tác đó đứng tên TEMP_ACTOR cố định.
  let sessionActor: Actor | null = null;
  function toActor(user: PublicUser): Actor {
    return { userId: user.id, username: user.username, name: user.name, role: user.role, clientId: 'app-v2-desktop' };
  }
  function requireActor(): Actor {
    if (!sessionActor) throw new Error('Chưa đăng nhập.');
    return sessionActor;
  }

  ipcMain.handle('auth:hasAnyUsers', () => auth.hasAnyUsers());
  // Đọc lại từ DB thay vì dựng từ sessionActor — xem ghi chú getUser().
  ipcMain.handle('auth:currentUser', () => (sessionActor ? auth.getUser(sessionActor.userId) : null));
  ipcMain.handle('auth:bootstrapAdmin', (_event, input) => auth.bootstrapAdmin(input));
  ipcMain.handle('auth:login', (_event, input) => {
    const result = auth.login(input);
    if (result.ok) sessionActor = toActor(result.data);
    return result;
  });
  ipcMain.handle('auth:logout', () => {
    if (sessionActor) writeAudit(db, sessionActor, 'Đăng xuất', 'Đăng xuất khỏi ứng dụng', sessionActor.username);
    sessionActor = null;
    return { ok: true, data: null };
  });
  ipcMain.handle('auth:listUsers', () => auth.listUsers(requireActor()));
  ipcMain.handle('auth:createUser', (_event, input) => auth.createUser(input, requireActor()));
  ipcMain.handle('auth:updateUser', (_event, input) => auth.updateUser(input, requireActor()));
  ipcMain.handle('auth:deleteUser', (_event, input) => auth.deleteUser(input, requireActor()));
  ipcMain.handle('auth:resetPassword', (_event, input) => auth.resetPassword(input, requireActor()));
  ipcMain.handle('auth:changeOwnPassword', (_event, input) => auth.changeOwnPassword(input, requireActor()));
  ipcMain.handle('auth:verifyPassword', (_event, input) => auth.verifyOwnPassword(input, requireActor()));
  ipcMain.handle('auth:setAvatar', (_event, input) => auth.setAvatar(input, requireActor()));
  ipcMain.handle('auth:clearAvatar', () => auth.clearAvatar(requireActor()));

  ipcMain.handle('config:listInstruments', () => config.listInstruments());
  ipcMain.handle('config:saveInstrument', (_event, input) => config.saveInstrument(input, requireActor()));
  ipcMain.handle('config:removeInstrument', (_event, input) => config.removeInstrument(input, requireActor()));
  ipcMain.handle('config:listTests', () => config.listTests());
  ipcMain.handle('config:saveTest', (_event, input) => config.saveTest(input, requireActor()));
  ipcMain.handle('config:listTestLevels', (_event, testId) => config.listTestLevels(testId));
  ipcMain.handle('config:saveTestLevel', (_event, input) => config.saveTestLevel(input, requireActor()));
  ipcMain.handle('config:listActivity', (_event, limit) => config.listActivity(limit));
  ipcMain.handle('config:listRuleScopes', (_event, testId) => config.listRuleScopes(testId));
  ipcMain.handle('config:saveRuleScope', (_event, testId, ruleId, scope) => config.saveRuleScope(testId, ruleId, scope, requireActor()));
  ipcMain.handle('config:listLots', () => config.listLots());
  ipcMain.handle('config:saveLot', (_event, input) => config.saveLot(input, requireActor()));
  ipcMain.handle('config:setTeaRefValue', (_event, input) => config.setTeaRefValue(input, requireActor()));
  ipcMain.handle('config:restoreTeaRefDefaults', (_event, input) => config.restoreTeaRefDefaults(input, requireActor()));
  ipcMain.handle('config:addTeaAnalyte', (_event, input) => config.addTeaAnalyte(input, requireActor()));
  ipcMain.handle('config:removeTest', (_event, input) => config.removeTest(input, requireActor()));
  ipcMain.handle('config:removePanel', (_event, input) => config.removePanel(input, requireActor()));
  ipcMain.handle('config:removeLot', (_event, input) => config.removeLot(input, requireActor()));
  ipcMain.handle('config:listLotGroups', () => config.listLotGroups());
  ipcMain.handle('config:removeLotGroup', (_event, input) => config.removeLotGroup(input, requireActor()));
  ipcMain.handle('config:stopLotGroup', (_event, input) => config.stopLotGroup(input, requireActor()));
  ipcMain.handle('config:activateLotGroup', (_event, input) => config.activateLotGroup(input, requireActor()));
  ipcMain.handle('config:previewLotRename', (_event, input) => config.previewLotRename(input));
  ipcMain.handle('config:removeLotTransition', (_event, input) => config.removeLotTransition(input, requireActor()));
  ipcMain.handle('config:saveLotGroup', (_event, input) => config.saveLotGroup(input, requireActor()));
  ipcMain.handle('config:listPanels', () => config.listPanels());
  ipcMain.handle('config:savePanel', (_event, input) => config.savePanel(input, requireActor()));
  ipcMain.handle('config:listLotTransitions', () => config.listLotTransitions());
  ipcMain.handle('config:createLotTransition', (_event, input) => config.createLotTransition(input, requireActor()));
  ipcMain.handle('config:listTeaRefs', () => config.listTeaRefs());
  ipcMain.handle('config:saveTeaRef', (_event, input) => config.saveTeaRef(input, requireActor()));
  ipcMain.handle('config:removeTeaRef', (_event, input) => config.removeTeaRef(input, requireActor()));
  ipcMain.handle('config:removeTeaLabProfile', (_event, input) => config.removeTeaLabProfile(input, requireActor()));
  ipcMain.handle('audit:query', (_event, input) => audit.query(input));
  ipcMain.handle('audit:exportCsv', (_event, input) => audit.exportCsv(input));
  ipcMain.handle('audit:verifyChainNow', () => audit.verifyChainNow());
  ipcMain.handle('audit:archive', (_event, input) => audit.archive(input, requireActor()));

  ipcMain.handle('entry:queryPoints', (_event, testId, level) => entry.queryPoints(testId, level));
  ipcMain.handle('entry:listHistoryPoints', (_event, testId) => entry.listHistoryPoints(testId));
  ipcMain.handle('entry:listVoidedPoints', (_event, testId) => entry.listVoidedPoints(testId));
  ipcMain.handle('entry:listParallelColumns', (_event, testId) => entry.listParallelColumns(testId));
  ipcMain.handle('entry:listPreviousLotSeries', (_event, testId) => entry.listPreviousLotSeries(testId));
  ipcMain.handle('entry:rangeCandidate', (_event, testId, level) => entry.rangeCandidate(testId, level));
  ipcMain.handle('entry:applyLabRange', (_event, input) => entry.applyLabRange(input, requireActor()));
  ipcMain.handle('entry:revertManufacturerRange', (_event, input) => entry.revertManufacturerRange(input, requireActor()));
  ipcMain.handle('entry:addPoint', (_event, input) => entry.addPoint(input, requireActor()));
  ipcMain.handle('entry:voidPoint', (_event, input) => entry.voidPoint(input, requireActor()));
  ipcMain.handle('entry:setDayNote', (_event, input) => entry.setDayNote(input, requireActor()));

  ipcMain.handle('westgard:listTestSummaries', () => westgardHandlers.listTestSummaries());
  ipcMain.handle('westgard:analyzeLevel', (_event, testId, level) => westgardHandlers.analyzeLevel(testId, level));
  ipcMain.handle('westgard:saveRuleAction', (_event, testId, ruleId, action) => westgardHandlers.saveRuleAction(testId, ruleId, action, requireActor()));
  ipcMain.handle('westgard:listRuleSettings', () => westgardHandlers.listRuleSettings());
  ipcMain.handle('westgard:saveRuleSetting', (_event, ruleId, on) => westgardHandlers.saveRuleSetting(ruleId, on, requireActor()));
  ipcMain.handle('westgard:resetRuleSettings', () => westgardHandlers.resetRuleSettings(requireActor()));
  ipcMain.handle('westgard:listArchivedBlocks', (_event, testId, groupId) => westgardHandlers.listArchivedBlocks(testId, groupId));
  ipcMain.handle('westgard:listArchivedGroupTests', (_event, groupId) => westgardHandlers.listArchivedGroupTests(groupId));
  ipcMain.handle('westgard:listPreviousLotBlocks', (_event, testId) => westgardHandlers.listPreviousLotBlocks(testId));

  ipcMain.handle('sigma:listPeriods', (_event, testId) => sigmaHandlers.listPeriods(testId));
  ipcMain.handle('sigma:listCohorts', (_event, testId, period, levels) => sigmaHandlers.listCohorts(testId, period, levels));
  ipcMain.handle('sigma:setTracking', (_event, input) => sigmaHandlers.setTracking(input, requireActor()));
  ipcMain.handle('sigma:saveTeaConfig', (_event, input) => sigmaHandlers.saveTeaConfig(input, requireActor()));
  ipcMain.handle('sigma:savePeriod', (_event, input) => sigmaHandlers.savePeriod(input, requireActor()));
  ipcMain.handle('sigma:renamePeriod', (_event, input) => sigmaHandlers.renamePeriod(input, requireActor()));
  ipcMain.handle('sigma:removePeriod', (_event, input) => sigmaHandlers.removePeriod(input, requireActor()));

  ipcMain.handle('nce:listRecords', () => nceHandlers.listRecords());
  ipcMain.handle('nce:create', (_event, input) => nceHandlers.create(input, requireActor()));
  ipcMain.handle('nce:saveProtocol', (_event, input) => nceHandlers.saveProtocol(input, requireActor()));
  ipcMain.handle('nce:approve', (_event, input) => nceHandlers.approve(input, requireActor()));
  ipcMain.handle('nce:returnForRevision', (_event, input) => nceHandlers.returnForRevision(input, requireActor()));
  ipcMain.handle('nce:cancel', (_event, input) => nceHandlers.cancel(input, requireActor()));
  ipcMain.handle('nce:setActionCompletedDate', (_event, input) => nceHandlers.setActionCompletedDate(input, requireActor()));
  ipcMain.handle('nce:markEffectiveness', (_event, input) => nceHandlers.markEffectiveness(input, requireActor()));
  ipcMain.handle('nce:setReleaseDecision', (_event, input) => nceHandlers.setReleaseDecision(input, requireActor()));
  ipcMain.handle('nce:setRerunEvidence', (_event, input) => nceHandlers.setRerunEvidence(input, requireActor()));
  ipcMain.handle('nce:reopen', (_event, input) => nceHandlers.reopenNce(input, requireActor()));

  ipcMain.handle('reagent:listComparisons', () => reagentHandlers.listComparisons());
  ipcMain.handle('reagent:createComparison', (_event, input) => reagentHandlers.createComparison(input, requireActor()));
  ipcMain.handle('reagent:saveMetadata', (_event, input) => reagentHandlers.saveMetadata(input, requireActor()));
  ipcMain.handle('reagent:saveRows', (_event, input) => reagentHandlers.saveRows(input, requireActor()));
  ipcMain.handle('reagent:removeComparison', (_event, input) => reagentHandlers.removeComparison(input, requireActor()));
  ipcMain.handle('reagent:listQuickValues', (_event, input) => reagentHandlers.listQuickValues(input));
  ipcMain.handle('reagent:addQuickValue', (_event, input) => reagentHandlers.addQuickListValue(input, requireActor()));
  ipcMain.handle('reagent:removeQuickValue', (_event, input) => reagentHandlers.removeQuickListValue(input, requireActor()));

  ipcMain.handle('settings:getLabProfile', () => settings.getLabProfile());
  ipcMain.handle('settings:saveLabProfile', (_event, input) => settings.saveLabProfile(input, requireActor()));
  ipcMain.handle('settings:getStorageInfo', () => settings.getStorageInfo());
  ipcMain.handle('firebase:getSettings', () => firebase.settings());
  ipcMain.handle('firebase:connect', (_event, input) => firebase.connect(input, requireActor()));
  ipcMain.handle('firebase:sync', (_event, input) => firebase.sync(input, requireActor()));
  ipcMain.handle('firebase:disconnect', () => firebase.disconnect(requireActor()));

  ipcMain.handle('report:listPeriodLocks', () => report.listPeriodLocks());
  ipcMain.handle('report:lockPeriod', (_event, input) => report.lockPeriod(input, requireActor()));
  ipcMain.handle('report:unlockPeriod', (_event, input) => report.unlockPeriod(input, requireActor()));
  ipcMain.handle('report:queryReport', (_event, input) => report.queryReport(input));

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // app-v2 là ứng dụng DESKTOP: không hỗ trợ bố cục mobile/tablet.
    // Toàn bộ CSS `@media(max-width:N)` với N <= 980 đã bị gỡ (2026-09-11),
    // nên cửa sổ hẹp hơn mức này sẽ không có bố cục nào đỡ. Chặn ở đây là
    // thứ làm cho việc gỡ đó AN TOÀN, không chỉ là chưa ai thử.
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setBroadcastWindow(win);

  ipcMain.handle('export:tableXlsx', async (_event, input: ExportTableInput) => {
    try {
      return { ok: true, data: await buildXlsxBase64(input) };
    } catch (e) {
      return { ok: false, error: { code: 'xlsx-failed', message: e instanceof Error ? e.message : 'Không tạo được file Excel.' } };
    }
  });
  ipcMain.handle('print:htmlToPdf', (_event, input: { html: string; defaultFileName: string }) =>
    printHtmlToPdf(win, input.html, input.defaultFileName));
  ipcMain.handle('backup:export', () => backup.exportBackup(requireActor()));
  ipcMain.handle('backup:import', (_event, input) => backup.importBackup(input, requireActor()));
  ipcMain.handle('backup:status', () => backup.backupStatus());
  ipcMain.handle('backup:verify', (_event, input) => backup.verifyBackup(input, requireActor()));
  ipcMain.handle('backup:resetAll', () => backup.resetOperationalData(requireActor()));
  ipcMain.handle('migration:previewLegacyBackup', (_event, input) => migration.preview(input));
  ipcMain.handle('migration:importLegacyBackup', (_event, input) => migration.importLegacy(input, requireActor()));
  ipcMain.handle('lis:getSettings', () => lis.getSettings());
  ipcMain.handle('lis:saveSettings', (_event, input) => lis.saveSettings(input, requireActor()));
  ipcMain.handle('lis:pullQueue', () => lis.pullQueue());
  ipcMain.handle('lis:importResult', (_event, input) => lis.importResult(input, requireActor()));
  ipcMain.handle('lis:rejectResult', (_event, input) => lis.rejectResult(input, requireActor()));

  const devServerUrl = process.env.APP_V2_DEV_SERVER_URL;
  if (devServerUrl) win.loadURL(devServerUrl);
  else win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

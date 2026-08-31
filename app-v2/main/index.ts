import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';
import { openDatabase } from './db/open-database';
import { type Actor, writeAudit } from './ipc/shared';
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

function createWindow(): void {
  const dbPath = path.join(app.getPath('userData'), 'qclab.sqlite');
  const db = openDatabase(dbPath);
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgardHandlers = createWestgardHandlers(db);
  const sigmaHandlers = createSigmaHandlers(db);
  const nceHandlers = createNceHandlers(db);
  const reagentHandlers = createReagentHandlers(db);
  const auth = createAuthHandlers(db);
  const audit = createAuditHandlers(db);
  const settings = createSettingsHandlers(db);
  const report = createReportHandlers(db);

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
  ipcMain.handle('auth:currentUser', () => (sessionActor ? { id: sessionActor.userId, username: sessionActor.username, name: sessionActor.name, role: sessionActor.role, active: true, mustChangePassword: false } : null));
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
  ipcMain.handle('auth:resetPassword', (_event, input) => auth.resetPassword(input, requireActor()));
  ipcMain.handle('auth:changeOwnPassword', (_event, input) => auth.changeOwnPassword(input, requireActor()));

  ipcMain.handle('config:listInstruments', () => config.listInstruments());
  ipcMain.handle('config:saveInstrument', (_event, input) => config.saveInstrument(input, requireActor()));
  ipcMain.handle('config:listTests', () => config.listTests());
  ipcMain.handle('config:saveTest', (_event, input) => config.saveTest(input, requireActor()));
  ipcMain.handle('config:listTestLevels', (_event, testId) => config.listTestLevels(testId));
  ipcMain.handle('config:saveTestLevel', (_event, input) => config.saveTestLevel(input, requireActor()));
  ipcMain.handle('config:listActivity', (_event, limit) => config.listActivity(limit));
  ipcMain.handle('audit:query', (_event, input) => audit.query(input));

  ipcMain.handle('entry:queryPoints', (_event, testId, level) => entry.queryPoints(testId, level));
  ipcMain.handle('entry:addPoint', (_event, input) => entry.addPoint(input, requireActor()));
  ipcMain.handle('entry:voidPoint', (_event, input) => entry.voidPoint(input, requireActor()));

  ipcMain.handle('westgard:listTestSummaries', () => westgardHandlers.listTestSummaries());
  ipcMain.handle('westgard:analyzeLevel', (_event, testId, level) => westgardHandlers.analyzeLevel(testId, level));
  ipcMain.handle('westgard:saveRuleAction', (_event, testId, ruleId, on) => westgardHandlers.saveRuleAction(testId, ruleId, on, requireActor()));

  ipcMain.handle('sigma:listPeriods', (_event, testId) => sigmaHandlers.listPeriods(testId));
  ipcMain.handle('sigma:savePeriod', (_event, input) => sigmaHandlers.savePeriod(input, requireActor()));

  ipcMain.handle('nce:listRecords', () => nceHandlers.listRecords());
  ipcMain.handle('nce:create', (_event, input) => nceHandlers.create(input, requireActor()));
  ipcMain.handle('nce:approve', (_event, input) => nceHandlers.approve(input, requireActor()));
  ipcMain.handle('nce:returnForRevision', (_event, input) => nceHandlers.returnForRevision(input, requireActor()));
  ipcMain.handle('nce:cancel', (_event, input) => nceHandlers.cancel(input, requireActor()));
  ipcMain.handle('nce:setActionCompletedDate', (_event, input) => nceHandlers.setActionCompletedDate(input, requireActor()));
  ipcMain.handle('nce:markEffectiveness', (_event, input) => nceHandlers.markEffectiveness(input, requireActor()));

  ipcMain.handle('reagent:listComparisons', () => reagentHandlers.listComparisons());
  ipcMain.handle('reagent:createComparison', (_event, input) => reagentHandlers.createComparison(input, requireActor()));
  ipcMain.handle('reagent:saveMetadata', (_event, input) => reagentHandlers.saveMetadata(input, requireActor()));
  ipcMain.handle('reagent:saveRows', (_event, input) => reagentHandlers.saveRows(input, requireActor()));
  ipcMain.handle('reagent:removeComparison', (_event, input) => reagentHandlers.removeComparison(input, requireActor()));

  ipcMain.handle('settings:getLabProfile', () => settings.getLabProfile());
  ipcMain.handle('settings:saveLabProfile', (_event, input) => settings.saveLabProfile(input, requireActor()));

  ipcMain.handle('report:listPeriodLocks', () => report.listPeriodLocks());
  ipcMain.handle('report:lockPeriod', (_event, input) => report.lockPeriod(input, requireActor()));
  ipcMain.handle('report:unlockPeriod', (_event, input) => report.unlockPeriod(input, requireActor()));
  ipcMain.handle('report:queryReport', (_event, input) => report.queryReport(input));

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.APP_V2_DEV_SERVER_URL;
  if (devServerUrl) win.loadURL(devServerUrl);
  else win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

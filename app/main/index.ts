import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { networkInterfaces } from 'node:os';
import * as path from 'node:path';
import { openDatabase } from './db/open-database';
import { type Actor, writeAudit, requireAdmin, setBroadcastWindow, setCloudChangeNotifier, setLanChangeNotifier } from './ipc/shared';
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
import { createLisHandlers } from './ipc/lis-handlers';
import { createFirebaseHandlers } from './ipc/firebase-handlers';
import { lanAddresses } from './lan/addresses';
import { LanHttpServer } from './lan/http-server';

const LAN_PORT = 3200;
let tray: Tray | null = null;
let quitting = false;
let mainWindow: BrowserWindow | null = null;
/** Kênh IPC chỉ dùng được trên máy chính (mở hộp thoại tệp), không mở qua LAN. */
const DESKTOP_ONLY_CHANNELS = new Set(['backup:export', 'backup:chooseFile', 'backup:import']);

function showMainWindow(): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function showLanAddresses(port: number): void {
  const addresses = lanAddresses(port, networkInterfaces());
  void dialog.showMessageBox({
    type: 'info',
    title: 'Địa chỉ truy cập',
    message: 'Nhân viên mở trình duyệt và gõ một trong các địa chỉ sau:',
    detail: (addresses.length
      ? addresses.join('\n')
      : `Không tìm thấy địa chỉ IPv4 trong mạng nội bộ. Kiểm tra kết nối mạng của máy chủ rồi thử lại.\n\nCổng cố định: ${port}`)
      // Máy chủ LAN chạy HTTP thường: mật khẩu và phiên đăng nhập đi qua mạng
      // không mã hoá. Nói rõ ngay tại chỗ người quản trị phát địa chỉ cho máy trạm.
      + '\n\nLưu ý bảo mật: kết nối này KHÔNG mã hoá (HTTP). Chỉ dùng trong mạng nội bộ tin cậy của phòng xét nghiệm, '
      + `không dùng qua Wi-Fi khách hay Wi-Fi công cộng, và không mở cổng ${port} ra Internet.`,
    buttons: ['Đóng'],
  });
}

function createTray(port: number): void {
  tray?.destroy();
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'build', 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip(`QC Lab — máy chủ LAN đang chạy tại cổng ${port}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở QC Lab', click: showMainWindow },
    { label: `Máy chủ LAN · cổng ${port}`, enabled: false },
    { label: 'Địa chỉ cho máy nhân viên…', click: () => showLanAddresses(port) },
    { type: 'separator' },
    { label: 'Thoát QC Lab (máy nhân viên sẽ mất kết nối)', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMainWindow);
}

async function createWindow(): Promise<void> {
  // Giữ bản đồ handler IPC để HTTP LAN gọi ĐÚNG cùng cổng nghiệp vụ. Đây là
  // cầu nối tạm thời khi renderer web thay IPC; không sao chép validation hay
  type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
  const lanHandlers = new Map<string, IpcHandler>();
  const electronHandle = ipcMain.handle.bind(ipcMain);
  (ipcMain as unknown as { handle: (channel: string, handler: IpcHandler) => void }).handle = (channel, handler) => {
    lanHandlers.set(channel, handler);
    electronHandle(channel, handler as never);
  };
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
  const lis = createLisHandlers(db);
  const firebase = createFirebaseHandlers(db, userDataDir);
  setCloudChangeNotifier(firebase.onDataChanged);

  // Danh tính đang đăng nhập: app 1 cửa sổ duy nhất nên giữ ngay trong bộ nhớ
  // main process, không cần session token/cookie. requireActor() là ranh
  // giới bắt buộc đăng nhập cho MỌI thao tác ghi ở các module khác — trước
  // khi có module này, các thao tác đó đứng tên TEMP_ACTOR cố định.
  let sessionActor: Actor | null = null;
  let lanCalls = Promise.resolve();
  function toActor(user: PublicUser): Actor {
    return { userId: user.id, username: user.username, name: user.name, role: user.role, clientId: 'app-desktop' };
  }
  function requireActor(): Actor {
    if (!sessionActor) throw new Error('Chưa đăng nhập.');
    return sessionActor;
  }

  /** IPC handlers đóng Actor qua `requireActor()`. Với HTTP nhiều người dùng,
   * tuần tự hoá phần đổi actor trong bộ nhớ để một lệnh không thể chạy bằng
   * danh tính của request khác. SQLite vẫn là nơi thực thi transaction. */
  async function invokeLan(channel: string, args: unknown[], actor: Actor): Promise<unknown> {
    // Tên hàm QcApi được giữ cho renderer, còn IPC có namespace. Không suy
    // đoán mơ hồ: `getSettings` tồn tại cả Firebase và LIS.
    const routes: Record<string, string> = {
      resetUserPassword: 'auth:resetPassword', verifyOwnPassword: 'auth:verifyPassword',
      listEntryHistoryPoints: 'entry:listHistoryPoints', listVoidedEntryPoints: 'entry:listVoidedPoints', listParallelEntryColumns: 'entry:listParallelColumns', listPreviousEntryLotSeries: 'entry:listPreviousLotSeries', getRangeCandidate: 'entry:rangeCandidate',
      listSigmaPeriods: 'sigma:listPeriods', listSigmaCohorts: 'sigma:listCohorts', saveSigmaTeaConfig: 'sigma:saveTeaConfig', saveSigmaPeriod: 'sigma:savePeriod', renameSigmaPeriod: 'sigma:renamePeriod', removeSigmaPeriod: 'sigma:removePeriod',
      listNceRecords: 'nce:listRecords', returnNce: 'nce:returnForRevision', setNceCompletedDate: 'nce:setActionCompletedDate', markNceEffectiveness: 'nce:markEffectiveness', setNceReleaseDecision: 'nce:setReleaseDecision', setNceRerunEvidence: 'nce:setRerunEvidence', reopenNce: 'nce:reopen',
      listReagentComparisons: 'reagent:listComparisons', createReagentComparison: 'reagent:createComparison', saveReagentMetadata: 'reagent:saveMetadata', saveReagentRows: 'reagent:saveRows', removeReagentComparison: 'reagent:removeComparison', listReagentQuickValues: 'reagent:listQuickValues', addReagentQuickValue: 'reagent:addQuickValue', removeReagentQuickValue: 'reagent:removeQuickValue',
      getFirebaseSettings: 'firebase:getSettings', resetOperationalData: 'backup:resetAll',
      getLisSettings: 'lis:getSettings', saveLisSettings: 'lis:saveSettings', pullLisQueue: 'lis:pullQueue', importLisResult: 'lis:importResult', rejectLisResult: 'lis:rejectResult',
    };
    const target = routes[channel] || [...lanHandlers.keys()].find((name) => name.endsWith(`:${channel}`));
    const handler = target ? lanHandlers.get(target) : undefined;
    // Xuất/nhập backup mở hộp thoại chọn tệp trên MÁY CHÍNH và đọc/ghi tệp ở
    // đó, nên không có nghĩa với máy trạm. Trước đây kênh `backup:export` vẫn
    // khớp theo đuôi tên (`export`) và trả cả CSDL qua mạng.
    if (!handler || channel === 'auth:bootstrapAdmin' || (target && DESKTOP_ONLY_CHANNELS.has(target))) {
      return { ok: false, error: { code: 'unknown-operation', message: 'Thao tác không được mở qua mạng nội bộ.' } };
    }
    let result: unknown;
    let failure: unknown;
    lanCalls = lanCalls.then(async () => {
      // Mọi handler lấy `requireActor()` ngay trong phần ĐỒNG BỘ của lời gọi,
      // nên actor LAN chỉ được đặt đúng trong phần đó. Giữ nó qua `await` thì
      // handler bất đồng bộ (LIS, Firebase…) để hở một khoảng mà thao tác
      // desktop gọi `requireActor()` sẽ chạy dưới danh tính người dùng LAN,
      // và lúc khôi phục có thể ghi đè phiên desktop vừa đăng nhập.
      const previous = sessionActor;
      let pending: unknown;
      sessionActor = actor;
      try { pending = handler({} as never, ...args); }
      catch (error) { failure = error; }
      finally { sessionActor = previous; }
      if (!failure) {
        try { result = await pending; }
        catch (error) { failure = error; }
      }
    });
    await lanCalls;
    if (failure) throw failure;
    return result;
  }

  ipcMain.handle('auth:hasAnyUsers', () => auth.hasAnyUsers());
  // Đọc lại từ DB thay vì dựng từ sessionActor — xem ghi chú getUser().
  ipcMain.handle('auth:currentUser', () => (sessionActor ? auth.getUser(sessionActor.userId) : null));
  ipcMain.handle('auth:bootstrapAdmin', (_event, input) => auth.bootstrapAdmin(input));
  ipcMain.handle('auth:login', async (_event, input) => {
    const result = await auth.login(input);
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
  ipcMain.handle('config:listPlannedTargets', () => config.listPlannedTargets());
  ipcMain.handle('config:savePlannedTargets', (_event, input) => config.savePlannedTargets(input, requireActor()));
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
  ipcMain.handle('audit:query', (_event, input) => audit.query(input, requireActor()));
  ipcMain.handle('audit:previewArchive', (_event, input) => audit.previewArchive(input, requireActor()));
  ipcMain.handle('audit:exportCsv', (_event, input) => audit.exportCsv(input, requireActor()));
  ipcMain.handle('audit:verifyChainNow', () => audit.verifyChainNow(requireActor()));
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
  ipcMain.handle('settings:getLoginBrand', () => settings.getLoginBrand());
  ipcMain.handle('settings:saveLabProfile', (_event, input) => settings.saveLabProfile(input, requireActor()));
  ipcMain.handle('settings:getStorageInfo', () => settings.getStorageInfo());
  ipcMain.handle('firebase:getSettings', () => firebase.settings());
  ipcMain.handle('firebase:connect', (_event, input) => firebase.connect(input, requireActor()));
  ipcMain.handle('firebase:sync', (_event, input) => firebase.sync(input, requireActor()));
  ipcMain.handle('firebase:disconnect', () => firebase.disconnect(requireActor()));

  ipcMain.handle('report:listPeriodLocks', () => report.listPeriodLocks());
  ipcMain.handle('report:getTemplateSettings', () => report.getReportTemplateSettings());
  ipcMain.handle('report:saveTemplateSettings', (_event, input) => report.saveReportTemplateSettings(input, requireActor()));
  ipcMain.handle('report:lockPeriod', (_event, input) => report.lockPeriod(input, requireActor()));
  ipcMain.handle('report:unlockPeriod', (_event, input) => report.unlockPeriod(input, requireActor()));
  ipcMain.handle('report:queryReport', (_event, input) => report.queryReport(input));

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // app là ứng dụng DESKTOP: không hỗ trợ bố cục mobile/tablet.
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
  ipcMain.handle('print:htmlToPdf', (_event, input: { html: string; defaultFileName: string; pageNumbers?: boolean }) =>
    printHtmlToPdf(win, input.html, input.defaultFileName, input.pageNumbers));
  // Backup là tệp trên máy chính: main mở hộp thoại, renderer chỉ nhận kết
  // quả. Tệp được chọn để phục hồi giữ ở đây sau bước kiểm tra, nên bước phục
  // hồi không nhận đường dẫn từ renderer.
  let pendingRestorePath: string | null = null;
  ipcMain.handle('backup:export', async () => {
    const actor = requireActor();
    const denied = requireAdmin(actor); if (denied) return denied;
    const picked = await dialog.showSaveDialog(win, {
      title: 'Xuất backup QC Lab',
      defaultPath: `qclab-backup-${new Date().toISOString().slice(0, 10)}.sqlite`,
      filters: [{ name: 'Backup QC Lab', extensions: ['sqlite'] }],
    });
    if (picked.canceled || !picked.filePath) return { ok: true, data: null };
    return backup.exportBackupTo(picked.filePath, actor);
  });
  ipcMain.handle('backup:chooseFile', async () => {
    const actor = requireActor();
    const denied = requireAdmin(actor); if (denied) return denied;
    pendingRestorePath = null;
    const picked = await dialog.showOpenDialog(win, {
      title: 'Chọn tệp backup để phục hồi',
      properties: ['openFile'],
      filters: [{ name: 'Backup QC Lab', extensions: ['sqlite', 'json'] }],
    });
    const filePath = picked.filePaths[0];
    if (picked.canceled || !filePath) return { ok: true, data: null };
    const verified = backup.verifyBackupFile(filePath, actor);
    if (!verified.ok) return verified;
    pendingRestorePath = filePath;
    return { ok: true, data: { ...verified.data, fileName: path.basename(filePath) } };
  });
  ipcMain.handle('backup:import', () => {
    const actor = requireActor();
    if (!pendingRestorePath) return { ok: false, error: { code: 'no-file', message: 'Chưa chọn tệp backup để phục hồi.' } };
    const filePath = pendingRestorePath;
    pendingRestorePath = null;
    return backup.importBackupFrom(filePath, actor);
  });
  ipcMain.handle('backup:status', () => backup.backupStatus());
  ipcMain.handle('backup:resetAll', () => backup.resetOperationalData(requireActor()));
  ipcMain.handle('lis:getSettings', () => lis.getSettings());
  ipcMain.handle('lis:saveSettings', (_event, input) => lis.saveSettings(input, requireActor()));
  ipcMain.handle('lis:pullQueue', () => lis.pullQueue());
  ipcMain.handle('lis:importResult', (_event, input) => lis.importResult(input, requireActor()));
  ipcMain.handle('lis:rejectResult', (_event, input) => lis.rejectResult(input, requireActor()));

  const lan = new LanHttpServer<PublicUser>({
    login: (input) => auth.login(input as { data: { username: string; password: string } }),
    getLoginBrand: () => settings.getLoginBrand(),
    actorOf: toActor,
    currentUser: (actor) => auth.getUser(actor.userId),
    invoke: invokeLan,
    staticDir: path.join(__dirname, '..', 'renderer'),
  });
  mainWindow = win;
  let lanPort: number;
  try {
    lanPort = await lan.start(LAN_PORT);
  } catch (error) {
    const detail = error instanceof Error ? `\n\n${error.message}` : '';
    throw new Error(`Cổng cố định ${LAN_PORT} đang được chương trình khác sử dụng. Hãy đóng chương trình đó rồi mở lại QC Lab.${detail}`);
  }
  setLanChangeNotifier((payload) => lan.publishChanged(payload));
  console.log(`QC Lab LAN server is listening on port ${lanPort}`);

  createTray(lanPort);
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  const devServerUrl = process.env.APP_V2_DEV_SERVER_URL;
  if (devServerUrl) win.loadURL(devServerUrl);
  else win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// Một lần bấm icon thứ hai không được tạo thêm server LAN. Cổng 3200 là cố
// định cho các máy trạm, vì vậy ta chuyển yêu cầu đó cho bản QC Lab đang chạy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
  app.whenReady().then(createWindow).catch((error) => {
    dialog.showErrorBox('Không khởi động được QC Lab', error instanceof Error ? error.message : 'Không thể khởi động máy chủ LAN.');
    app.quit();
  });

  app.on('window-all-closed', () => {
    // Máy chủ LAN phải tiếp tục chạy khi cửa sổ chỉ được ẩn xuống khay.
  });
  app.on('before-quit', () => { quitting = true; });
}



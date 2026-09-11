// `window.qcApi` cho BẢN XEM TRƯỚC QUA TRÌNH DUYỆT — chạy CHÍNH các handler
// `main/ipc/*` thật trên SQLite (sql.js/WASM) lưu trong IndexedDB.
//
// Thay cho `api.ts` cũ (1.748 dòng dịch lại logic của handler bằng mảng JS +
// localStorage). Lý do đổi: bản dịch tay đó là bản cài đặt THỨ HAI của toàn
// bộ tầng điều phối — và chính là nguồn của 18 lệch hành vi mà hạng mục C7
// phải đi bắt từng cái (79 chuỗi tiếng Việt mất dấu, nhật ký chỉ ghi 19/40
// dòng, mất cổng admin + allowlist origin của LIS, CSV không escape...).
// Từ nay bản xem trước và bản Electron dùng CÙNG một đoạn mã nghiệp vụ; chỉ
// khác 3 primitive, tất cả đều có bản song song đã test đối chiếu:
//   - SQLite: `node:sqlite` <-> sql.js/WASM (`sqlite-shim.ts`)
//   - SHA-256: `node:crypto` <-> JS thuần (`sha256-browser.ts`)
//   - PBKDF2: 600.000 vòng <-> 20.000 vòng, cùng thuật toán, tương thích 2
//     chiều vì số vòng nằm trong chuỗi lưu (`password-hash-browser.ts`)
//
// Những gì KHÔNG chạy được trong trình duyệt (file system, BrowserWindow,
// HTTP tới LIS Gateway, exceljs) trả `not-available-in-browser-preview` —
// GIỮ ĐÚNG danh sách hàm mà `api.ts` cũ đã trả như vậy, không mở rộng thêm ở
// bước này, để mọi khác biệt quan sát được đều truy được về việc đổi backend
// chứ không phải về việc bật thêm tính năng.
import { openPreviewDatabase } from './sqlite-loader';
import { setBrowserDbSizeSource } from '../../main/ipc/db-file-size-browser';
import { type Actor, setBroadcastWindow, writeAudit } from '../../main/ipc/shared';
import { createConfigHandlers } from '../../main/ipc/config-handlers';
import { createEntryHandlers } from '../../main/ipc/entry-handlers';
import { createWestgardHandlers } from '../../main/ipc/westgard-handlers';
import { createSigmaHandlers } from '../../main/ipc/sigma-handlers';
import { createNceHandlers } from '../../main/ipc/nce-handlers';
import { createReagentHandlers } from '../../main/ipc/reagent-handlers';
import { createAuthHandlers, type PublicUser } from '../../main/ipc/auth-handlers';
import { createAuditHandlers } from '../../main/ipc/audit-handlers';
import { createSettingsHandlers } from '../../main/ipc/settings-handlers';
import { createReportHandlers } from '../../main/ipc/report-handlers';
import { createLisHandlers } from '../../main/ipc/lis-handlers';
import type { QcApi, IpcResult } from '../../shared/qc-api';


/** Hiện ở thẻ "Dung lượng" trang Cài đặt. Không phải file thật — nói rõ điều
 * đó thay vì bịa một đường dẫn nghe như có thật. */
const PREVIEW_DB_PATH = 'IndexedDB: qclab-v2-preview (xem trước, không phải file trên đĩa)';

function notAvailable(): IpcResult<never> {
  return {
    ok: false,
    error: {
      code: 'not-available-in-browser-preview',
      message: 'Không khả dụng ở chế độ xem trước trình duyệt — cần chạy Electron thật (npm run app-v2:start).',
    },
  };
}

export async function createRealBrowserApi(): Promise<QcApi> {
  const preview = await openPreviewDatabase();
  const db = preview.db;
  setBrowserDbSizeSource(() => db.export().length);

  // `store:changed` — bản xem trước tự làm đích phát. `api.ts` cũ trả
  // `() => {}` và KHÔNG BAO GIỜ gọi callback, nên mọi `useStoreInvalidation()`
  // đều vô hiệu ở bản xem trước (một lệch nữa mà mock-parity không thấy: nó
  // chỉ chốt "trả về hàm huỷ đăng ký gọi được"). Nay dùng đúng điểm móc của
  // kiến trúc thật.
  const listeners = new Set<(payload: { tables: string[]; testIds: string[] }) => void>();
  setBroadcastWindow({
    webContents: {
      send(channel: string, payload: unknown) {
        if (channel !== 'store:changed') return;
        // Mọi thao tác ghi hợp lệ đều đi qua writeAudit() -> notifyChanged(),
        // nên đây là chỗ DUY NHẤT cần hẹn ghi database xuống IndexedDB —
        // không phải bọc từng hàm ghi một.
        preview.persist();
        const data = payload as { tables: string[]; testIds: string[] };
        for (const listener of listeners) listener(data);
      },
    },
  });

  // Cửa duy nhất để buộc ghi ngay xuống IndexedDB. Chỉ tồn tại ở bản xem
  // trước (Electron không đi qua file này) và chỉ dùng bởi gate parity: nó
  // seed xong rồi tải lại trang, mà `persist()` gộp 250ms nên nếu không đợi
  // ghi xong thì trang mới mở lên với database RỖNG — đã gặp thật, biểu hiện
  // là mọi surface lệch vì app quay về màn hình "tạo tài khoản quản trị".
  (window as unknown as { __qcPreviewFlush?: () => Promise<void> }).__qcPreviewFlush = () => preview.flush();

  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgard = createWestgardHandlers(db);
  const sigma = createSigmaHandlers(db);
  const nce = createNceHandlers(db);
  const reagent = createReagentHandlers(db);
  const auth = createAuthHandlers(db);
  const audit = createAuditHandlers(db);
  const settings = createSettingsHandlers(db, PREVIEW_DB_PATH);
  const report = createReportHandlers(db);
  // `lis-handlers.ts` không phụ thuộc `node:*` (đã kiểm) nên cấu hình LIS
  // chạy THẬT được ở đây; chỉ 3 hàm gọi HTTP ra ngoài là không, vì CSP
  // `connect-src 'self'` của renderer chặn và gateway là tiến trình riêng.
  const lis = createLisHandlers(db);

  // Danh tính đang đăng nhập — sao đúng cách `main/index.ts` làm (một biến
  // trong bộ nhớ, app một cửa sổ, không session token).
  //
  // KHÁC một điểm, và là điểm BẮT BUỘC phải bù: trong Electron, biến này nằm
  // ở MAIN PROCESS nên tải lại cửa sổ renderer không làm mất đăng nhập. Ở
  // bản xem trước, "main process" chính là tab, nên mỗi lần F5 sẽ văng ra
  // màn hình đăng nhập — khác hẳn hành vi thật. Ghi id phiên vào
  // `sessionStorage` (sống qua F5, mất khi đóng tab) để khôi phục đúng như
  // Electron. Chỉ lưu ID, không lưu mật khẩu.
  const SESSION_KEY = 'qclab-v2-preview-session';
  let sessionActor: Actor | null = null;

  function rememberSession(): void {
    try {
      if (sessionActor) sessionStorage.setItem(SESSION_KEY, sessionActor.userId);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* trình duyệt chặn lưu trữ: chỉ mất khôi phục phiên */ }
  }
  function toActor(user: PublicUser): Actor {
    return {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      clientId: 'app-v2-browser-preview',
    };
  }
  function requireActor(): Actor {
    if (!sessionActor) throw new Error('Chưa đăng nhập.');
    return sessionActor;
  }

  // Khôi phục phiên sau F5 — đọc lại từ DB (không tin dữ liệu trong
  // sessionStorage ngoài mỗi id), và bỏ qua nếu tài khoản đã bị khoá/xoá.
  try {
    const savedId = sessionStorage.getItem(SESSION_KEY);
    if (savedId) {
      const user = auth.getUser(savedId);
      if (user && user.active) sessionActor = toActor(user);
      else sessionStorage.removeItem(SESSION_KEY);
    }
  } catch { /* không có sessionStorage: coi như chưa đăng nhập */ }

  const api = {
    // auth
    hasAnyUsers: async () => auth.hasAnyUsers(),
    currentUser: async () => (sessionActor ? auth.getUser(sessionActor.userId) : null),
    bootstrapAdmin: async (input) => {
      const result = auth.bootstrapAdmin(input);
      preview.persist();
      return result;
    },
    login: async (input) => {
      const result = auth.login(input);
      if (result.ok) sessionActor = toActor(result.data);
      rememberSession();
      preview.persist();
      return result;
    },
    logout: async () => {
      if (sessionActor) writeAudit(db, sessionActor, 'Đăng xuất', 'Đăng xuất khỏi ứng dụng', sessionActor.username);
      sessionActor = null;
      rememberSession();
      return { ok: true as const, data: null };
    },
    listUsers: async () => auth.listUsers(requireActor()),
    createUser: async (input) => auth.createUser(input, requireActor()),
    updateUser: async (input) => auth.updateUser(input, requireActor()),
    deleteUser: async (input) => auth.deleteUser(input, requireActor()),
    resetUserPassword: async (input) => auth.resetPassword(input, requireActor()),
    changeOwnPassword: async (input) => auth.changeOwnPassword(input, requireActor()),
    verifyOwnPassword: async (input) => auth.verifyOwnPassword(input, requireActor()),
    setAvatar: async (input) => auth.setAvatar(input, requireActor()),
    clearAvatar: async () => auth.clearAvatar(requireActor()),

    // config
    listInstruments: async () => config.listInstruments(),
    saveInstrument: async (input) => config.saveInstrument(input, requireActor()),
    removeInstrument: async (input) => config.removeInstrument(input, requireActor()),
    listTests: async () => config.listTests(),
    saveTest: async (input) => config.saveTest(input, requireActor()),
    listTestLevels: async (testId: string) => config.listTestLevels(testId),
    saveTestLevel: async (input) => config.saveTestLevel(input, requireActor()),
    listActivity: async (limit?: number) => config.listActivity(limit),
    listRuleScopes: async (testId: string) => config.listRuleScopes(testId),
    saveRuleScope: async (testId: string, ruleId: string, scope) => config.saveRuleScope(testId, ruleId, scope, requireActor()),
    listLots: async () => config.listLots(),
    saveLot: async (input) => config.saveLot(input, requireActor()),
    setTeaRefValue: async (input) => config.setTeaRefValue(input, requireActor()),
    restoreTeaRefDefaults: async (input) => config.restoreTeaRefDefaults(input, requireActor()),
    addTeaAnalyte: async (input) => config.addTeaAnalyte(input, requireActor()),
    removeTest: async (input) => config.removeTest(input, requireActor()),
    removePanel: async (input) => config.removePanel(input, requireActor()),
    removeLot: async (input) => config.removeLot(input, requireActor()),
    listLotGroups: async () => config.listLotGroups(),
    removeLotGroup: async (input) => config.removeLotGroup(input, requireActor()),
    stopLotGroup: async (input) => config.stopLotGroup(input, requireActor()),
    activateLotGroup: async (input) => config.activateLotGroup(input, requireActor()),
    previewLotRename: async (input) => config.previewLotRename(input),
    removeLotTransition: async (input) => config.removeLotTransition(input, requireActor()),
    saveLotGroup: async (input) => config.saveLotGroup(input, requireActor()),
    listPanels: async () => config.listPanels(),
    savePanel: async (input) => config.savePanel(input, requireActor()),
    listLotTransitions: async () => config.listLotTransitions(),
    createLotTransition: async (input) => config.createLotTransition(input, requireActor()),
    listTeaRefs: async () => config.listTeaRefs(),
    saveTeaRef: async (input) => config.saveTeaRef(input, requireActor()),
    removeTeaRef: async (input) => config.removeTeaRef(input, requireActor()),
    removeTeaLabProfile: async (input) => config.removeTeaLabProfile(input, requireActor()),

    // audit
    queryActivity: async (input) => audit.query(input),
    exportActivityCsv: async (input) => audit.exportCsv(input),
    verifyActivityChainNow: async () => audit.verifyChainNow(),
    archiveActivity: async (input) => audit.archive(input, requireActor()),

    // entry
    queryPoints: async (testId: string, level: number) => entry.queryPoints(testId, level),
    listEntryHistoryPoints: async (testId: string) => entry.listHistoryPoints(testId),
    listVoidedEntryPoints: async (testId: string) => entry.listVoidedPoints(testId),
    listParallelEntryColumns: async (testId: string) => entry.listParallelColumns(testId),
    listPreviousEntryLotSeries: async (testId: string) => entry.listPreviousLotSeries(testId),
    getRangeCandidate: async (testId: string, level: number) => entry.rangeCandidate(testId, level),
    applyLabRange: async (input) => entry.applyLabRange(input, requireActor()),
    revertManufacturerRange: async (input) => entry.revertManufacturerRange(input, requireActor()),
    addPoint: async (input) => entry.addPoint(input, requireActor()),
    voidPoint: async (input) => entry.voidPoint(input, requireActor()),
    setDayNote: async (input) => entry.setDayNote(input, requireActor()),

    // westgard
    listTestSummaries: async () => westgard.listTestSummaries(),
    analyzeLevel: async (testId: string, level: number) => westgard.analyzeLevel(testId, level),
    saveRuleAction: async (testId: string, ruleId: string, action) => westgard.saveRuleAction(testId, ruleId, action, requireActor()),
    listRuleSettings: async () => westgard.listRuleSettings(),
    saveRuleSetting: async (ruleId: string, on: boolean) => westgard.saveRuleSetting(ruleId, on, requireActor()),
    resetRuleSettings: async () => westgard.resetRuleSettings(requireActor()),
    listArchivedBlocks: async (testId: string, groupId: string) => westgard.listArchivedBlocks(testId, groupId),
    listArchivedGroupTests: async (groupId: string) => westgard.listArchivedGroupTests(groupId),
    listPreviousLotBlocks: async (testId: string) => westgard.listPreviousLotBlocks(testId),

    // sigma
    listSigmaPeriods: async (testId: string) => sigma.listPeriods(testId),
    listSigmaCohorts: async (testId: string, period: string, levels: number[]) => sigma.listCohorts(testId, period, levels),
    setSigmaTracking: async (input) => sigma.setTracking(input, requireActor()),
    saveSigmaTeaConfig: async (input) => sigma.saveTeaConfig(input, requireActor()),
    saveSigmaPeriod: async (input) => sigma.savePeriod(input, requireActor()),
    renameSigmaPeriod: async (input) => sigma.renamePeriod(input, requireActor()),
    removeSigmaPeriod: async (input) => sigma.removePeriod(input, requireActor()),

    // nce
    listNceRecords: async () => nce.listRecords(),
    createNce: async (input) => nce.create(input, requireActor()),
    saveNceProtocol: async (input) => nce.saveProtocol(input, requireActor()),
    approveNce: async (input) => nce.approve(input, requireActor()),
    returnNce: async (input) => nce.returnForRevision(input, requireActor()),
    cancelNce: async (input) => nce.cancel(input, requireActor()),
    setNceCompletedDate: async (input) => nce.setActionCompletedDate(input, requireActor()),
    markNceEffectiveness: async (input) => nce.markEffectiveness(input, requireActor()),
    setNceReleaseDecision: async (input) => nce.setReleaseDecision(input, requireActor()),
    setNceRerunEvidence: async (input) => nce.setRerunEvidence(input, requireActor()),
    reopenNce: async (input) => nce.reopenNce(input, requireActor()),

    // reagent
    listReagentComparisons: async () => reagent.listComparisons(),
    createReagentComparison: async (input) => reagent.createComparison(input, requireActor()),
    saveReagentMetadata: async (input) => reagent.saveMetadata(input, requireActor()),
    saveReagentRows: async (input) => reagent.saveRows(input, requireActor()),
    removeReagentComparison: async (input) => reagent.removeComparison(input, requireActor()),
    listReagentQuickValues: async (input) => reagent.listQuickValues(input),
    addReagentQuickValue: async (input) => reagent.addQuickListValue(input, requireActor()),
    removeReagentQuickValue: async (input) => reagent.removeQuickListValue(input, requireActor()),

    // settings / report
    getLabProfile: async () => settings.getLabProfile(),
    saveLabProfile: async (input) => settings.saveLabProfile(input, requireActor()),
    getStorageInfo: async () => settings.getStorageInfo(),
    listPeriodLocks: async () => report.listPeriodLocks(),
    lockPeriod: async (input) => report.lockPeriod(input, requireActor()),
    unlockPeriod: async (input) => report.unlockPeriod(input, requireActor()),
    queryReport: async (input) => report.queryReport(input),

    backupStatus: async () => {
      // KHÔNG import `backup-handlers.ts`: nó kéo `db/table-io.ts`
      // (`node:fs`) và `domain/backup.ts` (`node:crypto`), mà Vite biến mọi
      // builtin của Node thành proxy ném lỗi NGAY KHI MODULE LOAD — một
      // import như vậy làm cả `real-api.ts` không nạp được trong tab. Thẻ
      // "lời nhắc sao lưu" ở trang Cài đặt chỉ cần 2 mốc trong `app_meta`.
      //
      // Hình dạng trả về phải khớp CHÍNH XÁC `backup-handlers.ts`: object
      // TRỰC TIẾP (không bọc `IpcResult`) và có đủ `maxImportBytes` —
      // bọc nhầm `{ok,data}` làm trang Cài đặt không dựng được thẻ sao lưu,
      // và gate parity bắt đúng chỗ đó.
      const rows = db.prepare("SELECT key, value FROM app_meta WHERE key IN ('lastBackupAt','lastBackupBytes')").all() as { key: string; value: string }[];
      const at = rows.find((r) => r.key === 'lastBackupAt')?.value || null;
      const bytes = Number(rows.find((r) => r.key === 'lastBackupBytes')?.value || 0);
      return {
        lastBackupAt: at,
        lastBackupBytes: Number.isFinite(bytes) ? bytes : 0,
        // Giữ đồng bộ với `MAX_IMPORT_BYTES` của backup-handlers.ts (128 MB).
        maxImportBytes: 128 * 1024 * 1024,
      };
    },

    // Cần Electron thật — khớp đúng danh sách `api.ts` cũ đã trả
    // not-available, không nới thêm ở bước này.
    // Trả TRỰC TIẾP (không bọc `IpcResult`) đúng như `firebase-handlers.ts`.
    getFirebaseSettings: async () => ({ labCode: '', email: '', config: '', connected: false, status: 'Chưa kết nối', dataPath: '' }),
    connectFirebase: async () => notAvailable(),
    syncFirebase: async () => notAvailable(),
    disconnectFirebase: async () => notAvailable(),
    exportTableXlsx: async () => notAvailable(),
    printHtmlToPdf: async () => notAvailable(),
    exportBackup: async () => notAvailable(),
    importBackup: async () => notAvailable(),
    verifyBackup: async () => notAvailable(),
    resetOperationalData: async () => notAvailable(),
    previewLegacyBackup: async () => notAvailable(),
    importLegacyBackup: async () => notAvailable(),
    getLisSettings: async () => lis.getSettings(),
    saveLisSettings: async (input) => lis.saveSettings(input, requireActor()),
    pullLisQueue: async () => ({
      ok: false as const,
      error: {
        code: 'not-available-in-browser-preview',
        message: 'LIS Gateway cần Electron thật (server độc lập gọi qua main process).',
      },
    }),
    importLisResult: async () => notAvailable(),
    rejectLisResult: async () => notAvailable(),

    onStoreChanged: (callback: (payload: { tables: string[]; testIds: string[] }) => void) => {
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    },
    // `satisfies QcApi` là SEAM của file này: thiếu hàm, thừa hàm, gõ sai
    // tên, HOẶC trả sai hình dạng đều đỏ ngay ở `tsc`. Dùng được `QcApi`
    // trực tiếp từ 2026-09-10, sau khi dọn xong drift giữa hợp đồng và
    // handler thật (xem CLAUDE.md) — trước đó phải nới thành một mapped type
    // chỉ so tên hàm.
  } satisfies QcApi;

  return api;
}

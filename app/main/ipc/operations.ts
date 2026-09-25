// Bảng thao tác một nguồn cho mọi đường gọi vào main: IPC của Electron, RPC
// của máy trạm LAN và bản xem trước qua trình duyệt đều đọc CÙNG bảng này.
//
// Mỗi dòng khai: tên hàm `QcApi`, kênh IPC, có mở qua LAN hay không, và hàm
// chạy nhận `CallContext`. Danh tính người gọi đi theo từng lời gọi qua
// `ctx.actor()`, không nằm trong biến toàn cục: trước đây LAN tráo tạm biến
// `sessionActor` của máy chính rồi trả lại, nên phải xếp hàng mọi lời gọi LAN
// và vẫn hở một khoảng khi handler có `await` (vd `auth:login` gán phiên sau
// `await`, tức máy trạm thay được phiên đang mở trên máy chính).
//
// LAN chỉ gọi được dòng có `lan: true` — danh sách cho phép tường minh, thay
// cho cách cũ tìm handler theo đuôi tên kênh.
//
// Máy trạm LAN chỉ dùng để NHẬP LIỆU (người dùng chốt 2026-09-25): mở mọi
// thao tác đọc và các thao tác ghi của KTV — điểm QC, ghi chú ngày, lập dải,
// NCE, Sigma, so sánh hoá chất, nhận/bỏ kết quả LIS, mật khẩu và ảnh của
// chính mình. Mọi thao tác quản trị chỉ làm trên máy chính, kể cả khi đăng
// nhập bằng tài khoản admin: người dùng, danh mục, lô, TEa, cấu hình luật
// Westgard, khoá kỳ, nhật ký, cài đặt LIS, hồ sơ đơn vị, mẫu báo cáo, xoá kỳ
// Sigma và phép so sánh hoá chất. Quy tắc gọn: thao tác nào handler đòi quyền
// admin thì `lan: false` (test canh điều này).
import type { QcApi } from '../../shared/qc-api';
import type { Actor } from './shared';
import type { createAuditHandlers } from './audit-handlers';
import type { createAuthHandlers } from './auth-handlers';
import type { createConfigHandlers } from './config-handlers';
import type { createEntryHandlers } from './entry-handlers';
import type { createLisHandlers } from './lis-handlers';
import type { createNceHandlers } from './nce-handlers';
import type { createReagentHandlers } from './reagent-handlers';
import type { createReportHandlers } from './report-handlers';
import type { createSettingsHandlers } from './settings-handlers';
import type { createSigmaHandlers } from './sigma-handlers';
import type { createWestgardHandlers } from './westgard-handlers';

export type ApiName = Exclude<keyof QcApi, 'onStoreChanged'>;
type Args<N extends ApiName> = Parameters<QcApi[N]>;
type Result<N extends ApiName> = Awaited<ReturnType<QcApi[N]>>;

/** Ngữ cảnh của MỘT lời gọi. `actor()` ném lỗi "Chưa đăng nhập." khi lời gọi
 * không gắn với phiên nào — cùng hành vi `requireActor()` cũ. */
export interface CallContext {
  actor(): Actor;
}

export interface Operation<N extends ApiName> {
  channel: string;
  /** `true`: máy trạm LAN gọi được qua `/api/rpc`. Mặc định của dòng mới là
   * `false`; chỉ mở khi là thao tác nhập liệu (xem đầu tệp), handler tự kiểm
   * quyền theo `ctx.actor()` và không đụng tới tài nguyên riêng của máy chính
   * (hộp thoại, tệp, cửa sổ, phiên). */
  lan: boolean;
  run(ctx: CallContext, ...args: Args<N>): Result<N> | Promise<Result<N>>;
}

export type OperationTable<N extends ApiName> = { [K in N]: Operation<K> };

/** Thao tác cần tài nguyên riêng của từng môi trường chạy (phiên đăng nhập,
 * hộp thoại tệp, cửa sổ in, Firebase, backup trên đĩa). Electron khai ở
 * `desktop-operations.ts`, bản xem trước tự cài ở `real-api.ts`. */
export type HostApiName =
  | 'currentUser' | 'bootstrapAdmin' | 'login' | 'logout'
  | 'getFirebaseSettings' | 'connectFirebase' | 'syncFirebase' | 'disconnectFirebase'
  | 'exportTableXlsx' | 'printHtmlToPdf'
  | 'exportBackup' | 'chooseBackupFile' | 'importBackup' | 'backupStatus' | 'resetOperationalData';
export type BusinessApiName = Exclude<ApiName, HostApiName>;

export interface BusinessHandlers {
  auth: ReturnType<typeof createAuthHandlers>;
  config: ReturnType<typeof createConfigHandlers>;
  audit: ReturnType<typeof createAuditHandlers>;
  entry: ReturnType<typeof createEntryHandlers>;
  westgard: ReturnType<typeof createWestgardHandlers>;
  sigma: ReturnType<typeof createSigmaHandlers>;
  nce: ReturnType<typeof createNceHandlers>;
  reagent: ReturnType<typeof createReagentHandlers>;
  settings: ReturnType<typeof createSettingsHandlers>;
  report: ReturnType<typeof createReportHandlers>;
  lis: ReturnType<typeof createLisHandlers>;
}

/** Lỗi gọi thao tác cần đăng nhập khi chưa có phiên. Có mã riêng để bọc
 * thành `IpcResult` với `code: 'unauthenticated'`. */
export class NotSignedInError extends Error {
  readonly code = 'unauthenticated';
  constructor() { super('Chưa đăng nhập.'); }
}

/** Ngữ cảnh đọc danh tính từ một phiên đang giữ trong bộ nhớ (máy chính,
 * bản xem trước). Đọc lại mỗi lần gọi `actor()`, không chụp lúc tạo. */
export function sessionContext(current: () => Actor | null): CallContext {
  return {
    actor() {
      const actor = current();
      if (!actor) throw new NotSignedInError();
      return actor;
    },
  };
}

// ── Bọc lỗi một chỗ ──────────────────────────────────────────────────────
// Thao tác trả `IpcResult`: exception (chưa đăng nhập, lỗi SQLite, lỗi lập
// trình) thành `{ ok: false, error }`, để form hiện lỗi thay vì một promise
// bị từ chối mà renderer không bắt. Thao tác đọc trả thẳng dữ liệu (mảng,
// object) thì GIỮ việc ném lỗi: trả một object lỗi vào chỗ renderer chờ mảng
// sẽ làm vỡ `.map` ở nơi khác, khó lần hơn.

type DataApiName = { [K in ApiName]: Result<K> extends { ok: boolean } ? never : K }[ApiName];
const DATA_API_NAMES = [
  'hasAnyUsers', 'currentUser', 'listInstruments', 'listTests', 'listTestLevels', 'listPlannedTargets',
  'listActivity', 'listRuleScopes', 'listLots', 'listLotGroups', 'listPanels', 'listLotTransitions',
  'listTeaRefs', 'queryPoints', 'listEntryHistoryPoints', 'listVoidedEntryPoints', 'listParallelEntryColumns',
  'listPreviousEntryLotSeries', 'listTestSummaries', 'analyzeLevel', 'listRuleSettings', 'listArchivedBlocks',
  'listArchivedGroupTests', 'listPreviousLotBlocks', 'listSigmaPeriods', 'listSigmaCohorts', 'listNceRecords',
  'listReagentComparisons', 'getLabProfile', 'getLoginBrand', 'getStorageInfo', 'getReportTemplateSettings',
  'getFirebaseSettings', 'listPeriodLocks', 'queryReport', 'backupStatus', 'getLisSettings',
] as const satisfies readonly DataApiName[];
// Trình biên dịch báo tên còn thiếu nếu `QcApi` có thêm hàm trả thẳng dữ liệu
// mà danh sách trên chưa ghi.
type MissingDataApi = Exclude<DataApiName, (typeof DATA_API_NAMES)[number]>;
const dataApiListIsComplete: [MissingDataApi] extends [never] ? true : MissingDataApi = true;
void dataApiListIsComplete;
const DATA_APIS: ReadonlySet<string> = new Set(DATA_API_NAMES);

/** Chuyển exception thành `IpcResult` lỗi. Lỗi ngoài dự kiến ghi ra console
 * của main để lần được, vì renderer chỉ thấy câu thông báo. */
export function errorResult(error: unknown): { ok: false; error: { code: string; message: string } } {
  if (error instanceof NotSignedInError) return { ok: false, error: { code: error.code, message: error.message } };
  console.error(error);
  const message = error instanceof Error && error.message ? error.message : 'Đã xảy ra lỗi không xác định.';
  return { ok: false, error: { code: 'internal-error', message } };
}

async function invokeOperation(name: string, operation: AnyOperation, ctx: CallContext, args: unknown[]): Promise<unknown> {
  if (DATA_APIS.has(name)) return operation.run(ctx, ...args);
  try {
    return await operation.run(ctx, ...args);
  } catch (error) {
    return errorResult(error);
  }
}

/** Các thao tác nghiệp vụ chỉ gọi handler của `main/ipc`, giống nhau ở mọi
 * môi trường chạy. */
export function createBusinessOperations(h: BusinessHandlers): OperationTable<BusinessApiName> {
  const { auth, config, audit, entry, westgard, sigma, nce, reagent, settings, report, lis } = h;
  return {
    hasAnyUsers: { channel: 'auth:hasAnyUsers', lan: true, run: () => auth.hasAnyUsers() },
    listUsers: { channel: 'auth:listUsers', lan: false, run: (ctx) => auth.listUsers(ctx.actor()) },
    createUser: { channel: 'auth:createUser', lan: false, run: (ctx, input) => auth.createUser(input, ctx.actor()) },
    updateUser: { channel: 'auth:updateUser', lan: false, run: (ctx, input) => auth.updateUser(input, ctx.actor()) },
    deleteUser: { channel: 'auth:deleteUser', lan: false, run: (ctx, input) => auth.deleteUser(input, ctx.actor()) },
    resetUserPassword: { channel: 'auth:resetPassword', lan: false, run: (ctx, input) => auth.resetPassword(input, ctx.actor()) },
    changeOwnPassword: { channel: 'auth:changeOwnPassword', lan: true, run: (ctx, input) => auth.changeOwnPassword(input, ctx.actor()) },
    verifyOwnPassword: { channel: 'auth:verifyPassword', lan: true, run: (ctx, input) => auth.verifyOwnPassword(input, ctx.actor()) },
    setAvatar: { channel: 'auth:setAvatar', lan: true, run: (ctx, input) => auth.setAvatar(input, ctx.actor()) },
    clearAvatar: { channel: 'auth:clearAvatar', lan: true, run: (ctx) => auth.clearAvatar(ctx.actor()) },

    listInstruments: { channel: 'config:listInstruments', lan: true, run: () => config.listInstruments() },
    saveInstrument: { channel: 'config:saveInstrument', lan: false, run: (ctx, input) => config.saveInstrument(input, ctx.actor()) },
    removeInstrument: { channel: 'config:removeInstrument', lan: false, run: (ctx, input) => config.removeInstrument(input, ctx.actor()) },
    listTests: { channel: 'config:listTests', lan: true, run: () => config.listTests() },
    saveTest: { channel: 'config:saveTest', lan: false, run: (ctx, input) => config.saveTest(input, ctx.actor()) },
    listTestLevels: { channel: 'config:listTestLevels', lan: true, run: (_ctx, testId) => config.listTestLevels(testId) },
    saveTestLevel: { channel: 'config:saveTestLevel', lan: false, run: (ctx, input) => config.saveTestLevel(input, ctx.actor()) },
    listPlannedTargets: { channel: 'config:listPlannedTargets', lan: true, run: () => config.listPlannedTargets() },
    savePlannedTargets: { channel: 'config:savePlannedTargets', lan: false, run: (ctx, input) => config.savePlannedTargets(input, ctx.actor()) },
    // Không còn màn hình nào gọi, và đọc nhật ký mà không kiểm quyền admin:
    // không mở qua LAN. Xoá hẳn ở giai đoạn C.
    listActivity: { channel: 'config:listActivity', lan: false, run: (_ctx, limit) => config.listActivity(limit) },
    listRuleScopes: { channel: 'config:listRuleScopes', lan: true, run: (_ctx, testId) => config.listRuleScopes(testId) },
    saveRuleScope: { channel: 'config:saveRuleScope', lan: false, run: (ctx, testId, ruleId, scope) => config.saveRuleScope(testId, ruleId, scope, ctx.actor()) },
    listLots: { channel: 'config:listLots', lan: true, run: () => config.listLots() },
    saveLot: { channel: 'config:saveLot', lan: false, run: (ctx, input) => config.saveLot(input, ctx.actor()) },
    setTeaRefValue: { channel: 'config:setTeaRefValue', lan: false, run: (ctx, input) => config.setTeaRefValue(input, ctx.actor()) },
    restoreTeaRefDefaults: { channel: 'config:restoreTeaRefDefaults', lan: false, run: (ctx, input) => config.restoreTeaRefDefaults(input, ctx.actor()) },
    addTeaAnalyte: { channel: 'config:addTeaAnalyte', lan: false, run: (ctx, input) => config.addTeaAnalyte(input, ctx.actor()) },
    removeTest: { channel: 'config:removeTest', lan: false, run: (ctx, input) => config.removeTest(input, ctx.actor()) },
    removePanel: { channel: 'config:removePanel', lan: false, run: (ctx, input) => config.removePanel(input, ctx.actor()) },
    removeLot: { channel: 'config:removeLot', lan: false, run: (ctx, input) => config.removeLot(input, ctx.actor()) },
    listLotGroups: { channel: 'config:listLotGroups', lan: true, run: () => config.listLotGroups() },
    removeLotGroup: { channel: 'config:removeLotGroup', lan: false, run: (ctx, input) => config.removeLotGroup(input, ctx.actor()) },
    stopLotGroup: { channel: 'config:stopLotGroup', lan: false, run: (ctx, input) => config.stopLotGroup(input, ctx.actor()) },
    activateLotGroup: { channel: 'config:activateLotGroup', lan: false, run: (ctx, input) => config.activateLotGroup(input, ctx.actor()) },
    previewLotRename: { channel: 'config:previewLotRename', lan: true, run: (_ctx, input) => config.previewLotRename(input) },
    removeLotTransition: { channel: 'config:removeLotTransition', lan: false, run: (ctx, input) => config.removeLotTransition(input, ctx.actor()) },
    saveLotGroup: { channel: 'config:saveLotGroup', lan: false, run: (ctx, input) => config.saveLotGroup(input, ctx.actor()) },
    listPanels: { channel: 'config:listPanels', lan: true, run: () => config.listPanels() },
    savePanel: { channel: 'config:savePanel', lan: false, run: (ctx, input) => config.savePanel(input, ctx.actor()) },
    listLotTransitions: { channel: 'config:listLotTransitions', lan: true, run: () => config.listLotTransitions() },
    createLotTransition: { channel: 'config:createLotTransition', lan: false, run: (ctx, input) => config.createLotTransition(input, ctx.actor()) },
    listTeaRefs: { channel: 'config:listTeaRefs', lan: true, run: () => config.listTeaRefs() },
    saveTeaRef: { channel: 'config:saveTeaRef', lan: false, run: (ctx, input) => config.saveTeaRef(input, ctx.actor()) },
    removeTeaRef: { channel: 'config:removeTeaRef', lan: false, run: (ctx, input) => config.removeTeaRef(input, ctx.actor()) },
    removeTeaLabProfile: { channel: 'config:removeTeaLabProfile', lan: false, run: (ctx, input) => config.removeTeaLabProfile(input, ctx.actor()) },

    queryActivity: { channel: 'audit:query', lan: false, run: (ctx, input) => audit.query(input, ctx.actor()) },
    previewArchiveActivity: { channel: 'audit:previewArchive', lan: false, run: (ctx, input) => audit.previewArchive(input, ctx.actor()) },
    exportActivityCsv: { channel: 'audit:exportCsv', lan: false, run: (ctx, input) => audit.exportCsv(input, ctx.actor()) },
    verifyActivityChainNow: { channel: 'audit:verifyChainNow', lan: false, run: (ctx) => audit.verifyChainNow(ctx.actor()) },
    archiveActivity: { channel: 'audit:archive', lan: false, run: (ctx, input) => audit.archive(input, ctx.actor()) },

    queryPoints: { channel: 'entry:queryPoints', lan: true, run: (_ctx, testId, level) => entry.queryPoints(testId, level) },
    listEntryHistoryPoints: { channel: 'entry:listHistoryPoints', lan: true, run: (_ctx, testId) => entry.listHistoryPoints(testId) },
    listVoidedEntryPoints: { channel: 'entry:listVoidedPoints', lan: true, run: (_ctx, testId) => entry.listVoidedPoints(testId) },
    listParallelEntryColumns: { channel: 'entry:listParallelColumns', lan: true, run: (_ctx, testId) => entry.listParallelColumns(testId) },
    listPreviousEntryLotSeries: { channel: 'entry:listPreviousLotSeries', lan: true, run: (_ctx, testId) => entry.listPreviousLotSeries(testId) },
    getRangeCandidate: { channel: 'entry:rangeCandidate', lan: true, run: (_ctx, testId, level) => entry.rangeCandidate(testId, level) },
    applyLabRange: { channel: 'entry:applyLabRange', lan: true, run: (ctx, input) => entry.applyLabRange(input, ctx.actor()) },
    revertManufacturerRange: { channel: 'entry:revertManufacturerRange', lan: true, run: (ctx, input) => entry.revertManufacturerRange(input, ctx.actor()) },
    addPoint: { channel: 'entry:addPoint', lan: true, run: (ctx, input) => entry.addPoint(input, ctx.actor()) },
    voidPoint: { channel: 'entry:voidPoint', lan: true, run: (ctx, input) => entry.voidPoint(input, ctx.actor()) },
    setDayNote: { channel: 'entry:setDayNote', lan: true, run: (ctx, input) => entry.setDayNote(input, ctx.actor()) },

    listTestSummaries: { channel: 'westgard:listTestSummaries', lan: true, run: () => westgard.listTestSummaries() },
    analyzeLevel: { channel: 'westgard:analyzeLevel', lan: true, run: (_ctx, testId, level) => westgard.analyzeLevel(testId, level) },
    // Ba dòng cấu hình luật dưới đây chỉ cần quyền ghi nhưng vẫn là việc quản
    // trị, nên không mở qua LAN.
    saveRuleAction: { channel: 'westgard:saveRuleAction', lan: false, run: (ctx, testId, ruleId, action) => westgard.saveRuleAction(testId, ruleId, action, ctx.actor()) },
    listRuleSettings: { channel: 'westgard:listRuleSettings', lan: true, run: () => westgard.listRuleSettings() },
    saveRuleSetting: { channel: 'westgard:saveRuleSetting', lan: false, run: (ctx, ruleId, on) => westgard.saveRuleSetting(ruleId, on, ctx.actor()) },
    resetRuleSettings: { channel: 'westgard:resetRuleSettings', lan: false, run: (ctx) => westgard.resetRuleSettings(ctx.actor()) },
    listArchivedBlocks: { channel: 'westgard:listArchivedBlocks', lan: true, run: (_ctx, testId, groupId) => westgard.listArchivedBlocks(testId, groupId) },
    listArchivedGroupTests: { channel: 'westgard:listArchivedGroupTests', lan: true, run: (_ctx, groupId) => westgard.listArchivedGroupTests(groupId) },
    listPreviousLotBlocks: { channel: 'westgard:listPreviousLotBlocks', lan: true, run: (_ctx, testId) => westgard.listPreviousLotBlocks(testId) },

    listSigmaPeriods: { channel: 'sigma:listPeriods', lan: true, run: (_ctx, testId) => sigma.listPeriods(testId) },
    listSigmaCohorts: { channel: 'sigma:listCohorts', lan: true, run: (_ctx, testId, period, levels) => sigma.listCohorts(testId, period, levels) },
    saveSigmaTeaConfig: { channel: 'sigma:saveTeaConfig', lan: true, run: (ctx, input) => sigma.saveTeaConfig(input, ctx.actor()) },
    saveSigmaPeriod: { channel: 'sigma:savePeriod', lan: true, run: (ctx, input) => sigma.savePeriod(input, ctx.actor()) },
    renameSigmaPeriod: { channel: 'sigma:renamePeriod', lan: true, run: (ctx, input) => sigma.renamePeriod(input, ctx.actor()) },
    removeSigmaPeriod: { channel: 'sigma:removePeriod', lan: false, run: (ctx, input) => sigma.removePeriod(input, ctx.actor()) },

    listNceRecords: { channel: 'nce:listRecords', lan: true, run: () => nce.listRecords() },
    createNce: { channel: 'nce:create', lan: true, run: (ctx, input) => nce.create(input, ctx.actor()) },
    saveNceProtocol: { channel: 'nce:saveProtocol', lan: true, run: (ctx, input) => nce.saveProtocol(input, ctx.actor()) },
    approveNce: { channel: 'nce:approve', lan: true, run: (ctx, input) => nce.approve(input, ctx.actor()) },
    returnNce: { channel: 'nce:returnForRevision', lan: true, run: (ctx, input) => nce.returnForRevision(input, ctx.actor()) },
    cancelNce: { channel: 'nce:cancel', lan: true, run: (ctx, input) => nce.cancel(input, ctx.actor()) },
    setNceCompletedDate: { channel: 'nce:setActionCompletedDate', lan: true, run: (ctx, input) => nce.setActionCompletedDate(input, ctx.actor()) },
    markNceEffectiveness: { channel: 'nce:markEffectiveness', lan: true, run: (ctx, input) => nce.markEffectiveness(input, ctx.actor()) },
    setNceReleaseDecision: { channel: 'nce:setReleaseDecision', lan: true, run: (ctx, input) => nce.setReleaseDecision(input, ctx.actor()) },
    setNceRerunEvidence: { channel: 'nce:setRerunEvidence', lan: true, run: (ctx, input) => nce.setRerunEvidence(input, ctx.actor()) },
    reopenNce: { channel: 'nce:reopen', lan: true, run: (ctx, input) => nce.reopenNce(input, ctx.actor()) },

    listReagentComparisons: { channel: 'reagent:listComparisons', lan: true, run: () => reagent.listComparisons() },
    createReagentComparison: { channel: 'reagent:createComparison', lan: true, run: (ctx, input) => reagent.createComparison(input, ctx.actor()) },
    saveReagentMetadata: { channel: 'reagent:saveMetadata', lan: true, run: (ctx, input) => reagent.saveMetadata(input, ctx.actor()) },
    saveReagentRows: { channel: 'reagent:saveRows', lan: true, run: (ctx, input) => reagent.saveRows(input, ctx.actor()) },
    removeReagentComparison: { channel: 'reagent:removeComparison', lan: false, run: (ctx, input) => reagent.removeComparison(input, ctx.actor()) },
    listReagentQuickValues: { channel: 'reagent:listQuickValues', lan: true, run: (_ctx, input) => reagent.listQuickValues(input) },
    addReagentQuickValue: { channel: 'reagent:addQuickValue', lan: true, run: (ctx, input) => reagent.addQuickListValue(input, ctx.actor()) },
    removeReagentQuickValue: { channel: 'reagent:removeQuickValue', lan: true, run: (ctx, input) => reagent.removeQuickListValue(input, ctx.actor()) },

    getLabProfile: { channel: 'settings:getLabProfile', lan: true, run: () => settings.getLabProfile() },
    getLoginBrand: { channel: 'settings:getLoginBrand', lan: true, run: () => settings.getLoginBrand() },
    saveLabProfile: { channel: 'settings:saveLabProfile', lan: false, run: (ctx, input) => settings.saveLabProfile(input, ctx.actor()) },
    getStorageInfo: { channel: 'settings:getStorageInfo', lan: true, run: () => settings.getStorageInfo() },

    listPeriodLocks: { channel: 'report:listPeriodLocks', lan: true, run: () => report.listPeriodLocks() },
    getReportTemplateSettings: { channel: 'report:getTemplateSettings', lan: true, run: () => report.getReportTemplateSettings() },
    saveReportTemplateSettings: { channel: 'report:saveTemplateSettings', lan: false, run: (ctx, input) => report.saveReportTemplateSettings(input, ctx.actor()) },
    lockPeriod: { channel: 'report:lockPeriod', lan: false, run: (ctx, input) => report.lockPeriod(input, ctx.actor()) },
    unlockPeriod: { channel: 'report:unlockPeriod', lan: false, run: (ctx, input) => report.unlockPeriod(input, ctx.actor()) },
    queryReport: { channel: 'report:queryReport', lan: true, run: (_ctx, input) => report.queryReport(input) },

    getLisSettings: { channel: 'lis:getSettings', lan: true, run: (ctx) => lis.getSettings(ctx.actor()) },
    saveLisSettings: { channel: 'lis:saveSettings', lan: false, run: (ctx, input) => lis.saveSettings(input, ctx.actor()) },
    pullLisQueue: { channel: 'lis:pullQueue', lan: true, run: () => lis.pullQueue() },
    importLisResult: { channel: 'lis:importResult', lan: true, run: (ctx, input) => lis.importResult(input, ctx.actor()) },
    rejectLisResult: { channel: 'lis:rejectResult', lan: true, run: (ctx, input) => lis.rejectResult(input, ctx.actor()) },
  };
}

type AnyOperation = { channel: string; lan: boolean; run(ctx: CallContext, ...args: unknown[]): unknown };
function entriesOf(tables: object[]): [string, AnyOperation][] {
  return tables.flatMap((table) => Object.entries(table) as [string, AnyOperation][]);
}

/** Đăng ký mọi dòng của các bảng lên `ipcMain` (hoặc bản giả trong test).
 * Kênh trùng giữa hai dòng là lỗi lập trình: ném ngay lúc khởi động. */
export function registerIpcOperations(
  ipc: { handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void },
  tables: object[],
  ctx: CallContext,
): void {
  const seen = new Set<string>();
  for (const [name, operation] of entriesOf(tables)) {
    if (seen.has(operation.channel)) throw new Error(`Kênh IPC bị khai hai lần: ${operation.channel} (${name}).`);
    seen.add(operation.channel);
    ipc.handle(operation.channel, (_event, ...args) => invokeOperation(name, operation, ctx, args));
  }
}

export const LAN_UNKNOWN_OPERATION = {
  ok: false as const,
  error: { code: 'unknown-operation', message: 'Thao tác không được mở qua mạng nội bộ.' },
};

/** Bộ điều phối RPC của máy trạm LAN: tra ĐÚNG tên hàm `QcApi` trong danh
 * sách `lan: true`, chạy với actor của phiên HTTP. Không xếp hàng: mỗi lời
 * gọi mang danh tính riêng nên chạy song song như IPC của máy chính. */
export function createLanInvoker(tables: object[]): (method: string, args: unknown[], actor: Actor) => Promise<unknown> {
  // `Map` thay vì tra thuộc tính object: tên như `constructor`, `__proto__`
  // không được khớp vào prototype.
  const allowed = new Map(entriesOf(tables).filter(([, operation]) => operation.lan));
  return async (method, args, actor) => {
    const operation = allowed.get(method);
    if (!operation) return LAN_UNKNOWN_OPERATION;
    return invokeOperation(method, operation, { actor: () => actor }, args);
  };
}

/** Biến bảng thành các hàm `QcApi` gắn sẵn một ngữ cảnh — dùng cho bản xem
 * trước, nơi renderer gọi thẳng hàm thay vì qua IPC. */
export type BoundOperations<N extends ApiName> = { [K in N]: (...args: Args<K>) => Promise<Result<K>> };
export function bindOperations<N extends ApiName>(table: OperationTable<N>, ctx: CallContext): BoundOperations<N> {
  return Object.fromEntries(entriesOf([table]).map(([name, operation]) =>
    [name, (...args: unknown[]) => invokeOperation(name, operation, ctx, args)])) as unknown as BoundOperations<N>;
}

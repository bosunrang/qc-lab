// C7 (docs/APP-V2-PLAN.md) — ĐỐI CHIẾU bản giả lập trình duyệt
// (`renderer/browser-mock/*`) với handler THẬT (`main/ipc/*` + SQLite).
//
// Vì sao cần: bản giả lập được gõ `: QcApi` nên TypeScript chặn được lệch
// TÊN/CHỮ KÝ, nhưng KHÔNG chặn được lệch HÀNH VI. Mà chính bản giả lập là
// thứ `npm run app-v2:ui-parity` đo (gate chạy `app-v2:dev` qua localhost),
// nên một lệch hành vi sẽ khiến gate xác nhận một giao diện mà bản Electron
// THẬT hiển thị khác. Đây là bài test duy nhất canh chỗ đó.
//
// Cách làm: chạy CÙNG một kịch bản qua 2 đường rồi so kết quả đã chuẩn hoá.
// - Chuẩn hoá bỏ các trường biến động (thời điểm, hash, seq) và thay MỌI
//   giá trị của trường dạng id bằng token theo thứ tự xuất hiện (`#1`,
//   `#2`...), nên vẫn giữ được quan hệ giữa các bản ghi mà không phụ thuộc
//   id ngẫu nhiên.
// - Phía thật dùng façade `makeRealApi()` bên dưới, sao lại đúng cách
//   `main/index.ts` nối kênh IPC (actor lấy từ phiên đăng nhập giữ trong bộ
//   nhớ). Không import thẳng `main/index.ts` được vì file đó import
//   `electron`.
// - Phía giả lập dùng `withPermissionPolicy(createBrowserMockApi())` — ĐÚNG
//   thứ `install.ts` gắn vào `window.qcApi`, không phải api trần.
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// `browser-mock/store.ts` gọi `localStorage.getItem` NGAY khi nạp module,
// nên stub phải có TRƯỚC require. Dùng require (CommonJS) chính vì thứ tự
// này điều khiển được, khác import ESM tĩnh.
class MemStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemStorage();

const { createBrowserMockApi } = require('../../app-v2-dist/mock/renderer/browser-mock/api.js');
const { withPermissionPolicy } = require('../../app-v2-dist/mock/renderer/browser-mock/permission-policy.js');

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-v2-dist/main/ipc/westgard-handlers.js');
const { createReportHandlers } = require('../../app-v2-dist/main/ipc/report-handlers.js');
const { createAuthHandlers } = require('../../app-v2-dist/main/ipc/auth-handlers.js');
const { createAuditHandlers } = require('../../app-v2-dist/main/ipc/audit-handlers.js');
const { writeAudit } = require('../../app-v2-dist/main/ipc/shared.js');
const { createSigmaHandlers } = require('../../app-v2-dist/main/ipc/sigma-handlers.js');
const { createNceHandlers } = require('../../app-v2-dist/main/ipc/nce-handlers.js');
const { createReagentHandlers } = require('../../app-v2-dist/main/ipc/reagent-handlers.js');
const { createSettingsHandlers } = require('../../app-v2-dist/main/ipc/settings-handlers.js');
const { createLisHandlers } = require('../../app-v2-dist/main/ipc/lis-handlers.js');
const { createBackupHandlers } = require('../../app-v2-dist/main/ipc/backup-handlers.js');
const { createMigrationHandlers } = require('../../app-v2-dist/main/ipc/migration-handlers.js');
const { buildXlsxBase64 } = require('../../app-v2-dist/main/ipc/export-handlers.js');

// ---------------------------------------------------------------------------
// Façade phía THẬT — sao lại đúng cách main/index.ts nối kênh IPC.
// ---------------------------------------------------------------------------
function makeRealApi() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgard = createWestgardHandlers(db);
  const report = createReportHandlers(db);
  const auth = createAuthHandlers(db);
  const audit = createAuditHandlers(db);
  const sigma = createSigmaHandlers(db);
  const nce = createNceHandlers(db);
  const reagent = createReagentHandlers(db);
  const settings = createSettingsHandlers(db, ':memory:');
  const lis = createLisHandlers(db);
  const backup = createBackupHandlers(db, tmpdir());
  const migration = createMigrationHandlers(db, tmpdir());

  let sessionActor = null;
  const toActor = (user) => ({ userId: user.id, username: user.username, name: user.name, role: user.role, clientId: 'app-v2-desktop' });
  const actor = () => { if (!sessionActor) throw new Error('Chưa đăng nhập.'); return sessionActor; };

  return {
    async bootstrapAdmin(input) { const r = auth.bootstrapAdmin(input); if (r.ok) sessionActor = toActor(r.data); return r; },
    async login(input) { const r = auth.login(input); if (r.ok) sessionActor = toActor(r.data); return r; },
    async createUser(input) { return auth.createUser(input, actor()); },
    async saveInstrument(input) { return config.saveInstrument(input, actor()); },
    async saveTest(input) { return config.saveTest(input, actor()); },
    async saveTestLevel(input) { return config.saveTestLevel(input, actor()); },
    async listTestLevels(testId) { return config.listTestLevels(testId); },
    async saveLot(input) { return config.saveLot(input, actor()); },
    async removeLot(input) { return config.removeLot(input, actor()); },
    async listLots() { return config.listLots(); },
    async addPoint(input) { return entry.addPoint(input, actor()); },
    async voidPoint(input) { return entry.voidPoint(input, actor()); },
    async setDayNote(input) { return entry.setDayNote(input, actor()); },
    async queryPoints(testId, level) { return entry.queryPoints(testId, level); },
    async listTestSummaries() { return westgard.listTestSummaries(); },
    async analyzeLevel(testId, level) { return westgard.analyzeLevel(testId, level); },
    async saveRuleAction(testId, ruleId, on) { return westgard.saveRuleAction(testId, ruleId, on, actor()); },
    async lockPeriod(input) { return report.lockPeriod(input, actor()); },
    async listPeriodLocks() { return report.listPeriodLocks(); },
    async queryActivity(input) { return audit.query(input); },

    // --- Six Sigma ---
    async listSigmaPeriods(testId) { return sigma.listPeriods(testId); },
    async saveSigmaPeriod(input) { return sigma.savePeriod(input, actor()); },
    async removeSigmaPeriod(input) { return sigma.removePeriod(input, actor()); },

    // --- Khắc phục sự cố (NCE) ---
    async listNceRecords() { return nce.listRecords(); },
    async createNce(input) { return nce.create(input, actor()); },
    async approveNce(input) { return nce.approve(input, actor()); },
    async cancelNce(input) { return nce.cancel(input, actor()); },
    async setNceCompletedDate(input) { return nce.setActionCompletedDate(input, actor()); },
    async markNceEffectiveness(input) { return nce.markEffectiveness(input, actor()); },
    async setNceReleaseDecision(input) { return nce.setReleaseDecision(input, actor()); },
    async setNceRerunEvidence(input) { return nce.setRerunEvidence(input, actor()); },
    async reopenNce(input) { return nce.reopenNce(input, actor()); },

    // --- So sánh hoá chất ---
    async listReagentComparisons() { return reagent.listComparisons(); },
    async createReagentComparison(input) { return reagent.createComparison(input, actor()); },
    async saveReagentMetadata(input) { return reagent.saveMetadata(input, actor()); },
    async saveReagentRows(input) { return reagent.saveRows(input, actor()); },
    async removeReagentComparison(input) { return reagent.removeComparison(input, actor()); },
    async listReagentQuickValues(input) { return reagent.listQuickValues(input); },
    async addReagentQuickValue(input) { return reagent.addQuickListValue(input, actor()); },
    async removeReagentQuickValue(input) { return reagent.removeQuickListValue(input, actor()); },

    // --- Cài đặt ---
    async getLabProfile() { return settings.getLabProfile(); },
    async saveLabProfile(input) { return settings.saveLabProfile(input, actor()); },

    // --- LIS Gateway: chỉ phần CẤU HÌNH so được (pull/import cần server thật) ---
    async getLisSettings() { return lis.getSettings(); },
    async saveLisSettings(input) { return lis.saveSettings(input, actor()); },

    // --- Danh sách đọc + phần ghi còn lại của Cấu hình chung ---
    async listInstruments() { return config.listInstruments(); },
    async removeInstrument(input) { return config.removeInstrument(input, actor()); },
    async listTests() { return config.listTests(); },
    async listPanels() { return config.listPanels(); },
    async savePanel(input) { return config.savePanel(input, actor()); },
    async listLotGroups() { return config.listLotGroups(); },
    async saveLotGroup(input) { return config.saveLotGroup(input, actor()); },
    async removeLotGroup(input) { return config.removeLotGroup(input, actor()); },
    async stopLotGroup(input) { return config.stopLotGroup(input, actor()); },
    async listLotTransitions() { return config.listLotTransitions(); },
    async createLotTransition(input) { return config.createLotTransition(input, actor()); },
    async removeLotTransition(input) { return config.removeLotTransition(input, actor()); },
    async listTeaRefs() { return config.listTeaRefs(); },
    async saveTeaRef(input) { return config.saveTeaRef(input, actor()); },
    async removeTeaRef(input) { return config.removeTeaRef(input, actor()); },
    async removeTeaLabProfile(input) { return config.removeTeaLabProfile(input, actor()); },
    async addTeaAnalyte(input) { return config.addTeaAnalyte(input, actor()); },
    async previewLotRename(input) { return config.previewLotRename(input); },
    async activateLotGroup(input) { return config.activateLotGroup(input, actor()); },
    async listRuleScopes(testId, levelCount) { return config.listRuleScopes(testId, levelCount); },
    async saveRuleScope(testId, ruleId, scope) { return config.saveRuleScope(testId, ruleId, scope, actor()); },
    async listActivity(limit) { return config.listActivity(limit); },
    async archiveActivity(input) { return audit.archive(input, actor()); },

    // --- Người dùng / phiên đăng nhập ---
    async hasAnyUsers() { return auth.hasAnyUsers(); },
    async currentUser() { return sessionActor ? auth.getUser(sessionActor.userId) : null; },
    async listUsers() { return auth.listUsers(actor()); },
    async updateUser(input) { return auth.updateUser(input, actor()); },
    async resetUserPassword(input) { return auth.resetPassword(input, actor()); },
    async changeOwnPassword(input) { return auth.changeOwnPassword(input, actor()); },
    async verifyOwnPassword(input) { return auth.verifyOwnPassword(input, actor()); },
    async setAvatar(input) { return auth.setAvatar(input, actor()); },
    async clearAvatar() { return auth.clearAvatar(actor()); },
    async deleteUser(input) { return auth.deleteUser(input, actor()); },
    async logout() {
      if (sessionActor) writeAudit(db, sessionActor, 'Đăng xuất', 'Đăng xuất khỏi ứng dụng', sessionActor.username);
      sessionActor = null;
      return { ok: true, data: null };
    },

    // --- Báo cáo / NCE còn lại ---
    async unlockPeriod(input) { return report.unlockPeriod(input, actor()); },
    async queryReport(input) { return report.queryReport(input); },
    async returnNce(input) { return nce.returnForRevision(input, actor()); },

    // --- Nhóm phụ thuộc môi trường, dùng cho khối "cố ý khác" ở cuối file ---
    async exportBackup() { return backup.exportBackup(actor()); },
    async verifyBackup(input) { return backup.verifyBackup(input, actor()); },
    async resetOperationalData() { return backup.resetOperationalData(actor()); },
    async pullLisQueue() { return lis.pullQueue(); },
    async importLisResult(input) { return lis.importResult(input, actor()); },
    async rejectLisResult(input) { return lis.rejectResult(input, actor()); },
    async importBackup(input) { return backup.importBackup(input, actor()); },
    async backupStatus() { return backup.backupStatus(); },
    async previewLegacyBackup(input) { return migration.preview(input, actor()); },
    async importLegacyBackup(input) { return migration.importLegacy(input, actor()); },
    async exportTableXlsx(input) { return buildXlsxBase64(input.data); },
    async getStorageInfo() { return settings.getStorageInfo(); },
    async verifyActivityChainNow() { return audit.verifyChainNow(); },
    async exportActivityCsv(input) { return audit.exportCsv(input); },
  };
}

// ---------------------------------------------------------------------------
// Chuẩn hoá kết quả để so được giữa 2 nguồn dữ liệu khác nhau.
// ---------------------------------------------------------------------------
const VOLATILE = new Set([
  'created_at', 'updated_at', 'createdAt', 'updatedAt', 'hash', 'prev_hash', 'prevHash',
  'seq', 'ts', 'at', 'mustChangePassword',
]);
const ID_KEY = /(^id$)|(_id$)|(Id$)|(^ids$)|(Ids$)/;

function makeNormalizer() {
  const seen = new Map();
  let counter = 0;
  const token = (value) => {
    if (value === null || value === undefined || value === '') return value;
    if (!seen.has(value)) seen.set(value, '#' + (++counter));
    return seen.get(value);
  };
  return function norm(value, key) {
    if (Array.isArray(value)) return value.map((item) => norm(item, key));
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value).sort()) {
        if (VOLATILE.has(k)) continue;
        out[k] = norm(value[k], k);
      }
      return out;
    }
    if (typeof value === 'string' && key && ID_KEY.test(key)) return token(value);
    // Mốc thời gian có thể nằm LỒNG trong 1 chuỗi JSON (vd
    // `detail_json.releaseDecidedAt` của hồ sơ NCE) nên phải quét theo mẫu,
    // không thể bỏ theo tên khoá như VOLATILE.
    if (typeof value === 'string') {
      const noTime = value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<TS>');
      // Nhật ký hoạt động nhúng id THẬT vào chữ (`target`, và `detail` kiểu
      // "Xoá hồ sơ chuyển lô <id>") — các trường này không mang tên dạng id
      // nên nhánh trên không chạm tới. Chỉ thay khi chuỗi 7 ký tự đó ĐÃ từng
      // xuất hiện như một id ở bước trước (nằm trong `seen`), nên không có
      // nguy cơ biến một từ tiếng Việt thành token.
      return noTime.replace(/[a-z0-9]{7}/g, (m) => (seen.has(m) ? seen.get(m) : m));
    }
    return value;
  };
}

// ---------------------------------------------------------------------------
// Kịch bản: chạy y hệt trên cả 2 phía. Mỗi bước ghi lại 1 dòng đã chuẩn hoá.
// Chọn bước theo tiêu chí "thứ mà trang thật sự đọc" + "cổng chặn dễ lệch":
// validate cấu hình, read-model của Tổng quan/Cấu hình chung, verdict
// Westgard, cổng huỷ điểm, kỳ báo cáo đã khoá, cổng xoá lô, quyền theo vai
// trò.
// ---------------------------------------------------------------------------
async function scenario(api) {
  const norm = makeNormalizer();
  const log = [];
  const step = (name, value) => log.push([name, norm(value, null)]);

  step('bootstrap', await api.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị', password: 'MatKhau#123' } }));

  // --- validate cấu hình ---
  step('instrument-rong', await api.saveInstrument({ data: { name: '   ' } }));
  const machine = await api.saveInstrument({ data: { name: 'May A', section: 'Hoa sinh' } });
  step('instrument-ok', machine);
  step('test-thieu-may', await api.saveTest({ data: { name: 'Glucose' } }));
  const test = await api.saveTest({ data: { name: 'Glucose', instrumentId: machine.data.id, unit: 'mmol/L', decimalPlaces: 2, teaRefKey: 'qclab-glucose' } });
  step('test-ok', test);
  step('test-trung-analyte-cung-may', await api.saveTest({ data: { name: 'GLU', instrumentId: machine.data.id, teaRefKey: 'qclab-glucose' } }));
  const sameAnalyteMachine = await api.saveInstrument({ data: { name: 'May cung chay Glucose', section: 'Hoa sinh' } });
  step('test-cung-analyte-khac-may', await api.saveTest({ data: { name: 'Glucose', instrumentId: sameAnalyteMachine.data.id, teaRefKey: 'qclab-glucose' } }));

  // --- lô QC + Mean/SD ---
  const lot = await api.saveLot({ data: { lotNo: 'L001', level: 1, exp: '2027-01-31' } });
  step('lot-ok', lot);
  const spareLot = await api.saveLot({ data: { lotNo: 'L000-DU-PHONG', level: 1, exp: '2027-01-31' } });
  step('lot-du-phong-ok', spareLot);
  step('nhom-lo-ok', await api.saveLotGroup({ data: { name: 'Nhóm lô Glucose', lotIds: [lot.data.id, spareLot.data.id] } }));
  step('panel-ok', await api.savePanel({ data: { name: 'Panel hóa sinh', instrumentId: machine.data.id, testIds: [test.data.id] } }));
  step('lot-thieu-so-lo', await api.saveLot({ data: { lotNo: '', level: 1 } }));
  step('level-sd-am', await api.saveTestLevel({ testId: test.data.id, data: { level: 1, mean: 5, sd: -1 } }));
  step('level-ok', await api.saveTestLevel({ testId: test.data.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: lot.data.id } }));
  step('list-levels', await api.listTestLevels(test.data.id));

  // --- điểm QC + verdict Westgard ---
  step('point-sai-muc', await api.addPoint({ data: { testId: test.data.id, level: 9, date: '2026-03-05', val: 5 } }));
  step('point-dat', await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-03-05', val: 5.05, operatorName: 'ktv1' } }));
  const bad = await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-03-06', val: 6.2, operatorName: 'ktv1' } });
  step('point-vi-pham', bad);
  step('query-points', await api.queryPoints(test.data.id, 1));
  step('analyze', await api.analyzeLevel(test.data.id, 1));
  step('summaries', await api.listTestSummaries());

  // --- huỷ điểm: cổng lý do ---
  step('ghi-chu-ngay-chua-co-diem', await api.setDayNote({ data: { testId: test.data.id, date: '2026-07-01', note: 'Thu ghi chu' } }));
  step('ghi-chu-ngay-ok', await api.setDayNote({ data: { testId: test.data.id, date: '2026-03-05', note: 'Chay lai sau hieu chuan' } }));
  // `pointId` phải nằm TRONG `data` (đúng hợp đồng `VoidPointInput`) — 2 dòng
  // dưới trước đây đặt nhầm ở `id` top-level (không hàm nào đọc), khiến cả
  // 2 bước luôn ra `missing-point` bất kể lý do đúng/sai, không hề kiểm
  // đường THÀNH CÔNG thật của voidPoint qua đối chiếu mock/real.
  step('void-thieu-ly-do', await api.voidPoint({ data: { pointId: bad.data.id, kind: 'other', reason: '' } }));
  step('void-ok', await api.voidPoint({ data: { pointId: bad.data.id, kind: 'other', reason: 'Nhap sai gia tri, da kiem tra lai' } }));
  step('summaries-sau-huy', await api.listTestSummaries());

  // --- huỷ điểm: "kind" quyết định tự mở/không mở hồ sơ NCE (2026-09-04) ---
  const rejForNce = await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-03-07', val: 6.3, operatorName: 'ktv1' } });
  step('point-vi-pham-cho-nce', rejForNce);
  step('void-analytical-tu-mo-nce', await api.voidPoint({ data: { pointId: rejForNce.data.id, kind: 'analytical' } }));
  step('nce-sau-void-analytical', await api.listNceRecords());
  const rejForDataEntry = await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-03-08', val: 6.3 } });
  step('void-data-entry-khong-mo-nce', await api.voidPoint({ data: { pointId: rejForDataEntry.data.id, kind: 'data-entry' } }));

  // --- xoá lô: cổng chặn khi lô đang gắn Mean/SD ---
  step('xoa-lo-dang-dung', await api.removeLot({ id: lot.data.id }));

  // --- kỳ báo cáo đã khoá chặn nhập điểm (giao 2 module) ---
  step('lock-thieu-ky', await api.lockPeriod({ data: { period: '' } }));
  step('lock-ok', await api.lockPeriod({ data: { period: '2026-04', note: 'Chot so lieu thang 4' } }));
  step('locks', await api.listPeriodLocks());
  step('point-ky-da-khoa', await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-04-02', val: 5.0 } }));
  step('point-ky-khac-van-duoc', await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-05-02', val: 5.02 } }));

  // --- luật Westgard theo xét nghiệm ---
  step('rule-sai-ma', await api.saveRuleAction(test.data.id, 'khong-ton-tai', false));
  step('rule-ok', await api.saveRuleAction(test.data.id, '1-3s', false));

  // --- quyền theo vai trò: KTV rồi chỉ-xem ---
  step('tao-ktv', await api.createUser({ data: { username: 'ktv', name: 'Ky thuat vien', password: 'MatKhau#123', role: 'technician' } }));
  step('tao-viewer', await api.createUser({ data: { username: 'viewer', name: 'Nguoi xem', password: 'MatKhau#123', role: 'viewer' } }));

  step('dang-nhap-ktv', await api.login({ data: { username: 'ktv', password: 'MatKhau#123' } }));
  step('ktv-ghi-diem', await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-05-03', val: 5.01 } }));
  step('ktv-sua-cau-hinh', await api.saveInstrument({ data: { name: 'May B' } }));
  step('ktv-khoa-ky', await api.lockPeriod({ data: { period: '2026-06', note: 'Thu khoa ky' } }));

  step('dang-nhap-viewer', await api.login({ data: { username: 'viewer', password: 'MatKhau#123' } }));
  step('viewer-ghi-diem', await api.addPoint({ data: { testId: test.data.id, level: 1, date: '2026-05-04', val: 5.03 } }));
  step('viewer-sua-cau-hinh', await api.saveInstrument({ data: { name: 'May C' } }));
  step('viewer-doc-duoc', await api.listLots());

  // Quay lại admin cho phần còn lại.
  step('dang-nhap-lai-admin', await api.login({ data: { username: 'admin', password: 'MatKhau#123' } }));

  // --- Six Sigma ---
  step('sigma-ky-sai-dinh-dang', await api.saveSigmaPeriod({ testId: test.data.id, period: '2026', levels: [{ level: 1, cv: 3 }] }));
  step('sigma-thieu-muc', await api.saveSigmaPeriod({ testId: test.data.id, period: '2026-03', levels: [] }));
  step('sigma-tea-am', await api.saveSigmaPeriod({ testId: test.data.id, period: '2026-03', tea: -5, levels: [{ level: 1, cv: 3 }] }));
  step('sigma-ok', await api.saveSigmaPeriod({ testId: test.data.id, period: '2026-03', tea: 10, teaSource: 'CLIA', levels: [{ level: 1, cv: 3, biasEqa: 2 }] }));
  // Nhiều vòng EQA lệch dấu: RMS phải thắng giá trị biasEqa đơn lẻ (xem
  // eqaRoundsStats() — Giai đoạn B4) và phải bật cờ mixedSigns.
  step('sigma-nhieu-vong-eqa', await api.saveSigmaPeriod({ testId: test.data.id, period: '2026-04', tea: 10, levels: [{ level: 1, cv: 3, biasEqa: 9, eqaRounds: [-2, 2], uCal: 0.4 }] }));
  step('sigma-list', await api.listSigmaPeriods(test.data.id));
  step('sigma-xoa-ky-khong-ton-tai', await api.removeSigmaPeriod({ data: { id: 'khong-co-that' } }));
  step('sigma-xoa-ky', await api.removeSigmaPeriod({ data: { id: `${test.data.id}:2026-04` } }));
  step('sigma-list-sau-xoa', await api.listSigmaPeriods(test.data.id));

  // --- Khắc phục sự cố (NCE) ---
  step('nce-thieu-xu-ly', await api.createNce({ data: { testId: test.data.id, date: '2026-03-06', correction: 'ngan' } }));
  step('nce-han-truoc-ngay-su-co', await api.createNce({ data: { testId: test.data.id, date: '2026-03-06', correction: 'Da chay lai QC va hieu chuan lai may', dueDate: '2026-03-01' } }));
  const nce = await api.createNce({ data: {
    testId: test.data.id, level: 1, date: '2026-03-06', rule: '1-3s', errorType: 'SE',
    correction: 'Da chay lai QC va hieu chuan lai may', dueDate: '2026-03-20',
    investigation: 'Kiem tra hoa chat va calib', causeCategory: 'SE', causeDescription: 'Calib troi',
  } });
  step('nce-ok', nce);
  step('nce-hieu-luc-truoc-ngay-hoan-thanh', await api.markNceEffectiveness({ data: { id: nce.data.id, status: 'effective', residualRisk: 'Rui ro con lai thap' } }));
  step('nce-release-thieu-ly-do', await api.setNceReleaseDecision({ data: { id: nce.data.id, decision: 'held', note: '' } }));
  step('nce-release-ok', await api.setNceReleaseDecision({ data: { id: nce.data.id, decision: 'released', note: 'Da doi chieu lai ket qua benh nhan' } }));
  step('nce-rerun-khong-ton-tai', await api.setNceRerunEvidence({ data: { id: nce.data.id, rerunPointId: 'khong-co-that' } }));
  step('nce-ngay-hoan-thanh', await api.setNceCompletedDate({ data: { id: nce.data.id, actionCompletedDate: '2026-03-10' } }));
  step('nce-hieu-luc-thieu-rui-ro', await api.markNceEffectiveness({ data: { id: nce.data.id, status: 'effective' } }));
  step('nce-khong-hieu-qua', await api.markNceEffectiveness({ data: { id: nce.data.id, status: 'ineffective', note: 'Van con lech' } }));
  const followUp = await api.reopenNce({ data: { id: nce.data.id, note: 'Mo vong 2' } });
  step('nce-mo-vong-tiep', followUp);
  step('nce-mo-vong-tiep-lan-2', await api.reopenNce({ data: { id: nce.data.id, note: 'Mo lai nua' } }));
  step('nce-duyet', await api.approveNce({ data: { id: nce.data.id } }));
  step('nce-huy-sau-duyet', await api.cancelNce({ data: { id: nce.data.id, note: 'Thu huy sau khi da duyet' } }));
  step('nce-list', await api.listNceRecords());

  // --- So sánh hoá chất ---
  const comparison = await api.createReagentComparison({ data: { name: 'Glucose lot moi', unit: 'mmol/L' } });
  step('reagent-tao', comparison);
  step('reagent-metadata', await api.saveReagentMetadata({ id: comparison.data.id, data: { reagent: 'Glucose', lotOld: 'A1', lotNew: 'A2', date: '2026-03-10', operator: 'ktv1', biasTarget: 6, alpha: 0.05, coverageConfirmed: true } }));
  // 24 cặp lệch đúng 1% — chốt luôn phần hồi quy/Bland-Altman của
  // reagent-stats.ts chạy giống nhau ở 2 bên.
  const pairs = Array.from({ length: 24 }, (_, i) => [String(5 + i * 0.5), String((5 + i * 0.5) * 1.01)]);
  step('reagent-24-cap', await api.saveReagentRows({ id: comparison.data.id, rows: pairs }));
  step('reagent-list', await api.listReagentComparisons());

  // --- "Chọn nhanh" người thực hiện/loại mẫu (2026-09-04) ---
  step('quick-loai-mau-mac-dinh', await api.listReagentQuickValues({ type: 'sampleType' }));
  step('quick-nguoi-thuc-hien-rong', await api.listReagentQuickValues({ type: 'operator' }));
  step('quick-sai-loai', await api.listReagentQuickValues({ type: 'khong-hop-le' }));
  step('quick-them-nguoi', await api.addReagentQuickValue({ type: 'operator', value: 'Nguyễn Văn A' }));
  step('quick-them-trung', await api.addReagentQuickValue({ type: 'operator', value: 'nguyen van a' }));
  step('quick-them-rong', await api.addReagentQuickValue({ type: 'operator', value: '   ' }));
  step('quick-xoa', await api.removeReagentQuickValue({ type: 'operator', index: 0 }));
  step('quick-xoa-sai-vi-tri', await api.removeReagentQuickValue({ type: 'operator', index: 99 }));

  step('reagent-xoa-khi-con-1', await api.removeReagentComparison({ id: comparison.data.id }));

  // --- Cài đặt: hồ sơ phòng xét nghiệm ---
  step('lab-mac-dinh', await api.getLabProfile());
  step('lab-luu', await api.saveLabProfile({ data: { name: 'Khoa Xet nghiem', dept: 'Hoa sinh', address: '12 Nguyen Trai', brandTitle: '', brandSub: '' } }));
  step('lab-doc-lai', await api.getLabProfile());

  // --- LIS Gateway: phần cấu hình (pull/import cần server thật, xem khối
  //     "cố ý khác" ở cuối file) ---
  step('lis-mac-dinh', await api.getLisSettings());
  step('lis-url-ngoai-allowlist', await api.saveLisSettings({ data: { enabled: true, url: 'http://vi-du.com:8787', token: 'abc' } }));
  step('lis-luu-ok', await api.saveLisSettings({ data: { enabled: true, url: 'http://127.0.0.1:8787', token: 'abc' } }));
  step('lis-doc-lai', await api.getLisSettings());

  // --- Danh sách đọc: hình dạng hàng phải khớp, đây là thứ mọi bảng đọc ---
  step('list-instruments', await api.listInstruments());
  step('list-tests', await api.listTests());
  step('has-any-users', await api.hasAnyUsers());
  step('current-user', await api.currentUser());
  step('list-users', await api.listUsers());

  // --- Panel QC + nhóm lô + chuyển tiếp lô (phần ghi chưa được phủ) ---
  const lot2 = await api.saveLot({ data: { lotNo: 'L002', level: 1, exp: '2027-06-30' } });
  step('lot2-ok', lot2);
  step('panel-thieu-xet-nghiem', await api.savePanel({ data: { name: 'Panel A', instrumentId: machine.data.id, testIds: [] } }));
  const panel = await api.savePanel({ data: { name: 'Panel A', instrumentId: machine.data.id, testIds: [test.data.id] } });
  step('panel-ok', panel);
  step('panel-list', await api.listPanels());
  // Đổi máy xét nghiệm phải gỡ liên kết Panel sai máy ở cả handler SQLite
  // và bản giả lập; sau đó đổi về và chủ động gắn lại để tiếp tục kịch bản.
  const machineB = await api.saveInstrument({ data: { name: 'May B', section: 'Hoa sinh' } });
  step('test-doi-may', await api.saveTest({ id: test.data.id, data: { name: 'Glucose', instrumentId: machineB.data.id, unit: 'mmol/L', decimalPlaces: 2, teaRefKey: 'qclab-glucose' } }));
  step('panel-sau-doi-may', await api.listPanels());
  step('test-doi-lai-may', await api.saveTest({ id: test.data.id, data: { name: 'Glucose', instrumentId: machine.data.id, unit: 'mmol/L', decimalPlaces: 2, teaRefKey: 'qclab-glucose' } }));
  step('panel-gan-lai', await api.savePanel({ id: panel.data.id, data: { name: 'Panel A', instrumentId: machine.data.id, testIds: [test.data.id] } }));
  step('nhom-lo-chi-1-lo', await api.saveLotGroup({ data: { name: 'Nhom 1', lotIds: [lot.data.id] } }));
  const group = await api.saveLotGroup({ data: { name: '', lotIds: [lot.data.id, lot2.data.id] } });
  step('nhom-lo-ok', group);
  step('nhom-lo-list', await api.listLotGroups());
  step('chuyen-lo-cung-lo', await api.createLotTransition({ data: { panelId: panel.data.id, fromLotId: lot.data.id, toLotId: lot.data.id } }));
  const transition = await api.createLotTransition({ data: { panelId: panel.data.id, fromLotId: lot.data.id, toLotId: lot2.data.id, startDate: '2026-03-01', status: 'planned' } });
  step('chuyen-lo-ok', transition);
  // MỘT hàm lưu duy nhất (2026-09-03, khớp app cũ): status đi kèm cùng lần
  // gọi createLotTransition (`id` có sẵn = sửa), không phải setLotTransitionStatus riêng.
  step('chuyen-lo-kich-hoat', await api.createLotTransition({ id: transition.data.id, data: { panelId: panel.data.id, fromLotId: lot.data.id, toLotId: lot2.data.id, startDate: '2026-03-01', status: 'active' } }));
  step('chuyen-lo-trung', await api.createLotTransition({ data: { panelId: panel.data.id, fromLotId: lot.data.id, toLotId: lot2.data.id } }));
  // Sửa hồ sơ chuyển lô (2026-09-03): `id` có → sửa; hồ sơ đã chấp nhận thì bị chặn đổi status khác 'accepted'.
  step('chuyen-lo-sua', await api.createLotTransition({ id: transition.data.id, data: { panelId: panel.data.id, fromLotId: lot.data.id, toLotId: lot2.data.id, startDate: '2026-03-08', note: 'da sua', status: 'active' } }));
  step('chuyen-lo-sua-khong-ton-tai', await api.createLotTransition({ id: 'khong-co', data: { panelId: panel.data.id, fromLotId: lot.data.id, toLotId: lot2.data.id } }));
  step('chuyen-lo-list', await api.listLotTransitions());
  // Đổi số lô: kế hoạch đếm trước (không ghi gì) rồi ghi lại nhãn lô trên điểm QC.
  step('doi-lo-preview-khong-doi', await api.previewLotRename({ id: lot.data.id, lotNo: lot.data.lot_no }));
  step('doi-lo-preview', await api.previewLotRename({ id: lot.data.id, lotNo: 'LOT-DOI-TEN' }));
  step('doi-lo-thuc-hien', await api.saveLot({ id: lot.data.id, data: { lotNo: 'LOT-DOI-TEN', level: lot.data.level } }));
  step('doi-lo-diem-qc-sau-khi-doi', await api.queryPoints(test.data.id, 1));
  // Kích hoạt nhóm lô: chưa có Mean/SD cho lô của nhóm → 'unready', không đụng gì.
  step('nhom-lo-kich-hoat-chua-du', await api.activateLotGroup({ id: group.data.id }));
  step('chuyen-lo-xoa', await api.removeLotTransition({ id: transition.data.id }));
  step('nhom-lo-dung', await api.stopLotGroup({ id: group.data.id }));
  step('nhom-lo-xoa', await api.removeLotGroup({ id: group.data.id }));
  step('xoa-may-dang-co-xet-nghiem', await api.removeInstrument({ id: machine.data.id }));

  // --- TEa tham chiếu: 6 điều kiện bắt buộc ---
  step('tea-thieu-ly-do', await api.saveTeaRef({ data: { name: 'Glucose', labValue: 10, labSource: 'regulation', reference: 'CLIA 2024' } }));
  step('tea-gia-tri-am', await api.saveTeaRef({ data: { name: 'Glucose', labValue: -1, labSource: 'regulation', reference: 'CLIA 2024 final rule', reason: 'Ly do du dai de qua gate nay', effectiveDate: '2026-01-01', approvedDate: '2025-12-20', preparedBy: 'A', approvedBy: 'B' } }));
  step('tea-duyet-sau-hieu-luc', await api.saveTeaRef({ data: { name: 'Glucose', labValue: 10, labSource: 'regulation', reference: 'CLIA 2024 final rule', reason: 'Ly do du dai de qua gate nay', effectiveDate: '2026-01-01', approvedDate: '2026-02-01', preparedBy: 'A', approvedBy: 'B' } }));
  const teaRef = await api.saveTeaRef({ data: {
    name: 'Glucose', unit: 'mmol/L', section: 'Hoa sinh', labValue: 10, labSource: 'regulation',
    reference: 'CLIA 2024 final rule',
    reason: 'Ap dung theo quy dinh CLIA hien hanh cua phong xet nghiem',
    effectiveDate: '2026-01-01', approvedDate: '2025-12-20', nextReviewDate: '2027-01-01',
    preparedBy: 'KTV Nam', approvedBy: 'TS Binh',
  } });
  step('tea-ok', teaRef);
  // "Thêm xét nghiệm tham chiếu" — thêm 1 DÒNG analyte vào danh mục, khác
  // `saveTeaRef` (hồ sơ TEa PXN, 6 trường bắt buộc): CLIA/Ricos để trống vẫn
  // hợp lệ, và khoá analyte suy từ tên nên thêm trùng tên bị chặn.
  step('tea-analyte-thieu-ten', await api.addTeaAnalyte({ name: '  ' }));
  step('tea-analyte-ok', await api.addTeaAnalyte({ name: 'Creatine kinase-MB', abbreviation: 'CK-MB', matrix: 'Serum', unit: 'U/L', section: 'Hoa sinh', clia: '30', ricos: '' }));
  step('tea-analyte-trung', await api.addTeaAnalyte({ name: 'Creatine kinase-MB' }));
  step('tea-list', await api.listTeaRefs());
  // `removeTeaLabProfile` — xoá RIÊNG hồ sơ PXN, khác `removeTeaRef` (xoá cả
  // dòng). (a) analyte CK-MB tự thêm CHƯA có hồ sơ PXN (`lab` rỗng) → no-op,
  // trả `removedRecord:false`, không đổi gì. (b) một hồ sơ PXN mới tạo cho
  // analyte KHÔNG có `abbreviation`/`matrix` (không phải tự thêm) và KHÔNG
  // còn CLIA/Ricos% nào khác → xoá RIÊNG hồ sơ này phải xoá LUÔN cả dòng.
  const ckMbRefs = (await api.listTeaRefs()).filter((r) => r.name === 'Creatine kinase-MB');
  step('tea-xoa-pxn-chua-co', await api.removeTeaLabProfile({ id: ckMbRefs[0].id }));
  const throwawayTea = await api.saveTeaRef({ data: {
    name: 'Kali tam xoa', labValue: 5, labSource: 'other', reference: 'Tam thoi de kiem tra xoa ho so PXN',
    reason: 'Chi de kiem tra removeTeaLabProfile xoa dung dong khi khong con gi khac',
    effectiveDate: '2026-01-01', approvedDate: '2025-12-01', preparedBy: 'A', approvedBy: 'B',
  } });
  step('tea-xoa-pxn-tao-tam', throwawayTea);
  step('tea-xoa-pxn-xoa-het', await api.removeTeaLabProfile({ id: throwawayTea.data.id }));
  step('tea-xoa-pxn-list-sau', (await api.listTeaRefs()).map((r) => r.name).sort());

  // --- Phạm vi luật Westgard theo xét nghiệm ---
  step('rule-scope-sai', await api.saveRuleScope(test.data.id, '1-3s', 'khong-hop-le'));
  step('rule-scope-ok', await api.saveRuleScope(test.data.id, '4-1s', 'across'));
  step('rule-scope-list', await api.listRuleScopes(test.data.id, 2));

  // --- Báo cáo: mở khoá + xem lại điểm QC ---
  step('mo-khoa-thieu-ly-do', await api.unlockPeriod({ data: { ym: '2026-04', note: '' } }));
  step('mo-khoa-ok', await api.unlockPeriod({ data: { ym: '2026-04', note: 'Can nhap bu 2 diem QC bi thieu' } }));
  step('locks-sau-mo', await api.listPeriodLocks());
  step('query-report', await api.queryReport({ testId: test.data.id, from: '2026-03-01', to: '2026-05-31' }));

  // --- NCE: trả lại hồ sơ ---
  step('nce-tra-lai-thieu-ly-do', await api.returnNce({ data: { id: followUp.data.id, note: '' } }));
  step('nce-tra-lai-ok', await api.returnNce({ data: { id: followUp.data.id, note: 'Thieu bang chung rerun, bo sung roi trinh lai' } }));

  // --- Nhật ký hoạt động ---
  step('activity-list', await api.listActivity(5));
  step('activity-luu-tru-moc-sai', await api.archiveActivity({ data: { months: 6 } }));
  step('activity-luu-tru-khong-co-gi-cu', await api.archiveActivity({ data: { months: 12 } }));
  step('tea-xoa', await api.removeTeaRef({ id: teaRef.data.id }));
  step('activity-loc-rong', await api.queryActivity({ page: 1, pageSize: 5 }));
  step('activity-loc-chu', await api.queryActivity({ query: 'Glucose', page: 1, pageSize: 5 }));

  // --- Người dùng: sửa / đặt lại mật khẩu / xoá / đổi mật khẩu của mình ---
  const ktvUser = (await api.listUsers()).data.find((u) => u.username === 'ktv');
  step('sua-user', await api.updateUser({ id: ktvUser.id, data: { name: 'KTV doi ten', role: 'technician', active: false } }));
  step('dat-lai-mk-yeu', await api.resetUserPassword({ id: ktvUser.id, data: { newPassword: '123' } }));
  step('dat-lai-mk-ok', await api.resetUserPassword({ id: ktvUser.id, data: { newPassword: 'MatKhauMoi#456' } }));
  step('xoa-user', await api.deleteUser({ id: ktvUser.id }));
  const me = await api.currentUser();
  step('xoa-chinh-minh', await api.deleteUser({ id: me.ok === false ? '' : (me.data || me).id }));
  step('xac-thuc-sai-mk', await api.verifyOwnPassword({ data: { password: 'sai-mat-khau' } }));
  step('xac-thuc-dung-mk', await api.verifyOwnPassword({ data: { password: 'MatKhau#123' } }));
  step('doi-mk-sai-cu', await api.changeOwnPassword({ data: { oldPassword: 'sai', newPassword: 'MatKhauKhac#789' } }));
  step('doi-mk-ok', await api.changeOwnPassword({ data: { oldPassword: 'MatKhau#123', newPassword: 'MatKhauKhac#789' } }));

  // --- Ảnh đại diện (2026-09-04) ---
  step('avatar-sai-dinh-dang', await api.setAvatar({ data: { dataUrl: 'not-an-image' } }));
  step('avatar-dat', await api.setAvatar({ data: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } }));
  step('avatar-hien-tai', await api.currentUser());
  step('avatar-xoa', await api.clearAvatar());
  step('avatar-sau-xoa', await api.currentUser());
  step('dang-nhap-mk-cu', await api.login({ data: { username: 'admin', password: 'MatKhau#123' } }));
  step('dang-nhap-mk-moi', await api.login({ data: { username: 'admin', password: 'MatKhauKhac#789' } }));
  step('backup-status', await api.backupStatus());
  step('activity-csv', await api.exportActivityCsv({ query: 'Glucose' }));
  step('dang-xuat', await api.logout());

  return log;
}

// ---------------------------------------------------------------------------
const realLog = await scenario(makeRealApi());
const mockLog = await scenario(withPermissionPolicy(createBrowserMockApi()));

assert.equal(realLog.length, mockLog.length, 'So buoc 2 phia phai bang nhau');

const diffs = [];
for (let i = 0; i < realLog.length; i++) {
  const [name, real] = realLog[i];
  const [mockName, mock] = mockLog[i];
  assert.equal(name, mockName, 'Thu tu buoc lech');
  const a = JSON.stringify(real), b = JSON.stringify(mock);
  if (a !== b) diffs.push('  [' + name + ']\n    that: ' + a + '\n    mock: ' + b);
}
assert.equal(
  diffs.length, 0,
  'Ban gia lap trinh duyet lech hanh vi so voi handler that o ' + diffs.length + ' buoc:\n' + diffs.join('\n'),
);

// Chốt luôn rằng bài test này CÓ chạy đủ bước — một kịch bản rỗng cũng "khớp".
assert.ok(realLog.length >= 60, 'Kich ban doi chieu phai du day, dang co ' + realLog.length + ' buoc');

// ---------------------------------------------------------------------------
// Nửa thứ hai: nhóm CỐ Ý KHÁC. Các hàm này cần môi trường Electron thật (file
// system, BrowserWindow, HTTP tới gateway) nên bản xem trước trả thẳng
// `not-available-in-browser-preview` thay vì giả vờ thành công — xem ghi chú
// đầu `browser-mock/api.ts`. Ở đây KHÔNG so bằng nhau mà chốt đúng sự khác
// biệt đó: mock phải trả đúng mã lỗi ấy, và bản thật phải KHÔNG trả mã đó.
//
// Vì sao đáng chốt: nếu sau này ai cài đặt thật một trong các hàm này ở bản
// giả lập, bài test sẽ đỏ và nhắc chuyển nó sang nửa SO BẰNG NHAU ở trên —
// thay vì nó âm thầm nằm ngoài mọi vùng kiểm soát.
const UNAVAILABLE_IN_PREVIEW = [
  ['exportBackup', (api) => api.exportBackup()],
  ['verifyBackup', (api) => api.verifyBackup({ data: { json: '{}' } })],
  ['resetOperationalData', (api) => api.resetOperationalData()],
  ['pullLisQueue', (api) => api.pullLisQueue()],
  ['importBackup', (api) => api.importBackup({ data: { json: '{}' } })],
  ['previewLegacyBackup', (api) => api.previewLegacyBackup({ data: { json: '{}' } })],
  ['importLegacyBackup', (api) => api.importLegacyBackup({ data: { json: '{}' } })],
  ['exportTableXlsx', (api) => api.exportTableXlsx({ data: { sheetName: 'S', headers: ['A'], rows: [['1']] } })],
  ['importLisResult', (api) => api.importLisResult({ data: { record: {} } })],
  ['rejectLisResult', (api) => api.rejectLisResult({ data: { messageId: 'khong-co-that' } })],
];

const realApiForEnv = makeRealApi();
await realApiForEnv.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị', password: 'MatKhau#123' } });
const mockApiForEnv = withPermissionPolicy(createBrowserMockApi());

for (const [name, call] of UNAVAILABLE_IN_PREVIEW) {
  const mockResult = await call(mockApiForEnv);
  assert.equal(
    mockResult.ok, false,
    name + ': ban gia lap phai tra loi ro rang, khong duoc gia vo thanh cong',
  );
  assert.equal(
    mockResult.error.code, 'not-available-in-browser-preview',
    name + ': ban gia lap phai tra dung ma not-available-in-browser-preview',
  );
  const realResult = await call(realApiForEnv);
  const realCode = realResult && realResult.ok === false ? realResult.error.code : '(ok)';
  assert.notEqual(
    realCode, 'not-available-in-browser-preview',
    name + ': ban THAT khong duoc tra ma danh rieng cho ban xem truoc',
  );
}

// ---------------------------------------------------------------------------
// Nửa thứ ba: 4 hàm KHÔNG so bằng nhau được nhưng vẫn phải có hợp đồng, thay
// vì bỏ trắng. Lý do khác nhau ở từng hàm, ghi ngay tại chỗ.
// ---------------------------------------------------------------------------

// (1) `getStorageInfo` — bản thật đo kích thước FILE SQLite trên đĩa
// (`:memory:` trong test nên trả 0), bản giả lập đo kích thước blob JSON
// trong localStorage. Hai đại lượng khác nhau về bản chất; hợp đồng chung là
// hình dạng + kiểu, và `path` phải NÓI RÕ đây không phải file thật.
{
  const realInfo = await realApiForEnv.getStorageInfo();
  const mockInfo = await mockApiForEnv.getStorageInfo();
  assert.deepEqual(Object.keys(realInfo).sort(), ['dbFileBytes', 'path'], 'getStorageInfo: hinh dang phia that');
  assert.deepEqual(Object.keys(mockInfo).sort(), ['dbFileBytes', 'path'], 'getStorageInfo: hinh dang phia mock');
  assert.equal(typeof mockInfo.dbFileBytes, 'number');
  assert.ok(mockInfo.dbFileBytes >= 0, 'getStorageInfo: dung luong khong duoc am');
  assert.ok(
    /xem tr/i.test(mockInfo.path),
    'getStorageInfo: `path` cua ban xem truoc phai noi ro day khong phai file SQLite that',
  );
}

// (2) `verifyActivityChainNow` — bản giả lập KHÔNG băm hash thật (trình duyệt
// không có `node:crypto`), nên mọi dòng là "legacy". Hợp đồng: cùng hình
// dạng, bản thật xác minh được chuỗi THẬT, bản giả lập không được báo "chuỗi
// bị phá" (đó là cách `verifyAuditChain()` thật xử lý dòng không hash).
{
  const shape = ['brokenIndex', 'checked', 'legacy', 'ok', 'reason'];
  const realChain = await realApiForEnv.verifyActivityChainNow();
  const mockChain = await mockApiForEnv.verifyActivityChainNow();
  assert.deepEqual(Object.keys(realChain).sort(), shape, 'verifyActivityChainNow: hinh dang phia that');
  assert.deepEqual(Object.keys(mockChain).sort(), shape, 'verifyActivityChainNow: hinh dang phia mock');
  assert.equal(realChain.ok, true, 'chuoi hash that phai xac minh duoc');
  assert.ok(realChain.checked > 0, 'ban that phai bam hash thuc su');
  assert.equal(mockChain.ok, true, 'ban gia lap khong duoc bao chuoi bi pha');
  assert.equal(mockChain.checked, 0, 'ban gia lap khong bam hash nen khong kiem duoc dong nao');
}

// (3) `printHtmlToPdf` — bản thật cần `BrowserWindow` thật nên KHÔNG gọi được
// trong Node (đã kiểm chứng bằng Playwright `_electron` ở Giai đoạn C1). Chỉ
// chốt được phía giả lập: phải từ chối rõ ràng, không giả vờ đã in.
{
  const printed = await mockApiForEnv.printHtmlToPdf({ data: { html: '<p>x</p>', defaultFileName: 'x.pdf' } });
  assert.equal(printed.ok, false, 'printHtmlToPdf: ban xem truoc khong duoc gia vo da in');
  assert.equal(printed.error.code, 'not-available-in-browser-preview');
}

// (4) `onStoreChanged` — không có handler nào ở main để so: đây là kênh
// `webContents.send` một chiều, `preload.ts` bọc `ipcRenderer.on`. Bản xem
// trước chỉ 1 tab nên theo thiết kế không cần đồng bộ chéo. Hợp đồng còn lại
// là thứ MỌI trang phụ thuộc: phải trả về hàm huỷ đăng ký gọi được, vì
// `useStoreInvalidation()` gọi nó trong nhánh dọn dẹp của `useEffect` — trả
// `undefined` sẽ làm mọi trang ném lỗi khi rời trang.
{
  const unsubscribe = mockApiForEnv.onStoreChanged(() => {});
  assert.equal(typeof unsubscribe, 'function', 'onStoreChanged: phai tra ve ham huy dang ky');
  unsubscribe();
}

console.log(
  'mock-parity: ' + realLog.length + ' buoc khop giua ban gia lap va handler that, '
  + UNAVAILABLE_IN_PREVIEW.length + ' ham co y khac dung nhu tai lieu, 4 ham co hop dong rieng.',
);

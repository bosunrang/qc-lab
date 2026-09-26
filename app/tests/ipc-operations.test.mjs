// Bảng thao tác một nguồn (`main/ipc/operations.ts`, `desktop-operations.ts`):
// preload, IPC, RPC của LAN và bản xem trước phải đọc cùng một bảng; LAN chỉ
// gọi được dòng `lan: true`; danh tính đi theo từng lời gọi.
//
// Trước bản này LAN tìm handler theo đuôi tên kênh và tráo tạm biến
// `sessionActor` của máy chính: máy trạm gọi `login` thay được phiên đang mở
// trên máy chính, gọi `htmlToPdf` mở hộp thoại lưu tệp trên máy chính, và
// mọi lời gọi LAN phải xếp hàng sau lệnh chậm nhất.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { createReagentHandlers } = require('../../app-dist/main/ipc/reagent-handlers.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { createAuditHandlers } = require('../../app-dist/main/ipc/audit-handlers.js');
const { createSettingsHandlers } = require('../../app-dist/main/ipc/settings-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { createLisHandlers } = require('../../app-dist/main/ipc/lis-handlers.js');
const {
  createBusinessOperations, createLanInvoker, registerIpcOperations, sessionContext, bindOperations,
} = require('../../app-dist/main/ipc/operations.js');
const { createDesktopOperations } = require('../../app-dist/main/ipc/desktop-operations.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test' };
const tech = { userId: 'u-tech', username: 'ktv', name: 'Ky thuat vien', role: 'technician', clientId: 'test' };
const viewer = { userId: 'u-view', username: 'xem', name: 'Nguoi xem', role: 'viewer', clientId: 'test' };

/** Dựng đủ hai bảng như `main/index.ts`, với phần Electron thay bằng bản giả. */
function setup({ backup, pickOpen = async () => null } = {}) {
  const db = openDatabase(':memory:');
  const auth = createAuthHandlers(db);
  const business = createBusinessOperations({
    auth, config: createConfigHandlers(db), audit: createAuditHandlers(db), entry: createEntryHandlers(db),
    westgard: createWestgardHandlers(db), sigma: createSigmaHandlers(db), nce: createNceHandlers(db),
    reagent: createReagentHandlers(db), settings: createSettingsHandlers(db, ':memory:'),
    report: createReportHandlers(db), lis: createLisHandlers(db),
  });
  let current = null;
  const printed = [];
  const session = { get: () => current, set: (actor) => { current = actor; } };
  const desktop = createDesktopOperations({
    db, auth,
    backup: backup || { backupStatus: () => ({ lastBackupAt: null, lastBackupBytes: 0 }) },
    firebase: { settings: () => ({ connected: false }) },
  }, {
    session,
    pickBackupSavePath: async () => null,
    pickBackupOpenPath: pickOpen,
    buildXlsxBase64: async () => 'eGxzeA==',
    printHtmlToPdf: async (input) => { printed.push(input); return { ok: true, data: { path: 'x.pdf' } }; },
    basename: (filePath) => filePath.split(/[\\/]/).pop(),
  });
  const tables = [business, desktop];
  return { db, auth, business, desktop, tables, session, printed, lan: createLanInvoker(tables) };
}

/** KTV được tạo NCE; vai trò chỉ xem thì không. */
const NCE_INPUT = { data: { date: '2026-09-25', correction: 'Chạy lại mẫu QC' } };

function lastAudit(db) {
  return db.prepare('SELECT username, type FROM activity ORDER BY seq DESC LIMIT 1').get();
}

test('preload khớp đúng bảng thao tác: cùng tên hàm, cùng kênh, không thừa không thiếu', () => {
  // Preload chạy trong sandbox của Electron nên không import được module
  // local; nó giữ bản chép tên kênh và test này canh bản chép đó.
  const preload = readFileSync(new URL('../main/preload.ts', import.meta.url), 'utf8');
  const fromPreload = Object.fromEntries([...preload.matchAll(/^ {2}([a-zA-Z]+): \(.*?ipcRenderer\.invoke\('([^']+)'/gm)].map((m) => [m[1], m[2]]));
  const { tables } = setup();
  const fromTables = Object.fromEntries(tables.flatMap((table) => Object.entries(table).map(([name, op]) => [name, op.channel])));
  assert.ok(Object.keys(fromPreload).length >= 120, 'regex đọc preload có còn đúng?');
  assert.deepEqual(fromPreload, fromTables);
});

test('mỗi kênh chỉ đăng ký một lần, và handler IPC chạy bằng phiên máy chính', async () => {
  const { tables, session, db } = setup();
  const handlers = new Map();
  registerIpcOperations({ handle: (channel, fn) => handlers.set(channel, fn) }, tables, sessionContext(() => session.get()));
  assert.equal(handlers.size, 124);

  const signedOut = await handlers.get('nce:create')({}, NCE_INPUT);
  assert.deepEqual(signedOut, { ok: false, error: { code: 'unauthenticated', message: 'Chưa đăng nhập.' } });
  session.set(tech);
  const saved = await handlers.get('nce:create')({}, NCE_INPUT);
  assert.equal(saved.ok, true);
  assert.equal(lastAudit(db).username, 'ktv');

  assert.throws(() => registerIpcOperations({ handle() {} }, [tables[0], tables[0]], sessionContext(() => null)), /khai hai lần/);
});

test('máy trạm LAN chỉ nhập liệu: danh sách mở là tường minh', () => {
  const { tables } = setup();
  const open = tables.flatMap((table) => Object.entries(table).filter(([, op]) => op.lan).map(([name]) => name)).sort();
  // Đổi danh sách này là quyết định bảo mật và nghiệp vụ (người dùng chốt
  // 2026-09-25: máy trạm chỉ nhập liệu, quản trị làm trên máy chính). Sửa có
  // chủ đích, kèm lý do ghi tại dòng tương ứng trong bảng.
  assert.deepEqual(open, [
    'addPoint', 'addReagentQuickValue', 'analyzeLevel', 'applyLabRange', 'approveNce', 'backupStatus',
    'cancelNce', 'changeOwnPassword', 'clearAvatar', 'createNce', 'createReagentComparison',
    'getFirebaseSettings', 'getLabProfile', 'getLisSettings', 'getLoginBrand', 'getRangeCandidate',
    'getReportTemplateSettings', 'getStorageInfo', 'hasAnyUsers', 'importLisResult',
    'listArchivedBlocks', 'listArchivedGroupTests', 'listEntryHistoryPoints', 'listInstruments',
    'listLotGroups', 'listLotTransitions', 'listLots', 'listNceRecords', 'listPanels',
    'listParallelEntryColumns', 'listPeriodLocks', 'listPlannedTargets', 'listPreviousEntryLotSeries',
    'listPreviousLotBlocks', 'listReagentComparisons', 'listReagentQuickValues', 'listRuleScopes',
    'listRuleSettings', 'listSigmaCohorts', 'listSigmaPeriods', 'listTeaRefs', 'listTestLevels',
    'listTestSummaries', 'listTests', 'listVoidedEntryPoints', 'markNceEffectiveness',
    'previewLotRename', 'pullLisQueue', 'queryPoints', 'queryReport', 'rejectLisResult',
    'removeReagentQuickValue', 'renameSigmaPeriod', 'reopenNce', 'returnNce', 'revertManufacturerRange',
    'saveNceProtocol', 'saveReagentMetadata', 'saveReagentRows', 'saveSigmaPeriod', 'saveSigmaTeaConfig',
    'setAvatar', 'setDayNote', 'setNceCompletedDate', 'setNceReleaseDecision', 'setNceRerunEvidence',
    'verifyOwnPassword', 'voidPoint',
  ]);
});

test('thao tác nào handler đòi quyền admin thì không mở qua LAN', async () => {
  // Quy tắc canh cho dòng mới: handler kiểm quyền TRƯỚC khi kiểm dữ liệu,
  // nên gọi bằng KTV với dữ liệu rỗng là biết thao tác có phải của admin.
  const { business } = setup();
  const adminOnly = [];
  for (const [name, op] of Object.entries(business)) {
    let result;
    try { result = await op.run({ actor: () => tech }, { data: {} }, 'x', 'y', 'z'); } catch { continue; }
    if (result?.error?.code === 'forbidden') adminOnly.push([name, op.lan]);
  }
  assert.ok(adminOnly.length >= 40, 'phép dò có còn nhận ra thao tác admin?');
  assert.deepEqual(adminOnly.filter(([, lan]) => lan).map(([name]) => name), []);
});

test('LAN từ chối kênh đóng, tên kênh có namespace, đuôi tên và tên thuộc prototype', async () => {
  const { lan, session, printed, auth } = setup();
  await auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quan tri', password: 'admin12345' } });
  session.set(admin);
  for (const method of [
    'login', 'logout', 'currentUser', 'bootstrapAdmin', 'auth:bootstrapAdmin', 'auth:login',
    'htmlToPdf', 'printHtmlToPdf', 'print:htmlToPdf', 'export', 'exportBackup', 'backup:export',
    'chooseFile', 'import', 'listActivity', 'resetOperationalData', 'backup:resetAll', 'config:listTests', 'constructor', '__proto__', 'toString', '',
  ]) {
    const result = await lan(method, [{ data: { username: 'admin', password: 'admin12345' } }], viewer);
    assert.equal(result?.error?.code, 'unknown-operation', `LAN phải chặn "${method}"`);
  }
  assert.equal(printed.length, 0, 'không mở hộp thoại in trên máy chính');
  assert.equal(session.get(), admin, 'phiên máy chính giữ nguyên sau mọi lời gọi LAN');
});

test('LAN chạy bằng actor của phiên HTTP, cổng quyền vẫn áp dụng', async () => {
  const { lan, session, db } = setup();
  session.set(admin);
  const saved = await lan('createNce', [NCE_INPUT], tech);
  assert.equal(saved.ok, true);
  assert.equal(lastAudit(db).username, 'ktv', 'nhật ký đứng tên người dùng máy trạm');
  assert.equal(session.get(), admin);

  const denied = await lan('createNce', [NCE_INPUT], viewer);
  assert.equal(denied.ok, false, 'vai trò chỉ xem vẫn bị chặn qua LAN');

  // Admin đăng nhập ở máy trạm cũng không làm việc quản trị được.
  for (const [method, args] of [['saveInstrument', [{ data: { name: 'May' } }]], ['queryActivity', [{}]], ['lockPeriod', [{ data: { ym: '2026-09' } }]], ['saveRuleSetting', ['1-2s', false]]]) {
    const result = await lan(method, args, admin);
    assert.equal(result?.error?.code, 'unknown-operation', `admin ở máy trạm không được gọi ${method}`);
  }
});

test('lời gọi LAN chậm không chặn lời gọi khác, và không lẫn danh tính', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const table = {
    hasAnyUsers: { channel: 'slow', lan: true, run: async (ctx) => { await gate; return ctx.actor().username; } },
    listUsers: { channel: 'fast', lan: true, run: (ctx) => ctx.actor().username },
  };
  const lan = createLanInvoker([table]);
  const slow = lan('hasAnyUsers', [], tech);
  const fast = await Promise.race([lan('listUsers', [], viewer), new Promise((resolve) => setTimeout(() => resolve('blocked'), 200))]);
  assert.equal(fast, 'xem', 'lời gọi nhanh không phải chờ lời gọi chậm');
  release();
  assert.equal(await slow, 'ktv', 'lời gọi chậm vẫn giữ actor của chính nó sau await');
});

test('phiên máy chính: đăng nhập, đăng xuất, và chưa đăng nhập thì bị chặn', async () => {
  const { desktop, business, session, auth, db } = setup();
  await auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quan tri', password: 'admin12345' } });
  const ctx = sessionContext(() => session.get());
  assert.throws(() => business.listUsers.run(ctx), /Chưa đăng nhập/);

  const login = await desktop.login.run(ctx, { data: { username: 'admin', password: 'admin12345' } });
  assert.equal(login.ok, true);
  assert.equal(session.get().username, 'admin');
  assert.equal(session.get().clientId, 'app-desktop');
  assert.equal(desktop.currentUser.run(ctx).username, 'admin');
  assert.equal(business.listUsers.run(ctx).ok, true);

  desktop.logout.run(ctx);
  assert.equal(session.get(), null);
  assert.equal(lastAudit(db).type, 'Đăng xuất');
  assert.equal(desktop.currentUser.run(ctx), null);
});

test('phục hồi backup chỉ dùng tệp main vừa kiểm tra, không nhận đường dẫn từ renderer', async () => {
  const imported = [];
  const backup = {
    verifyBackupFile: (filePath) => ({ ok: true, data: { points: 3, checked: filePath } }),
    importBackupFrom: (filePath, actor) => { imported.push([filePath, actor.username]); return { ok: true, data: { preRestoreSnapshotPath: 'snap' } }; },
  };
  const { desktop, session } = setup({ backup, pickOpen: async () => 'C:\\backup\\qclab.sqlite' });
  const ctx = sessionContext(() => session.get());

  session.set(tech);
  const denied = await desktop.chooseBackupFile.run(ctx);
  assert.equal(denied.ok, false, 'chỉ admin chọn được tệp phục hồi');

  session.set(admin);
  const early = desktop.importBackup.run(ctx, 'C:\\evil.sqlite');
  assert.equal(early.error.code, 'no-file');

  const chosen = await desktop.chooseBackupFile.run(ctx);
  assert.equal(chosen.data.fileName, 'qclab.sqlite');
  desktop.importBackup.run(ctx, 'C:\\evil.sqlite');
  assert.deepEqual(imported, [['C:\\backup\\qclab.sqlite', 'admin']]);
  assert.equal(desktop.importBackup.run(ctx).error.code, 'no-file', 'mỗi lần chọn chỉ phục hồi được một lần');
});

test('bản xem trước gắn cùng bảng nghiệp vụ, đọc phiên tại thời điểm gọi', async () => {
  const { business, session } = setup();
  const api = bindOperations(business, sessionContext(() => session.get()));
  assert.equal((await api.listUsers()).error.code, 'unauthenticated');
  await assert.rejects(api.getLisSettings(), /Chưa đăng nhập/, 'hàm đọc vẫn ném lỗi như trước');
  session.set(tech);
  const saved = await api.createNce(NCE_INPUT);
  assert.equal(saved.ok, true);
});

test('exception của thao tác trả IpcResult thành { ok: false }; thao tác đọc vẫn ném', async () => {
  const boom = () => { throw new Error('SQLITE_BUSY: database is locked'); };
  const table = {
    createNce: { channel: 'nce:create', lan: true, run: boom },
    listTests: { channel: 'config:listTests', lan: true, run: boom },
  };
  const quiet = console.error;
  console.error = () => {};
  try {
    const handlers = new Map();
    registerIpcOperations({ handle: (channel, fn) => handlers.set(channel, fn) }, [table], sessionContext(() => tech));
    const lan = createLanInvoker([table]);
    const api = bindOperations(table, sessionContext(() => tech));
    const expected = { ok: false, error: { code: 'internal-error', message: 'SQLITE_BUSY: database is locked' } };
    assert.deepEqual(await handlers.get('nce:create')({}, NCE_INPUT), expected, 'IPC');
    assert.deepEqual(await lan('createNce', [NCE_INPUT], tech), expected, 'LAN');
    assert.deepEqual(await api.createNce(NCE_INPUT), expected, 'bản xem trước');
    await assert.rejects(handlers.get('config:listTests')({}), /SQLITE_BUSY/);
    await assert.rejects(lan('listTests', [], tech), /SQLITE_BUSY/);
    await assert.rejects(api.listTests(), /SQLITE_BUSY/);
  } finally {
    console.error = quiet;
  }
});

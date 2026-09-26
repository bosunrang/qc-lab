// Thao tác riêng của máy chính Electron: phiên đăng nhập trong bộ nhớ, hộp
// thoại tệp backup, cửa sổ in PDF, Firebase. Phần phụ thuộc Electron (hộp
// thoại, `BrowserWindow`) được truyền vào qua `DesktopHost`, nên module này
// không import `electron` và test chạy được bằng Node.
import type { PublicUser } from '../../shared/qc-api';
import type { Actor } from './shared';
import { writeAudit, requireAdmin } from './shared';
import type { Db } from '../db/sqlite-like';
import type { createAuthHandlers } from './auth-handlers';
import type { BackupHandlers } from './backup-handlers';
import type { createFirebaseHandlers } from './firebase-handlers';
import type { ExportTableInput } from './export-handlers';
import type { HostApiName, OperationTable } from './operations';
import { logEvent } from '../logging/log-sink';
import { buildLogBundle } from '../logging/log-bundle';

export interface DesktopSession {
  get(): Actor | null;
  set(actor: Actor | null): void;
}

export interface DesktopHost {
  session: DesktopSession;
  /** Hộp thoại lưu tệp backup; `null` khi người dùng huỷ. */
  pickBackupSavePath(defaultName: string): Promise<string | null>;
  /** Hộp thoại chọn tệp backup để phục hồi; `null` khi người dùng huỷ. */
  pickBackupOpenPath(): Promise<string | null>;
  buildXlsxBase64(input: ExportTableInput): Promise<string>;
  printHtmlToPdf(input: { html: string; defaultFileName: string; pageNumbers?: boolean }): Promise<{ ok: true; data: { path: string } } | { ok: false; error: { code: string; message: string } }>;
  basename(filePath: string): string;
  /** Thư mục log; mở bằng trình quản lý tệp. Trả chuỗi lỗi, rỗng khi mở được. */
  logDir: string;
  openFolder(path: string): Promise<string>;
  /** Hộp thoại lưu gói log; `null` khi người dùng huỷ. */
  pickLogBundleSavePath(defaultName: string): Promise<string | null>;
  /** Ghi tệp ra đĩa (tách ra để test không ghi tệp thật). */
  writeFile(path: string, data: Buffer): Promise<void>;
  appVersion: string;
  electronVersion: string;
}

export interface DesktopHandlers {
  db: Db;
  auth: ReturnType<typeof createAuthHandlers>;
  backup: BackupHandlers;
  firebase: ReturnType<typeof createFirebaseHandlers>;
}

export function desktopActor(user: PublicUser): Actor {
  return { userId: user.id, username: user.username, name: user.name, role: user.role, clientId: 'app-desktop' };
}

export function createDesktopOperations(h: DesktopHandlers, host: DesktopHost): OperationTable<HostApiName> {
  const { db, auth, backup, firebase } = h;
  const { session } = host;
  // Tệp được chọn để phục hồi giữ ở đây sau bước kiểm tra, nên bước phục hồi
  // không nhận đường dẫn từ renderer.
  let pendingRestorePath: string | null = null;

  return {
    // Phiên của máy chính. Máy trạm LAN đăng nhập qua `/api/auth/login` (có
    // bộ đếm đăng nhập sai) và giữ phiên HTTP riêng, không bao giờ qua đây.
    // Đọc lại từ DB thay vì dựng từ actor — xem ghi chú getUser().
    currentUser: { channel: 'auth:currentUser', lan: false, run: () => { const actor = session.get(); return actor ? auth.getUser(actor.userId) : null; } },
    bootstrapAdmin: { channel: 'auth:bootstrapAdmin', lan: false, run: (_ctx, input) => auth.bootstrapAdmin(input) },
    login: {
      channel: 'auth:login', lan: false,
      run: async (_ctx, input) => {
        const result = await auth.login(input);
        if (result.ok) session.set(desktopActor(result.data));
        return result;
      },
    },
    logout: {
      channel: 'auth:logout', lan: false,
      run: () => {
        const actor = session.get();
        if (actor) writeAudit(db, actor, 'Đăng xuất', 'Đăng xuất khỏi ứng dụng', actor.username);
        session.set(null);
        return { ok: true as const, data: null };
      },
    },

    // Chỉ lời gọi đọc trạng thái mở qua LAN; kết nối và đồng bộ là việc của
    // máy chính (Firebase chỉ để sao lưu từ một máy).
    getFirebaseSettings: { channel: 'firebase:getSettings', lan: true, run: () => firebase.settings() },
    connectFirebase: { channel: 'firebase:connect', lan: false, run: (ctx, input) => firebase.connect(input, ctx.actor()) },
    syncFirebase: { channel: 'firebase:sync', lan: false, run: (ctx, input) => firebase.sync(input, ctx.actor()) },
    disconnectFirebase: { channel: 'firebase:disconnect', lan: false, run: (ctx) => firebase.disconnect(ctx.actor()) },

    exportTableXlsx: {
      channel: 'export:tableXlsx', lan: false,
      run: async (_ctx, input) => {
        try {
          return { ok: true as const, data: await host.buildXlsxBase64(input) };
        } catch (e) {
          return { ok: false as const, error: { code: 'xlsx-failed', message: e instanceof Error ? e.message : 'Không tạo được file Excel.' } };
        }
      },
    },
    // Mở hộp thoại lưu tệp trên máy chính: không mở qua LAN.
    printHtmlToPdf: { channel: 'print:htmlToPdf', lan: false, run: (_ctx, input) => host.printHtmlToPdf(input) },

    // Backup là tệp trên máy chính: main mở hộp thoại, renderer chỉ nhận kết
    // quả. Ba kênh này không mở qua LAN — trước đây `backup:export` khớp
    // theo đuôi tên `export` và trả cả CSDL qua mạng.
    exportBackup: {
      channel: 'backup:export', lan: false,
      run: async (ctx) => {
        const actor = ctx.actor();
        const denied = requireAdmin(actor); if (denied) return denied;
        const filePath = await host.pickBackupSavePath(`qclab-backup-${new Date().toISOString().slice(0, 10)}.sqlite`);
        if (!filePath) return { ok: true as const, data: null };
        return backup.exportBackupTo(filePath, actor);
      },
    },
    chooseBackupFile: {
      channel: 'backup:chooseFile', lan: false,
      run: async (ctx) => {
        const actor = ctx.actor();
        const denied = requireAdmin(actor); if (denied) return denied;
        pendingRestorePath = null;
        const filePath = await host.pickBackupOpenPath();
        if (!filePath) return { ok: true as const, data: null };
        const verified = backup.verifyBackupFile(filePath, actor);
        if (!verified.ok) return verified;
        pendingRestorePath = filePath;
        return { ok: true as const, data: { ...verified.data, fileName: host.basename(filePath) } };
      },
    },
    // Không nhận tham số: chỉ phục hồi đúng tệp main vừa kiểm tra.
    importBackup: {
      channel: 'backup:import', lan: false,
      run: (ctx) => {
        const actor = ctx.actor();
        if (!pendingRestorePath) return { ok: false as const, error: { code: 'no-file', message: 'Chưa chọn tệp backup để phục hồi.' } };
        const filePath = pendingRestorePath;
        pendingRestorePath = null;
        return backup.importBackupFrom(filePath, actor);
      },
    },
    backupStatus: { channel: 'backup:status', lan: true, run: () => backup.backupStatus() },
    // Xoá dữ liệu vận hành của cả phòng: chỉ làm trên máy chính, máy trạm LAN
    // dùng để nhập dữ liệu (người dùng chốt 2026-09-25).
    resetOperationalData: { channel: 'backup:resetAll', lan: false, run: (ctx) => backup.resetOperationalData(ctx.actor()) },
    // Lỗi không được bắt của cửa sổ app (kể cả ở màn hình đăng nhập, nên
    // không đòi phiên). Cắt độ dài để một vòng lỗi không làm phình tệp log.
    reportClientError: {
      channel: 'log:clientError', lan: false,
      run: (_ctx, input) => {
        const data = (input && typeof input === 'object' ? input : {}) as { message?: unknown; stack?: unknown };
        const message = String(data.message ?? '').slice(0, 2000) || 'Lỗi không có mô tả';
        const stack = typeof data.stack === 'string' ? data.stack.slice(0, 8000) : undefined;
        logEvent({ level: 'error', source: 'renderer', message, detail: stack });
        return { ok: true as const, data: null };
      },
    },
    openLogFolder: {
      channel: 'log:openFolder', lan: false,
      run: async (ctx) => {
        const denied = requireAdmin(ctx.actor()); if (denied) return denied;
        const failure = await host.openFolder(host.logDir);
        if (failure) return { ok: false as const, error: { code: 'open-failed', message: `Không mở được thư mục log: ${failure}` } };
        return { ok: true as const, data: { path: host.logDir } };
      },
    },
    // Gói ZIP gồm log, tệp crash và thông tin môi trường, để gửi kèm khi báo
    // lỗi (kế hoạch G.2). Không kèm CSDL. Chỉ quản trị viên, chỉ máy chính.
    exportLogBundle: {
      channel: 'log:exportBundle', lan: false,
      run: async (ctx) => {
        const actor = ctx.actor();
        const denied = requireAdmin(actor); if (denied) return denied;
        const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
        const filePath = await host.pickLogBundleSavePath(`QC-Lab-log-${stamp}.zip`);
        if (!filePath) return { ok: true as const, data: null };
        try {
          const bundle = buildLogBundle(host.logDir, { appVersion: host.appVersion, electronVersion: host.electronVersion, exportedBy: actor.name || actor.username });
          await host.writeFile(filePath, bundle.zip);
          // Không đổi dữ liệu QC; chỉ nhật ký ghi lại việc log rời khỏi máy.
          writeAudit(db, actor, 'Xuất gói log', `${bundle.files} tệp log/crash, ${(bundle.zip.length / 1024).toFixed(0)} KB`, '');
          return { ok: true as const, data: { path: filePath, files: bundle.files, bytes: bundle.zip.length } };
        } catch (e) {
          return { ok: false as const, error: { code: 'export-failed', message: `Không xuất được gói log: ${e instanceof Error ? e.message : String(e)}` } };
        }
      },
    },
  };
}

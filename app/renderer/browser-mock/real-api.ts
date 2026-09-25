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
//   - SHA-256: `node:crypto` <-> JS thuần (`sha256-browser.ts`)
//   - PBKDF2: 600.000 vòng <-> 20.000 vòng, cùng thuật toán, tương thích 2
//     chiều vì số vòng nằm trong chuỗi lưu (`password-hash-browser.ts`)
//
// Những gì KHÔNG chạy được trong trình duyệt (file system, BrowserWindow,
// HTTP tới LIS Gateway) trả `not-available-in-browser-preview`. Riêng Excel
// và PDF có đường thay thế thuần trình duyệt ở `browser-export.ts`, để xem và
// xuất báo cáo ngay trên cổng 5174.
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
import { bindOperations, createBusinessOperations, sessionContext } from '../../main/ipc/operations';
import type { QcApi, IpcResult } from '../../shared/qc-api';
import { exportTableXlsxInBrowser, printHtmlToPdfInBrowser } from './browser-export';


/** Hiện ở thẻ "Dung lượng" trang Cài đặt. Không phải file thật — nói rõ điều
 * đó thay vì bịa một đường dẫn nghe như có thật. */
const PREVIEW_DB_PATH = 'IndexedDB: qclab-v2-preview (xem trước, không phải file trên đĩa)';

function notAvailable(): IpcResult<never> {
  return {
    ok: false,
    error: {
      code: 'not-available-in-browser-preview',
      message: 'Không khả dụng ở chế độ xem trước trình duyệt — cần chạy Electron thật (npm run app:start).',
    },
  };
}

export async function createRealBrowserApi(): Promise<QcApi> {
  const preview = await openPreviewDatabase();
  const db = preview.db;
  setBrowserDbSizeSource(() => db.export().length);

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

  // Danh tính đang đăng nhập — cùng cách `main/index.ts` làm (một biến trong
  // bộ nhớ, app một cửa sổ, không session token); bảng thao tác đọc biến này
  // bằng `sessionContext()`.
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
      clientId: 'app-browser-preview',
    };
  }
  const business = bindOperations(
    createBusinessOperations({ auth, config, audit, entry, westgard, sigma, nce, reagent, settings, report, lis }),
    sessionContext(() => sessionActor),
  );

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
    currentUser: async () => (sessionActor ? auth.getUser(sessionActor.userId) : null),
    bootstrapAdmin: async (input) => {
      const result = auth.bootstrapAdmin(input);
      preview.persist();
      return result;
    },
    login: async (input) => {
      const result = await auth.login(input);
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
    // Mọi thao tác nghiệp vụ: CÙNG bảng với IPC của Electron và RPC của LAN.
    ...business,

    backupStatus: async () => {
      const rows = db.prepare("SELECT key, value FROM app_meta WHERE key IN ('lastBackupAt','lastBackupBytes')").all() as { key: string; value: string }[];
      const at = rows.find((r) => r.key === 'lastBackupAt')?.value || null;
      const bytes = Number(rows.find((r) => r.key === 'lastBackupBytes')?.value || 0);
      return {
        lastBackupAt: at,
        lastBackupBytes: Number.isFinite(bytes) ? bytes : 0,
      };
    },

    // Cần Electron thật — khớp đúng danh sách `api.ts` cũ đã trả
    // not-available, không nới thêm ở bước này. Ba hàm LIS gọi HTTP ra
    // ngoài ghi đè dòng cùng tên của `business` ở trên.
    // Trả TRỰC TIẾP (không bọc `IpcResult`) đúng như `firebase-handlers.ts`.
    getFirebaseSettings: async () => ({ labCode: '', email: '', config: '', connected: false, status: 'Chưa kết nối', dataPath: '' }),
    connectFirebase: async () => notAvailable(),
    syncFirebase: async () => notAvailable(),
    disconnectFirebase: async () => notAvailable(),
    exportTableXlsx: exportTableXlsxInBrowser,
    printHtmlToPdf: ({ html }) => printHtmlToPdfInBrowser(html),
    exportBackup: async () => notAvailable(),
    chooseBackupFile: async () => notAvailable(),
    importBackup: async () => notAvailable(),
    resetOperationalData: async () => notAvailable(),
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



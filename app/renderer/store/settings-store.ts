import { create } from 'zustand';
import type {
  LabProfile, IpcResult, LisGatewaySettings, LisQueueRecord, FirebaseSettings,
  FirebaseConnectResult, FirebaseSyncResult, StorageInfo, BackupFileSummary,
} from '../../shared/qc-api';

/** Trang Cài đặt gom 5 nhóm dữ liệu backend độc lập: hồ sơ đơn vị, dung
 * lượng, backup, LIS Gateway, Firebase.
 *
 * Trước 2026-09-10 chỉ 2 nhóm đầu đi qua store, 3 nhóm còn lại được
 * `SettingsPage.tsx` gọi thẳng `window.qcApi` (20 chỗ) và giữ trong
 * `useState` cục bộ. Hệ quả: `useStoreInvalidation()` không chạm tới được —
 * dữ liệu đổi ở nơi khác (hoặc do chính thao tác backup/reset ở đây) không
 * làm trang tự cập nhật, và không có chỗ nào khác dùng lại được các thao tác
 * đó. Nay mọi lời gọi backend của trang này nằm ở đây.
 *
 * RANH GIỚI: store giữ DỮ LIỆU TỪ BACKEND và các thao tác gọi IPC; state của
 * FORM (tên đơn vị đang gõ, mật khẩu Firebase, ô URL LIS…) vẫn thuộc về
 * trang — đó là nháp của người dùng, không phải dữ liệu đã lưu. Hộp thoại
 * xác nhận cũng ở trang: chúng là UI, không phải dữ liệu. Hộp thoại chọn tệp
 * backup do main process mở.
 */
interface SettingsState {
  profile: LabProfile | null;
  storage: StorageInfo | null;
  backup: { lastBackupAt: string | null; lastBackupBytes: number } | null;
  lis: LisGatewaySettings | null;
  lisQueue: { pending: LisQueueRecord[]; unresolved: LisQueueRecord[] } | null;
  firebase: FirebaseSettings | null;

  /** Nạp mọi dữ liệu trang Cài đặt cần, dùng khi mở trang và khi làm mới. */
  loadAll: () => Promise<void>;
  load: () => Promise<void>;
  loadStorage: () => Promise<void>;
  save: (data: { name: string; dept: string; address: string; brandTitle: string; brandSub: string; logoText?: string; logoData?: string; clearLogo?: boolean }) => Promise<IpcResult<LabProfile>>;

  loadBackupStatus: () => Promise<void>;
  exportBackup: () => Promise<IpcResult<{ path: string; bytes: number; points: number } | null>>;
  chooseBackupFile: () => Promise<IpcResult<BackupFileSummary | null>>;
  importBackup: () => Promise<IpcResult<{ preRestoreSnapshotPath: string }>>;
  resetOperationalData: () => Promise<IpcResult<{ preResetSnapshotPath: string; clearedTables: string[] }>>;

  loadLis: () => Promise<void>;
  saveLis: (data: { enabled: boolean; url: string; token: string }) => Promise<IpcResult<LisGatewaySettings>>;
  pullLisQueue: () => Promise<IpcResult<{ pending: LisQueueRecord[]; unresolved: LisQueueRecord[] }>>;
  importLisResult: (record: LisQueueRecord) => Promise<IpcResult<{ pointId: string; gatewayWarning?: string }>>;
  rejectLisResult: (messageId: string) => Promise<IpcResult<{ messageId: string }>>;

  loadFirebase: () => Promise<void>;
  connectFirebase: (data: { labCode?: string; email?: string; password?: string; config?: string }) => Promise<IpcResult<FirebaseConnectResult>>;
  syncFirebase: (direction: 'push' | 'pull') => Promise<IpcResult<FirebaseSyncResult>>;
  disconnectFirebase: () => Promise<IpcResult<null>>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  profile: null,
  storage: null,
  backup: null,
  lis: null,
  lisQueue: null,
  firebase: null,

  loadAll: async () => {
    await Promise.all([
      get().load(), get().loadStorage(), get().loadBackupStatus(),
      get().loadLis(), get().loadFirebase(),
    ]);
  },

  load: async () => set({ profile: await window.qcApi.getLabProfile() }),
  loadStorage: async () => set({ storage: await window.qcApi.getStorageInfo() }),
  save: async (data) => {
    const result = await window.qcApi.saveLabProfile({ data });
    if (result.ok) set({ profile: result.data });
    return result;
  },

  loadBackupStatus: async () => set({ backup: await window.qcApi.backupStatus() }),
  exportBackup: async () => {
    const result = await window.qcApi.exportBackup();
    // Mốc "sao lưu gần nhất" đổi ngay sau khi xuất — nạp lại để lời nhắc sao
    // lưu không còn nói "chưa sao lưu trên máy này".
    if (result.ok && result.data) await get().loadBackupStatus();
    return result;
  },
  chooseBackupFile: async () => window.qcApi.chooseBackupFile(),
  importBackup: async () => {
    const result = await window.qcApi.importBackup();
    // Phục hồi thay gần như MỌI bảng: nạp lại cả hồ sơ đơn vị lẫn dung lượng.
    if (result.ok) await get().loadAll();
    return result;
  },
  resetOperationalData: async () => {
    const result = await window.qcApi.resetOperationalData();
    if (result.ok) await get().loadAll();
    return result;
  },

  loadLis: async () => set({ lis: await window.qcApi.getLisSettings() }),
  saveLis: async (data) => {
    const result = await window.qcApi.saveLisSettings({ data });
    if (result.ok) set({ lis: result.data });
    return result;
  },
  pullLisQueue: async () => {
    const result = await window.qcApi.pullLisQueue();
    set({ lisQueue: result.ok ? result.data : null });
    return result;
  },
  importLisResult: async (record) => {
    const result = await window.qcApi.importLisResult({ data: { record } });
    // Làm mới hàng chờ TỪ NGUỒN THẬT thay vì tự suy đoán trạng thái mới.
    if (result.ok) await get().pullLisQueue();
    return result;
  },
  rejectLisResult: async (messageId) => {
    const result = await window.qcApi.rejectLisResult({ data: { messageId } });
    if (result.ok) await get().pullLisQueue();
    return result;
  },

  loadFirebase: async () => set({ firebase: await window.qcApi.getFirebaseSettings() }),
  connectFirebase: async (data) => {
    const result = await window.qcApi.connectFirebase({ data });
    if (result.ok) await get().loadFirebase();
    return result;
  },
  syncFirebase: async (direction) => {
    const result = await window.qcApi.syncFirebase({ data: { direction } });
    // Kéo về (`pull`) thay dữ liệu cục bộ → nạp lại mọi thứ trang này hiển thị.
    if (result.ok) await (direction === 'pull' ? get().loadAll() : get().loadFirebase());
    return result;
  },
  disconnectFirebase: async () => {
    const result = await window.qcApi.disconnectFirebase();
    if (result.ok) await get().loadFirebase();
    return result;
  },
}));


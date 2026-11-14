import type { AppUpdater, UpdateInfo } from 'electron-updater';
import type { IpcResult, SoftwareUpdateStatus } from '../../shared/qc-api';

type UpdatePort = Pick<AppUpdater, 'on' | 'checkForUpdates' | 'downloadUpdate' | 'quitAndInstall' | 'autoDownload' | 'autoInstallOnAppQuit' | 'allowDowngrade' | 'allowPrerelease' | 'disableWebInstaller'>;
export interface UpdateOptions { currentVersion: string; changed(): void; prepareInstall(): Promise<void>; beforeInstall(): void; installFailed?(): void }

/** Tự tải bản mới trong nền, chỉ cài sau xác nhận khởi động lại. Bản chạy từ mã nguồn
 * không có port cập nhật nên không vô tình tải/cài đè bản đang phát triển. */
export function createUpdateService(port: UpdatePort | null, options: UpdateOptions) {
  let state: SoftwareUpdateStatus = {
    phase: port ? 'idle' : 'unsupported', current_version: options.currentVersion, available_version: '', release_notes: '', checked_at: '',
    percent: 0, transferred: 0, total: 0, message: port ? 'Chưa kiểm tra bản cập nhật.' : 'Cập nhật tự động chỉ có trong bản cài Windows.',
  };
  let busy = false;
  const status = () => ({ ...state });
  function set(patch: Partial<SoftwareUpdateStatus>) { state = { ...state, ...patch }; options.changed(); }
  const ok = (): IpcResult<SoftwareUpdateStatus> => ({ ok: true, data: status() });
  const fail = (code: string, message: string): IpcResult<SoftwareUpdateStatus> => ({ ok: false, error: { code, message } });
  const infoOf = (info: UpdateInfo) => ({ available_version: info.version,
    // Chỉ hiện văn bản, không đưa HTML phát hành vào renderer.
    release_notes: (typeof info.releaseNotes === 'string' ? info.releaseNotes : (info.releaseNotes ?? []).map((note) => note.note ?? '').join('\n')).slice(0, 12000) });
  const errorMessage = () => 'Không hoàn tất được cập nhật. Kiểm tra kết nối Internet và bản phát hành trên GitHub rồi thử lại.';
  if (port) {
    port.autoDownload = true;
    port.autoInstallOnAppQuit = false;
    port.allowDowngrade = false;
    port.allowPrerelease = false;
    port.disableWebInstaller = true;
    port.on('update-available', (info) => set({ ...infoOf(info), phase: 'downloading', percent: 0, transferred: 0, total: 0, message: `Đang tải phiên bản ${info.version} trong nền…` }));
    port.on('update-not-available', () => set({ phase: 'idle', available_version: '', release_notes: '', message: 'Bạn đang dùng phiên bản mới nhất.' }));
    port.on('download-progress', (progress) => set({ phase: 'downloading', percent: Math.max(0, Math.min(100, progress.percent)), transferred: progress.transferred, total: progress.total, message: 'Đang tải bản cập nhật…' }));
    port.on('update-downloaded', (info) => set({ ...infoOf(info), phase: 'downloaded', percent: 100, message: 'Đã tải xong. Bạn có thể chọn thời điểm cài đặt.' }));
    port.on('error', () => {
      if (state.phase === 'installing') { busy = false; options.installFailed?.(); }
      set({ phase: 'error', message: errorMessage() });
    });
  }
  async function check(): Promise<IpcResult<SoftwareUpdateStatus>> {
    if (!port) return fail('update-unavailable', state.message);
    if (busy || ['downloading', 'installing'].includes(state.phase)) return fail('update-busy', 'Một thao tác cập nhật đang chạy.');
    if (state.phase === 'downloaded') return ok();
    busy = true; set({ phase: 'checking', message: 'Đang kiểm tra GitHub Releases…', checked_at: new Date().toISOString() });
    try { await port.checkForUpdates(); return state.phase === 'error' ? fail('update-check-failed', state.message) : ok(); }
    catch { set({ phase: 'error', message: errorMessage() }); return fail('update-check-failed', state.message); }
    finally { busy = false; }
  }
  async function download(): Promise<IpcResult<SoftwareUpdateStatus>> {
    if (!port) return fail('update-unavailable', state.message);
    if (busy || state.phase !== 'available') return fail('update-not-ready', 'Kiểm tra phiên bản mới trước khi tải.');
    busy = true; set({ phase: 'downloading', percent: 0, transferred: 0, total: 0, message: 'Đang tải bản cập nhật…' });
    try { await port.downloadUpdate(); return status().phase === 'error' ? fail('update-download-failed', state.message) : ok(); }
    catch { set({ phase: 'error', message: errorMessage() }); return fail('update-download-failed', state.message); }
    finally { busy = false; }
  }
  async function install(record: () => void): Promise<IpcResult<SoftwareUpdateStatus>> {
    if (!port || busy || state.phase !== 'downloaded') return fail('update-not-downloaded', 'Chỉ cài khi bản cập nhật đã tải xong.');
    busy = true; set({ phase: 'installing', message: 'Đang sao lưu và chuẩn bị cài đặt…' });
    try {
      await options.prepareInstall();
      record();
      // Cho IPC trả kết quả trước khi đóng cửa sổ. Cờ thoát phải đặt TRƯỚC
      // quitAndInstall(), vì app thường đóng cửa sổ bằng cách ẩn xuống khay.
      setTimeout(() => {
        try { options.beforeInstall(); port.quitAndInstall(true, true); }
        catch { busy = false; options.installFailed?.(); set({ phase: 'downloaded', message: 'Không mở được bộ cài. Hãy thử lại.' }); }
      }, 350).unref();
      return ok();
    } catch {
      busy = false; set({ phase: 'downloaded', message: 'Chưa cài đặt vì không chuẩn bị được bản sao lưu, đồng bộ hoặc nhật ký. Dữ liệu đang được giữ nguyên.' });
      return fail('update-prepare-failed', state.message);
    }
  }
  return { status, check, download, install };
}

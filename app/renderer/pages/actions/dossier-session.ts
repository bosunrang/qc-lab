// Phiên làm việc của một hồ sơ: tuần tự hoá ghi, bỏ phản hồi đọc cũ và giữ
// nguyên lỗi/bản nháp cho tới khi người dùng chủ động đối chiếu dữ liệu mới.
import { createStore } from 'zustand/vanilla';
import { withDeadline } from '../../lib/async-deadline';
import type { IpcResult, NceDossierView, NceWriteBase } from '../../../shared/qc-api';
import { assertDossier } from './dossier-data';

export type DossierWrite = (base: NceWriteBase) => Promise<IpcResult<NceDossierView>>;
export interface DossierWriteOptions {
  /** Trả true khi biểu mẫu đã gắn lỗi nhập liệu vào đúng ô; lỗi khác vẫn hiện chung. */
  handleValidationError?: (error: { code: string; message: string }) => boolean;
}
export interface DossierError { message: string; stale: boolean; kind: 'load' | 'write' | 'uncertain' }

interface DossierSession {
  dossier: NceDossierView | null | undefined;
  error: DossierError | null;
  busy: boolean;
  loading: boolean;
  activate: () => void;
  dispose: () => void;
  reload: (acknowledgeError?: boolean) => Promise<boolean>;
  invalidate: () => void;
  run: (write: DossierWrite, options?: DossierWriteOptions) => Promise<boolean>;
  clearError: () => void;
}

const messageOf = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : 'Không nhận được phản hồi hợp lệ.';

export function createDossierSession(
  id: string,
  get: (id: string) => Promise<NceDossierView | null>,
  options: { timeoutMs?: number; reportError?: (error: unknown) => void } = {},
) {
  let active = false;
  let generation = 0;
  let lifecycle = 0;
  let pendingReload = false;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const report = (error: unknown) => { try { options.reportError?.(error); } catch { /* Bước ghi log không được làm hỏng phục hồi lỗi. */ } };

  return createStore<DossierSession>((set, state) => ({
    dossier: undefined, error: null, busy: false, loading: false,
    activate() {
      active = true;
      lifecycle++;
      void state().reload();
    },
    dispose() {
      active = false;
      generation++;
      lifecycle++;
      pendingReload = false;
    },
    async reload(acknowledgeError = false) {
      if (!active) return false;
      if (state().busy) { pendingReload = true; return false; }
      const request = ++generation;
      set({ loading: true });
      try {
        const dossier = await withDeadline(() => get(id), timeoutMs);
        if (!active || request !== generation) return false;
        if (dossier !== null) assertDossier(dossier, id);
        set({ dossier, loading: false, error: acknowledgeError || state().error?.kind === 'load' ? null : state().error });
        return true;
      } catch (error) {
        if (!active || request !== generation) return false;
        report(error);
        // Đọc nền không xoá lỗi stale hoặc làm mất cảnh báo chưa biết kết quả
        // lệnh ghi. Chỉ tải lại thành công có xác nhận mới gỡ những lỗi đó.
        const previous = state().error;
        const detail = `Không tải được hồ sơ: ${messageOf(error)}`;
        set({ loading: false, error: previous && previous.kind !== 'load'
          ? { ...previous, message: `${previous.message.split('\nKhông tải được hồ sơ:')[0]}\n${detail}` }
          : { message: detail, stale: false, kind: 'load' } });
        return false;
      }
    },
    invalidate() {
      if (!active) return;
      if (state().busy) { pendingReload = true; return; }
      void state().reload();
    },
    async run(write, options) {
      const current = state();
      // Khoá ngay trong cùng nhịp xử lý, không đợi React vẽ lại nút disabled.
      if (!active || !current.dossier || current.busy || current.error?.kind === 'uncertain') return false;
      const startedIn = lifecycle;
      generation++;
      set({ busy: true, loading: false });
      try {
        const result = await withDeadline(() => write({ id, expectedVersion: current.dossier!.record.row_version }), timeoutMs);
        if (!active || startedIn !== lifecycle) return false;
        if (result.ok) { assertDossier(result.data, id); set({ dossier: result.data, error: null }); return true; }
        if (result.error.code === 'internal-error') throw new Error(result.error.message);
        // Lệnh đã bị từ chối rõ ràng: cho biểu mẫu đặt lỗi ngay cạnh ô nhập.
        // Xung đột phiên bản luôn giữ ở mức hồ sơ để người dùng đối chiếu.
        let handled = false;
        if (result.error.code !== 'stale' && options?.handleValidationError) {
          try { handled = options.handleValidationError(result.error); }
          catch (error) { report(error); }
        }
        if (handled) { set({ error: null }); return false; }
        set({ error: { message: result.error.message, stale: result.error.code === 'stale', kind: 'write' } });
        return false;
      } catch (error) {
        if (!active || startedIn !== lifecycle) return false;
        report(error);
        set({ error: {
          kind: 'uncertain', stale: false,
          message: `Chưa xác nhận được thao tác đã được lưu hay chưa: ${messageOf(error)} Không gửi lại lệnh ngay; hãy tải dữ liệu mới để đối chiếu. Bản nháp vẫn được giữ.`,
        } });
        return false;
      } finally {
        if (active && startedIn === lifecycle) {
          set({ busy: false });
          if (pendingReload) { pendingReload = false; void state().reload(); }
        }
      }
    },
    clearError() { if (state().error?.kind !== 'uncertain') set({ error: null }); },
  }));
}

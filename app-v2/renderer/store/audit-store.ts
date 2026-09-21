import { create } from 'zustand';
import type { ActivityArchivePreview, ActivityPage, IpcResult } from '../../shared/qc-api';

const EMPTY_PAGE: ActivityPage = { page: 1, pageCount: 1, offset: 0, rows: [], resultFrom: 0, resultTo: 0, filteredCount: 0, total: 0 };

/** Kết luận chuỗi hash — KHÔNG phải kết quả cổng quyền: các hàm đọc nhật ký
 * đều admin-only ở main, nên chúng trả `IpcResult<T>` bọc ngoài (xem
 * `shared/qc-api.d.ts`). */
export type ChainVerifyView = { ok: boolean; checked: number; legacy: number; brokenIndex: number; reason: string };

interface AuditState {
  result: ActivityPage;
  /** Thông báo khi main từ chối đọc nhật ký (vai trò không phải quản trị).
   * Giữ ở store thay vì nuốt lỗi: trang phải NÓI RA vì sao bảng trống, không
   * hiện "Không có dữ liệu phù hợp" cho một lỗi phân quyền. */
  error: string;
  query: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  load: () => Promise<void>;
  setQuery: (query: string) => void;
  setRange: (from: string, to: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  clearFilters: () => void;
  exportCsv: () => Promise<IpcResult<string>>;
  previewArchive: (months: 12 | 24 | 36) => Promise<IpcResult<ActivityArchivePreview>>;
  verifyChainNow: () => Promise<IpcResult<ChainVerifyView>>;
  archive: (months: 12 | 24 | 36) => Promise<IpcResult<{ removedCount: number; retainedCount: number; cutoffIso: string }>>;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  result: EMPTY_PAGE,
  error: '',
  query: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 25,

  load: async () => {
    const { query, from, to, page, pageSize } = get();
    const result = await window.qcApi.queryActivity({ query, from, to, page, pageSize });
    if (!result.ok) { set({ result: EMPTY_PAGE, error: result.error.message }); return; }
    set({ result: result.data, error: '' });
  },
  setQuery: (query) => { set({ query, page: 1 }); get().load(); },
  setRange: (from, to) => { set({ from, to, page: 1 }); get().load(); },
  setPage: (page) => { set({ page }); get().load(); },
  setPageSize: (pageSize) => { set({ pageSize, page: 1 }); get().load(); },
  clearFilters: () => { set({ query: '', from: '', to: '', page: 1 }); get().load(); },
  // Bản CSV nghiệp vụ là toàn bộ chuỗi audit, không theo bộ lọc đang xem.
  exportCsv: () => window.qcApi.exportActivityCsv({}),
  previewArchive: (months) => window.qcApi.previewArchiveActivity({ data: { months } }),
  verifyChainNow: () => window.qcApi.verifyActivityChainNow(),
  archive: async (months) => {
    const result = await window.qcApi.archiveActivity({ data: { months } });
    if (result.ok) await get().load();
    return result;
  },
}));

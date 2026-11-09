// Danh mục dùng chung (máy, xét nghiệm, lô, nhóm lô, Panel, TEa tham chiếu,
// tóm tắt xét nghiệm) — tự nạp khi trang mở và tự nạp lại khi đúng bảng nó
// phụ thuộc đổi (kế hoạch kiến trúc D.3). Trước 2026-09-26 mỗi trang tự chép
// danh sách bảng cần nghe, và nhiều trang chép thiếu: Nhập QC chỉ nạp danh mục
// lô/nhóm lô/Panel một lần lúc mở, nên quản trị viên đổi lô trên máy chính
// thì cây và cột nhập của KTV ở máy trạm vẫn giữ dữ liệu cũ.
//
// State vẫn ở `manage-store`/`westgard-store`; hook này chỉ gom việc nạp và
// danh sách bảng về MỘT nơi.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useManageStore } from '../store/manage-store';
import { useWestgardStore } from '../store/westgard-store';

/** Các bảng mà `listTestSummaries` đọc hoặc dùng để đánh giá Westgard: điểm,
 * xét nghiệm, Mean/SD, máy (tên hiển thị), lô, nhóm lô, Panel, chuyển lô,
 * luật chung (`app_meta`) và mốc khắc phục (`actions`). */
export const SUMMARY_TABLES = ['qc_points', 'tests', 'test_levels', 'instruments', 'nce_cuts', 'qc_lots', 'lot_groups', 'qc_panels', 'qc_panel_tests', 'lot_transitions', 'app_meta'];

const CATALOG = {
  instruments: { tables: ['instruments'], load: () => useManageStore.getState().loadInstruments() },
  tests: { tables: ['tests'], load: () => useManageStore.getState().loadTests() },
  // Lưu nhóm lô ghi lại `qc_lots.group_id`, nên hai danh mục này nghe cả hai bảng.
  lots: { tables: ['qc_lots', 'lot_groups'], load: () => useManageStore.getState().loadLots() },
  lotGroups: { tables: ['lot_groups', 'qc_lots'], load: () => useManageStore.getState().loadLotGroups() },
  panels: { tables: ['qc_panels', 'qc_panel_tests'], load: () => useManageStore.getState().loadPanels() },
  teaRefs: { tables: ['tea_refs'], load: () => useManageStore.getState().loadTeaRefs() },
  summaries: { tables: SUMMARY_TABLES, load: () => useWestgardStore.getState().loadSummaries() },
} satisfies Record<string, { tables: readonly string[]; load: () => unknown }>;

export type CatalogKey = keyof typeof CATALOG;

/** Bảng mà một danh mục phụ thuộc — để test và trang khác đối chiếu. */
export function catalogTables(key: CatalogKey): readonly string[] {
  return CATALOG[key].tables;
}

/** Danh mục đã nạp thành công ít nhất một lần trong phiên: quay lại trang thì
 * dữ liệu trong store đã có, không hiện "Đang tải…" lần nữa. */
const loadedOnce = new Set<CatalogKey>();

/** Trạng thái lần nạp đầu (và lần "Thử lại"). Trang dùng nó để không báo
 * "Chưa có xét nghiệm" khi dữ liệu còn đang về hoặc nạp lỗi (U30, đánh giá
 * 2026-11-09): store khởi tạo mảng rỗng nên không phân biệt được "rỗng thật"
 * với "chưa nạp". Lần nạp lại do thay đổi dữ liệu không đổi trạng thái này. */
export interface CatalogStatus {
  state: 'loading' | 'ready' | 'error';
  error: string;
  retry: () => void;
}

export function useCatalog(keys: readonly CatalogKey[]): CatalogStatus {
  const keysKey = keys.join(',');
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const [status, setStatus] = useState<{ state: CatalogStatus['state']; error: string }>(
    () => ({ state: keys.every((key) => loadedOnce.has(key)) ? 'ready' : 'loading', error: '' }));
  const attempt = useRef(0);
  const loadAll = useCallback(async () => {
    const mine = ++attempt.current;
    const current = keysRef.current;
    if (!current.every((key) => loadedOnce.has(key))) setStatus({ state: 'loading', error: '' });
    const results = await Promise.allSettled(current.map(async (key) => { await CATALOG[key].load(); loadedOnce.add(key); }));
    if (mine !== attempt.current) return;
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    setStatus(failed
      ? { state: 'error', error: failed.reason instanceof Error ? failed.reason.message : String(failed.reason) }
      : { state: 'ready', error: '' });
  }, []);
  useEffect(() => {
    void loadAll();
    return window.qcApi.onStoreChanged((payload) => {
      // Mỗi danh mục nạp lại đúng một lần cho một thông báo, và chỉ khi bảng
      // nó phụ thuộc có trong thông báo đó.
      for (const key of keysRef.current) {
        if (CATALOG[key].tables.some((table) => payload.tables.includes(table))) void CATALOG[key].load();
      }
    });
  }, [keysKey, loadAll]);
  // Unmount giữa chừng: kết quả của lần nạp cũ không ghi vào state nữa.
  useEffect(() => () => { attempt.current++; }, []);
  return { ...status, retry: () => { void loadAll(); } };
}

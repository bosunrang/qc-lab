// Danh mục dùng chung (máy, xét nghiệm, lô, nhóm lô, Panel, TEa tham chiếu,
// tóm tắt xét nghiệm) — tự nạp khi trang mở và tự nạp lại khi đúng bảng nó
// phụ thuộc đổi (kế hoạch kiến trúc D.3). Trước 2026-09-26 mỗi trang tự chép
// danh sách bảng cần nghe, và nhiều trang chép thiếu: Nhập QC chỉ nạp danh mục
// lô/nhóm lô/Panel một lần lúc mở, nên quản trị viên đổi lô trên máy chính
// thì cây và cột nhập của KTV ở máy trạm vẫn giữ dữ liệu cũ.
//
// State vẫn ở `manage-store`/`westgard-store`; hook này chỉ gom việc nạp và
// danh sách bảng về MỘT nơi.
import { useEffect, useRef } from 'react';
import { useManageStore } from '../store/manage-store';
import { useWestgardStore } from '../store/westgard-store';

/** Các bảng mà `listTestSummaries` đọc hoặc dùng để đánh giá Westgard: điểm,
 * xét nghiệm, Mean/SD, máy (tên hiển thị), lô, nhóm lô, Panel, chuyển lô,
 * luật chung (`app_meta`) và mốc khắc phục (`actions`). */
export const SUMMARY_TABLES = ['qc_points', 'tests', 'test_levels', 'instruments', 'actions', 'qc_lots', 'lot_groups', 'qc_panels', 'qc_panel_tests', 'lot_transitions', 'app_meta'];

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

export function useCatalog(keys: readonly CatalogKey[]): void {
  const keysKey = keys.join(',');
  const keysRef = useRef(keys);
  keysRef.current = keys;
  useEffect(() => {
    for (const key of keysRef.current) void CATALOG[key].load();
    return window.qcApi.onStoreChanged((payload) => {
      // Mỗi danh mục nạp lại đúng một lần cho một thông báo, và chỉ khi bảng
      // nó phụ thuộc có trong thông báo đó.
      for (const key of keysRef.current) {
        if (CATALOG[key].tables.some((table) => payload.tables.includes(table))) void CATALOG[key].load();
      }
    });
  }, [keysKey]);
}

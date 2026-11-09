// Ô chọn xét nghiệm có tìm kiếm, dùng chung cho Báo cáo và Phân tích Westgard
// (kế hoạch kiến trúc D.8). Trước 2026-11-06 là hai ô "tìm nhanh" + "chọn xét
// nghiệm"; nay gõ thẳng vào ô chọn (`SearchSelect`, cùng ô ở Ngoại kiểm), tìm
// không dấu trên nhãn và từ khoá phụ (LOT, máy…). Lựa chọn được giữ ở
// `useTestSelection` của trang gọi.
import { useMemo } from 'react';
import { SearchSelect } from './SearchSelect';
import type { SearchSelectOption } from '../lib/search-options';

export interface TestPickerProps<T> {
  items: readonly T[];
  selectedId: string;
  onSelect: (id: string) => void;
  idOf: (item: T) => string;
  labelOf: (item: T) => string;
  /** Từ khoá tìm thêm ngoài nhãn (LOT, máy…). */
  keywordsOf?: (item: T) => string;
  id: string;
  label: string;
  placeholder?: string;
  countId?: string;
}

export function TestPicker<T>({ items, selectedId, onSelect, idOf, labelOf, keywordsOf, id, label, placeholder = 'Gõ tên xét nghiệm…', countId }: TestPickerProps<T>) {
  const options = useMemo(() => items.map((item): SearchSelectOption => ({
    value: idOf(item), label: labelOf(item), keywords: keywordsOf?.(item),
  })), [items]); // eslint-disable-line react-hooks/exhaustive-deps -- các hàm nhãn là hàm thuần theo `items`
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span id={countId} className="hint">({items.length})</span></label>
      <SearchSelect id={id} value={selectedId} options={options} onChange={onSelect} ariaLabel={label} placeholder={placeholder} />
    </div>
  );
}

// Hai ô "tìm nhanh" + "chọn xét nghiệm" dùng chung cho Báo cáo và Phân tích
// Westgard (kế hoạch kiến trúc D.8). Mỗi trang giữ id, nhãn và chữ gợi ý của
// mình; phần lọc/chọn nằm ở `useTestSelection`.
export interface TestPickerProps<T> {
  selection: { query: string; setQuery: (value: string) => void; matched: readonly T[]; selectedId: string; select: (id: string) => void };
  total: number;
  idOf: (item: T) => string;
  labelOf: (item: T) => string;
  searchId: string;
  searchLabel: string;
  searchPlaceholder: string;
  selectId: string;
  selectLabel: string;
  selectAriaLabel: string;
  countId?: string;
}

export function TestPicker<T>({ selection, total, idOf, labelOf, searchId, searchLabel, searchPlaceholder, selectId, selectLabel, selectAriaLabel, countId }: TestPickerProps<T>) {
  const { query, setQuery, matched, selectedId, select } = selection;
  return (
    <>
      <div className="field">
        <label htmlFor={searchId}>{searchLabel}</label>
        <input id={searchId} type="search" placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={selectId}>{selectLabel} <span id={countId} className="hint">({matched.length}/{total})</span></label>
        <select id={selectId} aria-label={selectAriaLabel} disabled={!matched.length} value={matched.length ? selectedId : ''} onChange={(e) => select(e.target.value)}>
          {matched.length
            ? matched.map((item) => <option key={idOf(item)} value={idOf(item)}>{labelOf(item)}</option>)
            : <option value="">Không tìm thấy xét nghiệm phù hợp</option>}
        </select>
      </div>
    </>
  );
}

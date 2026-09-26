// Chọn một xét nghiệm từ danh sách có ô tìm nhanh — dùng chung cho Báo cáo và
// Phân tích Westgard (kế hoạch kiến trúc D.8). Trước 2026-09-26 mỗi trang tự
// viết một bản, và bản ở Westgard chỉ hạ chữ thường nên gõ "dien giai" không
// tìm được "Điện giải"; Báo cáo thì tìm không dấu.
import { useEffect, useMemo, useState } from 'react';

/** Chuẩn hoá để tìm: bỏ dấu tiếng Việt (kể cả đ/Đ), hạ chữ thường. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export interface TestSelectionOptions<T> {
  items: readonly T[];
  idOf: (item: T) => string;
  /** Chuỗi được tìm trong đó (tên, LOT, máy…). */
  searchTextOf: (item: T) => string;
  /** Không còn mục nào khớp thì giữ lựa chọn cũ thay vì bỏ trống. Westgard
   * cần vậy để vùng phân tích không trắng trong lúc người dùng đang gõ. */
  keepWhenNoMatch?: boolean;
}

export function useTestSelection<T>({ items, idOf, searchTextOf, keepWhenNoMatch = false }: TestSelectionOptions<T>) {
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState('');
  const matched = useMemo(() => {
    const needle = normalizeSearch(query);
    return needle ? items.filter((item) => normalizeSearch(searchTextOf(item)).includes(needle)) : items.slice();
  }, [items, query]); // eslint-disable-line react-hooks/exhaustive-deps
  // Lựa chọn luôn là một mục ĐANG có trong danh sách đã lọc; mất khỏi danh
  // sách thì nhảy về mục đầu. Nếu không, ô chọn nhìn trống nhưng trang vẫn
  // hiện xét nghiệm cũ — một trạng thái mâu thuẫn dễ gây nhầm lẫn.
  const selectedId = matched.some((item) => idOf(item) === chosenId)
    ? chosenId
    : matched.length ? idOf(matched[0]) : keepWhenNoMatch ? chosenId : '';
  useEffect(() => { if (selectedId !== chosenId) setChosenId(selectedId); }, [selectedId, chosenId]);
  return { query, setQuery, matched, selectedId, select: setChosenId };
}

// Giữ xét nghiệm đang chọn cho Báo cáo và Phân tích Westgard (kế hoạch kiến
// trúc D.8). Phần tìm kiếm nằm trong ô chọn (`TestPicker` → `SearchSelect`),
// nên ở đây chỉ còn bảo đảm lựa chọn luôn là một mục đang có trong danh sách.
import { useEffect, useState } from 'react';

/** Chuẩn hoá để tìm: bỏ dấu tiếng Việt (kể cả đ/Đ), hạ chữ thường. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export interface TestSelectionOptions<T> {
  items: readonly T[];
  idOf: (item: T) => string;
}

export function useTestSelection<T>({ items, idOf }: TestSelectionOptions<T>) {
  const [chosenId, setChosenId] = useState('');
  // Mục đã chọn mất khỏi danh sách (bị xoá, ngừng vận hành) thì nhảy về mục
  // đầu, để ô chọn và vùng phân tích không lệch nhau.
  const selectedId = items.some((item) => idOf(item) === chosenId)
    ? chosenId
    : items.length ? idOf(items[0]) : '';
  useEffect(() => { if (selectedId !== chosenId) setChosenId(selectedId); }, [selectedId, chosenId]);
  return { selectedId, select: setChosenId };
}

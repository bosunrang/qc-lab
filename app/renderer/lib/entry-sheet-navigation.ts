import type { KeyboardEvent } from 'react';

// Điều hướng bàn phím trong bảng nhập QC ("Bảng nhập QC" trang Nhập QC) —
// port `entry-sheet-navigation.ts`/`entry-sheet-input-order.ts`/
// `entry-sheet-focus.ts` app cũ: ArrowLeft/ArrowRight/Tab di chuyển NGANG
// (giữa các cột mức QC cùng ngày), ArrowUp/ArrowDown/Enter di chuyển DỌC
// (giữa các ngày trong cùng 1 cột mức) — Enter LUÔN xuống hàng dưới, quay
// vòng về đầu cột khi đang ở hàng cuối, đúng luồng "gõ rồi Enter, xuống
// dòng liên tục" của bảng tính. Đọc trực tiếp `dataset.focusDate`/
// `.focusLevel` của phần tử input đang gõ, giống hệt cách app cũ đọc DOM
// (không qua React state) — bảng này vốn đã uncontrolled (xem `RunSlot`).
// `focusColumn` phân biệt cột lô chính và cột lô song song cùng một mức;
// fallback `focusLevel` giữ tương thích với các ô/test cũ.
export type EntrySheetKey = 'ArrowLeft' | 'ArrowRight' | 'Tab' | 'ArrowUp' | 'ArrowDown' | 'Enter';

const SUPPORTED_KEYS: readonly string[] = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function isSheetNavigationKey(key: string): key is EntrySheetKey {
  return SUPPORTED_KEYS.includes(key);
}

/** Sắp mọi ô đang cho gõ theo đúng thứ tự (ngày, mức) — nguồn `available`
 * dùng chung cho cả 2 chiều di chuyển. */
export function sheetInputOrder(inputs: readonly HTMLInputElement[]): HTMLInputElement[] {
  return [...inputs].sort((a, b) =>
    (a.dataset.focusDate || '').localeCompare(b.dataset.focusDate || '', 'vi', { numeric: true })
    || Number(a.dataset.focusColumnOrder ?? a.dataset.focusLevel ?? 0) - Number(b.dataset.focusColumnOrder ?? b.dataset.focusLevel ?? 0));
}

function focusColumn(el: HTMLInputElement): string {
  return el.dataset.focusColumn || el.dataset.focusLevel || '';
}

export function sheetNavigationTarget(
  inputs: readonly HTMLInputElement[], current: HTMLInputElement, key: EntrySheetKey, shiftKey = false,
): HTMLInputElement | null {
  if (!inputs.length || !inputs.includes(current)) return null;
  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab') {
    const row = inputs.filter((el) => el.dataset.focusDate === current.dataset.focusDate);
    const index = row.indexOf(current);
    const step = key === 'ArrowLeft' || (key === 'Tab' && shiftKey) ? -1 : 1;
    if (index < 0 || row.length < 2) return null;
    return key === 'Tab' ? row[(index + step + row.length) % row.length] : row[index + step] || null;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
    const column = inputs.filter((el) => focusColumn(el) === focusColumn(current));
    const index = column.indexOf(current);
    const step = key === 'ArrowUp' ? -1 : 1;
    if (index < 0 || column.length < 2) return null;
    return key === 'Enter' ? column[(index + 1) % column.length] : column[index + step] || null;
  }
  return null;
}

/** Trong nhóm ô cùng ngày+mức (có thể còn ô cũ chưa kịp gỡ giữa 2 lượt vẽ),
 * ưu tiên ô còn TRỐNG (`.empty`) — port `entry-sheet-focus.ts`. */
export function pickSheetFocusCandidate(candidates: readonly HTMLInputElement[]): HTMLInputElement | null {
  return candidates.find((el) => el.classList.contains('empty')) || candidates[0] || null;
}

/** Ô đang gõ hiện tại → tính Ô KẾ TIẾP theo phím, rồi CHỜ 1 tick (để React
 * vẽ lại xong sau khi `blur()` kích hoạt lưu) và focus lại đúng ô đó bằng
 * `date+level` (không giữ tham chiếu DOM cũ — commit có thể làm ô đổi
 * `run-id`/unmount-remount, phải tra lại DOM sau khi vẽ xong, giống hệt
 * `entryFocusPendingSheet()` app cũ). */
export function handleSheetKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!isSheetNavigationKey(event.key)) return;
  const current = event.currentTarget;
  const inputs = sheetInputOrder(
    [...document.querySelectorAll<HTMLInputElement>('.qc-sheet .qc-inline-input')].filter((el) => !el.disabled && el.offsetParent !== null),
  );
  const next = sheetNavigationTarget(inputs, current, event.key, event.shiftKey);
  if (!next) return;
  event.preventDefault();
  const pendingDate = next.dataset.focusDate;
  const pendingLevel = next.dataset.focusLevel;
  const pendingColumn = focusColumn(next);
  current.blur();
  setTimeout(() => {
    const candidates = [...document.querySelectorAll<HTMLInputElement>('.qc-sheet .qc-inline-input')]
      .filter((el) => el.dataset.focusDate === pendingDate
        && focusColumn(el) === pendingColumn
        && (!pendingColumn || el.dataset.focusLevel === pendingLevel));
    const el = pickSheetFocusCandidate(candidates);
    if (el) { el.focus(); el.select(); }
  }, 0);
}

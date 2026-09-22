import type { KeyboardEvent } from 'react';

// Điều hướng bàn phím trong CÂY danh mục nội kiểm (trang Nhập QC) — cặp còn
// lại của `entry-sheet-navigation.ts` (bảng nhập). Trước bản này mọi `.tnode`
// đều KHÔNG focus được: cả cây chỉ dùng được bằng chuột.
//
// Luồng thao tác tham khảo `entryTreeKey()` app cũ, nhưng viết mới theo cây
// của app:
//   • Enter / Space  → kích hoạt nút đang focus (mở-đóng nhóm, hoặc chọn xét
//                      nghiệm) — chính là cú click.
//   • ArrowRight     → MỞ nhóm đang đóng;  ArrowLeft → ĐÓNG nhóm đang mở.
//   • ArrowUp/Down   → đi giữa các nút đang thấy, QUAY VÒNG ở hai đầu.
//   • Home / End     → về nút đầu / cuối.
// Nút MÁY (`.tn-machine`) và nhóm lô đều mở/đóng được; vì vậy cả hai nhận
// focus và dùng chung Enter/Space/mũi tên với nút xét nghiệm. Danh sách điều
// hướng lấy theo `[tabindex="0"]`, không phải mọi `.tnode`.
export type EntryTreeCommand = 'toggle' | 'navigate' | null;
export type EntryTreeNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

const NAVIGATION_KEYS: readonly string[] = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

/** Phím → việc cần làm, dựa trên `aria-expanded` của chính nút đang focus
 * ('true' | 'false' | null cho nút lá). Mũi tên trái/phải chỉ có nghĩa khi nó
 * ĐỔI được trạng thái: ArrowRight trên nhóm đã mở (hay trên nút lá) không
 * được nuốt phím rồi đóng nhóm lại. */
export function entryTreeKeyCommand(key: string, expanded: string | null): EntryTreeCommand {
  if (key === 'Enter' || key === ' ') return 'toggle';
  if (key === 'ArrowRight' && expanded === 'false') return 'toggle';
  if (key === 'ArrowLeft' && expanded === 'true') return 'toggle';
  return NAVIGATION_KEYS.includes(key) ? 'navigate' : null;
}

export function isTreeNavigationKey(key: string): key is EntryTreeNavigationKey {
  return NAVIGATION_KEYS.includes(key);
}

/** Nút kế tiếp theo phím. ArrowUp/ArrowDown QUAY VÒNG (cây thường dài hơn màn
 * hình; dừng câm ở nút cuối làm người dùng tưởng bàn phím hỏng), Home/End thì
 * không. `items` là danh sách nút ĐANG THẤY theo đúng thứ tự DOM. */
export function treeNavigationTarget<T>(
  items: readonly T[] | null | undefined, current: T, key: EntryTreeNavigationKey,
): T | null {
  const visible = items || [];
  const index = visible.indexOf(current);
  if (index < 0 || !visible.length) return null;
  if (key === 'Home') return visible[0] || null;
  if (key === 'End') return visible[visible.length - 1] || null;
  const step = key === 'ArrowDown' ? 1 : -1;
  return visible[(index + step + visible.length) % visible.length] || null;
}

/** Các nút của cây đang THẤY, theo thứ tự DOM. Lọc `offsetParent` để bỏ nút
 * của nhóm vừa đóng và cả cây khi panel bị thu gọn. */
export function visibleTreeNodes(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.tree .tnode[tabindex="0"]')].filter((el) => el.offsetParent !== null);
}

/** Gắn vào `onKeyDown` của từng nút cây. Không cần focus lại sau khi vẽ như
 * bảng nhập: mở-đóng nhóm hay chọn xét nghiệm đều giữ nguyên chính nút đang
 * focus (React tái dùng node nhờ `key`), chỉ phần con bên dưới đổi. */
export function handleTreeKeyDown(event: KeyboardEvent<HTMLElement>): void {
  if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  const current = event.currentTarget;
  const command = entryTreeKeyCommand(event.key, current.getAttribute('aria-expanded'));
  if (!command) return;
  event.preventDefault();
  if (command === 'toggle') { current.click(); return; }
  if (!isTreeNavigationKey(event.key)) return;
  const target = treeNavigationTarget(visibleTreeNodes(), current, event.key);
  target?.focus();
}

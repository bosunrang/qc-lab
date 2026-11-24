// Quyết định phím Enter trong modal có được coi là "bấm nút chính" hay không.
// Tách khỏi `Modal.tsx` thành hàm thuần (chỉ đọc vài trường của sự kiện) để
// test thẳng trên `.ts`, cùng cách `entry-sheet-navigation.ts` làm.
export interface ModalEnterEvent {
  key: string;
  defaultPrevented: boolean;
  isComposing: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: { tagName?: string; isContentEditable?: boolean } | null;
}

/** Các cổng loại trừ, mỗi cổng là một lỗi thật nếu thiếu:
 *  - `isComposing`: bộ gõ tiếng Việt (Telex/VNI) dùng Enter để chốt ký tự
 *    đang gõ. Thiếu cổng này thì đang gõ giữa từ mà modal tự lưu.
 *  - `defaultPrevented`: ô nào tự xử lý Enter rồi (gợi ý tên xét nghiệm ở
 *    Cấu hình chung, thêm cặp mẫu ở So sánh hoá chất, ô ngày, ô năm của lịch)
 *    thì handler của nó chạy TRƯỚC (bubble từ trong ra) và đã `preventDefault`
 *    — tôn trọng, không lưu đè lên.
 *  - `textarea`/`contenteditable`: Enter ở đó là xuống dòng.
 *  - `button`/`a`: Enter đã là "bấm chính nó".
 *  - `option`: danh sách `select` chạy ở chế độ `appearance:base-select`
 *    (app.css) nên khi đang mở, focus nằm trên chính thẻ `option` và Enter là
 *    "chọn mục này". Thiếu cổng này thì Enter bấm luôn nút Lưu, còn
 *    `preventDefault` của modal làm mục không được chọn. Ô `select` đang ĐÓNG
 *    (target là `SELECT`) vẫn lưu form như trước.
 *  - Có phím bổ trợ: Ctrl/Shift+Enter… để dành cho việc khác, không lưu. */
export function modalEnterSubmits(event: ModalEnterEvent): boolean {
  if (event.key !== 'Enter' || event.defaultPrevented) return false;
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  const tag = event.target?.tagName;
  if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'OPTION') return false;
  return !event.target?.isContentEditable;
}

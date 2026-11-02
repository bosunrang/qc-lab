// Chỉ ra ô nhập sai khi lưu biểu mẫu thất bại (U7 của đánh giá 2026-10-31).
// Trước đây lỗi chỉ hiện một dòng ở đầu form, người dùng phải tự đoán ô nào
// sai. Main trả mã lỗi ổn định (`missing-name`, `duplicate-name`…); mỗi form
// khai một bảng mã lỗi → tên ô, rồi `useInvalidField` đánh dấu `aria-invalid`,
// nối ô với dòng lỗi qua `aria-describedby` và đưa con trỏ về ô đó.
//
// Phần chọn ô là hàm THUẦN để test thẳng trên `.ts`; phần chạm DOM chỉ dùng
// vài phương thức tối thiểu của phần tử nên test được bằng đối tượng giả.

/** Mã lỗi → tên ô. Nhiều tên thì chọn ô ĐẦU TIÊN còn trống (vd thiếu một
 * trong hai ngày), không ô nào trống thì lấy tên đầu. */
export type FieldErrorMap = Readonly<Record<string, string | readonly string[]>>;

/** Lỗi đang hiện trên form. `fields` rỗng = lỗi chung, không gắn ô nào.
 * Mỗi lần lưu thất bại tạo đối tượng MỚI nên lưu lại vẫn sai cùng chỗ thì ô
 * vẫn được đánh dấu và focus lại. */
export interface FormError {
  message: string;
  fields: readonly string[];
}

/** Lỗi IPC (`result.error`) → lỗi form kèm ô ứng viên theo bảng mã. */
export function formErrorFrom(error: { code?: string; message: string }, map: FieldErrorMap): FormError {
  const mapped = error.code && Object.prototype.hasOwnProperty.call(map, error.code) ? map[error.code] : undefined;
  return { message: error.message, fields: mapped == null ? [] : typeof mapped === 'string' ? [mapped] : [...mapped] };
}

/** Lỗi do chính form phát hiện trước khi gọi main. */
export function formError(message: string, field?: string | null): FormError {
  return { message, fields: field ? [field] : [] };
}

/** Chọn ô cần đánh dấu. `valueOf(name)` trả giá trị hiện tại của ô, `null`
 * khi form không có ô đó (vd ô chỉ hiện ở một chế độ). */
export function pickField(fields: readonly string[], valueOf: (name: string) => string | null): string | null {
  const present = fields.filter((name) => valueOf(name) !== null);
  return present.find((name) => valueOf(name)!.trim() === '') ?? present[0] ?? null;
}

/** Thêm/bớt một id trong danh sách id cách nhau bằng khoảng trắng (thuộc tính
 * `aria-describedby` có thể đã có sẵn mô tả khác của ô). */
export function addIdToken(list: string | null, id: string): string {
  const ids = (list || '').split(/\s+/).filter(Boolean);
  return ids.includes(id) ? ids.join(' ') : [...ids, id].join(' ');
}
export function removeIdToken(list: string | null, id: string): string | null {
  const ids = (list || '').split(/\s+/).filter((item) => item && item !== id);
  return ids.length ? ids.join(' ') : null;
}

/** Phần tối thiểu của một ô nhập mà `markInvalidField` dùng tới. */
export interface FieldControl {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  focus(): void;
}

/** Sự kiện coi như người dùng đã sửa ô. `qc-field-edit` là sự kiện `DateField`
 * phát khi chọn ngày trên lịch (trùng `FIELD_EDIT_EVENT` của `modal-close.ts`;
 * viết thẳng để file này không kéo theo module khác). */
const EDIT_EVENTS = ['input', 'change', 'qc-field-edit'] as const;

/** Đánh dấu ô sai, nối với dòng lỗi `errorId` (bỏ qua khi rỗng) và focus vào
 * ô. Người dùng sửa ô thì tự gỡ dấu. Trả hàm gỡ — gọi khi lỗi đổi hoặc mất;
 * gọi nhiều lần vẫn an toàn. */
export function markInvalidField(control: FieldControl, errorId: string): () => void {
  let active = true;
  const unmark = () => {
    if (!active) return;
    active = false;
    for (const type of EDIT_EVENTS) control.removeEventListener(type, unmark);
    control.removeAttribute('aria-invalid');
    if (errorId) {
      const rest = removeIdToken(control.getAttribute('aria-describedby'), errorId);
      if (rest) control.setAttribute('aria-describedby', rest); else control.removeAttribute('aria-describedby');
    }
  };
  control.setAttribute('aria-invalid', 'true');
  if (errorId) control.setAttribute('aria-describedby', addIdToken(control.getAttribute('aria-describedby'), errorId));
  for (const type of EDIT_EVENTS) control.addEventListener(type, unmark);
  control.focus();
  return unmark;
}

/** Tìm ô theo `name` (form dùng `FormData`) hoặc `data-field` (ô điều khiển
 * bằng state, không có `name`). Bỏ qua ô ẩn và ô bị khoá; ô ngày của
 * `DateField` mang `name` trên ô `type=date` ẩn nên trả về ô chữ người dùng
 * thật sự gõ. */
export function findFieldControl(root: ParentNode, field: string): HTMLElement | null {
  const candidates = [...root.querySelectorAll<HTMLElement>('[name], [data-field]')]
    .filter((el) => el.getAttribute('name') === field || el.getAttribute('data-field') === field);
  for (const el of candidates) {
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
    if ((el as HTMLInputElement).disabled) continue;
    if (el.classList.contains('native-date')) {
      const text = el.closest('.datebox')?.querySelector<HTMLElement>('input.date-text');
      if (text) return text;
    }
    return el;
  }
  return null;
}

/** Giá trị hiện tại của ô để `pickField` biết ô nào còn trống. */
export function controlValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) return el.checked ? el.value : '';
  return 'value' in el ? String((el as HTMLInputElement).value ?? '') : '';
}

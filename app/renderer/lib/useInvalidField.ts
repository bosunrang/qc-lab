// Gắn lỗi lưu form vào đúng ô sai (U7 của đánh giá 2026-10-31). Logic chọn ô
// và đánh dấu nằm ở `field-error.ts`; hook này chỉ chạy nó mỗi khi lỗi đổi.
import { useEffect, useId, type RefObject } from 'react';
import { controlValue, findFieldControl, markInvalidField, pickField, type FormError } from './field-error';

/** Trả id cho lời nhắc lỗi (`FormErrorMessage` hoặc thông báo dưới ô đã có).
 * Mỗi lỗi mới có ô ứng viên thì ô đó được đánh dấu `aria-invalid`, nối với
 * dòng lỗi qua `aria-describedby` và nhận focus; lỗi đổi hoặc mất thì gỡ dấu
 * cũ, người dùng sửa ô thì tự gỡ. `rootRef` là form (hoặc khối) chứa các ô. */
export function useInvalidField(rootRef: RefObject<ParentNode | null>, error: FormError | null): string {
  const errorId = useId();
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !error?.fields.length) return;
    const field = pickField(error.fields, (name) => {
      const control = findFieldControl(root, name);
      return control ? controlValue(control) : null;
    });
    const control = field ? findFieldControl(root, field) : null;
    return control ? markInvalidField(control, errorId) : undefined;
  }, [error, errorId, rootRef]);
  return errorId;
}

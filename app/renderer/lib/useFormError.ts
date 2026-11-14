import { useRef, useState } from 'react';
import { controlValue, findFieldControl, formErrorFrom, pickField, type FieldErrorMap, type FormError } from './field-error';
import { useInvalidField } from './useInvalidField';

/** Nối lỗi có mã ổn định vào đúng ô của một biểu mẫu. Trả `false` cho lỗi
 * không gắn với ô để bên gọi chuyển sang hộp thoại thao tác chung. */
export function useFormError(fieldMap: FieldErrorMap) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<FormError | null>(null);
  const errorId = useInvalidField(rootRef, error);

  function handle(input: { code?: string; message: string }): boolean {
    const root = rootRef.current;
    if (!root || !root.isConnected || root.closest('[hidden]')) return false;
    const mapped = formErrorFrom(input, fieldMap);
    const field = pickField(mapped.fields, (name) => {
      const control = findFieldControl(root, name);
      return control ? controlValue(control) : null;
    });
    if (!field) return false;
    setError({ message: mapped.message, fields: [field] });
    return true;
  }

  return { rootRef, error, errorId, clear: () => setError(null), set: (next: FormError) => setError(next), handle };
}

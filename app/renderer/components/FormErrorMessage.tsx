import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { controlValue, findFieldControl, pickField, type FormError } from '../lib/field-error';

/** Đặt lời nhắc trong chính trường đang bị đánh dấu lỗi. Portal giữ nội dung
 * do React quản lý, không di chuyển ô nhập hoặc làm mất dữ liệu biểu mẫu. */
export function FormErrorMessage({ rootRef, error, id }: {
  rootRef: RefObject<ParentNode | null>; error: FormError | null; id: string;
}) {
  const [placement, setPlacement] = useState<{ error: FormError; target: HTMLElement | null } | null>(null);
  const [editedError, setEditedError] = useState<FormError | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !error) { setPlacement(null); return; }
    const field = pickField(error.fields, (name) => {
      const control = findFieldControl(root, name);
      return control ? controlValue(control) : null;
    });
    const control = field ? findFieldControl(root, field) : null;
    const container = control?.closest<HTMLElement>('.field, td, [role="group"], [role="radiogroup"], [data-field-container], .target-row') ?? null;
    setPlacement({ error, target: container && root.contains(container) ? container : null });
    if (!control) return;
    const hide = () => setEditedError(error);
    const events = ['input', 'change', 'qc-field-edit'];
    for (const event of events) control.addEventListener(event, hide);
    return () => { for (const event of events) control.removeEventListener(event, hide); };
  }, [rootRef, error]);

  if (!error || editedError === error || placement?.error !== error) return null;
  const message = <p id={id} className="field-error" role="alert">{error.message}</p>;
  return placement.target ? createPortal(message, placement.target) : message;
}

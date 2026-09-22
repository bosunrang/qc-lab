import type { ButtonHTMLAttributes } from 'react';

type RowActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  kind: 'edit' | 'delete';
  label: string;
};

function PencilIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>;
}

/** Nút Sửa/Xóa gọn trong hàng dữ liệu, đồng bộ mẫu `.row-action` của app Cost. */
export function RowActionButton({ kind, label, className = '', title, type = 'button', ...props }: RowActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`row-action${kind === 'delete' ? ' is-danger' : ''}${className ? ` ${className}` : ''}`}
      title={title || label}
      aria-label={props['aria-label'] || label}
    >
      {kind === 'edit' ? <PencilIcon /> : <TrashIcon />}
    </button>
  );
}

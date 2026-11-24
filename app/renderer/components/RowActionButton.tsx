import type { ButtonHTMLAttributes, ReactNode } from 'react';

const ICON_PATHS = {
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  delete: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
  key: <path d="M15.5 3a5.5 5.5 0 0 0-5.1 7.6L3 18v3h4v-3h3v-3l2.9-2.9A5.5 5.5 0 1 0 15.5 3ZM16 8h.01" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="11" rx="3" /><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" /><circle cx="12" cy="16" r="1.35" fill="currentColor" stroke="none" /></>,
  unlock: <><rect x="4.5" y="10.5" width="15" height="11" rx="3" /><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0" /><circle cx="12" cy="16" r="1.35" fill="currentColor" stroke="none" /></>,
} satisfies Record<string, ReactNode>;

type RowActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  kind: keyof typeof ICON_PATHS;
  label: string;
};

/** Nút có biểu tượng trong hàng dữ liệu, dùng nhãn chung cho chú giải và trình đọc màn hình. */
export function RowActionButton({ kind, label, className = '', title, type = 'button', ...props }: RowActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`row-action${kind === 'delete' ? ' is-danger' : ''}${className ? ` ${className}` : ''}`}
      title={title || label}
      aria-label={props['aria-label'] || label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICON_PATHS[kind]}
      </svg>
    </button>
  );
}



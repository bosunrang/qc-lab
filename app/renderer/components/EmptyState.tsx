// Thông báo trống dùng chung cho toàn app: tiêu đề, lời giải thích và hành
// động tuỳ chọn. Thông báo nằm thẳng trên bề mặt của khối chứa nó (panel, thẻ
// mức, modal) nên KHÔNG có viền hay nền riêng — một hộp xám có viền lồng
// trong panel trắng đọc thành hai lớp viền. Mọi trang dùng component này thay
// vì tự dựng `.empty`/`.analysis-empty-state`; design-system.test.mjs chặn
// việc dựng lại kiểu riêng.
//
// Có `icon` thì thông báo chuyển sang bố cục ngang: icon trong vòng tròn bên
// trái, chữ canh trái bên phải. Dùng cho chỗ đang chờ dữ liệu để vẽ biểu đồ
// hoặc kết luận (Sigma, So sánh hoá chất) — trước 2026-09-25 mỗi trang tự
// dựng một bản với vòng 36px và 48px, bản Sigma còn có viền đứt nét và nền xám.
import type { ReactNode } from 'react';

export type EmptyStateSize = 'page' | 'compact';
export type EmptyStateTone = 'accent' | 'info';

export function EmptyState({ title, children, action, size = 'page', icon, kicker, tone = 'accent', className }: {
  title?: ReactNode;
  /** Lời giải thích hoặc hướng dẫn bước tiếp theo. */
  children?: ReactNode;
  /** Nút hoặc liên kết hành động, đặt dưới lời giải thích. */
  action?: ReactNode;
  /** `page`: thay cho cả nội dung của một panel/thẻ. `compact`: nằm trong danh
   * sách, bảng hoặc bộ chọn, chỉ đệm vừa đủ. */
  size?: EmptyStateSize;
  /** SVG minh hoạ; cỡ do CSS đặt (--icon-lg), không tự đặt width/height. */
  icon?: ReactNode;
  /** Dòng chữ hoa nhỏ phía trên tiêu đề, chỉ dùng cùng `icon`. */
  kicker?: ReactNode;
  /** Màu vòng tròn chứa icon. */
  tone?: EmptyStateTone;
  /** Chỉ dùng cho bố cục (margin, lưới) của trang chứa; không đổi viền/nền. */
  className?: string;
}) {
  const text = <>
    {kicker ? <span className="empty-notice-kicker">{kicker}</span> : null}
    {title ? <b className="empty-notice-title">{title}</b> : null}
    {children ? <div className="empty-notice-text">{children}</div> : null}
    {action ? <div className="empty-notice-actions">{action}</div> : null}
  </>;
  return (
    <div className={['empty-notice', `empty-notice-${size}`, icon ? `empty-notice-media tone-${tone}` : '', className].filter(Boolean).join(' ')}>
      {icon ? <>
        <span className="empty-notice-icon" aria-hidden="true">{icon}</span>
        <div className="empty-notice-body">{text}</div>
      </> : text}
    </div>
  );
}

// Thông báo trống dùng chung cho toàn app: tiêu đề, lời giải thích và hành
// động tuỳ chọn. Thông báo nằm thẳng trên bề mặt của khối chứa nó (panel, thẻ
// mức, modal) nên KHÔNG có viền hay nền riêng — một hộp xám có viền lồng
// trong panel trắng đọc thành hai lớp viền. Mọi trang dùng component này thay
// vì tự dựng `.empty`/`.analysis-empty-state`; design-system.test.mjs chặn
// việc dựng lại kiểu riêng.
//
// Chỉ MỘT hình thức: không icon, không dòng chữ hoa phía trên. Trước
// 2026-09-25 biểu đồ Sigma trống và "Chưa đủ dữ liệu để kết luận" của So sánh
// hoá chất có icon trong vòng tròn và bố cục ngang riêng; nay dùng chung kiểu này.
import type { ReactNode } from 'react';

export type EmptyStateSize = 'page' | 'compact';

export function EmptyState({ title, children, action, size = 'page', className }: {
  title?: ReactNode;
  /** Lời giải thích hoặc hướng dẫn bước tiếp theo. */
  children?: ReactNode;
  /** Nút hoặc liên kết hành động, đặt dưới lời giải thích. */
  action?: ReactNode;
  /** `page`: thay cho cả nội dung của một panel/thẻ. `compact`: nằm trong danh
   * sách, bảng hoặc bộ chọn, chỉ đệm vừa đủ. */
  size?: EmptyStateSize;
  /** Chỉ dùng cho bố cục (margin, lưới) của trang chứa; không đổi viền/nền. */
  className?: string;
}) {
  return (
    <div className={['empty-notice', `empty-notice-${size}`, className].filter(Boolean).join(' ')}>
      {title ? <b className="empty-notice-title">{title}</b> : null}
      {children ? <div className="empty-notice-text">{children}</div> : null}
      {action ? <div className="empty-notice-actions">{action}</div> : null}
    </div>
  );
}

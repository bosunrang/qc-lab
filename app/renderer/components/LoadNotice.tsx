// Thông báo "đang tải" / "không tải được" thay cho nội dung một trang khi dữ
// liệu chưa về (U30, đánh giá 2026-11-09). Trước đây trang dựng ngay từ mảng
// rỗng của store nên báo "Chưa có xét nghiệm" kèm nút thêm mới — người dùng
// tưởng dữ liệu đã mất. Cùng kiểu với Tổng quan, Khắc phục sự cố và Ngoại kiểm:
// `EmptyState` trong panel, lỗi thì có nút "Thử lại".
import { EmptyState } from './EmptyState';

export function LoadNotice({ state, error, what, onRetry }: {
  state: 'loading' | 'error';
  error?: string;
  /** Tên dữ liệu đang nạp, viết thường: "danh mục xét nghiệm". */
  what: string;
  onRetry: () => void;
}) {
  if (state === 'loading') {
    return <div className="panel"><EmptyState title={`Đang tải ${what}…`} /></div>;
  }
  return (
    <div className="panel" role="alert">
      <EmptyState title={`Không tải được ${what}`}
        action={<button type="button" className="btn teal" onClick={onRetry}>Thử lại</button>}>
        Dữ liệu đã lưu không bị ảnh hưởng.{error ? ` Nội dung lỗi: ${error}` : ''}
      </EmptyState>
    </div>
  );
}

// Chặn lỗi hiển thị trong từng trang. Trước đây một lỗi render (dữ liệu lạ,
// thiếu trường) làm React gỡ cả cây và cửa sổ app trắng trơn, phải tắt mở
// lại. Nay chỉ vùng nội dung của trang đó hiện thông báo; thanh bên vẫn dùng
// được để sang trang khác.
//
// `resetKey` đổi (chuyển trang) thì tự bỏ trạng thái lỗi, để trang mới không
// bị kẹt thông báo của trang cũ.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { sendClientError } from '../lib/unhandled-errors';

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Lỗi hiển thị trang', error, info.componentStack);
    const withComponents = new Error(`Lỗi hiển thị trang: ${error.message}`);
    withComponents.stack = `${error.stack || ''}
Component:${info.componentStack || ''}`;
    sendClientError(withComponents);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private readonly retry = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="panel" role="alert">
        <EmptyState
          title="Trang này gặp lỗi khi hiển thị"
          action={<>
            <button type="button" className="btn teal sm" onClick={this.retry}>Thử lại</button>
            <button type="button" className="btn ghost sm" onClick={() => window.location.reload()}>Tải lại ứng dụng</button>
          </>}
        >
          Dữ liệu đã lưu không bị ảnh hưởng. Bấm Thử lại, hoặc chọn trang khác ở thanh bên. Nếu lỗi lặp lại, báo quản trị viên kèm nội dung: {error.message || 'không có mô tả'}.
        </EmptyState>
      </section>
    );
  }
}

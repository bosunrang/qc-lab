// Chạy một thao tác bất đồng bộ (lưu, huỷ, nhập…) và khoá nó cho tới khi xong
// (U7 của đánh giá 2026-10-31). Trước đây phần lớn modal không khoá nút: bấm
// đúp "Lưu" — hoặc bấm thêm vì máy chậm — gửi hai lần ghi và tạo hai bản ghi
// trùng.
//
// Thời gian khoá tính cả các hộp thoại chen giữa (xác nhận, xác thực lại mật
// khẩu) vì chúng nằm trong cùng Promise của thao tác. Nằm trong `Modal` thì
// báo cho modal biết đang bận: modal không đóng giữa chừng. Form dùng
// `useAsyncAction` ở component cha thì truyền `busy` cho `Modal`.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

/** Modal cung cấp; nút ngoài modal thì không có. */
export const ModalBusyContext = createContext<((busy: boolean) => void) | null>(null);

/** `run()` bỏ qua lần gọi mới khi lần trước chưa xong. Dùng ref chứ không chỉ
 * state: hai cú bấm (hoặc Enter + bấm) trong cùng một khung hình đều thấy
 * `busy === false` của lần render trước. */
export function useAsyncAction<A extends unknown[]>(action: (...args: A) => unknown, onBusyChange?: (busy: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const actionRef = useRef(action);
  useEffect(() => { actionRef.current = action; }, [action]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const run = useCallback(async (...args: A) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      await actionRef.current(...args);
    } finally {
      runningRef.current = false;
      onBusyChange?.(false);
      // Lưu xong thường đóng luôn modal: component đã bị gỡ thì không đặt state.
      if (mountedRef.current) setBusy(false);
    }
  }, [onBusyChange]);

  return { busy, run };
}

/** Nút của một thao tác bất đồng bộ: khoá chính nó và hiện `busyLabel` trong
 * lúc chạy. */
export function AsyncButton({ onClick, children, busyLabel = 'Đang xử lý…', disabled, type = 'button', ...rest }:
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> & {
    onClick: () => unknown;
    children: ReactNode;
    /** Nhãn hiện trong lúc chạy. */
    busyLabel?: ReactNode;
  }) {
  const reportBusy = useContext(ModalBusyContext);
  const { busy, run } = useAsyncAction(onClick, reportBusy ?? undefined);
  return (
    <button {...rest} type={type} disabled={disabled || busy} aria-busy={busy || undefined} onClick={() => { void run(); }}>
      {busy ? busyLabel : children}
    </button>
  );
}

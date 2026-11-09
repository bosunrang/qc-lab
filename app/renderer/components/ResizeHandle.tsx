// Thanh kéo đổi độ rộng cột danh sách bên trái, dùng chung cho Phân tích ngoại
// kiểm và cây danh mục ở Nhập QC. Thanh chỉ đo vị trí con trỏ so với mép trái
// của khung cần đổi rồi báo độ rộng mong muốn; trang gọi tự giới hạn khoảng
// cho phép và áp độ rộng. Phím ← → đổi mỗi lần 20px, Home/End về hẹp/rộng nhất.
//
// Đánh giá giao diện 09/11/2026 (U27, P18): trình đọc màn hình luôn đọc được
// độ rộng hiện tại (cả khi khung còn tự co giãn, chưa kéo lần nào) và giới hạn
// THẬT lúc đó (trần theo bề ngang cửa sổ, không chỉ con số cố định); kéo chuột
// gom theo khung hình để không đặt state và đo lại bố cục ở mọi pointermove;
// độ rộng đã chọn được nhớ qua `useStoredWidth`.
import { useEffect, useRef, useState, type RefObject } from 'react';

const KEY_STEP = 20;

export function ResizeHandle({ targetRef, label, value, min, max, maxNow, onResize, className }: {
  /** Khung bị đổi độ rộng; mép trái của nó là gốc để tính độ rộng mới. */
  targetRef: RefObject<HTMLElement | null>;
  label: string;
  /** Độ rộng đang áp; bỏ trống khi khung còn tự co giãn theo nội dung. */
  value?: number;
  min: number;
  max: number;
  /** Trần thật ở thời điểm hiện tại (vd 42% bề ngang trang), ≤ `max`. */
  maxNow?: () => number;
  onResize: (width: number) => void;
  className?: string;
}) {
  const rect = () => targetRef.current?.getBoundingClientRect();
  // Độ rộng đo được của khung — dùng cho `aria-valuenow` khi chưa có `value`,
  // và để tính lại trần khi cửa sổ đổi cỡ.
  const [measured, setMeasured] = useState<number>();
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    // Đo ngay một lần: ResizeObserver chỉ báo theo khung hình, cửa sổ đang ẩn
    // thì chưa báo gì và thanh kéo không có giá trị cho trình đọc màn hình.
    setMeasured(Math.round(target.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setMeasured(Math.round(target.getBoundingClientRect().width)));
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);
  const limit = Math.round(Math.max(min, Math.min(max, maxNow ? maxNow() : max)));
  const now = value ?? measured;

  const frame = useRef(0);
  const pendingX = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const scheduleResize = (clientX: number) => {
    pendingX.current = clientX;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      onResize(pendingX.current - (rect()?.left ?? 0));
    });
  };

  return (
    <div className={className ? `resize-handle ${className}` : 'resize-handle'} role="separator" aria-label={label}
      aria-orientation="vertical" tabIndex={0} aria-valuemin={min} aria-valuemax={limit}
      aria-valuenow={now == null ? undefined : Math.min(now, limit)}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scheduleResize(e.clientX); }}
      onPointerUp={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onKeyDown={(e) => {
        const current = rect()?.width ?? min;
        const next = e.key === 'ArrowRight' ? current + KEY_STEP
          : e.key === 'ArrowLeft' ? current - KEY_STEP
          : e.key === 'Home' ? min
          : e.key === 'End' ? limit
          : null;
        if (next == null) return;
        e.preventDefault();
        onResize(next);
      }}
      title="Kéo để đổi độ rộng · phím ← → · Home/End" />
  );
}

/** Độ rộng do người dùng chọn, nhớ theo `key` giữa các lần mở trang. Đọc/ghi
 * localStorage trong try/catch: chế độ riêng tư hoặc bị chặn thì chỉ không nhớ. */
export function useStoredWidth(key: string, fallback?: number): [number | undefined, (width: number) => void] {
  const [width, setWidthState] = useState<number | undefined>(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return Number.isFinite(saved) && saved > 0 ? saved : fallback;
    } catch { return fallback; }
  });
  const setWidth = (next: number) => {
    setWidthState(next);
    try { localStorage.setItem(key, String(next)); } catch { /* không nhớ được thì thôi */ }
  };
  return [width, setWidth];
}

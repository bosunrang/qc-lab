// Thanh kéo đổi độ rộng khung, dùng chung cho Phân tích ngoại kiểm và cây
// danh mục ở Nhập QC. Trang gọi tự giới hạn khoảng cho phép và áp độ rộng.
// Phím ← → dịch đường chia mỗi lần 20px, Home/End về khung hẹp/rộng nhất.
//
// Đánh giá giao diện 09/11/2026 (U27, P18): trình đọc màn hình luôn đọc được
// độ rộng hiện tại (cả khi khung còn tự co giãn, chưa kéo lần nào) và giới hạn
// THẬT lúc đó (trần theo bề ngang cửa sổ, không chỉ con số cố định); kéo chuột
// gom theo khung hình để không đặt state và đo lại bố cục ở mọi pointermove;
// độ rộng đã chọn được nhớ qua `useStoredWidth`.
import { useEffect, useRef, useState, type RefObject } from 'react';

const KEY_STEP = 20;

export function ResizeHandle({ targetRef, label, value, min, max, maxNow, onResize, className, edge = 'right' }: {
  /** Khung bị đổi độ rộng. */
  targetRef: RefObject<HTMLElement | null>;
  /** Mép đặt thanh kéo: khung bên phải được kéo từ mép trái. */
  edge?: 'left' | 'right';
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
  const [measured, setMeasured] = useState<{ width: number }>();
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    // Đo ngay một lần: ResizeObserver chỉ báo theo khung hình, cửa sổ đang ẩn
    // thì chưa báo gì và thanh kéo không có giá trị cho trình đọc màn hình.
    const measure = () => setMeasured({ width: Math.round(target.getBoundingClientRect().width) });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    // Trần có thể đổi khi khung bao co lại, dù khung con vẫn giữ cùng độ rộng.
    if (target.parentElement) observer.observe(target.parentElement);
    return () => observer.disconnect();
  }, [targetRef]);
  const limit = Math.round(Math.max(min, Math.min(max, maxNow ? maxNow() : max)));
  const now = value ?? measured?.width;

  const frame = useRef(0);
  const pendingX = useRef(0);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const direction = edge === 'right' ? 1 : -1;
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const finishDrag = () => { cancelAnimationFrame(frame.current); frame.current = 0; drag.current = null; };
  const scheduleResize = (clientX: number) => {
    pendingX.current = clientX;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (drag.current) onResize(drag.current.width + (pendingX.current - drag.current.x) * direction);
    });
  };

  return (
    <div className={className ? `resize-handle ${className}` : 'resize-handle'} role="separator" aria-label={label}
      aria-orientation="vertical" tabIndex={0} aria-valuemin={min} aria-valuemax={limit}
      aria-valuenow={now == null ? undefined : Math.max(min, Math.min(now, limit))}
      onPointerDown={(e) => {
        const width = rect()?.width;
        if (e.button !== 0 || width == null) return;
        e.preventDefault();
        drag.current = { x: e.clientX, width };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scheduleResize(e.clientX); }}
      onPointerUp={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        if (drag.current) onResize(drag.current.width + (e.clientX - drag.current.x) * direction);
        finishDrag();
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
      onKeyDown={(e) => {
        const current = rect()?.width ?? min;
        const next = e.key === 'ArrowRight' ? current + KEY_STEP * direction
          : e.key === 'ArrowLeft' ? current - KEY_STEP * direction
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

// Thanh kéo đổi độ rộng cột danh sách bên trái, dùng chung cho Phân tích ngoại
// kiểm và cây danh mục ở Nhập QC. Thanh chỉ đo vị trí con trỏ so với mép trái
// của khung cần đổi rồi báo độ rộng mong muốn; trang gọi tự giới hạn khoảng
// cho phép và áp độ rộng. Phím ← → đổi mỗi lần 20px.
import type { RefObject } from 'react';

const KEY_STEP = 20;

export function ResizeHandle({ targetRef, label, value, min, max, onResize, className }: {
  /** Khung bị đổi độ rộng; mép trái của nó là gốc để tính độ rộng mới. */
  targetRef: RefObject<HTMLElement | null>;
  label: string;
  /** Độ rộng đang áp; bỏ trống khi khung còn tự co giãn theo nội dung. */
  value?: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  className?: string;
}) {
  const rect = () => targetRef.current?.getBoundingClientRect();
  return (
    <div className={className ? `resize-handle ${className}` : 'resize-handle'} role="separator" aria-label={label}
      aria-orientation="vertical" tabIndex={0} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onResize(e.clientX - (rect()?.left ?? 0)); }}
      onPointerUp={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        onResize((rect()?.width ?? min) + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP));
      }}
      title="Kéo để đổi độ rộng · phím ← →" />
  );
}

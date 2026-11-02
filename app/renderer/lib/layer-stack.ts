// Ngăn xếp các lớp phủ đang mở: modal, hộp xác nhận/xác thực lại, lịch chọn
// ngày (U3 của đánh giá 2026-10-31). Trước đây mỗi lớp tự gắn một bộ nghe Esc
// lên `document`, nên một lần bấm Esc đóng CẢ lịch lẫn modal chứa nó, hoặc cả
// hộp xác nhận lẫn modal bên dưới. Nay chỉ có một bộ nghe, và Esc chỉ đến lớp
// trên cùng.
//
// Logic thuần (không đụng DOM) nằm ở `LayerStack` và `escapeTargetsLayer()` để
// test thẳng trên `.ts`; `registerLayer()` chỉ nối chúng vào `document`.

export interface EscapeEventLike {
  key: string;
  defaultPrevented: boolean;
  isComposing: boolean;
  target: { tagName?: string } | null;
}

/** Esc có thuộc về lớp trên cùng không. Bỏ qua khi:
 *  - một ô bên trong đã tự xử lý Esc và `preventDefault()` (vd đóng danh sách
 *    gợi ý tên xét nghiệm);
 *  - bộ gõ tiếng Việt đang ghép chữ;
 *  - danh sách `select` đang mở (focus nằm trên `option`): Esc là đóng danh
 *    sách đó, không phải đóng modal. */
export function escapeTargetsLayer(event: EscapeEventLike): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return false;
  return String(event.target?.tagName || '').toUpperCase() !== 'OPTION';
}

export class LayerStack {
  private layers: { id: number; onEscape: () => void }[] = [];
  private nextId = 1;

  push(onEscape: () => void): number {
    const id = this.nextId++;
    this.layers.push({ id, onEscape });
    return id;
  }

  remove(id: number): void {
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }

  isTop(id: number): boolean {
    return this.layers[this.layers.length - 1]?.id === id;
  }

  /** Gửi Esc tới lớp trên cùng; `false` khi không có lớp nào mở. */
  escape(): boolean {
    const top = this.layers[this.layers.length - 1];
    if (!top) return false;
    top.onEscape();
    return true;
  }
}

const stack = new LayerStack();
let listening = false;

/** Đăng ký một lớp vừa mở. `onEscape` chỉ được gọi khi lớp này đang ở trên
 * cùng. Gọi `release()` khi lớp đóng. */
export function registerLayer(onEscape: () => void): { id: number; isTop: () => boolean; release: () => void } {
  if (!listening && typeof document !== 'undefined') {
    listening = true;
    document.addEventListener('keydown', (event) => {
      if (!escapeTargetsLayer({ key: event.key, defaultPrevented: event.defaultPrevented, isComposing: event.isComposing, target: event.target as HTMLElement | null })) return;
      if (stack.escape()) { event.preventDefault(); event.stopPropagation(); }
    });
  }
  const id = stack.push(onEscape);
  return { id, isTop: () => stack.isTop(id), release: () => stack.remove(id) };
}

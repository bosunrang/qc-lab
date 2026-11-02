// Quyết định khi người dùng muốn đóng một modal (U3, U7 của đánh giá
// 2026-10-31). Tách khỏi `Modal.tsx` thành hàm thuần để test thẳng trên `.ts`.

/** Nguồn yêu cầu đóng. Nút "Hủy/Đóng" ở chân form gọi thẳng `onClose` của
 * modal (người dùng chủ ý bỏ), nên không đi qua đây. */
export type ModalCloseSource = 'escape' | 'close-button' | 'backdrop';

export interface ModalCloseState {
  /** Đang chạy thao tác của nút chính (`AsyncButton`). */
  busy: boolean;
  /** Người dùng đã gõ/chọn trong form từ lúc mở. */
  dirty: boolean;
  /** Modal có hỏi trước khi bỏ thay đổi không (`guardUnsaved`). */
  guarded: boolean;
}

/** - `ignore`: đang lưu — đóng giữa chừng thì người dùng không thấy kết quả
 *   hay lỗi của lần lưu, và dễ bấm mở lại rồi lưu lần nữa.
 * - `confirm`: form đã sửa — hỏi "Bỏ thay đổi chưa lưu?" thay vì lặng lẽ mất.
 * - `close`: đóng ngay như trước. */
export function decideModalClose(state: ModalCloseState): 'close' | 'confirm' | 'ignore' {
  if (state.busy) return 'ignore';
  if (state.dirty && state.guarded) return 'confirm';
  return 'close';
}

/** Sự kiện do `DateField` phát khi người dùng chọn ngày trên lịch: lịch nằm
 * ngoài khung modal nên không có sự kiện `input` nào nổi bọt qua modal. */
export const FIELD_EDIT_EVENT = 'qc-field-edit';

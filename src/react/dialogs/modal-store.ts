import { createStore } from 'zustand/vanilla';
import type { ReactNode } from 'react';

/**
 * #modalRoot (form trang: sửa Panel QC, sửa user, quy trình NCE...) — cùng
 * chiến lược strangler-fig đã dùng cho toàn bộ React-island migration: một
 * component React (ModalOverlay.tsx) sở hữu VĨNH VIỄN #modalRoot ngay từ
 * lát chuyển đầu tiên, nhưng vẫn nhận nội dung ở HAI dạng — 'html' (chuỗi
 * cũ từ modalTemplate()/*-html.ts, cho ~16 modal CHƯA chuyển) và 'react'
 * (component thật, cho modal ĐÃ chuyển) — nên có thể chuyển từng modal một
 * mà không bao giờ có hai nơi cùng ghi vào #modalRoot (đúng bài học từ
 * reauthenticateCurrentUser/#dialogRoot). openModal(html) giữ đúng chữ ký
 * cũ nên ~17 caller classic khác không cần sửa cho tới lượt chúng.
 */
export type ModalState =
  | { kind: 'none' }
  | { kind: 'html'; html: string }
  | { kind: 'react'; render: () => ReactNode };

export const modalStore = createStore<ModalState>(() => ({ kind: 'none' }));

export function openModal(html: string): void {
  modalStore.setState({ kind: 'html', html });
}

export function openReactModal(render: () => ReactNode): void {
  modalStore.setState({ kind: 'react', render });
}

export function closeModal(): void {
  modalStore.setState({ kind: 'none' });
}

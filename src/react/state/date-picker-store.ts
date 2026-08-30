import { createStore } from 'zustand/vanilla';

/**
 * Thay vn-date-picker-controller.ts cũ (dựng popup lịch bằng chuỗi HTML, tự
 * quản lý một singleton #vnDatePicker gắn vào document.body) bằng store
 * Zustand thuần + component React thật (DatePickerPopup.tsx, render qua
 * #datePickerRoot — cùng mẫu #dialogRoot/#modalRoot ở Giai đoạn 3). Chỉ MỘT
 * popup lịch có thể mở cùng lúc trên toàn ứng dụng (đúng hành vi bản cũ).
 * Store chỉ giữ tham chiếu DOM tới ô đang mở (box/input/native) — KHÔNG giữ
 * "giá trị" ngày trong state React, vì các ô ngày trong toàn app vẫn cố tình
 * để uncontrolled (defaultValue, đọc qua DOM lúc submit/onBlur) — pick() ghi
 * thẳng vào input/native ref rồi gọi callback, không cần dispatch sự kiện
 * DOM giả để "đánh lừa" React nữa (khác bản cũ, vì bản cũ còn phải tương
 * thích với action-dispatcher.ts's data-action-on="change").
 */
export type DatePickerMode = 'day' | 'month';

export type DatePickerState = {
  open: boolean;
  box: HTMLElement | null;
  input: HTMLInputElement | null;
  native: HTMLInputElement | null;
  onPicked: ((value: string) => void) | null;
  view: Date;
  mode: DatePickerMode;
};

export const datePickerStore = createStore<DatePickerState>(() => ({
  open: false, box: null, input: null, native: null, onPicked: null, view: new Date(), mode: 'day',
}));

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd nếu hợp lệ (kiểm cả ngày tràn tháng, vd 31/02), ngược lại ''. */
export function validIsoDate(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  return year >= 1000 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${pad(month)}-${pad(day)}` : '';
}

/** Nhận dd/mm/yyyy hoặc yyyy-mm-dd, trả yyyy-mm-dd hợp lệ hoặc ''. */
export function parseFlexibleDate(value: unknown): string {
  const text = String(value || '').trim();
  let match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (match) return validIsoDate(+match[3], +match[2], +match[1]);
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return match ? validIsoDate(+match[1], +match[2], +match[3]) : '';
}

/** yyyy-mm-dd -> dd/mm/yyyy (rỗng nếu không đúng dạng ISO). */
export function isoToDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function openDatePicker(box: HTMLElement, input: HTMLInputElement, native: HTMLInputElement | null, onPicked: (value: string) => void): void {
  if (input.disabled || input.readOnly) return;
  const iso = parseFlexibleDate(input.value) || (native && native.value) || todayIso();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return;
  datePickerStore.setState({ open: true, box, input, native, onPicked, view: new Date(+match[1], +match[2] - 1, 1), mode: 'day' });
}

export function closeDatePicker(): void {
  datePickerStore.setState({ open: false, box: null, input: null, native: null, onPicked: null });
}

export function movePickerMonth(delta: number): void {
  const { view } = datePickerStore.getState();
  datePickerStore.setState({ view: new Date(view.getFullYear(), view.getMonth() + delta, 1) });
}

export function setPickerMode(mode: DatePickerMode): void {
  datePickerStore.setState({ mode });
}

export function setPickerYear(value: unknown): void {
  const { view } = datePickerStore.getState();
  const year = Math.min(9999, Math.max(1000, parseInt(String(value), 10) || new Date().getFullYear()));
  datePickerStore.setState({ view: new Date(year, view.getMonth(), 1) });
}

export function setPickerMonth(monthIndex: number): void {
  const { view } = datePickerStore.getState();
  datePickerStore.setState({ view: new Date(view.getFullYear(), monthIndex, 1), mode: 'day' });
}

export function pickDate(iso: string): void {
  const { input, native, onPicked } = datePickerStore.getState();
  if (!input) return;
  const display = isoToDisplayDate(iso);
  input.value = display;
  if (native) native.value = iso;
  closeDatePicker();
  onPicked?.(display);
}

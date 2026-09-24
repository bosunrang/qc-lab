import { createStore } from 'zustand/vanilla';

export type DatePickerMode = 'day' | 'month';

export interface DatePickerState {
  open: boolean;
  box: HTMLElement | null;
  input: HTMLInputElement | null;
  native: HTMLInputElement | null;
  onPicked: ((iso: string) => void) | null;
  view: Date;
  mode: DatePickerMode;
}

export const datePickerStore = createStore<DatePickerState>(() => ({
  open: false, box: null, input: null, native: null, onPicked: null, view: new Date(), mode: 'day',
}));

const pad = (value: number) => String(value).padStart(2, '0');

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

/** yyyy-mm-dd → dd/mm/yyyy (rỗng nếu không đúng dạng ISO). */
export function isoToDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function openDatePicker(
  box: HTMLElement, input: HTMLInputElement, native: HTMLInputElement | null, onPicked: (iso: string) => void,
): void {
  if (input.disabled || input.readOnly) return;
  const iso = parseFlexibleDate(input.value) || (native && native.value) || todayIso();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return;
  datePickerStore.setState({
    open: true, box, input, native, onPicked, view: new Date(+match[1], +match[2] - 1, 1), mode: 'day',
  });
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

/** Chọn 1 ngày: ghi dd/mm/yyyy vào ô văn bản, ISO vào ô ẩn, đóng popup rồi
 * gọi callback với ISO (chế độ có điều khiển cần ISO để set state). */
export function pickDate(iso: string): void {
  const { input, native, onPicked } = datePickerStore.getState();
  if (!input) return;
  input.value = isoToDisplayDate(iso);
  if (native) native.value = iso;
  closeDatePicker();
  onPicked?.(iso);
}



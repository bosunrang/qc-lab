// Lịch chọn ngày TỰ VẼ — port `src/react/components/DatePickerPopup.tsx` của
// app cũ (xem lý do port ở đầu `state/date-picker-store.ts`). Mount đúng 1
// lần trong `AppShell`, portal vào `#datePickerRoot` (cùng mẫu #modalRoot/
// #dialogRoot). `position:fixed; z-index:1400` nên nổi trên cả modal (1000)
// và dialog (1100) — ô ngày nằm trong modal vẫn chọn được.
//
// KHÁC app cũ đúng 1 chi tiết, có lý do: app cũ phải dùng id `#reactDatePicker`
// để tránh đụng singleton `#vnDatePicker` của bản cổ điển còn sống song song.
// app-v2 không có bản cổ điển nào, nên dùng thẳng id `#vnDatePicker` như
// nguyên bản.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import {
  datePickerStore, closeDatePicker, movePickerMonth, setPickerMode, setPickerYear,
  setPickerMonth, pickDate, validIsoDate, parseFlexibleDate, todayIso,
} from '../state/date-picker-store';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function DatePickerPopup() {
  const state = useStore(datePickerStore);
  const popupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!state.open || !state.box || !popupRef.current) return;
    const rect = state.box.getBoundingClientRect();
    const popup = popupRef.current;
    const width = 258;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - popup.offsetHeight - 8);
    popup.style.left = `${left}px`;
    popup.style.top = `${Math.max(8, top)}px`;
  }, [state.open, state.box, state.view, state.mode]);

  useEffect(() => {
    if (!state.open) return;
    // `mousedown` (KHÔNG phải `click`) — BUG THẬT bắt được khi lịch mở lồng
    // trong modal (vd modal "Thêm lô QC"): `Modal.tsx` đóng modal ngay ở
    // bước `mousedown` trên nền tối. Nếu bộ dò "bấm ra ngoài" của popup này
    // còn nghe `click` (bắn SAU `mousedown`), thì khi bấm ra ngoài cả hai —
    // modal đã đóng và gỡ luôn ô input neo lịch khỏi DOM ngay trong bước
    // mousedown, nên sự kiện `click` kế tiếp KHÔNG CÒN đường nổi bọt lên
    // `document` nữa (trình duyệt không phát click cho một node đã rời cây
    // DOM) — `onDocClick` không bao giờ chạy, lịch bị "mồ côi" và nổi lại
    // trên nền đã tối, phải bấm thêm 1 lần nữa (lúc này không còn modal chắn
    // đường) mới đóng được. Dùng CÙNG loại sự kiện với Modal.tsx (mousedown)
    // để cả hai đóng trong CÙNG một lượt xử lý, trước khi bất kỳ DOM nào bị
    // gỡ — đúng cách app "Quản lý cước phí" (DateInput.tsx) đã làm.
    const onDocMouseDown = (event: MouseEvent) => {
      // composedPath() (KHÔNG phải target.closest()): một click bên trong
      // popup có thể tự đổi mode (vd chọn tháng) khiến React render lại và GỠ
      // NGAY nút vừa bấm khỏi DOM trong lúc sự kiện còn đang nổi bọt — lúc đó
      // target đã rời cây DOM nên .closest() luôn trả null, bị hiểu nhầm
      // thành "click ra ngoài" và tự đóng popup dù click ở bên trong.
      // composedPath() chốt đường đi ngay lúc phát sự kiện.
      const path = event.composedPath() as EventTarget[];
      if (path.some((node) => node instanceof HTMLElement
        && (node.id === 'vnDatePicker' || node.classList.contains('datebox')))) return;
      closeDatePicker();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDatePicker(); };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [state.open]);

  const root = typeof document === 'undefined' ? null : document.getElementById('datePickerRoot');
  if (!state.open || !root) return null;

  const year = state.view.getFullYear();
  const month = state.view.getMonth();

  if (state.mode === 'month') {
    return createPortal(
      <div id="vnDatePicker" className="vn-date-picker" ref={popupRef}>
        <div className="vn-date-head">
          <button type="button" onClick={() => setPickerYear(year - 1)} title="Năm trước">‹</button>
          <button type="button" className="vn-date-title" onClick={() => setPickerMode('day')} title="Quay lại chọn ngày">Chọn tháng/năm</button>
          <button type="button" onClick={() => setPickerYear(year + 1)} title="Năm sau">›</button>
        </div>
        <div className="vn-year-row">
          <button type="button" onClick={() => setPickerYear(year - 1)}>-</button>
          <input id="vnPickerYear" type="number" min={1000} max={9999} defaultValue={year} inputMode="numeric"
            onChange={(event) => setPickerYear(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setPickerYear(event.currentTarget.value); } }} />
          <button type="button" onClick={() => setPickerYear(year + 1)}>+</button>
        </div>
        <div className="vn-month-grid">
          {MONTHS.map((name, index) => (
            <button type="button" key={name} className={index === month ? 'selected' : ''} onClick={() => setPickerMonth(index)}>{name}</button>
          ))}
        </div>
        <div className="vn-date-foot">
          <button type="button" onClick={() => pickDate(todayIso())}>Hôm nay</button>
          <button type="button" onClick={() => closeDatePicker()}>Đóng</button>
        </div>
      </div>, root);
  }

  const selected = state.input ? parseFlexibleDate(state.input.value) : '';
  const today = todayIso();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Tuần bắt đầu THỨ HAI (đúng app cũ): getDay() trả 0=CN nên +6 rồi %7.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: Array<{ key: string; day: number | null; iso: string }> = [];
  for (let index = 0; index < offset; index += 1) cells.push({ key: `blank-${index}`, day: null, iso: '' });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ key: `d-${day}`, day, iso: validIsoDate(year, month + 1, day) });

  return createPortal(
    <div id="vnDatePicker" className="vn-date-picker" ref={popupRef}>
      <div className="vn-date-head">
        <button type="button" onClick={() => movePickerMonth(-1)} title="Tháng trước">‹</button>
        <button type="button" className="vn-date-title" onClick={() => setPickerMode('month')} title="Chọn nhanh tháng/năm">{MONTHS[month]} {year}</button>
        <button type="button" onClick={() => movePickerMonth(1)} title="Tháng sau">›</button>
      </div>
      <div className="vn-date-days">{DAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="vn-date-grid">
        {cells.map((cell) => (cell.day === null
          ? <button type="button" key={cell.key} className="blank" tabIndex={-1} />
          : (
            <button type="button" key={cell.key}
              className={[cell.iso === selected ? 'selected' : '', cell.iso === today ? 'today' : ''].filter(Boolean).join(' ')}
              onClick={() => pickDate(cell.iso)}>{cell.day}</button>
          )))}
      </div>
      <div className="vn-date-foot">
        <button type="button" onClick={() => pickDate(today)}>Hôm nay</button>
        <button type="button" onClick={() => closeDatePicker()}>Đóng</button>
      </div>
    </div>, root);
}

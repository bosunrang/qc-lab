import { useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from 'zustand';
import {
  datePickerStore, closeDatePicker, movePickerMonth, setPickerMode, setPickerYear, setPickerMonth, pickDate, validIsoDate, parseFlexibleDate, todayIso,
} from '../state/date-picker-store';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/* Cổng React của vn-date-picker-controller.ts cũ (vẫn còn sống, phục vụ các
   trường ngày CHƯA chuyển đổi) — một popup duy nhất trên toàn app, mount một
   lần qua #datePickerRoot (giống #dialogRoot/#modalRoot ở Giai đoạn 3). Cố
   tình dùng id KHÁC (#reactDatePicker, không phải #vnDatePicker của bản cổ
   điển): hai hệ thống cùng tồn tại song song trong giai đoạn chuyển đổi này,
   và vn-date-picker-controller.ts's bind() tự ý remove()/ghi innerHTML lên
   BẤT KỲ phần tử nào trùng id #vnDatePicker mà nó tìm thấy — nếu dùng chung
   id, node do React sở hữu sẽ bị code cổ điển xóa/ghi đè ngoài luồng
   reconcile của React, gây lỗi "removeChild: not a child of this node" khi
   React sau đó cũng cố gỡ đúng node đó. Từng trường ngày khi chuyển đổi
   (DateField.tsx) cũng tự stopPropagation() trên .datepick để listener
   document-level của bản cổ điển không xử lý trùng — hai lớp bảo vệ độc lập
   cho cùng một rủi ro. Một khi TẤT CẢ trường ngày đã chuyển hết, xóa hẳn
   vn-date-picker-controller.ts và có thể đổi lại id nếu muốn (không bắt
   buộc). ui-workflow-check.js's "Date picker TypeScript đồng bộ ngày text
   và native" đọc theo id mới này khi kiểm trang đã chuyển. */
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
    const onDocClick = (e: MouseEvent) => {
      /* composedPath() (không phải target.closest()): một click bên trong
         popup có thể tự đổi mode (vd chọn tháng) khiến React render lại và
         GỠ NGAY nút vừa bấm khỏi DOM trong lúc sự kiện còn đang nổi bọt —
         lúc đó target đã rời cây DOM nên .closest() luôn trả null, hiểu
         nhầm thành "click ra ngoài" và tự đóng popup dù thực ra click ở bên
         trong. composedPath() chốt đường đi ngay lúc phát sự kiện nên không
         bị ảnh hưởng bởi thay đổi DOM xảy ra sau đó. */
      const path = e.composedPath() as HTMLElement[];
      if (path.some(node => node instanceof HTMLElement && (node.id === 'reactDatePicker' || node.classList?.contains('datebox')))) return;
      closeDatePicker();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDatePicker(); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [state.open]);

  if (!state.open) return null;

  const year = state.view.getFullYear();
  const month = state.view.getMonth();

  if (state.mode === 'month') {
    return (
      <div id="reactDatePicker" className="vn-date-picker" ref={popupRef}>
        <div className="vn-date-head">
          <button type="button" onClick={() => setPickerYear(year - 1)} title="Năm trước">‹</button>
          <button type="button" className="vn-date-title" onClick={() => setPickerMode('day')} title="Quay lại chọn ngày">Chọn tháng/năm</button>
          <button type="button" onClick={() => setPickerYear(year + 1)} title="Năm sau">›</button>
        </div>
        <div className="vn-year-row">
          <button type="button" onClick={() => setPickerYear(year - 1)}>-</button>
          <input id="vnPickerYear" type="number" min={1000} max={9999} defaultValue={year} inputMode="numeric"
            onChange={e => setPickerYear(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setPickerYear((e.target as HTMLInputElement).value); } }} />
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
      </div>
    );
  }

  const selected = state.input ? parseFlexibleDate(state.input.value) : '';
  const today = todayIso();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: Array<{ key: string; day: number | null; iso: string }> = [];
  for (let i = 0; i < offset; i++) cells.push({ key: `blank-${i}`, day: null, iso: '' });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ key: `d-${day}`, day, iso: validIsoDate(year, month + 1, day) });

  return (
    <div id="reactDatePicker" className="vn-date-picker" ref={popupRef}>
      <div className="vn-date-head">
        <button type="button" onClick={() => movePickerMonth(-1)} title="Tháng trước">‹</button>
        <button type="button" className="vn-date-title" onClick={() => setPickerMode('month')} title="Chọn nhanh tháng/năm">{MONTHS[month]} {year}</button>
        <button type="button" onClick={() => movePickerMonth(1)} title="Tháng sau">›</button>
      </div>
      <div className="vn-date-days">{DAYS.map(d => <span key={d}>{d}</span>)}</div>
      <div className="vn-date-grid">
        {cells.map(cell => cell.day === null
          ? <button type="button" key={cell.key} className="blank" tabIndex={-1}></button>
          : <button type="button" key={cell.key} className={[cell.iso === selected ? 'selected' : '', cell.iso === today ? 'today' : ''].filter(Boolean).join(' ')} onClick={() => pickDate(cell.iso)}>{cell.day}</button>)}
      </div>
      <div className="vn-date-foot">
        <button type="button" onClick={() => pickDate(today)}>Hôm nay</button>
        <button type="button" onClick={() => closeDatePicker()}>Đóng</button>
      </div>
    </div>
  );
}

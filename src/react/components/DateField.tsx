import { useRef } from 'react';
import { openDatePicker, parseFlexibleDate } from '../state/date-picker-store';

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={4} y={5} width={16} height={16} rx={2} /><path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

/* dd/mm/yyyy nếu value trông như yyyy-mm-dd ở đầu chuỗi, ngược lại giữ
   nguyên — khớp hệt vnDate()/createQcDateFormat cũ (đủ để hiện giá trị ban
   đầu; không cần phụ thuộc kernel vì đây là hàm thuần, tự chứa). */
function formatDisplay(value: unknown): string {
  if (!value) return '';
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

export type DateFieldProps = {
  id: string;
  value?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Gọi khi gõ xong rồi rời ô (blur, giống data-action-on="change" cho ô
      văn bản) HOẶC khi chọn ngày qua lịch — nhận giá trị dd/mm/yyyy hiện tại. */
  onChange?: (value: string) => void;
};

/* Thay dateBoxHtml()+dangerouslySetInnerHTML cũ bằng JSX thật — cùng cấu
   trúc DOM (.datebox > .date-text/.datepick/.native-date) nên CSS và
   ui-workflow-check.js's "Date picker TypeScript đồng bộ ngày text và
   native" không cần đổi gì. Cố tình giữ ô .date-text UNCONTROLLED
   (defaultValue) — mọi nơi gọi vẫn đọc document.getElementById(id).value
   lúc submit (saveConfigLot()...) hoặc nhận giá trị qua onChange lúc
   blur/chọn lịch, không có nơi nào cần React kiểm soát value trong lúc gõ. */
export function DateField({ id, value = '', className = '', disabled = false, ariaLabel, onChange }: DateFieldProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const iso = parseFlexibleDate(value);

  const openPicker = (e: React.MouseEvent) => {
    /* Chặn sự kiện nổi bọt tới document — vn-date-picker-controller.ts cổ
       điển (còn phục vụ các trường ngày CHƯA chuyển đổi) bind một listener
       click ở mức document, tra theo class .datepick/#vnDatePicker (không
       phân biệt React hay cổ điển) — nếu không chặn ở đây, listener đó sẽ
       chạy ĐỒNG THỜI với onClick này, tìm thấy #vnDatePicker (component này
       vừa mount) rồi tự tay ghi đè innerHTML/remove() nó — React sau đó
       reconcile trên một node đã bị gỡ ngoài luồng của mình, ném lỗi
       removeChild. Xem thêm marker data-react trên DatePickerPopup.tsx. */
    e.stopPropagation();
    if (disabled || !boxRef.current || !inputRef.current) return;
    openDatePicker(boxRef.current, inputRef.current, nativeRef.current, v => onChange?.(v));
  };

  return (
    <span className={`datebox ${className}`} ref={boxRef}>
      <input ref={inputRef} id={id} className="date-text" inputMode="numeric" defaultValue={formatDisplay(value)} placeholder="dd/mm/yyyy"
        disabled={disabled} aria-label={ariaLabel}
        onBlur={e => onChange?.(e.target.value)} />
      <span className="datepick" title="Chọn ngày" onClick={openPicker}><CalendarIcon /></span>
      <input ref={nativeRef} className="native-date" type="date" lang="vi" defaultValue={iso} title="Chọn ngày" />
    </span>
  );
}

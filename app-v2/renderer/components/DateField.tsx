// Ô chọn ngày dùng chung. **Viết lại ở Giai đoạn D3.2** theo đúng DOM của
// app cũ (`src/react/components/DateField.tsx`): `.datebox` bọc 1 ô văn bản
// `.date-text` gõ dd/mm/yyyy + nút lịch `.datepick` + 1 `<input type="date">`
// ẩn `.native-date`. Bản trước đó dùng thẳng `<input type="date">` trần —
// quyết định "đơn giản hoá" của Giai đoạn A1 — nhưng đó là KHÁC BIỆT NHÌN
// THẤY ĐƯỢC (ô ngày trần hiển thị theo locale của trình duyệt, có icon
// riêng, không gõ được dd/mm/yyyy), và gate parity phát hiện thiếu đúng 4
// class này. Đây là component nền tảng nên sửa 1 lần ở đây thay vì vá riêng
// cho trang Báo cáo (xem quy trình D3 trong docs/APP-V2-PLAN.md).
//
// **2026-09-03**: lịch tự vẽ ĐÃ ĐƯỢC PORT. Trước đó nút `.datepick` gọi
// `showPicker()` của `<input type="date">` ẩn với lý do "giống luồng thao
// tác, không cần giống cách vẽ" — nhưng người dùng thấy ngay: đó là lịch
// NATIVE của Chromium (tháng tiếng Anh, cột Su/Mo/Tu, nút Clear/Today), khác
// hẳn lịch tiếng Việt của app cũ. Giờ nút mở
// `components/DatePickerPopup.tsx` (port từ app cũ), và ô `.native-date`
// quay lại đúng vai trò của nó ở app cũ: chỉ CHỨA giá trị ISO cho FormData,
// `display:none`.
//
// Hai chế độ, giữ nguyên như trước để mọi chỗ gọi cũ không phải sửa:
//   - CÓ ĐIỀU KHIỂN: `value` (ISO) + `onChange` (nhận ISO).
//   - KHÔNG ĐIỀU KHIỂN: `name` + `defaultValue`, đọc qua FormData lúc submit.
//     `name` được đặt trên `.native-date` (ô giữ giá trị ISO), KHÔNG phải ô
//     văn bản dd/mm/yyyy — nếu đặt sai chỗ, FormData sẽ nhận "01/09/2026"
//     thay vì "2026-09-01" và mọi form CRUD lưu sai ngày.
import { useRef, useState, type MouseEvent } from 'react';
import { openDatePicker } from '../state/date-picker-store';

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={4} y={5} width={16} height={16} rx={2} /><path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

/** ISO `yyyy-mm-dd` → `dd/mm/yyyy` để hiện; giá trị khác giữ nguyên. Khớp
 * `vnDate()`/`formatDisplay()` app cũ. */
export function formatDateDisplay(value: unknown): string {
  if (!value) return '';
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

/** Người dùng gõ tay → ISO. Nhận `dd/mm/yyyy`, `d/m/yyyy` (và cả `-`/`.`
 * thay `/`) lẫn ISO sẵn; chuỗi không phải ngày hợp lệ trả về ''. Kiểm cả
 * ngày có thật (31/02 không hợp lệ) chứ không chỉ khớp regex. */
export function parseDateInput(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const vn = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(text);
  const [y, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : vn ? [+vn[3], +vn[2], +vn[1]] : [0, 0, 0];
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function DateField({ label, value, onChange, defaultValue, name, id, disabled, className = '' }: {
  label?: string; id?: string; name?: string; disabled?: boolean; className?: string;
  value?: string; onChange?: (value: string) => void; defaultValue?: string;
}) {
  const isControlled = value !== undefined;
  const nativeRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  // Chỉ dùng ở chế độ KHÔNG điều khiển: giữ ISO hiện tại để đồng bộ 2 ô với
  // nhau. Chế độ có điều khiển đọc thẳng từ `value`.
  const [ownIso, setOwnIso] = useState(defaultValue || '');
  const iso = isControlled ? (value || '') : ownIso;

  function commit(nextIso: string) {
    if (!isControlled) setOwnIso(nextIso);
    if (textRef.current) textRef.current.value = formatDateDisplay(nextIso);
    onChange?.(nextIso);
  }

  function openPicker(event: MouseEvent<HTMLElement>) {
    if (disabled || !textRef.current) return;
    // `pickDate()` ghi thẳng vào 2 input rồi gọi callback này với ISO — cần
    // `commit()` để chế độ có điều khiển cập nhật React state (chế độ không
    // điều khiển cũng cần, để `ownIso`/ô ẩn khớp nhau).
    openDatePicker(event.currentTarget.parentElement as HTMLElement, textRef.current, nativeRef.current, commit);
  }

  const box = (
    <span className={`datebox ${className}`.trim()}>
      <input ref={textRef} id={id} className="date-text" inputMode="numeric" placeholder="dd/mm/yyyy"
        disabled={disabled} aria-label={label} defaultValue={formatDateDisplay(iso)}
        key={isControlled ? iso : undefined}
        onBlur={(e) => commit(parseDateInput(e.target.value))}
        onKeyDown={(e) => {
          // Enter CHỐT ngày đang gõ rồi DỪNG ở đây (preventDefault), không để
          // nổi bọt lên `Modal` — nếu không, modal sẽ lưu TRƯỚC khi `onBlur`
          // kịp commit và ngày vừa gõ bị mất im lặng. Cùng quy ước với ô năm
          // của lịch chọn ngày. Bấm Enter lần nữa mới là lưu modal.
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
          e.preventDefault();
          commit(parseDateInput(e.currentTarget.value));
        }} />
      <span className="datepick" title="Chọn ngày" onClick={openPicker}><CalendarIcon /></span>
      <input ref={nativeRef} name={name} className="native-date" type="date" lang="vi" title="Chọn ngày"
        disabled={disabled} value={iso} onChange={(e) => commit(e.target.value)} />
    </span>
  );

  if (label === undefined) return box;
  return <div className="field">{label && <label htmlFor={id}>{label}</label>}{box}</div>;
}

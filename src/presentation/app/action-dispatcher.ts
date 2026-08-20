/* Pha H2 lát 1 (2026-08-20) — hạ tầng thay onclick="tenHam(...)" trần bằng
   event delegation, nhân bản đúng mẫu đã chứng minh trong
   vn-date-picker-controller.ts: MỘT listener gắn vào `document` một lần
   (guard `bound`), sống hết đời app vì router chỉ thay `#main.innerHTML`
   (con), không bao giờ thay chính node `#main`/`document`.

   Phần tử mang `data-action="tenHam"` (+ tuỳ chọn `data-args='["a",1]'` — một
   mảng JSON) thay cho `onclick="tenHam('a',1)"`. Tên hàm vẫn tra qua global
   bridge hiện có (deps.resolve, thực chất là `(root as any)[name]` ở lớp
   adapter) — lát này đổi CÁCH gắn sự kiện, không đổi việc hàm nghiệp vụ vẫn
   là global; xoá hẳn global bridge là việc khác, không thuộc phạm vi Pha H2.

   Gọi qua `fn.apply(el, args)` — cố ý giữ `el` (phần tử khớp `[data-action]`)
   làm `this`, đúng ngữ nghĩa `this` mà thuộc tính onclick="..." trần vẫn có
   (trình duyệt luôn bind `this` = phần tử mang thuộc tính lúc gọi inline
   handler).

   Pha H2 nhóm (d) (2026-08-20, lát 2) — mở rộng cho các mẫu còn dùng
   `event`/`this` trần trong chuỗi onclick/oninput/onchange/onfocus cũ:

   1. `data-action-on="input"` hoặc `"change"` (mặc định "click" nếu bỏ
      trống): đổi sự kiện được lắng nghe. Với input/change, giá trị SỐNG của
      phần tử (checkbox/radio đọc `.checked`, còn lại đọc `.value`) được nối
      thêm vào CUỐI mảng args đã giải mã từ `data-args` — khớp đúng cách mọi
      chuỗi cũ dùng `this.value`/`this.checked` LÀM THAM SỐ CUỐI CÙNG khi gọi
      hàm đích (`fn(a, b, this.value)`), nên hàm đích không cần đổi chữ ký.
      Không dùng cho `data-action-on="click"`/`"focus"` vì hai sự kiện đó
      không có "giá trị sống" cần đọc — chỉ là một cú bấm/focus trần.
      Ngoại lệ: `<input type="file">` không có `.value` có ý nghĩa (chỉ là
      tên file) — nối `event` THẬT thay cho giá trị, để hàm đích tự đọc
      `event.target.files` (mẫu import/kiểm tra file backup).
   2. `data-action-on="focus"`: lắng nghe qua `focusin` thật (event `focus`
      trần KHÔNG nổi bong bóng nên không delegate được từ `document`;
      `focusin` là bản nổi bong bóng tương đương, trình duyệt hỗ trợ sẵn) —
      gọi hàm không kèm giá trị sống, giống `click`. Tương tự,
      `data-action-on="mouseout"` thay cho `onmouseleave=` (cũng không nổi
      bong bóng) — dùng đúng cho phần tử LÁ (không có phần tử con, như một
      `<circle>` SVG), vì `mouseout` (có nổi bong bóng) và `mouseleave` chỉ
      khác nhau khi có hậu duệ.
   3. `data-action-self-only` (thuộc tính có/không, không cần giá trị): chỉ
      gọi hàm khi CHÍNH phần tử mang `data-action` là mục tiêu bị click/phím,
      bỏ qua nếu sự kiện nổi lên từ một phần tử con — thay cho
      `onclick="if(event.target===this)fn()"` (mẫu "bấm ra ngoài để đóng"
      của lớp phông modal) hoặc `onkeydown="if(event.target===event.currentTarget)fn()"`
      (mẫu "Enter/Space chỉ chọn dòng khi chính dòng đó đang được focus, không
      phải một ô điều khiển lồng trong dòng"). Không dùng `closest()` bình
      thường ở đây vì mục đích ngược lại: các mẫu khác (nút lồng trong card
      có thể bấm) dựa vào `closest()` tìm khớp GẦN NHẤT để tự loại trừ nhau —
      còn mẫu này cần biết đích bấm có đúng là phần tử này không.

   Pha H2 nhóm (d) (2026-08-20, lát 3) — `onkeydown=`/`onmousemove=`, hai
   thuộc tính CSP còn chặn `'unsafe-inline'` cuối cùng cần dispatcher truyền
   `event` bàn phím/chuột thật, khác hẳn "chỉ cần giá trị sống hoặc không cần
   gì" của click/input/change/focus ở trên:

   4. `data-keydown-action="tenHam"` (+ `data-keydown-args`, cùng dạng JSON
      như `data-args`) — hai chế độ, phân biệt bằng có/không
      `data-keydown-keys`:
      - CÓ `data-keydown-keys='["Enter"," "]'` (JSON, vì phím Space chính là
        ký tự `" "` — không thể dùng danh sách cách-nhau-bởi-dấu-cách như
        `data-action-on` do bản thân nó là một dấu cách): chỉ gọi khi
        `event.key` khớp một phần tử trong danh sách, luôn `preventDefault()`
        trước khi gọi (khớp mọi chuỗi onkeydown cũ dạng
        `if(event.key==='Enter'){event.preventDefault();fn(...)}`), và nối
        thêm giá trị SỐNG của phần tử vào cuối args — giống input/change,
        dùng cho ô tìm kiếm "Enter để tạo mới" hay card/dòng "Enter/Space để
        chọn" (phần tử không có `.value` thì giá trị nối vào là `undefined`,
        vô hại vì hàm đích không đọc tham số dư). Tôn trọng
        `data-keydown-self-only` nếu có mặt — CỜ RIÊNG, không dùng chung
        `data-action-self-only` của (3): một `<tr>` có thể vừa mang
        `data-action="fn"` cho click (muốn dùng `closest()` để tự loại trừ
        nút/ô lồng trong dòng, KHÔNG self-only) vừa mang
        `data-keydown-action="fn"` cho Enter/Space (CẦN self-only, vì phím
        Enter khi một `<select>` lồng trong dòng đang được focus không có
        `data-keydown-action` riêng để `closest()` tự dừng ở đó) — hai nhu
        cầu ngược nhau trên CÙNG một phần tử, không thể dùng một cờ.
      - KHÔNG có `data-keydown-keys` (mọi phím đều gọi, không lọc, không tự
        `preventDefault` — để hàm đích tự quyết theo từng phím): dùng cho các
        handler điều hướng thật (mũi tên trong cây xét nghiệm/bảng nhập QC).
        Gọi `fn.apply(el, [event, ...args])` — event ở ĐẦU vì các hàm này
        vốn nhận `(event)` làm tham số duy nhất; hàm đích đọc `this` để lấy
        lại phần tử (đổi từ đọc `event.currentTarget` — currentTarget của
        một listener delegate luôn là `document`, không phải phần tử thật,
        nên các hàm này đã được đổi sang đọc `this` khi chuyển lát này).
   5. `data-mousemove-action="tenHam"` (+ `data-mousemove-args`) — luôn gọi
      không lọc, `fn.apply(el, [event, ...args])` giống nhánh "mọi phím" của
      (4) — dùng cho tooltip theo con trỏ chuột trên các điểm SVG.
   6. `data-notify-changed="tenHam"` — CƠ CHẾ RIÊNG, độc lập hoàn toàn với
      `data-action`: gọi hàm (không tham số) mỗi khi có 'input' HOẶC 'change'
      nổi bong bóng lên từ BẤT KỲ hậu duệ nào, KỂ CẢ khi hậu duệ đó đã tự có
      `data-action` riêng xử lý sự kiện đó rồi — thay
      `onclick="actionFormChanged()"` gắn trên nguyên khối bọc form NCE, dùng
      để bắt "form vừa đổi bất cứ trường nào" (lưu draft, làm mới chip trạng
      thái từng mục) mà KHÔNG được phép thay thế hành vi của từng trường con.
      Đây LÀ trường hợp một sự kiện cần gọi HAI hàm (khớp gần nhất qua
      `data-action` + thông báo nổi bọt qua `data-notify-changed`), khác với
      `data-action` (luôn chỉ gọi ĐÚNG MỘT hàm — khớp gần nhất).

   Pha H2 lát cuối (2026-08-20) — 2 phần tử còn lại cần NHIỀU sự kiện KHÁC
   NHAU trên CÙNG một input, thứ mà `data-action` (một sự kiện mỗi phần tử,
   qua `data-action-on`) không diễn tả được: ô số lô cũ/mới/Bias mong muốn/
   alpha của trang So sánh hóa chất cần cả `oninput=` (ghi giá trị,
   `data-action` đã có) LẪN `onfocus=`/`onchange=` (ghi log thay đổi trước/
   sau — `rcMetaFocus`/`rcMetaLog`, không đọc giá trị sống); ô gõ số lô của
   modal chuyển lô cần cả `oninput=` LẪN `onchange=` gọi CÙNG một hàm
   (`lotTransitionChoiceInput`) với tham số `commit` khác nhau — hàm này đọc
   `this`/`el.dataset.lotId` chứ không cần giá trị sống nối sẵn, nên
   `data-action-on="input"` (LUÔN nối `liveValue(el)`) sẽ sai: mọi lần gõ sẽ
   nhận value làm tham số `commit` (luôn truthy), commit sai trên từng phím
   gõ. Ba thuộc tính mới, cùng khuôn với `data-mousemove-action` (luôn gọi,
   không lọc, KHÔNG nối giá trị sống — khác `data-action-on`, hàm đích tự đọc
   `this` nếu cần):
   7. `data-input-action="tenHam"` (+ `data-input-args`) — lắng nghe qua
      `input`, gọi `fn.apply(el, args)`, không nối giá trị sống.
   8. `data-focus-action="tenHam"` (+ `data-focus-args`) — lắng nghe qua
      `focusin` (bong bóng), gọi `fn.apply(el, args)`.
   9. `data-change-action="tenHam"` (+ `data-change-args`) — lắng nghe qua
      `change`, gọi `fn.apply(el, args)`. Cả ba độc lập hoàn toàn với
      `data-action`/`data-action-on` — một phần tử có thể mang CẢ `data-action`
      (ví dụ `rcMeta` trên 'input', CẦN giá trị sống) VÀ `data-focus-action`/
      `data-change-action` (không cần), mỗi thuộc tính gọi một hàm khác nhau
      trên CÙNG sự kiện — giống tinh thần `data-notify-changed` nhưng có
      tham số riêng theo từng phần tử thay vì không tham số toàn cục.

   Pha H2 lát cuối, phần 2 (2026-08-20) — `ontoggle="fn('key',this.open)"` trên
   3 khối `<details>` (form NCE, hai panel phụ trang Nhập liệu) sống sót qua
   vòng grep đầu vì không khớp 5 mẫu onXXX= đã quét; phát hiện muộn qua
   `nce-check` thật (trạng thái mở/đóng của `<details>` không còn sống sót qua
   `rerender()` — đúng loại lỗi chỉ browser test thấy được, không phải Node
   test). Sự kiện `toggle` trên `<details>` KHÔNG nổi bong bóng (khác hẳn
   click/input/change) nên không thể delegate qua listener thường trên
   `document` như các nhánh trên — phải dùng PHA BẮT (capture), vì phase bắt
   luôn đi qua mọi ancestor kể cả khi sự kiện không nổi bong bóng lên sau đó.
   10. `data-toggle-action="tenHam"` (+ `data-toggle-args`) — lắng nghe qua
       `toggle` ở PHA BẮT (`addEventListener('toggle', fn, true)`), gọi
       `fn.apply(el, [...args, el.open])` — nối `el.open` vào cuối, giống
       quy ước "nối giá trị sống" của input/change, khớp đúng `this.open`
       chuỗi onXXX= cũ truyền. */
export function createActionDispatcher(deps: {
  document: { addEventListener: (type: string, listener: (event: any) => void, useCapture?: boolean) => void } | undefined;
  resolve: (name: string) => ((...args: any[]) => void) | undefined;
}) {
  let bound = false;
  const decodeArgs = (raw: string | null | undefined): any[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const liveValue = (el: any) => (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
  const dispatch = (eventType: string) => (event: any) => {
    const el = event?.target?.closest?.('[data-action]');
    if (!el) return;
    if ((el.dataset.actionOn || 'click') !== eventType) return;
    if (el.dataset.actionSelfOnly !== undefined && event.target !== el) return;
    const name = el.dataset.action;
    if (!name) return;
    const fn = deps.resolve(name);
    if (typeof fn !== 'function') return;
    const args = decodeArgs(el.dataset.args);
    /* input type="file"'s `.value` là chuỗi tên file, vô nghĩa với hàm đích
       (luôn cần đọc `event.target.files` thật) — nối `event` thay `liveValue`
       cho riêng trường hợp này, giống nhánh "mọi phím" của keydown ở trên. */
    if (eventType === 'input' || eventType === 'change') args.push(el.type === 'file' ? event : liveValue(el));
    fn.apply(el, args);
  };
  const dispatchKeydown = (event: any) => {
    const el = event?.target?.closest?.('[data-keydown-action]');
    if (!el) return;
    const name = el.dataset.keydownAction;
    if (!name) return;
    const fn = deps.resolve(name);
    if (typeof fn !== 'function') return;
    const args = decodeArgs(el.dataset.keydownArgs);
    const keys = el.dataset.keydownKeys;
    if (keys === undefined) { fn.apply(el, [event, ...args]); return; }
    if (!decodeArgs(keys).includes(event.key)) return;
    if (el.dataset.keydownSelfOnly !== undefined && event.target !== el) return;
    event.preventDefault();
    args.push(liveValue(el));
    fn.apply(el, args);
  };
  const dispatchMousemove = (event: any) => {
    const el = event?.target?.closest?.('[data-mousemove-action]');
    if (!el) return;
    const name = el.dataset.mousemoveAction;
    if (!name) return;
    const fn = deps.resolve(name);
    if (typeof fn !== 'function') return;
    fn.apply(el, [event, ...decodeArgs(el.dataset.mousemoveArgs)]);
  };
  const dispatchNotifyChanged = (event: any) => {
    const el = event?.target?.closest?.('[data-notify-changed]');
    if (!el) return;
    const fn = deps.resolve(el.dataset.notifyChanged);
    if (typeof fn === 'function') fn();
  };
  const dispatchInputAction = (event: any) => {
    const el = event?.target?.closest?.('[data-input-action]');
    if (!el) return;
    const fn = deps.resolve(el.dataset.inputAction);
    if (typeof fn !== 'function') return;
    fn.apply(el, decodeArgs(el.dataset.inputArgs));
  };
  const dispatchFocusAction = (event: any) => {
    const el = event?.target?.closest?.('[data-focus-action]');
    if (!el) return;
    const fn = deps.resolve(el.dataset.focusAction);
    if (typeof fn !== 'function') return;
    fn.apply(el, decodeArgs(el.dataset.focusArgs));
  };
  const dispatchChangeAction = (event: any) => {
    const el = event?.target?.closest?.('[data-change-action]');
    if (!el) return;
    const fn = deps.resolve(el.dataset.changeAction);
    if (typeof fn !== 'function') return;
    fn.apply(el, decodeArgs(el.dataset.changeArgs));
  };
  const dispatchToggleAction = (event: any) => {
    const el = event?.target;
    if (!el || el.dataset?.toggleAction === undefined) return;
    const fn = deps.resolve(el.dataset.toggleAction);
    if (typeof fn !== 'function') return;
    const args = decodeArgs(el.dataset.toggleArgs);
    args.push(el.open);
    fn.apply(el, args);
  };
  const bind = () => {
    if (bound || !deps.document) return;
    bound = true;
    deps.document.addEventListener('click', dispatch('click'));
    deps.document.addEventListener('input', dispatch('input'));
    deps.document.addEventListener('change', dispatch('change'));
    deps.document.addEventListener('focusin', dispatch('focus'));
    deps.document.addEventListener('mouseout', dispatch('mouseout'));
    deps.document.addEventListener('keydown', dispatchKeydown);
    deps.document.addEventListener('mousemove', dispatchMousemove);
    deps.document.addEventListener('input', dispatchNotifyChanged);
    deps.document.addEventListener('change', dispatchNotifyChanged);
    deps.document.addEventListener('input', dispatchInputAction);
    deps.document.addEventListener('focusin', dispatchFocusAction);
    deps.document.addEventListener('change', dispatchChangeAction);
    deps.document.addEventListener('toggle', dispatchToggleAction, true);
  };
  return { bind, dispatch, dispatchKeydown, dispatchMousemove, dispatchNotifyChanged, dispatchInputAction, dispatchFocusAction, dispatchChangeAction, dispatchToggleAction };
}

type EntryVoidModalInput = { dateText: string; level: number; valueText: string; confirmAction: string };

type EntryVoidModalDependencies = { button: (label: string, action: string, variant: string) => string; escape: (value: unknown) => string };

export function createEntryVoidModalHtml(deps: EntryVoidModalDependencies) {
  return (input: EntryVoidModalInput) => `<div class="modal">
    <div class="modal-h"><h3>Hủy điểm QC</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <div class="hint">Ngày ${deps.escape(input.dateText)} · Mức ${input.level} · Giá trị ${deps.escape(input.valueText)}</div>
      <label>Loại hủy</label>
      <select id="voidKindInput" aria-label="Loại hủy điểm QC" onchange="syncVoidNceChoice()">
        <option value="analytical">Kết quả QC thực tế không hợp lệ</option>
        <option value="data-entry">Nhập sai dữ liệu</option>
        <option value="other">Lý do khác</option>
      </select>
      <div class="void-nce-choice"><label><input id="voidOpenNce" type="checkbox" checked disabled> Lập hồ sơ NCE và yêu cầu chạy lại QC</label><div id="voidNceHint" class="hint">Hệ thống sẽ mở hoặc tái sử dụng hồ sơ NCE và chờ một kết quả QC chạy lại được chấp nhận.</div></div>
      <div id="voidReasonBox"><label id="voidReasonLabel">Ghi chú / bằng chứng (khuyến nghị)</label>
        <textarea id="voidReasonInput" aria-label="Ghi chú lý do hủy điểm QC" placeholder="VD: Máy báo lỗi hút mẫu lúc 08:15, đã ghi nhận trong sổ bảo trì..." oninput="document.getElementById('voidReasonErr').style.display='none'"></textarea>
        <div id="voidReasonErr" class="hint field-error">Cần ghi lý do hủy tối thiểu 5 ký tự.</div>
      </div>
    </div>
    <div class="modal-f">${deps.button('Đóng','closeModal()','ghost')}${deps.button('Xác nhận hủy',input.confirmAction,'danger')}</div>
  </div>`;
}

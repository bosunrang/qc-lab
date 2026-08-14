export type ActivityAuditArchiveModalInput = { total: number; cancelButtonHtml: string; archiveButtonHtml: string };

export function activityAuditArchiveModalHtml(input: ActivityAuditArchiveModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Lưu trữ nhật ký cũ</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
      <div class="hint">Nhật ký hiện có <b>${input.total}</b> dòng. Các dòng cũ hơn mốc chọn sẽ được <b>xuất ra file CSV</b> (kèm PrevHash/Hash), sau đó mới bị gỡ khỏi hệ thống — hash dòng cuối file trở thành điểm nối vào chuỗi còn lại nên phần lưu trữ vẫn kiểm chứng được.</div>
      <label class="flow-section">Chỉ giữ lại nhật ký trong</label>
      <select id="auditArchiveMonths" aria-label="Mốc tuổi nhật ký được giữ lại"><option value="12">12 tháng gần nhất</option><option value="24" selected>24 tháng gần nhất</option><option value="36">36 tháng gần nhất</option></select>
    </div><div class="modal-f">${input.cancelButtonHtml}${input.archiveButtonHtml}</div></div>`;
}

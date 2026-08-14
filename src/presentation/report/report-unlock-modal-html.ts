export type ReportUnlockModalInput = { titleHtml: string; periodLabelHtml: string; closeButtonHtml: string; confirmButtonHtml: string };

export function reportUnlockModalHtml(input: ReportUnlockModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>${input.titleHtml}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
      <div class="hint">Sau khi mở khóa, điểm QC trong kỳ ${input.periodLabelHtml} có thể được sửa/hủy trở lại.</div>
      <label>Lý do mở khóa (tối thiểu 5 ký tự)</label>
      <textarea id="unlockReasonInput" placeholder="VD: Bổ sung đối soát, phát hiện sai sót cần chỉnh lại..." oninput="document.getElementById('unlockReasonErr').style.display='none'"></textarea>
      <div id="unlockReasonErr" class="hint field-error">Cần ghi lý do mở khóa tối thiểu 5 ký tự.</div>
    </div><div class="modal-f">${input.closeButtonHtml}${input.confirmButtonHtml}</div></div>`;
}

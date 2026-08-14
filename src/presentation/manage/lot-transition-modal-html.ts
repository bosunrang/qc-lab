export type LotTransitionModalInput = {
  title: string;
  panelsHtml: string;
  fromChoiceHtml: string;
  toChoiceHtml: string;
  startDateHtml: string;
  status: string;
  targetsHtml: string;
  cancelButtonHtml: string;
  saveButtonHtml: string;
};

export function lotTransitionModalHtml(input: LotTransitionModalInput) {
  return `<div class="modal rcfg-modal lot-trans-modal"><div class="modal-h"><div><h3>${input.title}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="lot-trans-row3"><div><label>Panel QC áp dụng</label><select id="cfgTransPanel" onchange="refreshLotTransitionTargets()">${input.panelsHtml}</select></div><div><label>Lô cũ</label>${input.fromChoiceHtml}</div><div><label>Lô mới</label>${input.toChoiceHtml}</div></div>
    <div class="lot-trans-row2"><div><label>Ngày bắt đầu (dd/mm/yyyy)</label>${input.startDateHtml}</div><div><label>Trạng thái</label><select id="cfgTransStatus"><option value="planned" ${input.status==='planned'?'selected':''}>Dự kiến</option><option value="active" ${input.status==='active'||input.status==='completed'?'selected':''}>Đang chạy song song</option><option value="accepted" ${input.status==='accepted'?'selected':''}>Chấp nhận lô mới</option><option value="rejected" ${input.status==='rejected'?'selected':''}>Không chấp nhận</option></select></div></div>
    <div id="cfgTransTargets">${input.targetsHtml}</div>
    </div>
    <div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}

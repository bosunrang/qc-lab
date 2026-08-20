type ReagentInfoPanelInput = {
  disabledAttr: string;
  reagentValueHtml: string;
  unitValueHtml: string;
  lotOldValueHtml: string;
  lotNewValueHtml: string;
  dateInputHtml: string;
  operatorValueHtml: string;
  sampleTypeValueHtml: string;
  biasTarget: unknown;
  alpha: unknown;
  coverageChecked: boolean;
  canWrite: boolean;
  userIconHtml: string;
  sampleIconHtml: string;
};

export function reagentInfoPanelHtml(input: ReagentInfoPanelInput): string {
  const ro = input.disabledAttr;
  return `<div class="panel rc-info-panel"><h2 class="panel-title">Thông tin đánh giá</h2><div class="rc-info-grid">
     <div class="rc-field"><label>Tên hóa chất</label><input ${ro} value="${input.reagentValueHtml}" data-action="rcMeta" data-args='["reagent"]' data-action-on="input" placeholder="Tên hóa chất / xét nghiệm"></div>
     <div class="rc-field"><label>Đơn vị</label><input ${ro} value="${input.unitValueHtml}" data-action="rcMeta" data-args='["unit"]' data-action-on="input" placeholder="mmol/L..."></div>
     <div class="rc-field"><label>Số lô cũ</label><input ${ro} aria-label="Số lô cũ" value="${input.lotOldValueHtml}" data-action="rcMeta" data-args='["lotOld"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["lotOld"]' data-change-action="rcMetaLog" data-change-args='["lotOld"]'></div>
     <div class="rc-field"><label>Số lô mới</label><input ${ro} aria-label="Số lô mới" value="${input.lotNewValueHtml}" data-action="rcMeta" data-args='["lotNew"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["lotNew"]' data-change-action="rcMetaLog" data-change-args='["lotNew"]'></div>
     <div class="rc-field rc-date-field"><label>Ngày thực hiện</label>${input.dateInputHtml}</div>
     <div class="rc-field"><label>Người thực hiện</label><div class="rc-quick-field"><input ${ro} value="${input.operatorValueHtml}" data-action="rcMeta" data-args='["operator"]' data-action-on="input" placeholder="Họ tên"><button class="rc-icon-btn" ${input.canWrite ? '' : 'disabled'} data-action="rcOpenQuick" data-args='["operator"]' title="Chọn nhanh người thực hiện" aria-label="Chọn nhanh người thực hiện">${input.userIconHtml}</button></div></div>
     <div class="rc-field"><label>Loại mẫu</label><div class="rc-quick-field"><input ${ro} value="${input.sampleTypeValueHtml}" data-action="rcMeta" data-args='["sampleType"]' data-action-on="input" placeholder="Loại mẫu"><button class="rc-icon-btn" ${input.canWrite ? '' : 'disabled'} data-action="rcOpenQuick" data-args='["sampleType"]' title="Chọn nhanh loại mẫu" aria-label="Chọn nhanh loại mẫu">${input.sampleIconHtml}</button></div></div>
     <div class="rc-field"><label>Bias mong muốn (%)</label><input ${ro} aria-label="Bias mong muốn (%)" type="number" step="any" value="${input.biasTarget}" data-action="rcMeta" data-args='["biasTarget"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["biasTarget"]' data-change-action="rcMetaLog" data-change-args='["biasTarget"]'></div>
     <div class="rc-field"><label>Mức ý nghĩa (α, alpha)</label><input ${ro} aria-label="Mức ý nghĩa (alpha)" type="number" step="any" value="${input.alpha}" data-action="rcMeta" data-args='["alpha"]' data-action-on="input" data-focus-action="rcMetaFocus" data-focus-args='["alpha"]' data-change-action="rcMetaLog" data-change-args='["alpha"]'></div>
     <div class="rc-field rc-coverage-cell"><label class="rc-coverage-check"><input ${ro} type="checkbox" ${input.coverageChecked ? 'checked' : ''} data-action="rcMeta" data-args='["coverageConfirmed"]' data-action-on="change"><span>Mẫu đã bao phủ khoảng đo và/hoặc điểm quyết định lâm sàng theo SOP</span></label></div></div></div>`;
}

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
     <div class="rc-field"><label>Tên hóa chất</label><input ${ro} value="${input.reagentValueHtml}" oninput="rcMeta('reagent',this.value)" placeholder="Tên hóa chất / xét nghiệm"></div>
     <div class="rc-field"><label>Đơn vị</label><input ${ro} value="${input.unitValueHtml}" oninput="rcMeta('unit',this.value)" placeholder="mmol/L..."></div>
     <div class="rc-field"><label>Số lô cũ</label><input ${ro} aria-label="Số lô cũ" value="${input.lotOldValueHtml}" oninput="rcMeta('lotOld',this.value)" onfocus="rcMetaFocus('lotOld')" onchange="rcMetaLog('lotOld')"></div>
     <div class="rc-field"><label>Số lô mới</label><input ${ro} aria-label="Số lô mới" value="${input.lotNewValueHtml}" oninput="rcMeta('lotNew',this.value)" onfocus="rcMetaFocus('lotNew')" onchange="rcMetaLog('lotNew')"></div>
     <div class="rc-field rc-date-field"><label>Ngày thực hiện</label>${input.dateInputHtml}</div>
     <div class="rc-field"><label>Người thực hiện</label><div class="rc-quick-field"><input ${ro} value="${input.operatorValueHtml}" oninput="rcMeta('operator',this.value)" placeholder="Họ tên"><button class="rc-icon-btn" ${input.canWrite ? '' : 'disabled'} onclick="rcOpenQuick('operator')" title="Chọn nhanh người thực hiện" aria-label="Chọn nhanh người thực hiện">${input.userIconHtml}</button></div></div>
     <div class="rc-field"><label>Loại mẫu</label><div class="rc-quick-field"><input ${ro} value="${input.sampleTypeValueHtml}" oninput="rcMeta('sampleType',this.value)" placeholder="Loại mẫu"><button class="rc-icon-btn" ${input.canWrite ? '' : 'disabled'} onclick="rcOpenQuick('sampleType')" title="Chọn nhanh loại mẫu" aria-label="Chọn nhanh loại mẫu">${input.sampleIconHtml}</button></div></div>
     <div class="rc-field"><label>Bias mong muốn (%)</label><input ${ro} aria-label="Bias mong muốn (%)" type="number" step="any" value="${input.biasTarget}" oninput="rcMeta('biasTarget',this.value)" onfocus="rcMetaFocus('biasTarget')" onchange="rcMetaLog('biasTarget')"></div>
     <div class="rc-field"><label>Mức ý nghĩa (α, alpha)</label><input ${ro} aria-label="Mức ý nghĩa (alpha)" type="number" step="any" value="${input.alpha}" oninput="rcMeta('alpha',this.value)" onfocus="rcMetaFocus('alpha')" onchange="rcMetaLog('alpha')"></div>
     <div class="rc-field rc-coverage-cell"><label class="rc-coverage-check"><input ${ro} type="checkbox" ${input.coverageChecked ? 'checked' : ''} onchange="rcMeta('coverageConfirmed',this.checked)"><span>Mẫu đã bao phủ khoảng đo và/hoặc điểm quyết định lâm sàng theo SOP</span></label></div></div></div>`;
}

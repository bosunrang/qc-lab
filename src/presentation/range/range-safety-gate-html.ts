export type RangeSafetyGateHtmlInput = { nceId: string; rule: string; biasInputAction: string; thresholdText: string; noTeaHint: string };

export function rangeSafetyGateHtml(input: RangeSafetyGateHtmlInput) {
  return `<div class="alert warn flow-control"><b>Hồ sơ NCE ${input.nceId} đang ghi nhận vi phạm hệ thống (${input.rule})</b><div>Xác nhận 2 điều kiện dưới đây trước khi áp dụng dải mới — tránh "đuổi theo mean" khi nguyên nhân dịch chuyển chưa được lý giải.</div></div>
    <label class="range-gate-check"><input type="checkbox" id="rangeCauseConfirm" onchange="document.getElementById('rangeGateErr').style.display='none'"><span>Xác nhận nguyên nhân dịch chuyển đã được xác định và ghi nhận trong hồ sơ NCE ${input.nceId} (không phải lỗi chưa lý giải)</span></label>
    <div class="field-row flow-item"><div><label>Bias đo lại (%)</label><input id="rangeBiasInput" type="text" inputmode="decimal" oninput="${input.biasInputAction}"></div><div><label>Ngưỡng cho phép (≤ TEa/4)</label><input id="rangeBiasThreshold" readonly value="${input.thresholdText}"></div></div>
    <div id="rangeBiasHint" class="hint flow-tight">${input.noTeaHint}</div>
    <div id="rangeGateErr" class="hint field-error">Cần xác nhận nguyên nhân dịch chuyển và nhập Bias trong ngưỡng cho phép trước khi áp dụng.</div>`;
}

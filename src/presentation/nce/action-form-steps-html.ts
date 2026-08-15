export type ActionImmediateStepInput = {
  containmentSelectHtml: string;
  containmentNoteValueHtml: string;
  containmentNoteSuggestHtml: string;
  correctionTextHtml: string;
  correctionSuggestHtml: string;
};

export function actionImmediateStepHtml(input: ActionImmediateStepInput) {
  return `<div class="action-immediate-grid"><div><label>Phạm vi kiểm soát tức thời</label>${input.containmentSelectHtml}</div><div><label>Ghi chú phạm vi</label><input id="aContainmentNote" placeholder="VD: Giữ kết quả từ 08:00 đến khi QC đạt" value="${input.containmentNoteValueHtml}">${input.containmentNoteSuggestHtml}</div><div><label>Xử lý tức thời đã thực hiện</label><textarea id="aCorrection" rows="1" placeholder="VD: Dừng trả kết quả, cô lập lô QC và thông báo phụ trách...">${input.correctionTextHtml}</textarea>${input.correctionSuggestHtml}</div></div>`;
}

export type ActionRiskStepInput = {
  severitySelectHtml: string;
  occurrenceSelectHtml: string;
  detectabilitySelectHtml: string;
  levelSelectHtml: string;
  scoreClassHtml: string;
  scoreHtml: string;
  basisValueHtml: string;
  basisSuggestHtml: string;
};

export function actionRiskStepHtml(input: ActionRiskStepInput) {
  return `<div class="action-risk-grid"><div><label>Mức độ ảnh hưởng (S)</label>${input.severitySelectHtml}</div><div><label>Khả năng xảy ra (O)</label>${input.occurrenceSelectHtml}</div><div><label>Khả năng không phát hiện (D)</label>${input.detectabilitySelectHtml}</div><div class="action-risk-level"><label>Phân loại theo SOP</label>${input.levelSelectHtml}</div><div class="action-risk-result"><label>RPN</label><div id="aRiskScoreCard" class="action-risk-score risk-${input.scoreClassHtml}" aria-live="polite"><b id="aRiskScore">${input.scoreHtml}</b></div></div><div class="action-risk-basis"><label>Căn cứ phân loại theo SOP</label><input id="aRiskBasis" placeholder="VD: SOP-QC-07, ma trận nguy cơ bảng 3" value="${input.basisValueHtml}">${input.basisSuggestHtml}</div></div>`;
}

export function actionInvestigationStepHtml(fieldsHtml: readonly string[]) {
  return `<div class="action-investigation-grid">${fieldsHtml.join('')}</div>`;
}

export function actionCauseStepHtml(input: any) {
  const releaseHint=input.containmentHeld?'Bắt buộc sau khi QC được chấp nhận và hành động đã hoàn thành':'Không bắt buộc vì mục 1 không ghi nhận kết quả liên quan bị giữ';
  return `<div class="action-cause-grid"><div><label>Nhóm nguyên nhân</label>${input.causeCategory}</div><div><label>Nguyên nhân gốc hoặc nghi ngờ</label><textarea id="aCause" rows="1" placeholder="Mô tả bằng chứng và nguyên nhân...">${input.cause}</textarea>${input.causeSuggest}</div><div><label>Hành động khắc phục để ngăn tái diễn</label><textarea id="aAct" rows="1" placeholder="VD: Thay lọ QC mới, vệ sinh kim hút, cập nhật lịch bảo trì...">${input.action}</textarea>${input.actionSuggest}</div></div><div class="action-cause-second-row"><div><label>Ngày hoàn thành hành động</label>${input.completedDate}</div><div><label>Bias trước khắc phục (%) <small class="hint">tham khảo</small></label><input id="aBiasBefore" type="text" inputmode="decimal" placeholder="VD: 8.5" value="${input.biasBefore}" oninput="actionUpdateBiasHint()">${input.sigmaBias}</div><div><label>Bias sau khắc phục (%) <small class="hint">tham khảo</small></label><input id="aBiasAfter" type="text" inputmode="decimal" placeholder="VD: 1.2" value="${input.biasAfter}" oninput="actionUpdateBiasHint()"></div></div><div id="aBiasThresholdHint" class="hint flow-note">${input.threshold}</div>${input.rerun}<div class="action-release-block"><div class="action-release-title"><b>Cho phép hoạt động/trả kết quả trở lại</b><small>${releaseHint}</small></div><div class="action-release-grid"><div><label>Quyết định</label>${input.releaseStatus}</div><div><label>Ngày cho phép</label>${input.releaseDate}</div><div><label>Người cho phép</label><input id="aReleaseBy" list="aByList" autocomplete="off" placeholder="Chọn hoặc gõ tên" value="${input.releaseBy}"></div><div><label>Căn cứ cho phép</label><input id="aReleaseNote" placeholder="VD: QC chạy lại đã được chấp nhận" value="${input.releaseNote}">${input.releaseSuggest}</div></div></div>`;
}

export function actionPatientStepHtml(input: any) {
  return `<div id="aPatientRiskRef" class="hint space-after-control">${input.reference}</div><div class="action-patient-grid"><div><label>Kết luận ảnh hưởng</label>${input.impact}</div><div><label>Xử lý mẫu/kết quả liên quan</label><textarea id="aPatientAction" rows="1" placeholder="VD: Rà soát các mẫu từ 08:00–10:00; chạy lại 3 mẫu...">${input.action}</textarea>${input.suggest}</div></div>`;
}

export function actionEffectivenessStepHtml(input: any) {
  return `<div class="action-effectiveness-grid"><div><label>Kết luận hiệu lực</label>${input.status}</div><div class="action-effectiveness-date"><label>Ngày đánh giá</label>${input.date}</div><div><label>Bằng chứng/nhận xét hiệu lực</label><textarea id="aEffectivenessNote" rows="1" placeholder="VD: Theo dõi 20 lần chạy tiếp theo không tái diễn...">${input.note}</textarea>${input.noteSuggest}</div></div><div class="action-residual-block"><div class="action-release-title"><b>Nguy cơ còn lại sau khắc phục</b><small>Chỉ bắt buộc khi kết luận có hiệu lực; dùng cùng thang điểm và SOP với đánh giá ban đầu</small></div><div class="action-residual-grid"><div><label>Mức độ (S)</label>${input.severity}</div><div><label>Khả năng xảy ra (O)</label>${input.occurrence}</div><div><label>Khả năng không phát hiện (D)</label>${input.detectability}</div><div><label>Phân loại theo SOP</label>${input.level}</div><div class="action-risk-result"><label>RPN còn lại</label><div id="aResidualRiskScoreCard" class="action-risk-score risk-${input.scoreClass}" aria-live="polite"><b id="aResidualRiskScore">${input.score}</b></div></div><div class="action-residual-basis"><label>Căn cứ đánh giá lại</label><input id="aResidualRiskBasis" placeholder="VD: SOP-QC-07; dữ liệu theo dõi sau khắc phục" value="${input.basis}">${input.basisSuggest}</div></div></div>`;
}

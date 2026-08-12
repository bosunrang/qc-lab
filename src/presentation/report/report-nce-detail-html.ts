type DetailModel = Record<string, any>;

export function createReportNceDetailHtml(deps: {
  model: (action: Record<string, any>, test: Record<string, any>) => DetailModel;
  field: (label: string, value: unknown, wide?: boolean) => string;
  escape: (value: unknown) => string;
}) {
  return (action: Record<string, any>, test: Record<string, any>) => {
    const model = deps.model(action, test), field = deps.field, checks = (model.checks || []).map((check: unknown[]) => `<tr><td><b>${deps.escape(check[0])}</b></td><td>${deps.escape(check[1])}</td><td>${deps.escape(check[2])}</td></tr>`).join('');
    let html = `<section class="nce-detail"><div class="nce-detail-head"><h3>Phiếu NCE ${deps.escape(model.nceTitle)}</h3><div class="nce-detail-status">${deps.escape(model.wfLabel)}</div></div><div class="nce-detail-grid">${field('Ngày xảy ra', model.eventDateText)}${field('Xét nghiệm / mức / lô', model.testLevelText)}${field('Luật / loại sai số', model.ruleErrText)}${field('Nguồn / giai đoạn', model.sourcePhaseText)}${field('Người phụ trách / hạn', model.ownerDueText)}${field('Trạng thái bản ghi', model.recordStatusText)}</div>`;
    if (!model.modern) return html + `<h4>Hành động đã ghi</h4><div class="nce-detail-text">${deps.escape(model.legacyActionText)}</div><h4>QC chạy lại / duyệt</h4><div class="nce-detail-grid">${field('QC chạy lại', model.rerunText)}${field('Phê duyệt', model.approvalShortText)}</div></section>`;
    html += `<h4>1. Kiểm soát và xử lý tức thời</h4><div class="nce-detail-stack"><div class="nce-detail-grid">${field('Phạm vi kiểm soát', model.containmentText)}${field('Ghi chú phạm vi', model.containmentNote)}</div><div class="nce-detail-text">${deps.escape(model.correctionText)}</div></div>`;
    html += `<h4>2. Đánh giá nguy cơ ban đầu</h4><div class="nce-detail-grid">${field('Phân loại / RPN', model.riskText)}${field('S x O x D', model.sodText)}${field('Căn cứ SOP', model.riskBasis, true)}</div>`;
    html += `<h4>3. Checklist điều tra</h4><table class="nce-check-table"><colgroup><col class="nce-check-item-col"><col class="nce-check-result-col"><col class="nce-check-note-col"></colgroup><tr><th>Hạng mục</th><th>Kết luận</th><th>Ghi chú / bằng chứng</th></tr>${checks}</table>`;
    html += `<h4>4. Nguyên nhân và hành động khắc phục</h4><div class="nce-detail-stack"><div class="nce-detail-grid">${field('Nhóm nguyên nhân', model.causeCategoryText)}${field('Ngày hoàn thành hành động', model.actionCompletedText)}</div><div class="nce-detail-text"><b>Nguyên nhân:</b> ${deps.escape(model.causeText)}\n<b>Hành động khắc phục:</b> ${deps.escape(model.actionText)}</div></div>`;
    html += `<h4>5. Bằng chứng QC chạy lại và cho phép trở lại</h4><div class="nce-detail-grid">${field('QC chạy lại', model.rerunText)}${field('Quyết định', model.releaseText)}${field('Ngày / người cho phép', model.releaseWhoText)}${field('Căn cứ cho phép', model.releaseNote)}</div>`;
    html += `<h4>6. Ảnh hưởng người bệnh</h4><div class="nce-detail-grid">${field('Kết luận', model.patientText)}${field('Xử lý kết quả liên quan', model.patientAction)}</div>`;
    html += `<h4>7. Hiệu lực, nguy cơ còn lại và phê duyệt</h4><div class="nce-detail-grid">${field('Đánh giá hiệu lực', model.effLabel)}${field('Ngày / người đánh giá', model.effWhoText)}${field('Bằng chứng hiệu lực', model.effNote)}${field('Nguy cơ còn lại', model.residualText)}${field('Căn cứ đánh giá lại', model.residualBasis)}${field('Phê duyệt', model.approvalText)}${field('Ý kiến duyệt', model.approvalNote, true)}</div>`;
    if (model.cancelled) html += `<h4>Thông tin hủy hồ sơ</h4><div class="nce-detail-text">${deps.escape(model.cancelText)}</div>`;
    return html + '</section>';
  };
}

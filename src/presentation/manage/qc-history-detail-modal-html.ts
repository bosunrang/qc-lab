export type QcHistoryDetailModalInput = {
  title: string;
  historyRowsHtml: string;
  historyEmptyHtml: string;
  pointCount: number;
  pointRowsHtml: string;
  pointsEmptyHtml: string;
  closeButtonHtml: string;
};

export function qcHistoryDetailModalHtml(input: QcHistoryDetailModalInput) {
  const history=input.historyRowsHtml?`<table class="history-detail-table hist-meansd-table"><thead><tr><th>Lô QC</th><th class="num">Mean</th><th class="num">SD</th><th class="num">Mean tích lũy</th><th class="num">SD tích lũy</th><th class="num">CV tích lũy</th><th>Hiệu lực</th><th>Nguồn</th></tr></thead><tbody>${input.historyRowsHtml}</tbody></table>`:input.historyEmptyHtml;
  const points=input.pointRowsHtml?`<table class="history-detail-table hist-points-table"><thead><tr><th>Ngày</th><th>Lần chạy</th><th class="num">Giá trị</th><th class="num">Z</th><th class="num">Mean lúc nhập</th><th class="num">SD lúc nhập</th><th>Kết luận nhanh</th><th>NV</th></tr></thead><tbody>${input.pointRowsHtml}</tbody></table>`:input.pointsEmptyHtml;
  return `<div class="modal rcfg-history-detail-modal"><div class="modal-h"><div><h3>${input.title}</h3></div><button class="modal-close" data-action="closeModal">✕</button></div><div class="modal-b">
    <h4 class="history-detail-heading">Mean/SD đã dùng</h4>${history}
    <h4 class="flow-panel space-after-section">Điểm QC đã nhập (${input.pointCount})</h4>${points}</div><div class="modal-f">${input.closeButtonHtml}</div></div>`;
}

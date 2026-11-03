// Bản in biên bản xem xét dữ liệu QC tháng (GV4 mục 2): biểu mẫu có kiểm soát
// tài liệu, số liệu do main tính, kết luận và người ký lấy từ lần ký hiện hành.
import type { QcMonthlyReview } from '../../shared/qc-api';
import { REVIEW_CONCLUSION_LABELS } from '../../main/domain/monthly-review';
import { NCE_STATUS_LABEL } from '../../main/domain/nce/labels';
import { DOCUMENT_CSS, documentHeader, escapeHtml, signatureBlock, type PrintIdentity } from './print-document';

export const fixed = (value: number | null | undefined, digits: number) => (value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits));
export const monthLabel = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
export const dateTimeText = (iso: string) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');

export const nceStatusText = (status: string) => (NCE_STATUS_LABEL as Record<string, string>)[status] || status;

export const REVIEW_HEADERS = ['Xét nghiệm', 'Máy', 'Mức', 'Lô', 'n', 'Dùng TK', 'Bị loại', 'Mean', 'SD', 'CV%', 'Mean đích', 'CV đích %', 'Dịch (SD)', 'Bias %', 'Huỷ'];

/** Một dòng số liệu dùng chung cho bảng trên trang và bản in. */
export function reviewRowCells(row: QcMonthlyReview['rows'][number]): string[] {
  const d = row.decimal_places;
  return [
    row.test_name, row.instrument_name, `M${row.level}`, row.lot || '—', String(row.n), String(row.accepted), String(row.rejected),
    fixed(row.mean, d), fixed(row.sd, d + 1), fixed(row.cv, 2), `${fixed(row.target_mean, d)}${row.target_changed ? ' *' : ''}`, fixed(row.target_cv, 2),
    fixed(row.shift_sd, 2), fixed(row.bias_pct, 2), row.voided ? `${row.voided}${row.voided_rejected ? ` (${row.voided_rejected} lần chạy loại)` : ''}` : '0',
  ];
}

export function totalsText(review: QcMonthlyReview): string {
  const t = review.totals;
  return `${t.points} kết quả · ${t.accepted} dùng thống kê · ${t.rejected_runs} lần chạy bị loại · ${t.voided} điểm huỷ${t.voided_rejected ? ` (${t.voided_rejected} thuộc lần chạy bị loại)` : ''} · ${t.nce} hồ sơ NCE, ${t.nce_open} chưa đóng`;
}

export function buildMonthlyReviewPrintHtml(identity: PrintIdentity, review: QcMonthlyReview): string {
  const latest = review.signatures.at(-1);
  const rows = review.rows.map((row) => `<tr>${reviewRowCells(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  const nce = review.nce.length
    ? `<table><thead><tr><th>Hồ sơ</th><th>Xét nghiệm</th><th>Loại sai số</th><th>Trạng thái</th></tr></thead><tbody>${review.nce.map((row) => `<tr><td>${escapeHtml(row.nce_id)}</td><td>${escapeHtml(row.test_name)}</td><td>${escapeHtml(row.error_class || '—')}</td><td>${escapeHtml(nceStatusText(row.status))}</td></tr>`).join('')}</tbody></table>`
    : '<p class="meta">Không có hồ sơ NCE nào có lần chạy trong tháng.</p>';
  const conclusion = latest
    ? `<p><b>Kết luận:</b> ${escapeHtml(REVIEW_CONCLUSION_LABELS[latest.conclusion])}${latest.note ? ` — ${escapeHtml(latest.note)}` : ''}</p><p class="meta">Người xem xét: ${escapeHtml(latest.reviewer_name)} · ${escapeHtml(dateTimeText(latest.reviewed_at))}</p>`
    : '<p class="meta">Chưa có kết luận xem xét.</p>';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Biên bản xem xét QC tháng</title>
  <style>
    @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}
    body{font:9px Arial,sans-serif;color:#183843;margin:0;}
    h2{font-size:11px;color:#215968;margin:12px 0 5px;break-after:avoid;}
    p{margin:4px 0}p.meta{color:#506674;}
    table{width:100%;border-collapse:collapse;} th,td{border:1px solid #c9d9d6;padding:3px 5px;text-align:left;overflow-wrap:anywhere;}
    th{background:#e9f1f2;print-color-adjust:exact;-webkit-print-color-adjust:exact;} thead{display:table-header-group} tr{break-inside:avoid}
    ${DOCUMENT_CSS}
  </style></head><body>
  ${documentHeader(identity, 'Biên bản xem xét dữ liệu nội kiểm', `Tháng ${monthLabel(review.ym)}`, [totalsText(review)])}
  ${review.open_items ? `<p><b>Việc còn tồn:</b> ${escapeHtml(review.open_items)}</p>` : ''}
  <h2>Số liệu theo xét nghiệm, mức và lô</h2>
  <table><thead><tr>${REVIEW_HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${REVIEW_HEADERS.length}">Không có kết quả QC trong tháng.</td></tr>`}</tbody></table>
  <p class="meta">Mean, SD, CV tính trên kết quả dùng thống kê (không thuộc lần chạy bị loại). Dịch (SD) = (Mean − Mean đích) / SD đích. * Mean/SD đích đổi trong tháng.</p>
  <h2>Hồ sơ khắc phục sự cố (NCE)</h2>${nce}
  <h2>Kết luận xem xét</h2>${conclusion}
  ${signatureBlock()}</body></html>`;
}

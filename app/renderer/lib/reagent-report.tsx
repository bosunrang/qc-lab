import REAGENT_REPORT_CSS from '../print/reagent.css?raw';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReagentComparisonView } from '../../shared/qc-api';
import { StatsPanel, CriteriaPanel, ReagentCharts } from '../components/ReagentResults';
import { fmt, fmtFixed, MIN_PAIRS } from './reagent-format';
import { vnDate } from './format';
import { DOCUMENT_CSS, documentHeader, escapeHtml, signatureBlock, type PrintIdentity } from './print-document';

// Chỉ định dạng số và các cột dẫn xuất như trên màn hình; thống kê, tiêu chí
// và kết luận luôn lấy từ kết quả do main cung cấp, không tính lại khi in.
export function buildReagentReport(comparison: ReagentComparisonView, identity: PrintIdentity): string {
  const information = [
    ['Tên hoá chất', comparison.reagent], ['Đơn vị', comparison.unit],
    ['Số lô cũ', comparison.lot_old], ['Số lô mới', comparison.lot_new],
    ['Ngày thực hiện', comparison.date ? vnDate(comparison.date) : ''], ['Người thực hiện', comparison.operator],
    ['Loại mẫu', comparison.sample_type], ['Bias mong muốn (%)', fmt(comparison.bias_target ?? 6, 3)],
    ['Mức ý nghĩa (α, alpha)', fmt(comparison.alpha ?? 0.05, 4)],
    ['Bao phủ khoảng đo / điểm quyết định lâm sàng theo SOP', comparison.coverage_confirmed ? 'Đã xác nhận theo SOP' : 'Chưa xác nhận theo SOP'],
  ];
  const content = renderToStaticMarkup(<main>
    <section>
      <h2>Thông tin đánh giá</h2>
      <dl className="rc-print-info">{information.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    </section>
    <section>
      <h2>Dữ liệu đo bắt cặp</h2>
      <table className="rc-print-pairs">
        <thead><tr><th>Mẫu</th><th>Lô cũ: {comparison.lot_old || '—'}</th><th>Lô mới: {comparison.lot_new || '—'}</th><th>Trung bình</th><th>Hiệu số (cũ − mới)</th></tr></thead>
        <tbody>{comparison.rows.map(([oldValue, newValue], index) => {
          const oldNumber = Number(oldValue), newNumber = Number(newValue);
          const complete = oldValue.trim() !== '' && newValue.trim() !== '' && Number.isFinite(oldNumber) && Number.isFinite(newNumber);
          return <tr key={index}><td>{index + 1}</td><td>{oldValue || '—'}</td><td>{newValue || '—'}</td>
            <td>{complete ? fmtFixed((oldNumber + newNumber) / 2) : '—'}</td><td>{complete ? fmtFixed(oldNumber - newNumber) : '—'}</td></tr>;
        })}</tbody>
      </table>
      <p className="rc-print-note">Số cặp hợp lệ dùng để tính thống kê: {comparison.result?.N ?? `chưa đủ ${MIN_PAIRS} cặp`}. Dòng thiếu hoặc không hợp lệ được giữ trong bảng và không dùng để tính thống kê.</p>
    </section>
    <StatsPanel result={comparison.result} />
    <CriteriaPanel result={comparison.result} />
    <ReagentCharts comparison={comparison} />
  </main>);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(`So sánh hoá chất — ${comparison.reagent}`)}</title>
    <style>${REAGENT_REPORT_CSS}${DOCUMENT_CSS}</style></head><body class="${comparison.result ? 'has-result' : ''}">
    ${documentHeader(identity, 'So sánh hoá chất', comparison.reagent, [])}${content}${signatureBlock()}</body></html>`;
}

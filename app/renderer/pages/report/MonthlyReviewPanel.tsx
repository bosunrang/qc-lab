// Khung "Biên bản xem xét QC tháng" của trang Báo cáo (GV4 mục 2, ISO 15189:2022
// 7.3.7.2): số liệu nội kiểm của tháng do main tính, người có quyền `qc.config`
// ký kết luận, in thành biểu mẫu có kiểm soát tài liệu.
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useReportStore } from '../../store/report-store';
import { useAuthStore } from '../../store/auth-store';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { hasUserCapability } from '../../../main/domain/capabilities';
import { REVIEW_CONCLUSIONS, REVIEW_CONCLUSION_LABELS } from '../../../main/domain/monthly-review';
import { isoLocalDate } from '../../../main/domain/local-date';
import { buildMonthlyReviewPrintHtml, dateTimeText, monthLabel, nceStatusText, REVIEW_HEADERS, reviewRowCells, totalsText } from '../../lib/monthly-review-print';
import { loadPrintIdentity } from '../../lib/print-document';
import { printHtmlToPdf } from '../../lib/export';
import { errorDialog } from '../../state/dialog-store';
import { showToast } from '../../state/toast-store';
import { PrintIcon } from '../../components/PrintIcon';
import type { QcReviewConclusion } from '../../../shared/qc-api';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function MonthlyReviewPanel() {
  const { review, reviewLoading, loadReview, signReview } = useReportStore(useShallow((s) => ({ review: s.review, reviewLoading: s.reviewLoading, loadReview: s.loadReview, signReview: s.signReview })));
  const user = useAuthStore((s) => s.user);
  const canSign = hasUserCapability(user, 'qc.config');
  const thisMonth = isoLocalDate().slice(0, 7);
  const [ym, setYm] = useState(thisMonth);
  const [conclusion, setConclusion] = useState<QcReviewConclusion>('ok');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void loadReview(ym); }, [ym, loadReview]);
  // Tổng hợp một tháng tốn khoảng 1–2 giây ở dữ liệu nhiều năm, nên không tự
  // tính lại sau mỗi điểm nhập; chỉ nạp lại khi có lần ký mới, còn lại dùng nút
  // "Tải lại số liệu". Lúc ký, main luôn tính lại từ dữ liệu hiện tại.
  useStoreInvalidation(['qc_month_reviews'], undefined, () => { void loadReview(ym); });

  const year = Number(ym.slice(0, 4)), month = Number(ym.slice(5, 7));
  const years = Array.from({ length: 5 }, (_, i) => Number(thisMonth.slice(0, 4)) - 3 + i);
  const shown = review?.ym === ym ? review : null;
  const latest = shown?.signatures.at(-1);

  async function sign() {
    setBusy(true);
    try {
      const result = await signReview(ym, conclusion, note);
      if (!result.ok) { await errorDialog(result.error.message); return; }
      setNote('');
      showToast(`Đã ký biên bản xem xét QC tháng ${monthLabel(ym)}.`);
    } finally { setBusy(false); }
  }

  async function print() {
    if (!shown) return;
    const identity = await loadPrintIdentity('review');
    const error = await printHtmlToPdf(buildMonthlyReviewPrintHtml(identity, shown), `bien-ban-xem-xet-qc-${ym}.pdf`, { pageNumbers: true });
    if (error) await errorDialog(error);
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Biên bản xem xét QC tháng</h2>
      <div className="report-panel-body">
        <div className="report-lock-controls">
          <div className="field">
            <label htmlFor="review-month">Tháng</label>
            <select id="review-month" value={month} onChange={(e) => setYm(`${year}-${String(Number(e.target.value)).padStart(2, '0')}`)}>
              {MONTHS.map((m) => <option value={m} key={m}>Tháng {m}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="review-year">Năm</label>
            <select id="review-year" value={year} onChange={(e) => setYm(`${e.target.value}-${String(month).padStart(2, '0')}`)}>
              {years.map((y) => <option value={y} key={y}>{y}</option>)}
            </select>
          </div>
          <div className="report-lock-action">
            <button className="btn ghost" disabled={reviewLoading} onClick={() => void loadReview(ym)}>{reviewLoading ? 'Đang tổng hợp…' : 'Tải lại số liệu'}</button>
            <button className="btn ghost" disabled={!shown} onClick={() => void print()}><PrintIcon />In biên bản</button>
          </div>
        </div>

        {!shown ? <p className="hint" role="status">{reviewLoading ? 'Đang tổng hợp số liệu…' : ''}</p> : <>
          <p className="monthly-review-totals">{totalsText(shown)}</p>
          {shown.open_items && <div className="alert warn" role="status">Việc còn tồn: {shown.open_items}</div>}
          <div className="monthly-review-table-wrap">
            <table className="monthly-review-table">
              <thead><tr>{REVIEW_HEADERS.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {shown.rows.length ? shown.rows.map((row) => (
                  <tr key={`${row.test_id}|${row.level}|${row.lot}`}>{reviewRowCells(row).map((cell, i) => <td key={i} className={i >= 4 ? 'num' : undefined}>{cell}</td>)}</tr>
                )) : <tr><td colSpan={REVIEW_HEADERS.length}>Không có kết quả QC trong tháng {monthLabel(ym)}.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="hint">Mean, SD, CV tính trên kết quả dùng thống kê. Dịch (SD) = (Mean − Mean đích) / SD đích. Dấu * là Mean/SD đích đổi trong tháng. Tiêu chí đánh giá theo SOP của phòng xét nghiệm.</p>
          {shown.nce.length > 0 && <p className="hint">Hồ sơ NCE trong tháng: {shown.nce.map((row) => `${row.nce_id} (${row.test_name}, ${nceStatusText(row.status)})`).join('; ')}.</p>}

          <div className="monthly-review-sign">
            <div className={`alert${latest ? ' ok' : ''}`} role="status">
              {latest
                ? <>Đã ký: <b>{REVIEW_CONCLUSION_LABELS[latest.conclusion]}</b>{latest.note ? ` — ${latest.note}` : ''} · {latest.reviewer_name} · {dateTimeText(latest.reviewed_at)}{shown.signatures.length > 1 ? ` · ký ${shown.signatures.length} lần` : ''}</>
                : `Tháng ${monthLabel(ym)} chưa có biên bản xem xét.`}
            </div>
            {canSign ? (
              <div className="monthly-review-sign-form">
                <div className="field">
                  <label htmlFor="review-conclusion">Kết luận</label>
                  <select id="review-conclusion" value={conclusion} onChange={(e) => setConclusion(e.target.value as QcReviewConclusion)}>
                    {REVIEW_CONCLUSIONS.map((value) => <option key={value} value={value}>{REVIEW_CONCLUSION_LABELS[value]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="review-note">Nhận xét {conclusion !== 'ok' && <span className="req">*</span>}</label>
                  <input id="review-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={conclusion === 'ok' ? 'Không bắt buộc' : 'Cần theo dõi hoặc khắc phục gì (tối thiểu 10 ký tự)'} />
                </div>
                <div className="report-lock-action"><button className="btn teal" disabled={busy || ym > thisMonth} onClick={() => void sign()}>{latest ? 'Ký lại' : 'Ký xem xét'}</button></div>
              </div>
            ) : <p className="hint">Cần quyền cấu hình tiêu chí QC để ký xem xét.</p>}
          </div>
        </>}
      </div>
    </div>
  );
}

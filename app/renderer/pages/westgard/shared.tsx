// Phần dùng chung giữa bảng lô đang vận hành và tab nhóm lô đã dừng/lưu trữ
// của trang Phân tích Westgard. Tách khỏi `WestgardPage.tsx` ngày 2026-09-26
// (kế hoạch kiến trúc D.7).
import { useMemo, useState } from 'react';
import { vnDate as formatVnDate } from '../../lib/format';
import type { LevelAnalysis } from '../../../shared/qc-api';
import { Pagination, pageBounds } from '../../components/Pagination';
import { POINT_FILTERS, POINT_PAGE_SIZE, effectiveFilter, filterCounts, pointRows, type PointFilter } from './point-filter';

export const VERDICT_LABEL: Record<string, string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };
/** Định dạng ngày ISO theo cách hiển thị tiếng Việt. */
export const vnDate = (iso: string) => formatVnDate(iso, '—');
/** Mã chạy tự sinh có dạng YYYY-MM-DD-1; trong bảng chỉ cần số lần chạy.
 * Mã nguyên vẹn vẫn có ở tooltip để truy vết và với mã LIS tự do. */
const runLabel = (runId: string) => {
  const generated = /^(?:\d{4}-\d{2}-\d{2})-(\d+)$/.exec(runId);
  return generated ? `Lần ${generated[1]}` : `Lần chạy: ${runId}`;
};
/** `none` không có Mean/SD nên z-score là NaN: tuyệt đối không đưa chuỗi
 * "NaNs" vào bảng, Excel hoặc PDF vì dễ bị hiểu là một kết quả xét nghiệm. */
const zText = (z: number) => Number.isFinite(z) ? `${z >= 0 ? '+' : ''}${z.toFixed(2)}s` : '—';

/** Nhãn cho điểm tự nó đạt nhưng cả lần chạy bị loại. Nêu rõ MỨC nguồn để
 * không bị hiểu nhầm là chính điểm đang xem sai.
 *
 * Đọc thẳng `runRejectedBy` do main trả (`rejectedLevelsByRun()`), KHÔNG tự
 * dò lại. Bản trước quét `analysisByLevel` tìm mức khác có điểm cùng
 * ngày + mã run mang verdict 'rej' — một bản sao thứ hai của cùng một phép
 * tính, và sai ở hai chỗ: chỉ nêu được MỘT mức dù nhiều mức cùng hỏng, và
 * khi bảng đang mở "Xem lô cũ" thì điểm hiển thị là của lô đã chuyển tiếp
 * trong khi vòng dò vẫn đọc điểm của LÔ ĐANG CHẠY — tra nhầm chuỗi, nên
 * gần như luôn rơi về nhãn chung chung. Tab "Nhóm lô đã dừng" thậm chí
 * không gọi nó, chỉ in cứng nhãn chung. */
const runExclusionLabel = (point: { runRejectedBy?: number[] }) => {
  const by = point.runRejectedBy || [];
  return by.length ? `Lần chạy bị loại ở ${by.map((level) => `Mức ${level}`).join(', ')}` : 'Lần chạy bị loại ở mức khác';
};

/** Bảng điểm Westgard của một mức: kết luận, luật, bằng chứng lịch sử và loại
 * sai số. Dùng chung cho lô đang vận hành, lô cũ đang mở và tab nhóm lô đã
 * dừng — trước đây là hai bản chép gần giống nhau; điểm lịch sử có
 * `cusumSignal: null` nên phần CUSUM tự ẩn. */
export function WestgardPointTable({ points, decimals, label }: { points: LevelAnalysis['points']; decimals: number; label: string }) {
  // `null` = chưa chọn: mặc định "Có vi phạm", hoặc "Tất cả" khi không có vi
  // phạm nào (xem `effectiveFilter()`).
  const [chosen, setChosen] = useState<PointFilter | null>(null);
  const [page, setPage] = useState(1);
  const counts = useMemo(() => filterCounts(points), [points]);
  const filter = effectiveFilter(chosen, counts);
  const view = useMemo(() => pointRows(points, filter, page), [points, filter, page]);
  return (
    <>
      <div className="wg-table-filter">
        <div className="dayseg" role="group" aria-label={`Lọc điểm QC ${label}`}>
          {POINT_FILTERS.map(({ key, label: text }) => (
            <button type="button" key={key} className={filter === key ? 'on' : ''} aria-pressed={filter === key}
              onClick={() => { setChosen(key); setPage(1); }}>{text} ({counts[key]})</button>
          ))}
        </div>
        <span className="hint">Mới nhất trước</span>
      </div>
      <div className="chart-scroll">
        <table className="wg-table">
          <thead><tr><th>#</th><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th className="wg-verdict-head">Kết luận</th><th className="wg-evidence-head">Luật / bằng chứng</th><th>Loại sai số</th></tr></thead>
          <tbody>
            {!view.rows.length && <tr><td colSpan={7} className="hint wg-table-empty">Không có điểm nào thuộc nhóm "{POINT_FILTERS.find((item) => item.key === filter)?.label}".</td></tr>}
            {view.rows.map(({ point: p, seq }) => (
              <tr key={p.id}>
                <td title={`Mã lần chạy: ${p.runId}`}>{seq}</td><td title={`Mã lần chạy: ${p.runId}`}>{vnDate(p.date)}<small className="hint" style={{ display: 'block' }}>{runLabel(p.runId)}</small></td>
                <td className="num">{p.val.toFixed(decimals)}</td>
                <td className="num">{zText(p.z)}</td>
                <td className="wg-verdict-cell">
                  <span className={`tag ${p.verdict}`}>{VERDICT_LABEL[p.verdict]}</span>{p.runRejected && p.verdict !== 'rej' && <span className="tag none" title="Điểm này đạt riêng lẻ nhưng không được dùng cho thống kê vì một mức khác trong cùng run bị loại">{runExclusionLabel(p)}</span>}
                  {p.cusumSignal && <span className="tag warn" title="Tín hiệu xu hướng CUSUM; không tự loại điểm QC">Cảnh báo CUSUM</span>}
                </td>
                <td className="wg-evidence-cell">
                  <div className="wg-rule-chips">
                  {p.rules.map((r) => <span className="pill" key={r}>{r}</span>)}
                  {p.cusumSignal && <span className="pill warn" title="CUSUM vượt ngưỡng h; cần rà soát xu hướng">{p.cusumSignal}</span>}
                  {p.supportRules.map((r) => <span className="pill hint wg-support-rule" key={`s-${r}`} title="Điểm lịch sử cấu thành quy tắc — chỉ là bằng chứng" aria-label={`Bằng chứng lịch sử cho luật ${r}`}><span aria-hidden="true">↩</span><span>{r}</span></span>)}
                  {!p.rules.length && !p.cusumSignal && !p.supportRules.length && '—'}
                  </div>
                </td>
                <td className="hint">{p.errorType !== '—' ? <div className="wg-error-type"><b>{p.errorType}</b><small>{p.errorDesc}</small></div> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={view.page} pageCount={view.pageCount} {...pageBounds(view.page, POINT_PAGE_SIZE, view.total)} total={view.total}
        unit="điểm" label={`Phân trang điểm QC ${label}`} onPageChange={setPage} />
    </>
  );
}

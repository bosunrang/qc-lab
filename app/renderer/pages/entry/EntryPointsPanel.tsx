// "Điểm trong khoảng xem": bảng chi tiết từng cột kèm thống kê tích lũy, nút
// huỷ điểm và danh sách điểm đã huỷ trong khoảng xem.
import { memo } from 'react';
import { observedStats } from '../../../main/domain/observed-stats';
import { EmptyState } from '../../components/EmptyState';
import { TrashIcon, VERDICT_LABEL, formatQcValue, inLjWindow, runExcludedNote, vnDate, zText, type DisplayColumn } from './shared';
import type { QcPointView, VoidedQcPointView } from '../../../shared/qc-api';

export const EntryPointsPanel = memo(function EntryPointsPanel({ displayColumns, voidedPoints, decimals, writable, ljFrom, ljTo, onVoid }: {
  displayColumns: DisplayColumn[];
  voidedPoints: VoidedQcPointView[];
  decimals: number;
  writable: boolean;
  ljFrom: string;
  ljTo: string;
  onVoid: (point: QcPointView) => void;
}) {
  const valText = (val: number) => formatQcValue(val, decimals);
  const voidedInWindow = inLjWindow(voidedPoints, ljFrom, ljTo);
  return (
    <section className="panel entry-secondary-panel qc-points-panel">
      <div className="entry-secondary-summary"><span>Điểm trong khoảng xem</span><small>Tra cứu chi tiết, luật vi phạm và điểm đã hủy</small></div>
      <div className="entry-secondary-body">
        <div className="hint qc-cumulative-note">Thống kê tích lũy tính từ đầu LOT trên các lần chạy được chấp nhận; bảng bên dưới hiển thị theo khoảng xem {vnDate(ljFrom)} – {vnDate(ljTo)}.</div>
        <div className="qc-table-grid">
          {displayColumns.map((column) => {
            const all = column.points;
            const active = inLjWindow(all.filter((p) => !p.voided), ljFrom, ljTo);
            // Mean/SD/CV tích lũy chỉ tính trên LẦN CHẠY ĐƯỢC CHẤP
            // NHẬN. Gộp cả dữ liệu mất kiểm soát vào thì chính sự
            // cố đó nống SD lên, và lần sau cùng một sự cố không
            // còn vượt ngưỡng nữa — hệ QC tự làm mù mình. Con số
            // "đã ghi nhận bao nhiêu" vẫn giữ riêng cho truy vết
            // ISO 15189, không trộn vào phép thống kê.
            const recorded = all.filter((p) => !p.voided && (!ljTo || p.date <= ljTo));
            const cumulative = recorded.filter((p) => p.accepted !== false);
            const excluded = recorded.length - cumulative.length;
            const { n, mean, sd, cv } = observedStats(cumulative);
            return (
              <div className={`qc-table-card${column.parallel ? ' qc-parallel-card' : ''}${column.previous ? ' qc-previous-card' : ''}`} key={column.key}>
                <h4><span>Mức {column.level} · {column.previous ? 'Lô cũ ' : 'Lô '}{column.lot}{column.parallel && <span className="qc-parallel-label">Song song</span>}<span className="hint qc-table-count">{active.length} điểm trong khoảng</span></span></h4>
                <div className="qc-cumulative">
                  <div><span>N dùng thống kê</span><b>{n}</b></div>
                  <div><span>Mean tích lũy</span><b>{mean != null ? mean.toFixed(decimals) : '—'}</b></div>
                  <div><span>SD tích lũy</span><b>{sd != null ? sd.toFixed(4) : '—'}</b></div>
                  <div><span>CV tích lũy</span><b>{cv != null ? cv.toFixed(2) + '%' : '—'}</b></div>
                </div>
                <div className="hint qc-cumulative-source">Tổng ghi nhận {recorded.length}{excluded ? ` · ${excluded} điểm thuộc lần chạy bị loại, không vào thống kê` : ''}</div>
                {active.length ? (
                  <table>
                    <thead><tr><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th>Kết luận</th><th>Luật</th><th>Thao tác</th></tr></thead>
                    <tbody>
                      {active.map((p) => (
                        <tr key={p.id} className={p.verdict === 'rej' ? 'qc-point-rej' : p.verdict === 'warn' ? 'qc-point-warn' : ''}>
                          <td>{vnDate(p.date)}</td><td className="num"><b>{valText(p.val)}</b></td><td className="num">{zText(p, column)}</td>
                          <td>
                            <span className={`tag ${p.verdict}`}>{VERDICT_LABEL[p.verdict]}</span>
                            {runExcludedNote(p) && <span className="qc-run-excluded" title="Lần chạy bị loại thì mọi mức trong lần chạy đó phải chạy lại; kết quả cũ không vào Mean/SD/CV thực.">{runExcludedNote(p)}</span>}
                          </td>
                          <td>{p.rules.length ? p.rules.map((r) => <span className="pill" key={r}>{r}</span>) : '—'}</td>
                          <td className="qc-row-actions">{writable ? <button type="button" className="qc-row-void" title="Hủy điểm QC" aria-label={`Hủy điểm QC ngày ${vnDate(p.date)}`} onClick={() => onVoid(p)}><TrashIcon /></button> : <span className="hint">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <EmptyState className="qc-table-empty">Chưa có điểm nào trong mức này.</EmptyState>}
              </div>
            );
          })}
        </div>
        {voidedInWindow.length > 0 && (
          <div className="qc-voided-box">
            <h4>Điểm đã hủy trong khoảng</h4>
            <table className="qc-voided-table">
              <thead><tr><th>Ngày</th><th>Mức / lô</th><th className="num">Giá trị</th><th>Lần chạy</th><th>Người hủy</th><th>Lý do</th></tr></thead>
              <tbody>{voidedInWindow.map((point) => (
                <tr key={point.id}>
                  <td>{vnDate(point.date)}</td><td>Mức {point.level} · Lô {point.lot || '—'}</td>
                  <td className="num">{valText(point.val)}</td><td>{point.run_id || '—'}</td>
                  <td>{point.voided_by || '—'}</td><td>{point.void_reason || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
});

import type { EqaReportReview } from '../../../shared/qc-api';
import { EQA_REVIEW_LABELS } from '../../lib/eqa-report-document';
import { EmptyState } from '../../components/EmptyState';

export function EqaReviewHistory({ reviews, selectedId, onSelect, disabled }: {
  reviews: readonly EqaReportReview[]; selectedId: string; onSelect: (id: string) => void; disabled: boolean;
}) {
  return <section className="panel eqa-review-history" aria-label="Lịch sử phiếu xem xét">
    <div className="panel-head"><h2>Lịch sử phiếu xem xét</h2><span className="tag none"><span className="sr-only">Số lần ký: </span>{reviews.length}</span></div>
    <div className="eqa-review-history-body">
      {reviews.length ? <table className="eqa-review-history-table" aria-label="Các lần ký xem xét">
        <thead><tr><th scope="col">Phiếu xem xét</th><th scope="col">Ngày ký</th></tr></thead>
        <tbody>{reviews.map((r) => <tr key={r.id} className={r.id === selectedId ? 'is-selected' : undefined}>
          <td><button type="button" className="eqa-history-open" aria-pressed={r.id === selectedId} disabled={disabled} onClick={() => onSelect(r.id)}>{EQA_REVIEW_LABELS[r.kind]}</button><span className="eqa-history-signer">{r.actor_name}</span></td>
          <td><time dateTime={r.decided_at}>{new Date(r.decided_at).toLocaleDateString('vi-VN')}<span>{new Date(r.decided_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span></time><span className={`tag ${r.current ? 'ok' : 'warn'}`}>{r.current ? 'Hiện hành' : 'Căn cứ cũ'}</span></td>
        </tr>)}</tbody>
      </table> : <EmptyState size="compact" title="Chưa có phiếu xem xét">Các lần ký trong phạm vi đang chọn sẽ hiển thị tại đây.</EmptyState>}
    </div>
  </section>;
}

// Dải tổng hợp dùng chung cho Tổng quan và Kỳ báo cáo, dựa trên xếp loại đã có.
import type { EqaCounts } from '../../../main/domain/eqa/evaluation';

export function EqaResultsSummary({ totals, description, loading = false, failed = false, filter, onFilter, rejectionHint = 'Xem kết quả liên quan' }: {
  totals: EqaCounts; description: string; loading?: boolean; failed?: boolean;
  filter: 'all' | 'ok' | 'warn' | 'rej' | 'attention';
  onFilter: (filter: 'all' | 'ok' | 'warn' | 'rej') => void; rejectionHint?: string;
}) {
  const unavailable = loading || failed;
  const toggle = (value: 'ok' | 'warn' | 'rej') => onFilter(filter === value ? 'all' : value);
  return <div className="eqa-overview-summary" aria-label="Tổng hợp kết quả ngoại kiểm">
    <button type="button" className="eqa-accept-summary" aria-pressed={filter === 'ok'} onClick={() => toggle('ok')} disabled={unavailable || !totals.total}>
      <span className="eqa-summary-label">Tỷ lệ chấp nhận</span>
      <span className="eqa-accept-value"><b>{unavailable || totals.acceptPct === null ? '—' : `${totals.acceptPct.toFixed(1)}%`}</b><span>{failed ? 'Không tải được số liệu' : loading ? 'Đang tải…' : totals.total ? `${totals.ok}/${totals.total} kết quả` : 'Chưa có kết quả'}</span></span>
      <span className="eqa-accept-bar" aria-hidden="true">{!unavailable && totals.total > 0 && <>
        <i className="is-ok" style={{ width: `${totals.ok / totals.total * 100}%` }} />
        <i className="is-warn" style={{ width: `${totals.warn / totals.total * 100}%` }} />
        <i className="is-rej" style={{ width: `${totals.rej / totals.total * 100}%` }} />
      </>}</span>
      <small>{description}</small>
    </button>
    <button type="button" className="eqa-summary-count is-rej" aria-pressed={filter === 'rej'} disabled={unavailable} onClick={() => toggle('rej')}>
      <span className="eqa-summary-label">Không chấp nhận</span><b>{unavailable ? '—' : totals.rej}</b><small>{rejectionHint} <span aria-hidden="true">→</span></small>
    </button>
    <button type="button" className="eqa-summary-count is-warn" aria-pressed={filter === 'warn'} disabled={unavailable} onClick={() => toggle('warn')}>
      <span className="eqa-summary-label">Cảnh báo</span><b>{unavailable ? '—' : totals.warn}</b><small>Kết quả cần rà soát <span aria-hidden="true">→</span></small>
    </button>
  </div>;
}

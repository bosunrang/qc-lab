// Dải tổng hợp dùng chung cho Tổng quan, Kỳ báo cáo và Xem trước khi nhập.
import type { ReactNode } from 'react';
import type { EqaCounts } from '../../../main/domain/eqa/evaluation';

/** Chỉ dùng nút khi dải tổng hợp có thao tác lọc kết quả. */
function SummaryItem({ className, children, onClick, pressed, disabled }: {
  className: string; children: ReactNode; onClick?: () => void; pressed: boolean; disabled: boolean;
}) {
  return onClick
    ? <button type="button" className={className} aria-pressed={pressed} disabled={disabled} onClick={onClick}>{children}</button>
    : <div className={className}>{children}</div>;
}

export function EqaResultsSummary({ totals, description, loading = false, failed = false, filter = 'all', onFilter, rejectionHint = 'Xem kết quả liên quan' }: {
  totals: EqaCounts; description: string; loading?: boolean; failed?: boolean;
  filter?: 'all' | 'ok' | 'warn' | 'rej' | 'attention';
  onFilter?: (filter: 'all' | 'ok' | 'warn' | 'rej') => void; rejectionHint?: string;
}) {
  const unavailable = loading || failed;
  const toggle = (value: 'ok' | 'warn' | 'rej') => onFilter ? () => onFilter(filter === value ? 'all' : value) : undefined;
  return <div className="eqa-overview-summary" aria-label="Tổng hợp kết quả ngoại kiểm">
    <SummaryItem className="eqa-accept-summary" pressed={filter === 'ok'} onClick={toggle('ok')} disabled={unavailable || !totals.total}>
      <span className="eqa-summary-label">Tỷ lệ chấp nhận</span>
      <span className="eqa-accept-value"><b>{unavailable || totals.acceptPct === null ? '—' : `${totals.acceptPct.toFixed(1)}%`}</b><span>{failed ? 'Không tải được số liệu' : loading ? 'Đang tải…' : totals.total ? `${totals.ok}/${totals.total} kết quả` : 'Chưa có kết quả'}</span></span>
      <span className="eqa-accept-bar" aria-hidden="true">{!unavailable && totals.total > 0 && <>
        <i className="is-ok" style={{ width: `${totals.ok / totals.total * 100}%` }} />
        <i className="is-warn" style={{ width: `${totals.warn / totals.total * 100}%` }} />
        <i className="is-rej" style={{ width: `${totals.rej / totals.total * 100}%` }} />
      </>}</span>
      <small>{description}</small>
    </SummaryItem>
    <SummaryItem className={`eqa-summary-count is-rej${totals.rej === 0 ? ' is-zero' : ''}`} pressed={filter === 'rej'} disabled={unavailable} onClick={toggle('rej')}>
      <span className="eqa-summary-label">Không chấp nhận</span><b>{unavailable ? '—' : totals.rej}</b>{onFilter && <small>{rejectionHint} <span aria-hidden="true">→</span></small>}
    </SummaryItem>
    <SummaryItem className={`eqa-summary-count is-warn${totals.warn === 0 ? ' is-zero' : ''}`} pressed={filter === 'warn'} disabled={unavailable} onClick={toggle('warn')}>
      <span className="eqa-summary-label">Cảnh báo</span><b>{unavailable ? '—' : totals.warn}</b>{onFilter && <small>Kết quả cần rà soát <span aria-hidden="true">→</span></small>}
    </SummaryItem>
  </div>;
}

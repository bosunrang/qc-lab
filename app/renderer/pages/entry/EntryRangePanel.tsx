// "Thống kê toàn bộ & Dải kiểm soát": dải đang dùng, điều kiện lập dải PXN
// của mức đang chọn, và nút mở hộp thoại thiết lập / hoàn dải.
import { memo } from 'react';
import { EmptyState } from '../../components/EmptyState';
import type { RangeMode } from './RangeWorkflowModal';
import type { RangeCandidateView } from '../../../shared/qc-api';

export const EntryRangePanel = memo(function EntryRangePanel({ rangeCandidate, rangeError, levelNums, rangeLevel, decimals, writable, onRangeLevel, onOpen }: {
  rangeCandidate: RangeCandidateView | null;
  rangeError: string | null;
  levelNums: number[];
  rangeLevel: number | null;
  decimals: number;
  writable: boolean;
  onRangeLevel: (level: number) => void;
  onOpen: (mode: RangeMode) => void;
}) {
  const p = rangeCandidate?.proposed;
  const rangeSummaryText = p
    ? `N=${p.n} · Mean thực=${p.mean.toFixed(decimals)} · SD thực=${p.sd.toFixed(4)} · CV=${p.cv.toFixed(2)}%`
    : 'Chưa có dữ liệu của lô đang vận hành';
  return (
    <section className="panel entry-secondary-panel range-summary-panel">
      <div className="entry-secondary-summary range-summary-header">
        <span>Thống kê toàn bộ &amp; Dải kiểm soát</span>
        <small>{rangeSummaryText}</small>
        {levelNums.length > 1 && (
          <div className="dayseg" role="tablist" aria-label="Chọn mức QC cho thống kê và dải kiểm soát">
            {levelNums.map((level) => <button type="button" key={level} role="tab" aria-selected={rangeLevel === level}
              className={rangeLevel === level ? 'on' : ''} onClick={() => onRangeLevel(level)}>Mức {level}</button>)}
          </div>
        )}
      </div>
      <div className="entry-secondary-body">
        {rangeCandidate ? (
          <>
            <div className="range-band-note">
              <div className="range-band-copy">
                <div className="range-band-label">Dải đang dùng:</div>
                <div className="range-band-source">{rangeCandidate.source === 'lab' ? 'PXN tự xây dựng' : 'Nhà sản xuất'}</div>
                <div className="range-band-body">· Mức {rangeCandidate.level}: Mean={rangeCandidate.current.mean != null ? rangeCandidate.current.mean.toFixed(decimals) : '—'} SD={rangeCandidate.current.sd != null ? rangeCandidate.current.sd.toFixed(4) : '—'}.
                  {rangeCandidate.proposed
                    ? rangeCandidate.eligible
                      ? ` Đủ điều kiện lập dải mới (${rangeCandidate.proposed.n} kết quả / ${rangeCandidate.proposed.days} ngày độc lập). Dải đề xuất: Mean=${rangeCandidate.proposed.mean.toFixed(decimals)} SD=${rangeCandidate.proposed.sd.toFixed(4)} CV=${rangeCandidate.proposed.cv.toFixed(2)}%.`
                      : ` Cần ≥20 kết quả trên ≥20 ngày độc lập và không lần chạy nào bị loại — hiện ${rangeCandidate.proposed.n} kết quả / ${rangeCandidate.proposed.days} ngày, ${rangeCandidate.proposed.rejected} điểm thuộc lần chạy bị loại.`
                    : ' Chưa có dữ liệu của lô đang vận hành.'}
                </div>
              </div>
              {rangeCandidate.eligible && writable && <button type="button" className="btn teal range-band-action" onClick={() => onOpen('apply')}>Thiết lập dải PXN</button>}
            </div>
            {rangeCandidate.canRevert && writable && (
              <div className="range-workflow-actions">
                <button type="button" className="btn ghost" onClick={() => onOpen('revert')}>↶ Hoàn dải nhà sản xuất</button>
              </div>
            )}
          </>
        ) : <EmptyState className="qc-table-empty">{rangeError || 'Đang kiểm tra điều kiện dải kiểm soát…'}</EmptyState>}
      </div>
    </section>
  );
});

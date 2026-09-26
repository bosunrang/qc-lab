// Hộp thoại chọn CV IQC theo lô (cohort) và xác nhận rà soát của trang Six Sigma.
import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { confirmDialog, infoDialog } from '../../state/dialog-store';
import { cohortStatusLabel, cohortStatusTone, vnDate, vnPeriod } from './shared';
import type { SigmaCohortView, SigmaPeriodView } from '../../../shared/qc-api';

export function CohortModal({ period, cohorts, onClose, onSubmit }: {
  period: SigmaPeriodView; cohorts: SigmaCohortView[]; onClose: () => void;
  onSubmit: (choices: Record<number, SigmaCohortView | undefined>, cohortReviewed: boolean) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const byLevel = useMemo(() => new Map(period.levels.map((level) => [level.level, cohorts.filter((cohort) => cohort.level === level.level)])), [period.levels, cohorts]);
  const [choices, setChoices] = useState<Record<number, string>>(() => Object.fromEntries(period.levels.map((level) => [level.level, level.sourceLot || byLevel.get(level.level)?.at(-1)?.lot || ''])));
  async function submit() {
    const selected: Record<number, SigmaCohortView | undefined> = {};
    for (const level of period.levels) selected[level.level] = byLevel.get(level.level)?.find((cohort) => cohort.lot === choices[level.level]);
    const confirmed = await confirmDialog(
      'Xác nhận bạn đã rà soát biểu đồ IQC/Westgard, xử lý các sự cố liên quan và chọn các lô đại diện theo SOP. Hệ thống sẽ lưu tên và thời điểm xác nhận.',
      { title: 'Xác nhận rà soát IQC', confirmLabel: 'Xác nhận và dùng dữ liệu', cancelLabel: 'Quay lại', danger: false },
    );
    if (!confirmed) return;
    const result = await onSubmit(selected, true);
    if (!result.ok) await infoDialog(result.error?.message || 'Không thể nạp CV từ IQC.', { title: 'Không thể dùng dữ liệu IQC', type: 'warn' });
  }
  return <Modal title={`Chọn dữ liệu CV IQC theo lô — ${vnPeriod(period.period)}`} onClose={onClose} size="xl"
    footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Dùng dữ liệu đã chọn</button></>}>
    <div className="sg-cohort-table-wrap"><table className="sg-cohort-table"><thead><tr><th className="sg-cohort-level">Mức</th><th>Lô QC</th><th>Khoảng dữ liệu</th><th className="num">n</th><th className="num">CV</th><th>Trạng thái</th></tr></thead><tbody>
      {period.levels.flatMap((level) => {
        const rows = byLevel.get(level.level) || [];
        if (!rows.length) return <tr key={level.level}><td>Mức {level.level}</td><td colSpan={5} className="hint">Chưa có điểm IQC hợp lệ theo lô trong kỳ này.</td></tr>;
        return rows.map((cohort, index) => <tr key={`${level.level}:${cohort.lot}:${cohort.start}`}><td className="sg-cohort-level">{index === 0 ? `Mức ${level.level}` : ''}</td><td><label><input type="radio" name={`cohort-${level.level}`} checked={choices[level.level] === cohort.lot} onChange={() => setChoices((old) => ({ ...old, [level.level]: cohort.lot }))} /> Lô {cohort.lot || '—'}</label></td><td>{vnDate(cohort.start)}–{vnDate(cohort.end)}</td><td className="num">{cohort.n}</td><td className="num">{cohort.cv != null ? `${cohort.cv.toFixed(2)}%` : '—'}</td><td><span className={`tag ${cohortStatusTone(cohort.status)}`}>{cohortStatusLabel(cohort.status)}</span>{cohort.issues.length ? <div className="sg-cohort-issue">{cohort.issues.join(' · ')}</div> : null}</td></tr>);
      })}
    </tbody></table></div>
  </Modal>;
}

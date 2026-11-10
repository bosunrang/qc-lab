// Dòng thời gian tổng thể ở bước Phê duyệt & lịch sử; bằng chứng của từng
// lần QC vẫn mở tại mốc tương ứng. Nhật ký chi tiết giữ nguyên để tra cứu.
import type { ReactNode } from 'react';
import type { NceDossierView } from '../../../shared/qc-api';
import { nceHistory } from '../../../main/domain/nce/presentation';
import { dateText, timeText, RUN_ROLE_LABEL, runPoints, SnapshotTable } from './shared';

/** Một lần chạy QC: số mức đạt/bị loại và bảng điểm đã chụp của hồ sơ. */
export function QcRunDetails({ run, head }: { run: NceDossierView['runs'][number]; head: ReactNode }) {
  const points = runPoints(run);
  const rejected = points.filter((point) => !point.voided && point.verdict === 'rej').length;
  const accepted = points.filter((point) => !point.voided && point.verdict === 'ok').length;
  return <details className="nce-run">
    <summary>{head}<span className="nce-run-counts">{accepted > 0 && <span className="tag ok">{accepted} đạt</span>}{rejected > 0 && <span className="tag rej">{rejected} bị loại</span>}</span><span className="nce-run-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg></span></summary>
    <div className="nce-run-body"><SnapshotTable points={points} /></div>
  </details>;
}

export function DossierHistorySection({ dossier }: { dossier: NceDossierView }) {
  const { runs, timeline } = dossier;
  const history = nceHistory(dossier);
  const otherRuns = runs.filter((run) => !timeline.some((entry) => entry.run && entry.run.date === run.date && entry.run.runId === run.run_id));
  return <section className="nce-review-history" aria-label="Lịch sử hồ sơ">
    <div className="nce-review-subhead"><h3>Lịch sử hồ sơ</h3><span className="nce-note">{timeline.length + otherRuns.length} mốc</span></div>
    <section className="nce-timeline nce-timeline-overview" aria-label="Dòng thời gian hồ sơ">
      <ol>
        {timeline.map((entry, index) => {
          const run = entry.run && runs.find((item) => item.date === entry.run!.date && item.run_id === entry.run!.runId);
          const when = <time dateTime={entry.at}>{entry.dateOnly ? dateText(entry.at) : timeText(entry.at)}</time>;
          const text = <span className="nce-timeline-text"><b>{entry.label}</b>{entry.detail && <small>{entry.detail}</small>}</span>;
          return <li key={`${entry.at}-${index}`} className={run ? 'has-run' : undefined}>
            {run ? <QcRunDetails run={run} head={<>{when}{text}</>} /> : <>{when}{text}</>}
          </li>;
        })}
        {otherRuns.map((run) => (
          <li key={run.id} className="has-run"><QcRunDetails run={run} head={<><time dateTime={run.date}>{dateText(run.date)}</time><span className="nce-timeline-text"><b>{RUN_ROLE_LABEL[run.role]}</b>{run.run_id && <small>lần {run.run_id}</small>}</span></>} /></li>
        ))}
      </ol>
    </section>
    {history.length > 0 && <details className="nce-timeline-disclosure nce-history-disclosure">
      <summary><span>Chi tiết quyết định &amp; chỉnh sửa ({history.length})</span><span className="nce-timeline-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg></span></summary>
      <ol className="nce-history">{history.map((item, index) => <li key={`${item.at}-${index}`}><b>{item.title}</b><span>{item.detail}</span><small>{item.actor} · {timeText(item.at)}</small></li>)}</ol>
    </details>}
  </section>;
}

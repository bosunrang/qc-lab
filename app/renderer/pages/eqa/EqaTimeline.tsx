// Dòng thời gian 12 tháng của lịch ngoại kiểm: mỗi chương trình một hàng,
// vạch từ ngày nhận mẫu tới hạn nộp, chấm ngày chạy và mốc hạn nộp tô theo
// trạng thái. Trạng thái do main suy ra; ở đây chỉ đặt vị trí theo ngày.
import { vnDate } from '../../lib/format';
import type { EqaScheduleRow } from '../../../shared/qc-api';

const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

/** Vị trí (%) của một ngày trên trục năm, kẹp trong năm. */
function at(date: string, year: number): number {
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  return Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
}

export function EqaTimeline({ rows, year, today, tone, statusText, onPick }: {
  rows: readonly EqaScheduleRow[]; year: number; today: string;
  /** Lớp màu của mốc hạn nộp theo trạng thái (dùng chung với lịch tháng). */
  tone: (row: EqaScheduleRow) => string;
  statusText: (row: EqaScheduleRow) => string;
  onPick?: (row: EqaScheduleRow) => void;
}) {
  const programs = [...rows.reduce((map, row) => map.set(row.program_id, [...(map.get(row.program_id) ?? []), row]), new Map<string, EqaScheduleRow[]>()).values()]
    .sort((a, b) => a[0].program_name.localeCompare(b[0].program_name, 'vi'));
  const todayAt = today.startsWith(String(year)) ? at(today, year) : null;

  return (
    <div className="eqa-timeline" role="group" aria-label={`Dòng thời gian năm ${year}`}>
      <div className="eqa-tl-row eqa-tl-head">
        <span className="eqa-tl-label">Chương trình</span>
        <div className="eqa-tl-track eqa-tl-months">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
      </div>
      {programs.map((list) => (
        <div key={list[0].program_id} className="eqa-tl-row">
          <span className="eqa-tl-label">
            <b>{list[0].program_name}</b>
            <small>{[list[0].sample_type, `${list.length} đợt`].filter(Boolean).join(' · ')}</small>
          </span>
          <div className="eqa-tl-track">
            {todayAt !== null && <span className="eqa-tl-today" style={{ left: `${todayAt}%` }} aria-hidden="true" />}
            {list.map((row) => {
              const from = at(row.receive_date || row.run_date || row.due_date, year), due = at(row.due_date, year);
              const label = `${row.program_name} ${row.round}/${row.year} · hạn nộp ${vnDate(row.due_date)} · ${statusText(row)}`;
              return (
                <span key={row.id}>
                  {due > from && <span className="eqa-tl-span" style={{ left: `${from}%`, width: `${due - from}%` }} aria-hidden="true" />}
                  {row.run_date && row.run_date !== row.due_date && <span className="eqa-tl-run" style={{ left: `${at(row.run_date, year)}%` }} title={`Ngày chạy mẫu ${vnDate(row.run_date)}`} aria-hidden="true" />}
                  {onPick
                    ? <button type="button" className={`eqa-tl-due ${tone(row)}`} style={{ left: `${due}%` }} title={label} aria-label={label} onClick={() => onPick(row)}>{row.round_no}</button>
                    : <span className={`eqa-tl-due ${tone(row)}`} style={{ left: `${due}%` }} title={label}>{row.round_no}</span>}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

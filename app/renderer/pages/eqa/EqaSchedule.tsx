// Thẻ "Lịch" của trang Phân tích ngoại kiểm: đợt cần nộp, lịch tháng và lịch cả
// năm. Trạng thái và số ngày còn lại do main tính (`domain/eqa/schedule.ts`).
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { useAuthStore } from '../../store/auth-store';
import { canWrite } from '../../lib/permissions';
import { vnDate } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { RowActionButton } from '../../components/RowActionButton';
import { confirmDialog, errorDialog } from '../../state/dialog-store';
import { showToast } from '../../state/toast-store';
import { isoLocalDate } from '../../../main/domain/local-date';
import { EQA_DUE_SOON_DAYS, EQA_SAMPLE_TYPES, needsAction } from '../../../main/domain/eqa/schedule';
import type { EqaScheduleRow } from '../../../shared/qc-api';
import { StatCard } from './shared';
import { EqaScheduleModal } from './EqaScheduleModal';
import { EqaSubmitModal } from './EqaSubmitModal';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function ScheduleStatusTag({ row }: { row: EqaScheduleRow }) {
  if (row.status === 'reported') return <span className="tag ok">Đã có báo cáo</span>;
  if (row.status === 'submitted') return <span className="tag ok">Đã nộp</span>;
  if (row.status === 'overdue') return <span className="tag rej">Quá hạn</span>;
  return row.days_left <= EQA_DUE_SOON_DAYS ? <span className="tag warn">Sắp đến hạn</span> : <span className="tag none">Chưa nộp</span>;
}

/** Số máy đã nộp (gồm máy đã có trong báo cáo) trên tổng số máy của đợt. */
function machineProgress(row: EqaScheduleRow): { done: number; total: number } {
  return { done: row.instruments.filter((m) => m.submitted_at || m.reported).length, total: row.instruments.length };
}

/** Dòng phụ dưới trạng thái: lần nộp, hoặc tiến độ nộp theo máy khi chưa đủ. */
function submittedText(row: EqaScheduleRow): string {
  const { done, total } = machineProgress(row);
  if (total && done < total) return done ? `Đã nộp ${done}/${total} máy` : '';
  return row.submitted_at ? `Nộp ${vnDate(row.submitted_at.slice(0, 10))}${row.submitted_by ? ` · ${row.submitted_by}` : ''}` : '';
}

/** Tên chương trình kèm loại mẫu; dòng phụ do nơi gọi chọn. */
function ProgramCell({ row, sub }: { row: EqaScheduleRow; sub: string }) {
  return <><b className="eqa-strong">{row.program_name}{row.sample_type && <span className="pill eqa-sample-type">{row.sample_type}</span>}</b><span className="eqa-sub">{sub}</span></>;
}

/** Máy của đợt: xanh là đã nộp hoặc đã có trong báo cáo. */
function MachineTags({ row }: { row: EqaScheduleRow }) {
  if (!row.instruments.length) return <>—</>;
  return <span className="eqa-machine-tags">{row.instruments.map((m) => (
    <span key={m.instrument_id} className={`tag ${m.submitted_at || m.reported ? 'ok' : 'none'}`} title={m.reported ? 'Đã có trong báo cáo' : m.submitted_at ? 'Đã nộp' : 'Chưa nộp'}>{m.instrument_name}</span>
  ))}</span>;
}

export function daysLeftText(row: EqaScheduleRow): string {
  if (row.status === 'submitted' || row.status === 'reported') return '—';
  if (row.days_left === 0) return 'Hôm nay';
  return row.days_left > 0 ? `Còn ${row.days_left} ngày` : `Quá ${-row.days_left} ngày`;
}

/** Màu chấm trên lịch theo trạng thái của đợt. */
function dotTone(row: EqaScheduleRow): string {
  if (row.status === 'overdue') return 'is-overdue';
  if (row.status === 'planned') return row.days_left <= EQA_DUE_SOON_DAYS ? 'is-soon' : 'is-planned';
  return 'is-done';
}

/** Các ô của lịch tháng, tuần bắt đầu từ thứ Hai. */
function monthCells(ym: string): { date: string; inMonth: boolean }[] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = Date.UTC(y, m - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    return { date, inMonth: date.slice(0, 7) === ym };
  });
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function EqaSchedule() {
  const { schedule, markSubmitted, removeSchedule } = useEqaStore(useShallow((s) => ({ schedule: s.schedule, markSubmitted: s.markSubmitted, removeSchedule: s.removeSchedule })));
  const writable = canWrite(useAuthStore((s) => s.user?.role));
  const today = isoLocalDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState('');
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [editing, setEditing] = useState<EqaScheduleRow | 'new' | null>(null);
  const [submitting, setSubmitting] = useState<EqaScheduleRow | null>(null);
  const [sampleFilter, setSampleFilter] = useState('');

  const actionRows = useMemo(() => schedule.filter(needsAction), [schedule]);
  const stats = useMemo(() => ({
    soon: schedule.filter((r) => r.status === 'planned' && r.days_left <= EQA_DUE_SOON_DAYS).length,
    overdue: schedule.filter((r) => r.status === 'overdue').length,
    waiting: schedule.filter((r) => r.status === 'submitted').length,
    reported: schedule.filter((r) => r.status === 'reported' && r.year === year).length,
  }), [schedule, year]);
  const byDate = useMemo(() => {
    const map = new Map<string, { row: EqaScheduleRow; kind: 'due' | 'run' }[]>();
    const add = (date: string, row: EqaScheduleRow, kind: 'due' | 'run') => { if (date) map.set(date, [...(map.get(date) ?? []), { row, kind }]); };
    for (const row of schedule) { add(row.due_date, row, 'due'); if (row.run_date !== row.due_date) add(row.run_date, row, 'run'); }
    return map;
  }, [schedule]);
  const years = useMemo(() => [...new Set([Number(today.slice(0, 4)), ...schedule.map((r) => r.year)])].sort((a, b) => b - a), [schedule, today]);
  const yearRows = schedule.filter((r) => r.year === year && (!sampleFilter || r.sample_type === sampleFilter));
  const dayItems = selectedDay ? byDate.get(selectedDay) ?? [] : [];

  async function submitted(row: EqaScheduleRow, value: boolean) {
    // Đợt có khai máy: chọn máy đã nộp trong hộp riêng.
    if (row.instruments.length) { setSubmitting(row); return; }
    const result = await markSubmitted(row.id, value);
    if (!result.ok) { await errorDialog(result.error.message); return; }
    showToast(value ? `Đã ghi nhận nộp ${row.program_name} ${row.round}/${row.year}.` : 'Đã bỏ đánh dấu đã nộp.');
  }
  async function remove(row: EqaScheduleRow) {
    if (!(await confirmDialog(`Xoá ${row.program_name} ${row.round}/${row.year} khỏi lịch?`, { title: 'Xoá đợt trong lịch', confirmLabel: 'Xoá', danger: true }))) return;
    const result = await removeSchedule(row.id);
    if (!result.ok) await errorDialog(result.error.message);
  }

  return (
    <div className="eqa-schedule">
      <div className="eqa-intro">
        <div>
          <h2>Lịch ngoại kiểm</h2>
          <p>Ngày nhận mẫu, ngày chạy và hạn nộp kết quả cho trung tâm. Nộp trễ hạn thì đợt bị tính không đạt.</p>
        </div>
        {writable && <div className="eqa-intro-actions"><button type="button" className="btn" onClick={() => setEditing('new')}>Thêm đợt</button></div>}
      </div>

      <div className="eqa-stats">
        <StatCard tone="warning" label="Sắp đến hạn" value={stats.soon} detail={`Chưa nộp, còn ≤ ${EQA_DUE_SOON_DAYS} ngày`} />
        <StatCard tone="danger" label="Quá hạn" value={stats.overdue} detail="Chưa đánh dấu đã nộp" />
        <StatCard tone="info" label="Chờ báo cáo" value={stats.waiting} detail="Đã nộp, chưa nhập báo cáo PDF" />
        <StatCard tone="success" label={`Có báo cáo năm ${year}`} value={stats.reported} detail="Đợt đã nhập báo cáo của trung tâm" />
      </div>

      <div className="eqa-schedule-grid">
        <section className="panel" aria-label="Đợt cần nộp">
          <div className="panel-head"><h2>Cần nộp <span className="count">{actionRows.length}</span></h2></div>
          <div className="eqa-section-body">
            {!actionRows.length ? <EmptyState size="compact" title="Không có đợt nào cần nộp">Các đợt quá hạn hoặc đến hạn trong {EQA_DUE_SOON_DAYS} ngày tới hiện ở đây.</EmptyState> : (
              <div className="eqa-table-wrap">
                <table className="eqa-table eqa-center-rest">
                  <thead><tr><th>Chương trình</th><th>Đợt</th><th>Hạn nộp</th><th>Còn</th><th aria-label="Thao tác" /></tr></thead>
                  <tbody>
                    {actionRows.map((row) => (
                      <tr key={row.id} className={row.status === 'overdue' ? 'is-rej' : 'is-warn'}>
                        <td><ProgramCell row={row} sub={row.assignee ? `Phụ trách: ${row.assignee}` : row.provider || '—'} /></td>
                        <td>{row.round} / {row.year}</td>
                        <td>{vnDate(row.due_date, '—')}</td>
                        <td><ScheduleStatusTag row={row} /><span className="eqa-sub">{[daysLeftText(row), submittedText(row)].filter(Boolean).join(' · ')}</span></td>
                        <td>{writable && <button type="button" className="btn ghost sm" onClick={() => void submitted(row, true)}>Đã nộp</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel" aria-label="Lịch tháng">
          <div className="panel-head">
            <h2>Tháng {month.slice(5, 7)}/{month.slice(0, 4)}</h2>
            <div className="eqa-cal-nav">
              <button type="button" className="btn ghost sm" aria-label="Tháng trước" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
              <button type="button" className="btn ghost sm" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDay(today); }}>Hôm nay</button>
              <button type="button" className="btn ghost sm" aria-label="Tháng sau" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
            </div>
          </div>
          <div className="eqa-section-body">
            <div className="eqa-cal" role="grid" aria-label={`Lịch tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`}>
              {WEEKDAYS.map((d) => <span key={d} className="eqa-cal-head" role="columnheader">{d}</span>)}
              {monthCells(month).map(({ date, inMonth }) => {
                const items = byDate.get(date) ?? [];
                const classes = ['eqa-cal-day', inMonth ? '' : 'is-out', date === today ? 'is-today' : '', date === selectedDay ? 'is-selected' : ''].filter(Boolean).join(' ');
                return (
                  <button key={date} type="button" role="gridcell" className={classes} aria-pressed={date === selectedDay}
                    aria-label={`${vnDate(date)}${items.length ? `: ${items.length} việc` : ''}`} onClick={() => setSelectedDay(date === selectedDay ? '' : date)}>
                    <span>{Number(date.slice(8, 10))}</span>
                    {items.length > 0 && <span className="eqa-cal-dots">{items.slice(0, 3).map(({ row, kind }) => <i key={`${row.id}-${kind}`} className={`eqa-cal-dot ${kind === 'run' ? 'is-run' : dotTone(row)}`} />)}</span>}
                  </button>
                );
              })}
            </div>
            <p className="eqa-note">Chấm đỏ: quá hạn · cam: sắp đến hạn · xám: chưa nộp · xanh lá: đã nộp hoặc có báo cáo · xanh dương: ngày chạy mẫu.</p>
            {selectedDay && (
              <div className="eqa-cal-detail">
                <h3>{vnDate(selectedDay)}</h3>
                {!dayItems.length ? <p className="hint-inline">Không có đợt nào.</p> : (
                  <ul className="eqa-history">
                    {dayItems.map(({ row, kind }) => (
                      <li key={`${row.id}-${kind}`}>
                        <b className="eqa-strong">{row.program_name} · {row.round}/{row.year}</b>
                        <p>{kind === 'due' ? 'Hạn nộp kết quả' : 'Ngày chạy mẫu'}{row.assignee ? ` · ${row.assignee}` : ''}</p>
                        <span><ScheduleStatusTag row={row} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel" aria-label="Lịch cả năm">
        <div className="panel-head">
          <h2>Lịch năm {year} <span className="count">{yearRows.length}</span></h2>
          <div className="eqa-cal-nav">
            <select className="eqa-year-select" aria-label="Loại mẫu" value={sampleFilter} onChange={(e) => setSampleFilter(e.target.value)}>
              <option value="">Mọi loại mẫu</option>
              {EQA_SAMPLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="eqa-year-select" aria-label="Năm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="eqa-section-body">
          {!yearRows.length ? (
            <EmptyState title={sampleFilter ? `Không có đợt ${sampleFilter} trong năm ${year}` : `Chưa có đợt nào trong năm ${year}`}
              action={writable ? <button type="button" className="btn sm" onClick={() => setEditing('new')}>Thêm đợt</button> : undefined}>
              Khai lịch các đợt theo lịch của trung tâm ngoại kiểm để app nhắc hạn nộp.
            </EmptyState>
          ) : (
            <div className="eqa-table-wrap">
              <table className="eqa-table eqa-center-rest">
                <thead><tr><th>Chương trình</th><th>Đợt</th><th>Nhận mẫu</th><th>Chạy mẫu</th><th>Hạn nộp</th><th>Máy</th><th>Phụ trách</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
                <tbody>
                  {yearRows.map((row) => (
                    <tr key={row.id} className={row.status === 'overdue' ? 'is-rej' : undefined}>
                      <td><ProgramCell row={row} sub={row.provider || '—'} /></td>
                      <td>{row.round}</td>
                      <td>{vnDate(row.receive_date, '—')}</td>
                      <td>{vnDate(row.run_date, '—')}</td>
                      <td>{vnDate(row.due_date, '—')}<span className="eqa-sub">{daysLeftText(row)}</span></td>
                      <td><MachineTags row={row} /></td>
                      <td>{row.assignee || '—'}</td>
                      <td><ScheduleStatusTag row={row} />{submittedText(row) && <span className="eqa-sub">{submittedText(row)}</span>}</td>
                      <td>
                        {writable && (
                          <div className="eqa-row-actions">
                            {row.status === 'planned' || row.status === 'overdue'
                              ? <button type="button" className="btn ghost sm" onClick={() => void submitted(row, true)}>Đã nộp</button>
                              : row.status === 'submitted' ? <button type="button" className="btn ghost sm" onClick={() => void submitted(row, false)}>{row.instruments.length ? 'Sửa đã nộp' : 'Bỏ đã nộp'}</button> : null}
                            <RowActionButton kind="edit" label={`Sửa ${row.program_name} ${row.round}`} onClick={() => setEditing(row)} />
                            {(row.status === 'planned' || row.status === 'overdue') && !row.instruments.some((m) => m.submitted_at) && <RowActionButton kind="delete" label={`Xoá ${row.program_name} ${row.round}`} onClick={() => void remove(row)} />}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {editing && <EqaScheduleModal row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {submitting && <EqaSubmitModal row={submitting} onClose={() => setSubmitting(null)} />}
    </div>
  );
}

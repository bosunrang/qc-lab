// Lịch ngoại kiểm: lịch tháng, danh sách theo năm và chi tiết ngày được chọn.
// Trạng thái, số ngày còn lại và tiến độ từng máy lấy từ main.
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { EQA_DUE_SOON_DAYS, EQA_SAMPLE_TYPES } from '../../../main/domain/eqa/schedule';
import type { EqaScheduleRow } from '../../../shared/qc-api';
import { EqaScheduleModal } from './EqaScheduleModal';
import { EqaSubmitModal } from './EqaSubmitModal';

const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const EVENT_LABELS = { receive: 'Nhận mẫu', run: 'Chạy mẫu', due: 'Hạn nộp' };
type EventKind = keyof typeof EVENT_LABELS;

function statusLabel(row: EqaScheduleRow): string {
  if (row.status === 'reported') return 'Đã có báo cáo';
  if (row.status === 'submitted') return 'Đã nộp';
  if (row.status === 'overdue') return 'Quá hạn';
  return row.days_left <= EQA_DUE_SOON_DAYS ? 'Sắp đến hạn' : 'Chưa nộp';
}

function ScheduleStatusTag({ row }: { row: EqaScheduleRow }) {
  const tone = row.status === 'reported' || row.status === 'submitted' ? 'ok' : row.status === 'overdue' ? 'rej' : row.days_left <= EQA_DUE_SOON_DAYS ? 'warn' : 'none';
  return <span className={`tag ${tone}`}>{statusLabel(row)}</span>;
}

function machineProgress(row: EqaScheduleRow) {
  return { done: row.instruments.filter((m) => m.submitted_at || m.reported).length, total: row.instruments.length };
}

function submittedText(row: EqaScheduleRow): string {
  const { done, total } = machineProgress(row);
  if (total) return `Đã nộp ${done}/${total} máy`;
  return row.submitted_at ? `Nộp ${vnDate(row.submitted_at.slice(0, 10))}${row.submitted_by ? ` · ${row.submitted_by}` : ''}` : '';
}

function ProgramCell({ row, sub }: { row: EqaScheduleRow; sub: string }) {
  return <><b className="eqa-strong">{row.program_name}{row.sample_type && <span className="pill eqa-sample-type">{row.sample_type}</span>}</b><span className="eqa-sub">{sub}</span></>;
}

function MachineTags({ row }: { row: EqaScheduleRow }) {
  if (!row.instruments.length) return null;
  // Trạng thái nộp không chỉ dựa vào màu: máy đã nộp có dấu ✓, trình đọc màn hình đọc đủ trạng thái.
  return <span className="eqa-machine-tags">{row.instruments.map((m) => {
    const state = m.reported ? 'Đã có trong báo cáo' : m.submitted_at ? 'Đã nộp' : 'Chưa nộp';
    return <span key={m.instrument_id} className={`tag ${m.submitted_at || m.reported ? 'ok' : 'none'}`} title={state}>
      {(m.submitted_at || m.reported) && <span aria-hidden="true">✓ </span>}{m.instrument_name}<span className="sr-only">: {state}</span>
    </span>;
  })}</span>;
}

export function daysLeftText(row: EqaScheduleRow): string {
  if (row.status === 'submitted' || row.status === 'reported') return '—';
  if (row.days_left === 0) return 'Hôm nay';
  return row.days_left > 0 ? `Còn ${row.days_left} ngày` : `Quá ${-row.days_left} ngày`;
}

function dotTone(row: EqaScheduleRow): string {
  if (row.status === 'overdue') return 'is-overdue';
  if (row.status === 'planned') return row.days_left <= EQA_DUE_SOON_DAYS ? 'is-soon' : 'is-planned';
  return 'is-done';
}

/** Chỉ dựng số tuần cần thiết, vẫn giữ đủ những ngày liền kề ngoài tháng. */
function monthCells(ym: string): { date: string; inMonth: boolean }[] {
  const [y, m] = ym.split('-').map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(Date.UTC(y, m, 0)).getUTCDate()) / 7) * 7;
  const start = Date.UTC(y, m - 1, 1 - offset);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    return { date, inMonth: date.slice(0, 7) === ym };
  });
}

function dueOrder(a: EqaScheduleRow, b: EqaScheduleRow): number {
  return a.due_date.localeCompare(b.due_date) || a.program_name.localeCompare(b.program_name, 'vi') || a.round_no - b.round_no;
}

export function EqaSchedule({ onOpenRound, targetScheduleId = '' }: { onOpenRound: (id: string) => void; targetScheduleId?: string }) {
  const { schedule, loading, loaded, error, load, markSubmitted, removeSchedule } = useEqaStore(useShallow((s) => ({
    schedule: s.schedule, loading: s.loading, loaded: s.loaded, error: s.error, load: s.load, markSubmitted: s.markSubmitted, removeSchedule: s.removeSchedule,
  })));
  const writable = canWrite(useAuthStore((s) => s.user?.role));
  const today = isoLocalDate();
  // Tháng là mốc thời gian duy nhất; chuyển cách xem không làm mất năm đang xem.
  const [month, setMonth] = useState(today.slice(0, 7));
  const year = Number(month.slice(0, 4));
  const [selectedDay, setSelectedDay] = useState(today);
  const [layout, setLayout] = useState<'month' | 'list'>('month');
  const [sampleFilter, setSampleFilter] = useState('');
  const [editing, setEditing] = useState<EqaScheduleRow | 'new' | null>(null);
  const [newDueDate, setNewDueDate] = useState('');
  const [submitting, setSubmitting] = useState<EqaScheduleRow | null>(null);
  const locatedSchedule = useRef('');
  const targetTask = useRef<HTMLLIElement>(null);
  const [revealedSchedule, setRevealedSchedule] = useState('');

  // Chờ lịch được nạp rồi định vị theo mã riêng, tránh nhầm các máy cùng đợt.
  // Chỉ làm một lần cho mỗi đường dẫn, để tải lại dữ liệu không kéo người dùng về ngày cũ.
  useEffect(() => {
    if (!targetScheduleId) { locatedSchedule.current = ''; setRevealedSchedule(''); return; }
    if (locatedSchedule.current === targetScheduleId) return;
    const row = schedule.find((item) => item.id === targetScheduleId);
    if (!row) return;
    locatedSchedule.current = targetScheduleId;
    setSampleFilter('');
    setMonth(row.due_date.slice(0, 7));
    setSelectedDay(row.due_date);
    setLayout('month');
    setRevealedSchedule(row.id);
  }, [schedule, targetScheduleId]);
  useEffect(() => {
    if (!revealedSchedule) return;
    targetTask.current?.scrollIntoView({ block: 'nearest' });
    targetTask.current?.focus({ preventScroll: true });
  }, [revealedSchedule]);

  // Chỉ cảnh báo các đợt main xác định quá hạn; không để bộ lọc che nợ năm cũ.
  const overdueRows = useMemo(() => schedule.filter((r) => r.status === 'overdue').sort(dueOrder), [schedule]);
  const filtered = useMemo(() => schedule.filter((r) => !sampleFilter || r.sample_type === sampleFilter), [schedule, sampleFilter]);
  const yearRows = useMemo(() => filtered.filter((r) => r.year === year).sort(dueOrder), [filtered, year]);
  // Gộp theo mã chương trình rồi số đợt chuẩn hoá; mỗi nhóm giữ thứ tự hạn nộp.
  const listRows = useMemo(() => {
    const programGroups = new Map<string, EqaScheduleRow[]>();
    for (const row of yearRows) {
      const group = programGroups.get(row.program_id) ?? [];
      group.push(row);
      programGroups.set(row.program_id, group);
    }
    return [...programGroups.values()].flatMap((programRows) => {
      const rounds = new Map<number, EqaScheduleRow[]>();
      for (const row of programRows) {
        const group = rounds.get(row.round_no) ?? [];
        group.push(row);
        rounds.set(row.round_no, group);
      }
      return [...rounds.values()].flatMap((rows, roundIndex) => rows.map((row, index) => ({
        row,
        programRowSpan: roundIndex === 0 && index === 0 ? programRows.length : 0,
        roundRowSpan: index === 0 ? rows.length : 0,
      })));
    });
  }, [yearRows]);
  const byDate = useMemo(() => {
    const map = new Map<string, { row: EqaScheduleRow; kind: EventKind }[]>();
    for (const row of [...filtered].sort(dueOrder)) {
      // Hai mốc cùng ngày vẫn là hai công việc; không bỏ ngày chạy trùng hạn nộp.
      for (const [kind, date] of [['due', row.due_date], ['run', row.run_date], ['receive', row.receive_date]] as const) {
        if (date) map.set(date, [...(map.get(date) ?? []), { row, kind }]);
      }
    }
    return map;
  }, [filtered]);
  const years = [...new Set([year, Number(today.slice(0, 4)), ...schedule.flatMap((r) => [r.year, ...[r.receive_date, r.run_date, r.due_date].filter(Boolean).map((d) => Number(d.slice(0, 4)))])])].sort((a, b) => b - a);
  // Gộp các mốc cùng đợt thành một mục để không lặp thao tác ghi dữ liệu.
  const dayRows = [...(byDate.get(selectedDay) ?? []).reduce((map, { row, kind }) => {
    const item = map.get(row.id) ?? { row, kinds: [] as EventKind[] };
    item.kinds.push(kind);
    return map.set(row.id, item);
  }, new Map<string, { row: EqaScheduleRow; kinds: EventKind[] }>()).values()];
  const cells = monthCells(month);
  // Lưới lịch chỉ có một điểm dừng Tab (ngày đang chọn); phím mũi tên đi giữa các ngày.
  const tabDate = cells.some((c) => c.date === selectedDay) ? selectedDay : cells.find((c) => c.inMonth)?.date;
  const monthHasEvents = [...byDate.keys()].some((d) => d.startsWith(month));

  function selectDay(date: string) { setSelectedDay(date); setMonth(date.slice(0, 7)); }
  function startNew(dueDate = '') { setNewDueDate(dueDate); setEditing('new'); }
  function changeMonth(value: string) { setMonth(value); setSelectedDay(`${value}-01`); }
  function locate(row: EqaScheduleRow) { setSampleFilter(''); selectDay(row.due_date); setLayout('month'); }
  async function submitted(row: EqaScheduleRow, value: boolean) {
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
  function actions(row: EqaScheduleRow) {
    return <div className="eqa-row-actions">
      {row.round_id && <button type="button" className="btn ghost sm" onClick={() => onOpenRound(row.round_id!)}>Mở đợt báo cáo</button>}
      {writable && <>
        {row.status !== 'reported' && <button type="button" className="btn ghost sm" onClick={() => void submitted(row, row.status !== 'submitted')}>
          {row.status === 'submitted' ? row.instruments.length ? 'Sửa đã nộp' : 'Bỏ đã nộp' : 'Ghi nhận nộp'}
        </button>}
        <RowActionButton kind="edit" label={`Sửa ${row.program_name} ${row.round}`} onClick={() => setEditing(row)} />
        {(row.status === 'planned' || row.status === 'overdue') && !row.instruments.some((m) => m.submitted_at || m.reported) &&
          <RowActionButton kind="delete" label={`Xoá ${row.program_name} ${row.round}`} onClick={() => void remove(row)} />}
      </>}
    </div>;
  }
  function task(row: EqaScheduleRow, kinds: EventKind[]) {
    return <li key={row.id} className="eqa-schedule-task" ref={row.id === revealedSchedule ? targetTask : undefined} tabIndex={-1}>
      <ProgramCell row={row} sub={`${row.round}/${row.year}${row.assignee ? ` · ${row.assignee}` : ''}`} />
      <span className="eqa-sub">{kinds.map((kind) => EVENT_LABELS[kind]).join(' · ')}</span>
      <div className="eqa-schedule-task-meta"><ScheduleStatusTag row={row} /><span className="eqa-note">Hạn {vnDate(row.due_date)}{daysLeftText(row) !== '—' ? ` · ${daysLeftText(row)}` : ''}</span></div>
      {submittedText(row) && <span className="eqa-sub">{submittedText(row)}</span>}
      <MachineTags row={row} />
      {row.note && <span className="eqa-sub">{row.note}</span>}
      {actions(row)}
    </li>;
  }

  // Giữ hộp thoại đang nhập khi tải lại; lỗi đọc không được hiện như lịch rỗng.
  const idle = !editing && !submitting;
  if (idle && !schedule.length && (!loaded || loading)) return <section className="panel"><EmptyState title="Đang tải lịch ngoại kiểm…" /></section>;
  if (idle && !schedule.length && error) return <section className="panel"><EmptyState title="Không tải được lịch ngoại kiểm" action={<button type="button" className="btn" onClick={() => void load()}>Thử lại</button>}>{error}</EmptyState></section>;

  return <div className={`eqa-schedule${schedule.length ? '' : ' is-unplanned'}`}>
    {error && <div className="alert rej eqa-schedule-error" role="alert"><div>Không tải được lịch mới. Dữ liệu đang hiển thị là lần tải trước.<span className="eqa-sub">{error}</span></div><button type="button" className="btn ghost sm" disabled={loading} onClick={() => void load()}>Thử lại</button></div>}
    {overdueRows.length > 0 && <div className="alert warn eqa-action-alert" role="status">
      <details>
        <summary className="eqa-overdue-summary">Có <b>{overdueRows.length} lịch quá hạn</b> chưa nộp đủ kết quả (mọi năm). Xem các lịch</summary>
        <ul className="eqa-action-list eqa-overdue-list">{overdueRows.map((row) => <li key={row.id}>
          <div><b>{row.program_name} · {row.round}/{row.year}</b><span className="eqa-sub">{[row.sample_type, row.instruments.map((m) => m.instrument_name).join(', '), `Hạn ${vnDate(row.due_date)}`, daysLeftText(row), submittedText(row)].filter(Boolean).join(' · ')}</span></div>
          <button type="button" className="btn ghost sm" onClick={(event) => {
            locate(row);
            event.currentTarget.closest('details')?.removeAttribute('open');
          }}>Xem trong lịch</button>
        </li>)}</ul>
      </details>
    </div>}
    <div className={`eqa-schedule-workspace${layout === 'list' ? ' is-list' : ''}`}>
      <section className="panel eqa-schedule-main" aria-label="Lịch và danh sách đợt">
        <div className="panel-head">
          <div className="dayseg eqa-schedule-view" role="group" aria-label="Cách xem lịch">
            {([['month', 'Lịch tháng'], ['list', 'Danh sách']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={layout === value} className={layout === value ? 'on' : ''} onClick={() => setLayout(value)}>{label}</button>)}
          </div>
          <div className="eqa-schedule-controls">
            {layout === 'month' && <select className="eqa-schedule-select" aria-label="Tháng trong lịch" value={month.slice(5, 7)} onChange={(e) => changeMonth(`${year}-${e.target.value}`)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1).padStart(2, '0')}>Tháng {i + 1}</option>)}</select>}
            <select className="eqa-schedule-select" aria-label="Năm trong lịch" value={year} onChange={(e) => changeMonth(`${e.target.value}${month.slice(4)}`)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
            {schedule.length > 0 && <select className="eqa-schedule-select" aria-label="Loại mẫu trong lịch" value={sampleFilter} onChange={(e) => setSampleFilter(e.target.value)}><option value="">Mọi loại mẫu</option>{EQA_SAMPLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
            {writable && <button type="button" className="btn" onClick={() => startNew()}>Thêm đợt</button>}
          </div>
        </div>
        <div className="eqa-section-body">
          {sampleFilter && !filtered.length ? <EmptyState title="Không có đợt thuộc loại mẫu đã chọn" action={<button type="button" className="btn ghost sm" onClick={() => setSampleFilter('')}>Xem mọi loại mẫu</button>} />
          : layout === 'month' ? <>
            <div className="eqa-cal" role="grid" aria-label={`Lịch tháng ${month.slice(5, 7)}/${year}`} onKeyDown={(event) => {
              if (!(event.target instanceof HTMLButtonElement)) return;
              const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
              if (!delta) return;
              const index = cells.findIndex((cell) => cell.date === (event.target as HTMLButtonElement).dataset.date);
              const next = cells[index + delta];
              if (index < 0 || !next) return;
              event.preventDefault();
              event.currentTarget.querySelector<HTMLButtonElement>(`button[data-date="${next.date}"]`)?.focus();
            }}>
              <div className="eqa-cal-week" role="row">{WEEKDAYS.map((d) => <span key={d} className="eqa-cal-head" role="columnheader">{d}</span>)}</div>
              {Array.from({ length: cells.length / 7 }, (_, week) => <div className="eqa-cal-week" role="row" key={week}>{cells.slice(week * 7, week * 7 + 7).map(({ date, inMonth }, weekday) => {
                const items = byDate.get(date) ?? [];
                // Nền ô chỉ theo hạn nộp chưa hoàn tất; ngày chạy không tự
                // thành cảnh báo. Quá hạn được ưu tiên khi có nhiều công việc.
                const dayTone = items.some(({ row, kind }) => kind === 'due' && row.status === 'overdue') ? ' is-overdue'
                  : items.some(({ row, kind }) => kind === 'due' && row.status === 'planned' && row.days_left <= EQA_DUE_SOON_DAYS) ? ' is-soon' : '';
                const toneText = dayTone === ' is-overdue' ? ', có hạn nộp quá hạn' : dayTone === ' is-soon' ? ', có hạn nộp sắp tới' : '';
                return <div key={date} role="gridcell">
                  <button type="button" data-date={date} tabIndex={date === tabDate ? 0 : -1} className={`eqa-cal-day${dayTone}${weekday >= 5 ? ' is-weekend' : ''}${inMonth ? '' : ' is-out'}${date === today ? ' is-today' : ''}${date === selectedDay ? ' is-selected' : ''}`} aria-current={date === today ? 'date' : undefined} aria-pressed={date === selectedDay} aria-label={`${vnDate(date)}${items.length ? `: ${items.length} việc` : ''}${toneText}`} onClick={() => selectDay(date)}>
                    <span className="eqa-cal-date"><span>{Number(date.slice(8, 10))}</span>{items.length > 2 && <small>+{items.length - 2}</small>}</span>
                    {items.slice(0, 2).map(({ row, kind }) => <span key={`${row.id}-${kind}`} className={`eqa-cal-event ${kind === 'due' ? dotTone(row) : `is-${kind}`}`} title={[EVENT_LABELS[kind], row.program_name, row.sample_type, `${row.round}/${row.year}`, row.instruments.map((m) => m.instrument_name).join(', ')].filter(Boolean).join(' · ')}><span aria-hidden="true">●</span> {kind === 'due' ? 'Nộp' : kind === 'run' ? 'Chạy' : 'Nhận'} · {row.sample_type || row.program_name}</span>)}
                  </button>
                </div>;
              })}</div>)}
            </div>
            <div className="eqa-calendar-key"><span><span className="eqa-legend-run" aria-hidden="true">●</span> Chạy mẫu</span><span><span className="eqa-legend-due" aria-hidden="true">●</span> Hạn nộp</span><span className="eqa-note">Chọn ngày để xem đủ công việc.</span></div>
            {schedule.length > 0 && !monthHasEvents && <span className="eqa-note">Không có công việc trong tháng này{sampleFilter ? ` với loại mẫu ${sampleFilter}` : ''}.</span>}
          </> : <>
            <p className="eqa-note">{yearRows.length} lịch · {yearRows.filter((r) => r.status === 'reported').length} đã có báo cáo · Theo năm chương trình {year}</p>
            {!yearRows.length ? <EmptyState title={`Không có đợt trong năm ${year}`} action={sampleFilter ? <button type="button" className="btn ghost sm" onClick={() => setSampleFilter('')}>Xem mọi loại mẫu</button> : undefined} />
            : <div className="eqa-table-wrap"><table className="eqa-table eqa-schedule-list">
              <thead><tr><th>Chương trình</th><th>Loại mẫu</th><th>Đợt</th><th>Chạy mẫu</th><th>Hạn nộp</th><th>Máy</th><th>Phụ trách</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>{listRows.map(({ row, programRowSpan, roundRowSpan }, index) => <tr key={row.id} data-schedule-id={row.id}>
                {programRowSpan > 0 && <td rowSpan={programRowSpan} className={`eqa-schedule-program${index + programRowSpan === listRows.length ? ' is-last-span' : ''}`}><b className="eqa-strong">{row.program_name}</b><span className="eqa-sub">{row.provider || '—'}</span></td>}
                <td>{row.sample_type || '—'}</td>
                {roundRowSpan > 0 && <td rowSpan={roundRowSpan} className={`eqa-schedule-round${index + roundRowSpan === listRows.length ? ' is-last-span' : ''}`}>{row.round}</td>}
                <td>{vnDate(row.run_date, '—')}</td>
                <td>{vnDate(row.due_date)}<span className="eqa-sub">{daysLeftText(row)}</span></td>
                <td>{row.instruments.length ? <MachineTags row={row} /> : '—'}</td>
                <td>{row.assignee || '—'}</td>
                <td><ScheduleStatusTag row={row} /><span className="eqa-sub">{submittedText(row)}</span></td>
                <td>{actions(row)}</td>
              </tr>)}</tbody>
            </table></div>}
          </>}
        </div>
      </section>
      {layout === 'month' && <div className="eqa-schedule-rail">
        {!schedule.length ? <section className="panel" aria-label="Bắt đầu lập lịch">
          <div className="panel-head"><h2>Bắt đầu lập lịch</h2></div>
          <div className="eqa-section-body">
            <EmptyState size="compact" title="Chưa khai lịch ngoại kiểm" action={writable ? <button type="button" className="btn" onClick={() => startNew()}>Thêm đợt đầu tiên</button> : undefined}>Thêm đợt đầu tiên, hoặc chọn ngày trên lịch để đặt hạn nộp.</EmptyState>
            <ol className="eqa-schedule-steps">
              <li><span className="step-number" aria-hidden="true">1</span><div><b>Chọn chương trình và đợt</b><span className="eqa-sub">Kèm loại mẫu và máy tham gia.</span></div></li>
              <li><span className="step-number" aria-hidden="true">2</span><div><b>Đặt các mốc thời gian</b><span className="eqa-sub">Ngày chạy mẫu → Hạn nộp kết quả.</span></div></li>
              <li><span className="step-number" aria-hidden="true">3</span><div><b>Theo dõi ngay trên lịch</b><span className="eqa-sub">Xem việc đến hạn và ghi nhận nộp từng máy.</span></div></li>
            </ol>
            <div className="eqa-schedule-picked-date" aria-live="polite"><span className="eqa-note">Ngày đang chọn trên lịch</span><b>{vnDate(selectedDay)}</b>{writable && <button type="button" className="btn ghost sm" onClick={() => startNew(selectedDay)}>Dùng làm hạn nộp</button>}</div>
          </div>
        </section> :
        <section className="panel" aria-label="Công việc ngày được chọn">
          <div className="panel-head"><h2>Công việc ngày {vnDate(selectedDay)}</h2></div>
          <div className="eqa-section-body" aria-live="polite">{dayRows.length ? <ul className="eqa-schedule-tasks">{dayRows.map(({ row, kinds }) => task(row, kinds))}</ul> : <EmptyState size="compact" title="Không có công việc trong ngày này" action={writable ? <button type="button" className="btn ghost sm" onClick={() => startNew(selectedDay)}>Dùng làm hạn nộp</button> : undefined}>{sampleFilter ? `Đang lọc loại mẫu ${sampleFilter}.` : 'Chọn ngày có mốc để xem công việc, hoặc lập đợt với hạn nộp ngày này.'}</EmptyState>}</div>
        </section>
        }
      </div>}
    </div>
    {editing && <EqaScheduleModal row={editing === 'new' ? null : editing} initialDueDate={newDueDate} onClose={() => setEditing(null)} />}
    {submitting && <EqaSubmitModal row={submitting} onClose={() => setSubmitting(null)} />}
  </div>;
}
